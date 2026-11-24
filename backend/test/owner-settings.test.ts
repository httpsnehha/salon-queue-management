import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test, { type TestContext } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../src/app.js";
import { initializeDatabase } from "../src/queueRepository.js";

const origin = "http://localhost:5173";
const accessCode = "test-staff-code";
const sessionSecret = "a".repeat(48);
const startDate = new Date("2026-11-24T12:00:00.000Z");

type Fixture = { db: DatabaseSync; url: string; server: Server; now: () => Date; setNow: (date: Date) => void };
async function fixture(t: TestContext): Promise<Fixture> {
  const db = new DatabaseSync(":memory:");
  initializeDatabase(db);
  let current = new Date(startDate);
  const app = createApp(db, {
    timeZone: "Asia/Kolkata",
    now: () => current,
    staffAccessCode: accessCode,
    sessionSecret,
  });
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server did not start.");
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });
  return { db, server, url: "http://127.0.0.1:" + address.port, now: () => current, setNow: (date) => { current = date; } };
}
async function request(url: string, path: string, method = "GET", body?: unknown, cookie?: string) {
  return fetch(url + path, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function login(url: string) {
  const response = await request(url, "/api/staff/session", "POST", { accessCode });
  assert.equal(response.status, 200);
  return (response.headers.get("set-cookie") ?? "").split(";")[0];
}
async function addBarber(url: string, cookie: string, name: string) {
  const response = await request(url, "/api/staff/barbers", "POST", { name }, cookie);
  assert.equal(response.status, 201);
  return await response.json() as { id: string; name: string };
}
async function setDuty(url: string, cookie: string, id: string, onDuty: boolean) {
  return request(url, "/api/staff/barbers/" + id + "/duty", "PATCH", { onDuty }, cookie);
}
async function addRegistration(url: string, payload: Record<string, unknown>, cookie?: string, staff = false) {
  return request(url, staff ? "/api/staff/registrations" : "/api/registrations", "POST", payload, cookie);
}
const registration = (customerName: string, preferredBarberId?: string | null, serviceId = "signature-cut") => ({
  customerName, phoneNumber: "+91 98765 43210", serviceId, preferredBarberId: preferredBarberId ?? null,
});

test("owner settings endpoints require the existing staff session", async (t) => {
  const { url } = await fixture(t);
  assert.equal((await request(url, "/api/staff/services")).status, 401);
  assert.equal((await request(url, "/api/staff/settings")).status, 401);
  assert.equal((await request(url, "/api/staff/barbers")).status, 401);
  assert.equal((await request(url, "/api/staff/statistics")).status, 401);
  assert.equal((await request(url, "/api/staff/services", "POST", { name: "X" })).status, 401);
});

test("service create, edit, and deactivation preserve historical queue snapshots", async (t) => {
  const { url } = await fixture(t);
  const cookie = await login(url);
  const before = await addRegistration(url, registration("Asha Mehta"));
  assert.equal(before.status, 201);
  const created = await request(url, "/api/staff/services", "POST", {
    name: "Color Service", name_gu: "Color Service Gujarati", category: "Hair", description: "Color treatment",
    price: 1500, duration_minutes: 75,
  }, cookie);
  assert.equal(created.status, 201);
  const service = await created.json() as { id: string; is_active: number };
  assert.equal(service.is_active, 1);

  const edit = await request(url, "/api/staff/services/signature-cut", "PATCH", {
    name: "Updated Cut", name_gu: "Updated Gujarati", category: "Hair", description: "Updated description",
    price: 800, duration_minutes: 55,
  }, cookie);
  assert.equal(edit.status, 200);
  const historical = await (await request(url, "/api/registrations/" + String((await before.json() as { id: string }).id))).json() as Record<string, unknown>;
  assert.equal(historical.service_name, "Signature Haircut");
  assert.equal(historical.service_price, 600);
  assert.equal(historical.service_duration_minutes, 45);

  const deactivated = await request(url, "/api/staff/services/signature-cut/active", "PATCH", { active: false }, cookie);
  assert.equal(deactivated.status, 200);
  const publicServices = await (await request(url, "/api/services")).json() as Array<{ id: string }>;
  assert.equal(publicServices.some((item) => item.id === "signature-cut"), false);
  assert.equal((await addRegistration(url, registration("Nisha Rao"))).status, 400);
  const allServices = await (await request(url, "/api/staff/services", "GET", undefined, cookie)).json() as Array<{ id: string; is_active: number }>;
  assert.equal(allServices.find((item) => item.id === "signature-cut")?.is_active, 0);
});

test("closed online queue rejects customers but staff can register walk-ins", async (t) => {
  const { url } = await fixture(t);
  const cookie = await login(url);
  const closed = await request(url, "/api/staff/settings/online-queue", "PATCH", { onlineQueueOpen: false }, cookie);
  assert.equal(closed.status, 200);
  const publicSettings = await (await request(url, "/api/public/settings")).json() as { onlineQueueOpen: boolean };
  assert.equal(publicSettings.onlineQueueOpen, false);
  const online = await addRegistration(url, registration("Online Customer"));
  assert.equal(online.status, 409);
  assert.match((await online.json() as { message: string }).message, /closed/i);
  const walkIn = await addRegistration(url, registration("Walk-in Customer"), cookie, true);
  assert.equal(walkIn.status, 201);
  assert.equal((await walkIn.json() as { token: string }).token, "#001");
});

test("barber choice, break state, FCFS eligibility, and single chair assignment are enforced", async (t) => {
  const { url } = await fixture(t);
  const cookie = await login(url);
  const barberA = await addBarber(url, cookie, "Barber A");
  const barberB = await addBarber(url, cookie, "Barber B");
  assert.equal((await setDuty(url, cookie, barberA.id, true)).status, 200);
  assert.equal((await setDuty(url, cookie, barberB.id, true)).status, 200);

  const onBreak = await request(url, "/api/staff/barbers/" + barberB.id + "/break", "PATCH", { onBreak: true }, cookie);
  assert.equal(onBreak.status, 200);
  const rejected = await addRegistration(url, registration("Break Preference", barberB.id));
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json() as { message: string }).message, /break/i);
  await request(url, "/api/staff/barbers/" + barberB.id + "/break", "PATCH", { onBreak: false }, cookie);

  const pinnedB = await addRegistration(url, registration("Pinned B", barberB.id));
  const any = await addRegistration(url, registration("Any Barber"));
  const pinnedA = await addRegistration(url, registration("Pinned A", barberA.id));
  assert.equal(pinnedB.status, 201); assert.equal(any.status, 201); assert.equal(pinnedA.status, 201);
  const callA = await request(url, "/api/staff/queue/call-next/" + barberA.id, "POST", {}, cookie);
  const calledA = await callA.json() as { token_number: number };
  assert.equal(calledA.token_number, 2);
  const start = await request(url, "/api/staff/queue/" + String((await any.json() as { id: string }).id) + "/status", "PATCH", { status: "In chair" }, cookie);
  assert.equal(start.status, 200);
  const secondCallA = await request(url, "/api/staff/queue/call-next/" + barberA.id, "POST", {}, cookie);
  assert.equal(secondCallA.status, 409);
  const bCall = await request(url, "/api/staff/queue/call-next/" + barberB.id, "POST", {}, cookie);
  assert.equal((await bCall.json() as { token_number: number }).token_number, 1);
  const assigned = await (await request(url, "/api/registrations/" + String((await pinnedB.json() as { id: string }).id))).json() as { assigned_barber_id: string };
  assert.equal(assigned.assigned_barber_id, barberB.id);
  const cannotTakeBreak = await request(url, "/api/staff/barbers/" + barberB.id + "/break", "PATCH", { onBreak: true }, cookie);
  assert.equal(cannotTakeBreak.status, 400);
});

