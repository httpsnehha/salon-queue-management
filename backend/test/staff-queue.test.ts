import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { Server as SocketServer } from "socket.io";
import { io as createSocketClient, type Socket } from "socket.io-client";
import { createApp } from "../src/app.js";
import { configureSocketServer } from "../src/socket.js";
import { createBarber, initializeDatabase, registerCustomer, setBarberDuty } from "../src/queueRepository.js";

const accessCode = randomBytes(24).toString("base64url");
const sessionSecret = randomBytes(48).toString("base64url");
const origin = "http://localhost:5173";
const fixedNow = new Date("2026-11-24T12:00:00.000Z");

type Fixture = {
  db: DatabaseSync;
  url: string;
  httpServer: HttpServer;
  socketServer: SocketServer;
};

async function startFixture(
  db: DatabaseSync,
  options: { sessionTtlSeconds?: number; productionCookie?: boolean; now?: () => Date } = {},
) {
  let socketServer: SocketServer | undefined;
  const previousNodeEnv = process.env.NODE_ENV;
  if (options.productionCookie) process.env.NODE_ENV = "production";
  const app = createApp(db, {
    timeZone: "Asia/Kolkata",
    now: options.now ?? (() => fixedNow),
    staffAccessCode: accessCode,
    sessionSecret,
    sessionTtlSeconds: options.sessionTtlSeconds,
    onStatusChanged: (update) => socketServer?.emit("queue:updated", update),
  });
  const httpServer = createServer(app);
  socketServer = configureSocketServer(httpServer);
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start.");
  return { httpServer, socketServer, url: "http://127.0.0.1:" + address.port };
}

async function stopFixture(server: SocketServer, db: DatabaseSync) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
}

async function fixture(t: TestContext, options: { sessionTtlSeconds?: number; productionCookie?: boolean; now?: () => Date } = {}): Promise<Fixture> {
  const db = new DatabaseSync(":memory:", { timeout: 5000 });
  initializeDatabase(db);
  const running = await startFixture(db, options);
  t.after(async () => stopFixture(running.socketServer, db));
  return { db, ...running };
}

async function request(url: string, path: string, init: RequestInit = {}) {
  return fetch(url + path, { ...init, headers: { Origin: origin, ...(init.headers ?? {}) } });
}

async function login(url: string, code = accessCode) {
  const response = await request(url, "/api/staff/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessCode: code }),
  });
  const setCookie = response.headers.get("set-cookie") ?? "";
  return { response, cookie: setCookie.split(";")[0], setCookie, body: await response.json() as Record<string, unknown> };
}

async function createEntry(db: DatabaseSync, name: string, preferredBarberId?: string) {
  return registerCustomer(db, {
    customerName: name,
    phoneNumber: "+91 98765 43210",
    serviceId: "signature-cut",
    preferredBarberId,
  }, fixedNow, "Asia/Kolkata");
}

async function updateStatus(url: string, id: string, status: string, cookie?: string) {
  return request(url, "/api/staff/queue/" + id + "/status", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ status }),
  });
}


async function callNext(url: string, barberId: string, cookie: string) {
  return request(url, "/api/staff/queue/call-next/" + encodeURIComponent(barberId), {
    method: "POST",
    headers: { Cookie: cookie },
  });
}

test("staff queue reads require an authenticated session; credentials never appear in responses", async (t) => {
  const { db, url } = await fixture(t);
  await createEntry(db, "Mira Patel");

  const unauthenticated = await request(url, "/api/staff/queue");
  assert.equal(unauthenticated.status, 401);

  const rejected = await login(url, "wrong-code");
  assert.equal(rejected.response.status, 401);

  const authenticated = await login(url);
  assert.equal(authenticated.response.status, 200);
  assert.equal(authenticated.body.authenticated, true);
  assert.equal(JSON.stringify(authenticated.body).includes(accessCode), false);
  assert.equal(JSON.stringify(authenticated.body).includes(sessionSecret), false);
  assert.match(authenticated.setCookie, /HttpOnly/i);
  assert.match(authenticated.setCookie, /SameSite=Lax/i);
  assert.equal(authenticated.setCookie.includes(sessionSecret), false);

  const queue = await request(url, "/api/staff/queue", { headers: { Cookie: authenticated.cookie } });
  const body = await queue.json() as { entries: Array<Record<string, unknown>> };
  assert.equal(queue.status, 200);
  assert.equal(body.entries.length, 1);
  assert.equal(body.entries[0].customer_name, "Mira Patel");
});

