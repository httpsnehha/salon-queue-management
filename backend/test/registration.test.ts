import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../src/app.js";
import { initializeDatabase } from "../src/queueRepository.js";

type Fixture = { db: DatabaseSync; url: string; server: Server };

async function startServer(db: DatabaseSync, options: { timeZone?: string; now?: () => Date } = {}) {
  const server = createServer(createApp(db, options));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start.");
  return { server, url: "http://127.0.0.1:" + address.port };
}

async function stopServer(server: Server) {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function fixture(t: TestContext, options: { timeZone?: string; now?: () => Date } = {}): Promise<Fixture> {
  const db = new DatabaseSync(":memory:");
  initializeDatabase(db);
  const running = await startServer(db, options);
  t.after(async () => {
    await stopServer(running.server);
    db.close();
  });
  return { db, ...running };
}

async function postRegistration(url: string, payload: unknown) {
  const response = await fetch(url + "/api/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { response, body: await response.json() as Record<string, unknown> };
}

const validInput = {
  customerName: "Asha Mehta",
  phoneNumber: "+91 98765 43210",
  serviceId: "signature-cut",
};

test("services are served from SQLite with the homepage sample values", async (t) => {
  const { url } = await fixture(t);
  const response = await fetch(url + "/api/services");
  const services = await response.json() as Array<Record<string, unknown>>;
  assert.equal(response.status, 200);
  assert.equal(services.length, 6);
  const haircut = services.find((service) => service.id === "signature-cut");
  assert.equal(haircut?.price, 600);
  assert.equal(haircut?.duration_minutes, 45);
  const created = await postRegistration(url, { ...validInput, serviceName: "Forged", servicePrice: 1, serviceDurationMinutes: 1 });
  assert.equal(created.body.serviceName, "Signature Haircut");
  assert.equal(created.body.servicePrice, 600);
  assert.equal(created.body.serviceDurationMinutes, 45);
});

test("required fields, phone, and database service selection are validated without consuming a token", async (t) => {
  const { url } = await fixture(t);
  const invalidInputs = [
    {},
    { ...validInput, customerName: " " },
    { ...validInput, phoneNumber: "abc" },
    { ...validInput, serviceId: "unavailable-service" },
  ];

  for (const input of invalidInputs) {
    const { response, body } = await postRegistration(url, input);
    assert.equal(response.status, 400);
    assert.equal(typeof body.message, "string");
  }

  const valid = await postRegistration(url, validInput);
  assert.equal(valid.response.status, 201);
  assert.equal(valid.body.token, "#001");
});

test("the registration response ID retrieves that customer's queue status", async (t) => {
  const { url } = await fixture(t);
  const created = await postRegistration(url, validInput);
  assert.equal(created.response.status, 201);
  assert.equal(typeof created.body.id, "string");

  const statusResponse = await fetch(url + "/api/registrations/" + encodeURIComponent(String(created.body.id)));
  const status = await statusResponse.json() as Record<string, unknown>;
  assert.equal(statusResponse.status, 200);
  assert.equal(status.id, created.body.id);
  assert.equal(status.customer_name, validInput.customerName);

  const placeholderResponse = await fetch(url + "/api/registrations/demo");
  assert.equal(placeholderResponse.status, 404);
});
test("tokens are sequential and canceled tokens are not reused", async (t) => {
  const { db, url } = await fixture(t);
  const first = await postRegistration(url, validInput);
  assert.equal(first.body.token, "#001");

  db.prepare("UPDATE queue_entries SET status='Cancelled' WHERE id=?").run(first.body.id);

  const next = await postRegistration(url, { ...validInput, customerName: "Nisha Rao" });
  assert.equal(next.body.token, "#002");
});

test("simultaneous registration requests receive unique sequential tokens", async (t) => {
  const { url } = await fixture(t);
  const requests = Array.from({ length: 16 }, (_, index) =>
    postRegistration(url, { ...validInput, customerName: "Customer " + String(index + 1) }),
  );
  const results = await Promise.all(requests);
  assert.ok(results.every((result) => result.response.status === 201));
  const tokens = results.map((result) => result.body.tokenNumber as number).sort((a, b) => a - b);
  assert.deepEqual(tokens, Array.from({ length: 16 }, (_, index) => index + 1));
});

test("token resets at midnight in the configured Asia/Kolkata timezone", async (t) => {
  let currentTime = new Date("2026-11-24T18:29:00.000Z");
  const { url } = await fixture(t, { timeZone: "Asia/Kolkata", now: () => currentTime });
  const beforeMidnight = await postRegistration(url, validInput);
  assert.equal(beforeMidnight.body.tokenDate, "2026-11-24");
  assert.equal(beforeMidnight.body.token, "#001");

  currentTime = new Date("2026-11-24T18:30:00.000Z");
  const afterMidnight = await postRegistration(url, { ...validInput, customerName: "Nisha Rao" });
  assert.equal(afterMidnight.body.tokenDate, "2026-11-25");
  assert.equal(afterMidnight.body.token, "#001");
});

test("a failed database insert rolls back and does not consume a token", async (t) => {
  const { db, url } = await fixture(t);
  db.exec(
    "CREATE TRIGGER reject_test_registration BEFORE INSERT ON queue_entries " +
    "WHEN NEW.customer_name='Trigger Failure' BEGIN SELECT RAISE(ABORT, 'test failure'); END"
  );

  const originalConsoleError = console.error;
  console.error = () => {};
  let failed: Awaited<ReturnType<typeof postRegistration>>;
  try {
    failed = await postRegistration(url, { ...validInput, customerName: "Trigger Failure" });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(failed.response.status, 500);

  db.exec("DROP TRIGGER reject_test_registration");
  const succeeding = await postRegistration(url, validInput);
  assert.equal(succeeding.body.token, "#001");
});

test("registration details persist after closing and reopening the backend database", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "salon-queue-persistence-"));
  const databasePath = join(directory, "test.sqlite");
  let db: DatabaseSync | undefined;
  let server: Server | undefined;

  t.after(async () => {
    if (server) await stopServer(server);
    if (db) db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  db = new DatabaseSync(databasePath, { timeout: 5000 });
  initializeDatabase(db);
  let running = await startServer(db);
  server = running.server;
  const created = await postRegistration(running.url, validInput);
  assert.equal(created.response.status, 201);

  await stopServer(server);
  server = undefined;
  db.close();
  db = undefined;

  db = new DatabaseSync(databasePath, { timeout: 5000 });
  initializeDatabase(db);
  running = await startServer(db);
  server = running.server;
  const response = await fetch(running.url + "/api/registrations/" + String(created.body.id));
  const saved = await response.json() as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(saved.customer_name, "Asha Mehta");
  assert.equal(saved.service_name, "Signature Haircut");
  assert.equal(saved.token_number, 1);
  assert.equal(saved.service_price, 600);
  assert.equal(saved.service_duration_minutes, 45);
  assert.equal(saved.status, "Waiting");
  assert.equal("phone_number" in saved, false);
});