test("called customers become no-shows at ten minutes and actual wait statistics use service start time", async (t) => {
  const { db, url, setNow } = await fixture(t);
  const cookie = await login(url);
  const barber = await addBarber(url, cookie, "Barber A");
  await setDuty(url, cookie, barber.id, true);

  const firstResponse = await addRegistration(url, registration("Served Customer"));
  const first = await firstResponse.json() as { id: string };
  setNow(new Date(startDate.getTime() + 3 * 60_000));
  assert.equal((await request(url, "/api/staff/queue/call-next/" + barber.id, "POST", {}, cookie)).status, 200);
  setNow(new Date(startDate.getTime() + 8 * 60_000));
  assert.equal((await request(url, "/api/staff/queue/" + first.id + "/status", "PATCH", { status: "In chair" }, cookie)).status, 200);
  setNow(new Date(startDate.getTime() + 20 * 60_000));
  assert.equal((await request(url, "/api/staff/queue/" + first.id + "/status", "PATCH", { status: "Done" }, cookie)).status, 200);

  const secondResponse = await addRegistration(url, registration("No-show Customer"));
  const second = await secondResponse.json() as { id: string };
  assert.equal((await request(url, "/api/staff/queue/call-next/" + barber.id, "POST", {}, cookie)).status, 200);
  setNow(new Date(startDate.getTime() + 29 * 60_000 + 59_000));
  let queueResponse = await request(url, "/api/staff/queue", "GET", undefined, cookie);
  let queue = await queueResponse.json() as { entries: Array<{ id: string; status: string }> };
  assert.equal(queue.entries.find((entry) => entry.id === second.id)?.status, "Called");
  setNow(new Date(startDate.getTime() + 30 * 60_000));
  queueResponse = await request(url, "/api/staff/queue", "GET", undefined, cookie);
  queue = await queueResponse.json() as { entries: Array<{ id: string; status: string }> };
  assert.equal(queue.entries.find((entry) => entry.id === second.id)?.status, "No-show");
  const stats = await (await request(url, "/api/staff/statistics", "GET", undefined, cookie)).json() as {
    customersServed: number; averageWaitingMinutes: number | null; noShows: number;
  };
  assert.equal(stats.customersServed, 1);
  assert.equal(stats.averageWaitingMinutes, 8);
  assert.equal(stats.noShows, 1);
  assert.equal((db.prepare("SELECT status FROM queue_entries WHERE id=?").get(second.id) as { status: string }).status, "No-show");
});