test("production staff cookies are Secure and SameSite=None", async (t) => {
  const { url } = await fixture(t, { productionCookie: true });
  const authenticated = await login(url);
  assert.equal(authenticated.response.status, 200);
  assert.match(authenticated.setCookie, /HttpOnly/i);
  assert.match(authenticated.setCookie, /SameSite=None/i);
  assert.match(authenticated.setCookie, /Secure/i);
});

test("staff sessions expire and unauthenticated status updates are rejected", async (t) => {
  let now = new Date(fixedNow);
  const { db, url } = await fixture(t, { sessionTtlSeconds: 60, now: () => now });
  const entry = await createEntry(db, "Leena Shah");

  const rejectedUpdate = await updateStatus(url, entry.id, "In Service");
  assert.equal(rejectedUpdate.status, 401);
  assert.equal((db.prepare("SELECT status FROM queue_entries WHERE id=?").get(entry.id) as { status: string }).status, "Waiting");

  const authenticated = await login(url);
  assert.equal(authenticated.response.status, 200);
  now = new Date(fixedNow.getTime() + 61_000);
  const expiredUpdate = await updateStatus(url, entry.id, "In Service", authenticated.cookie);
  assert.equal(expiredUpdate.status, 401);
});

test("barber queue actions enforce the documented workflow and retain cancelled records", async (t) => {
  const { db, url } = await fixture(t);
  const barber = createBarber(db, "Barber One");
  setBarberDuty(db, barber.id, "2026-11-24", true);
  const waitingToServe = await createEntry(db, "Asha Mehta", barber.id);
  const waitingToCancel = await createEntry(db, "Nisha Rao");
  const completedCannotReturn = await createEntry(db, "Sana Iyer");
  db.prepare("UPDATE queue_entries SET status='Done' WHERE id=?").run(completedCannotReturn.id);
  const authenticated = await login(url);
  const cookie = authenticated.cookie;

  assert.equal((await updateStatus(url, waitingToServe.id, "In chair", cookie)).status, 409);
  const called = await callNext(url, barber.id, cookie);
  assert.equal(called.status, 200);
  assert.equal((await updateStatus(url, waitingToServe.id, "In chair", cookie)).status, 200);
  assert.equal((await updateStatus(url, waitingToServe.id, "Done", cookie)).status, 200);
  assert.equal((db.prepare("SELECT status FROM queue_entries WHERE id=?").get(waitingToServe.id) as { status: string }).status, "Done");

  assert.equal((await updateStatus(url, waitingToCancel.id, "Cancelled", cookie)).status, 200);
  assert.equal((await updateStatus(url, waitingToCancel.id, "Done", cookie)).status, 409);
  assert.equal((await updateStatus(url, waitingToCancel.id, "Waiting", cookie)).status, 409);
  assert.equal((await updateStatus(url, completedCannotReturn.id, "Waiting", cookie)).status, 409);
  assert.equal((await updateStatus(url, waitingToCancel.id, "Unknown", cookie)).status, 409);
  assert.equal((await updateStatus(url, waitingToServe.id, "No-show", cookie)).status, 409);
});