test("existing SQLite schema migrates idempotently and preserves records and service snapshots", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE services (id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,price INTEGER NOT NULL,duration_minutes INTEGER NOT NULL,is_active INTEGER NOT NULL DEFAULT 1)");
    db.prepare("INSERT INTO services VALUES (?,?,?,?,?,?,1)").run("signature-cut", "Signature Haircut", "Hair", "Old description", 600, 45);
    db.exec("CREATE TABLE queue_entries (id TEXT PRIMARY KEY,customer_name TEXT NOT NULL,phone_number TEXT NOT NULL,service_id TEXT NOT NULL,service_name TEXT NOT NULL,service_price INTEGER NOT NULL,service_duration_minutes INTEGER NOT NULL,token_date TEXT NOT NULL,token_number INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('Waiting','In Service','Completed','Cancelled')),registered_at TEXT NOT NULL,UNIQUE(token_date,token_number))");
    db.prepare("INSERT INTO queue_entries VALUES (?,?,?,?,?,?,?,?,?,?,?)").run("old-in-service","Asha","1234567","signature-cut","Historical Cut",500,30,"2026-11-24",1,"In Service","2026-11-24T11:00:00.000Z");
    db.prepare("INSERT INTO queue_entries VALUES (?,?,?,?,?,?,?,?,?,?,?)").run("old-completed","Mira","1234567","signature-cut","Completed Cut",550,35,"2026-11-24",2,"Completed","2026-11-24T11:10:00.000Z");
    initializeDatabase(db);
    initializeDatabase(db);
    const entries = db.prepare("SELECT id,status,service_name,service_price,service_duration_minutes,service_name_gu FROM queue_entries ORDER BY token_number").all() as Array<Record<string, unknown>>;
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map((item) => item.status), ["In chair", "Done"]);
    assert.equal(entries[0].service_name, "Historical Cut");
    assert.equal(entries[0].service_price, 500);
    assert.equal(entries[0].service_duration_minutes, 30);
    assert.ok(typeof entries[0].service_name_gu === "string");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM services").get().n, 6);
  } finally { db.close(); }
});

test("earlier cancelled and no-show records remain available in protected history", async (t) => {
  const { db, url, setNow } = await fixture(t);
  const cookie = await login(url);
  const response = await addRegistration(url, registration("Historical Customer"));
  const entry = await response.json() as { id: string };
  await request(url, "/api/staff/queue/" + entry.id + "/status", "PATCH", { status: "Cancelled" }, cookie);
  setNow(new Date(startDate.getTime() + 7 * 60 * 60 * 1000));
  db.prepare("UPDATE queue_entries SET token_date=? WHERE id=?").run("2026-11-23", entry.id);
  const denied = await request(url, "/api/staff/history");
  assert.equal(denied.status, 401);
  const history = await (await request(url, "/api/staff/history", "GET", undefined, cookie)).json() as { entries: Array<{ id: string; status: string }> };
  assert.deepEqual(history.entries.map((item) => [item.id, item.status]), [[entry.id, "Cancelled"]]);
});

test("configured Vercel origin receives credentialed CORS and may start a staff session", async (t) => {
  const previous = process.env.FRONTEND_ORIGIN;
  const vercelOrigin = "https://maison-rose.vercel.app";
  process.env.FRONTEND_ORIGIN = "http://localhost:5173," + vercelOrigin;
  let running: Fixture;
  try { running = await fixture(t); } finally {
    if (previous === undefined) delete process.env.FRONTEND_ORIGIN;
    else process.env.FRONTEND_ORIGIN = previous;
  }
  const preflight = await fetch(running.url + "/api/staff/session", {
    method: "OPTIONS",
    headers: { Origin: vercelOrigin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
  });
  assert.equal(preflight.headers.get("access-control-allow-origin"), vercelOrigin);
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
  const loginResponse = await fetch(running.url + "/api/staff/session", {
    method: "POST", headers: { Origin: vercelOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ accessCode }),
  });
  assert.equal(loginResponse.status, 200);
  assert.match(loginResponse.headers.get("set-cookie") ?? "", /HttpOnly/i);
});