test("queue listing includes today in token order and separates new statuses", async (t) => {
  const { db, url } = await fixture(t);
  const barber = createBarber(db, "Barber One");
  setBarberDuty(db, barber.id, "2026-11-24", true);
  const first = await createEntry(db, "Mira Patel");
  const second = await createEntry(db, "Leena Shah");
  const third = await createEntry(db, "Nisha Rao");
  const authenticated = await login(url);
  const cookie = authenticated.cookie;

  assert.equal((await callNext(url, barber.id, cookie)).status, 200);
  db.prepare("UPDATE queue_entries SET status='Cancelled' WHERE id=?").run(third.id);

  const response = await request(url, "/api/staff/queue", { headers: { Cookie: cookie } });
  const body = await response.json() as { entries: Array<{ id: string; status: string; token_number: number }> };
  assert.equal(response.status, 200);
  assert.deepEqual(body.entries.map((entry) => entry.id), [first.id, second.id, third.id]);
  assert.deepEqual(body.entries.map((entry) => entry.status), ["Called", "Waiting", "Cancelled"]);

  const displayResponse = await request(url, "/api/display/queue");
  const display = await displayResponse.json() as { nowServing: unknown[]; called: unknown[]; upcoming: unknown[] };
  assert.equal(display.nowServing.length, 0);
  assert.equal(display.called.length, 1);
  assert.equal(display.upcoming.length, 1);
});

test("Call Next emits a Socket.IO notification after the database update commits", async (t) => {
  const { db, url } = await fixture(t);
  const barber = createBarber(db, "Barber One");
  setBarberDuty(db, barber.id, "2026-11-24", true);
  const entry = await createEntry(db, "Mira Patel");
  const authenticated = await login(url);

  const client: Socket = createSocketClient(url, { transports: ["websocket"], extraHeaders: { Origin: origin } });
  t.after(() => client.disconnect());
  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve); client.once("connect_error", reject); client.connect();
  });
  const eventPromise = new Promise<{ registrationId: string; status: string }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for queue update.")), 2000);
    client.once("queue:updated", (event: { registrationId: string; status: string }) => { clearTimeout(timeout); resolve(event); });
  });

  const response = await callNext(url, barber.id, authenticated.cookie);
  assert.equal(response.status, 200);
  assert.deepEqual(await eventPromise, { registrationId: entry.id, status: "Called" });
  assert.equal((db.prepare("SELECT status FROM queue_entries WHERE id=?").get(entry.id) as { status: string }).status, "Called");
  const queueResponse = await request(url, "/api/staff/queue", { headers: { Cookie: authenticated.cookie } });
  const queue = await queueResponse.json() as { entries: Array<{ id: string; status: string }> };
  assert.equal(queue.entries.find((item) => item.id === entry.id)?.status, "Called");
});

test("updated queue status persists after closing and reopening the backend database", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "salon-staff-queue-"));
  const databasePath = join(directory, "staff.sqlite");
  let db: DatabaseSync | undefined;
  let running: Awaited<ReturnType<typeof startFixture>> | undefined;

  t.after(async () => {
    if (running) await stopFixture(running.socketServer, db!);
    else if (db) db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  db = new DatabaseSync(databasePath, { timeout: 5000 });
  initializeDatabase(db);
  running = await startFixture(db);
  const barber = createBarber(db, "Barber One");
  setBarberDuty(db, barber.id, "2026-11-24", true);
  const entry = await createEntry(db, "Asha Mehta", barber.id);
  const authenticated = await login(running.url);
  assert.equal((await callNext(running.url, barber.id, authenticated.cookie)).status, 200);
  assert.equal((await updateStatus(running.url, entry.id, "In chair", authenticated.cookie)).status, 200);
  const changed = await updateStatus(running.url, entry.id, "Done", authenticated.cookie);
  assert.equal(changed.status, 200);

  await stopFixture(running.socketServer, db);
  running = undefined;
  db = undefined;

  db = new DatabaseSync(databasePath, { timeout: 5000 });
  initializeDatabase(db);
  running = await startFixture(db);
  const authenticatedAgain = await login(running.url);
  const queueResponse = await request(running.url, "/api/staff/queue", {
    headers: { Cookie: authenticatedAgain.cookie },
  });
  const queue = await queueResponse.json() as { entries: Array<{ id: string; status: string }> };
  assert.equal(queueResponse.status, 200);
  assert.equal(queue.entries.find((item) => item.id === entry.id)?.status, "Done");
});