import { createHmac, timingSafeEqual } from "node:crypto";
import cors from "cors";
import express from "express";
import type { DatabaseSync } from "node:sqlite";
import {
  BarberValidationError,
  expireCalledCustomers,
  getBarbers,
  getCalendarDate,
  getDisplayQueue,
  getQueueSettings,
  getQueueHistory,
  getRegistration,
  getServices,
  getStaffQueue,
  getStatistics,
  QueueClosedError,
  QueueEntryNotFoundError,
  QueueTransitionError,
  RegistrationError,
  saveService,
  ServiceValidationError,
  setBarberBreak,
  setBarberDuty,
  setOnlineQueueOpen,
  setServiceActive,
  callNextForBarber,
  createBarber,
  createWalkIn,
  registerCustomer,
  updateQueueStatus,
  type QueueStatus,
  type RegistrationInput,
} from "./queueRepository.js";

type QueueEvent = { registrationId: string; status: QueueStatus };
type AppOptions = {
  timeZone?: string; now?: () => Date; staffAccessCode?: string; sessionSecret?: string;
  sessionTtlSeconds?: number; onStatusChanged?: (update: QueueEvent) => void;
  onSettingsChanged?: () => void; onServicesChanged?: () => void; onBarbersChanged?: () => void;
};

const cookieName = "salon_staff_session";
const defaultSessionTtlSeconds = 8 * 60 * 60;
function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
function sessionCookieValue(secret: string, expiresAt: number) {
  const payload = Buffer.from(JSON.stringify({ expiresAt })).toString("base64url");
  return payload + "." + sign(payload, secret);
}
function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator >= 0 && item.slice(0, separator).trim() === name) return item.slice(separator + 1).trim();
  }
  return undefined;
}
function hasValidSession(cookieHeader: string | undefined, secret: string, now: Date) {
  const value = readCookie(cookieHeader, cookieName);
  if (!value) return false;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return false;
  const payload = value.slice(0, separator);
  const received = Buffer.from(value.slice(separator + 1), "base64url");
  const expected = Buffer.from(sign(payload, secret), "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { expiresAt?: unknown };
    return typeof session.expiresAt === "number" && session.expiresAt > Math.floor(now.getTime() / 1000);
  } catch { return false; }
}
function isValidAccessCode(supplied: unknown, expected: string) {
  if (typeof supplied !== "string") return false;
  const received = Buffer.from(supplied);
  const actual = Buffer.from(expected);
  if (received.length !== actual.length) {
    const padded = Buffer.alloc(actual.length);
    received.copy(padded, 0, 0, Math.min(received.length, padded.length));
    timingSafeEqual(actual, padded);
    return false;
  }
  return timingSafeEqual(received, actual);
}

export function createApp(db: DatabaseSync, options: AppOptions = {}) {
  const app = express();
  const timeZone = options.timeZone ?? process.env.QUEUE_TIME_ZONE ?? "Asia/Kolkata";
  const now = options.now ?? (() => new Date());
  const accessCode = options.staffAccessCode ?? process.env.STAFF_ACCESS_CODE ?? "";
  const sessionSecret = options.sessionSecret ?? process.env.STAFF_SESSION_SECRET ?? "";
  const sessionTtlSeconds = options.sessionTtlSeconds ?? defaultSessionTtlSeconds;
  const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
  const secureCookie = process.env.NODE_ENV === "production";
  const sameSite = secureCookie ? "None" : "Lax";
  const notifyStatusChanged = options.onStatusChanged ?? (() => {});
  const notifySettingsChanged = options.onSettingsChanged ?? (() => {});
  const notifyServicesChanged = options.onServicesChanged ?? (() => {});
  const notifyBarbersChanged = options.onBarbersChanged ?? (() => {});

  function hasStaffSession(request: express.Request) {
    return sessionSecret.length >= 32 && hasValidSession(request.headers.cookie, sessionSecret, now());
  }
  function requestComesFromFrontend(request: express.Request) {
    return request.get("origin") === allowedOrigin;
  }
  function requireStaff(request: express.Request, response: express.Response) {
    if (hasStaffSession(request)) return true;
    response.status(401).json({ message: "A valid staff session is required." });
    return false;
  }
  function requireFrontend(request: express.Request, response: express.Response) {
    if (requestComesFromFrontend(request)) return true;
    response.status(403).json({ message: "This request origin is not allowed." });
    return false;
  }
  function notifyExpired() {
    const ids = expireCalledCustomers(db, now(), timeZone);
    for (const registrationId of ids) notifyStatusChanged({ registrationId, status: "No-show" });
  }

  app.use(cors({ origin: allowedOrigin, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE"] }));
  app.use(express.json());
  app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/api/services", (_request, response) => response.json(getServices(db)));
  app.get("/api/public/settings", (_request, response) => {
    const date = getCalendarDate(now(), timeZone);
    const waitingCount = (db.prepare("SELECT COUNT(*) AS count FROM queue_entries WHERE token_date=? AND status='Waiting'").get(date) as { count: number }).count;
    response.json({ ...getQueueSettings(db), waitingCount, barbers: getBarbers(db, date) });
  });

  app.post("/api/registrations", (request, response) => {
    try {
      const registration = registerCustomer(db, (request.body ?? {}) as RegistrationInput, now(), timeZone);
      notifyStatusChanged({ registrationId: registration.id, status: "Waiting" });
      response.status(201).json(registration);
    } catch (error) {
      if (error instanceof QueueClosedError) response.status(409).json({ message: error.message });
      else if (error instanceof RegistrationError) response.status(400).json({ message: error.message });
      else {
        console.error("Unable to create queue registration:", error);
        response.status(500).json({ message: "Registration could not be completed. Please try again." });
      }
    }
  });
  app.post("/api/registrations/:id", (_request, response) => response.status(405).json({ message: "Method not allowed." }));
  app.get("/api/registrations/:id", (request, response) => {
    notifyExpired();
    const registration = getRegistration(db, request.params.id, now(), timeZone);
    if (!registration) return response.status(404).json({ message: "This queue registration could not be found." });
    response.json(registration);
  });
  app.get("/api/display/queue", (_request, response) => {
    notifyExpired();
    response.json(getDisplayQueue(db, now(), timeZone));
  });

  app.post("/api/staff/session", (request, response) => {
    if (!requireFrontend(request, response)) return;
    if (!accessCode || sessionSecret.length < 32) {
      response.status(503).json({ message: "Staff access is not configured on the backend." });
      return;
    }
    if (!isValidAccessCode(request.body?.accessCode, accessCode)) {
      response.status(401).json({ message: "The staff access code is incorrect." });
      return;
    }
    const expiresAt = Math.floor(now().getTime() / 1000) + sessionTtlSeconds;
    const cookieValue = sessionCookieValue(sessionSecret, expiresAt);
    const secure = secureCookie ? "; Secure" : "";
    response.setHeader("Set-Cookie", cookieName + "=" + cookieValue + "; Path=/; HttpOnly; SameSite=" + sameSite + "; Max-Age=" + sessionTtlSeconds + secure);
    response.json({ authenticated: true, expiresAt });
  });
  app.delete("/api/staff/session", (request, response) => {
    if (!requireFrontend(request, response)) return;
    const secure = secureCookie ? "; Secure" : "";
    response.setHeader("Set-Cookie", cookieName + "=; Path=/; HttpOnly; SameSite=" + sameSite + "; Max-Age=0" + secure);
    response.status(204).end();
  });

  app.get("/api/staff/history", (request, response) => {
    if (!requireStaff(request, response)) return;
    response.json({ entries: getQueueHistory(db, now(), timeZone) });
  });

  app.get("/api/staff/queue", (request, response) => {
    if (!requireStaff(request, response)) return;
    notifyExpired();
    response.json({ entries: getStaffQueue(db, now(), timeZone) });
  });
  app.post("/api/staff/queue/call-next/:barberId", (request, response) => {
    if (!requireFrontend(request, response) || !requireStaff(request, response)) return;
    try {
      const called = callNextForBarber(db, request.params.barberId, now(), timeZone);
      notifyStatusChanged({ registrationId: called.id, status: "Called" });
      response.json(called);
    } catch (error) {
      if (error instanceof BarberValidationError || error instanceof QueueTransitionError) response.status(409).json({ message: error.message });
      else {
        console.error("Unable to call next customer:", error);
        response.status(500).json({ message: "The next customer could not be called." });
      }
    }
  });
  app.post("/api/staff/registrations", (request, response) => {
    if (!requireFrontend(request, response) || !requireStaff(request, response)) return;
    try {
      const registration = createWalkIn(db, (request.body ?? {}) as RegistrationInput, now(), timeZone);
      notifyStatusChanged({ registrationId: registration.id, status: "Waiting" });
      response.status(201).json(registration);
    } catch (error) {
      if (error instanceof RegistrationError) response.status(400).json({ message: error.message });
      else {
        console.error("Unable to register walk-in:", error);
        response.status(500).json({ message: "Walk-in registration could not be completed." });
      }
    }
  });
  app.patch("/api/staff/queue/:id/status", (request, response) => {
    if (!requireFrontend(request, response) || !requireStaff(request, response)) return;
    try {
      const status = updateQueueStatus(db, request.params.id, request.body?.status, now());
      const update = { registrationId: request.params.id, status };
      notifyStatusChanged(update);
      response.json(update);
    } catch (error) {
      if (error instanceof QueueEntryNotFoundError) response.status(404).json({ message: error.message });
      else if (error instanceof QueueTransitionError) response.status(409).json({ message: error.message });
      else {
        console.error("Unable to update queue status:", error);
        response.status(500).json({ message: "Queue status could not be updated. Please try again." });
      }
    }
  });

  app.get("/api/staff/services", (request, response) => {
    if (!requireStaff(request, response)) return;
    response.json(getServices(db, true));
  });
  app.post("/api/staff/services", (request, response) => {
    if (!requireFrontend(request, response) || !requireStaff(request, response)) return;
    try {
      const service = saveService(db, request.body ?? {});
      notifyServicesChanged();
      response.status(201).json(service);
    } catch (error) {
      if (error instanceof ServiceValidationError) response.status(400).json({ message: error.message });
      else {
        console.error("Unable to add service:", error);
        response.status(500).json({ message: "Service could not be saved." });
      }
    }
  });
  app.patch("/api/staff/services/:id", (request, response) => {
    if (!requireFrontend(request, response) || !requireStaff(request, response)) return;
    try {
      const service = saveService(db, request.body ?? {}, request.params.id);
      notifyServicesChanged();
      response.json(service);
    } catch (error) {
      if (error instanceof ServiceValidationError) response.status(400).json({ message: error.message });
      else {
        console.error("Unable to edit service:", error);
        response.status(500).json({ message: "Service could not be updated." });
      }
    }
  });
  app.patch("/api/staff/services/:id/active", (request, response) => {
    if (!requireFrontend(request, response) || !requireStaff(request, response)) return;
    try {
      const service = setServiceActive(db, request.params.id, request.body?.active);
      notifyServicesChanged();
      response.json(service);
    } catch (error) {
      if (error instanceof ServiceValidationError) response.status(400).json({ message: error.message });
      else {
        console.error("Unable to change service availability:", error);
        response.status(500).json({ message: "Service availability could not be changed." });
      }
    }
  });
  app.get("/api/staff/settings", (request, response) => {
    if (!requireStaff(request, response)) return;
    response.json(getQueueSettings(db));
  });
  app.patch("/api/staff/settings/online-queue", (request, response) => {
    if (!requireFrontend(request, response) || !requireStaff(request, response)) return;
    try {
      const settings = setOnlineQueueOpen(db, request.body?.onlineQueueOpen);
      notifySettingsChanged();
      response.json(settings);
    } catch (error) {
      if (error instanceof ServiceValidationError) response.status(400).json({ message: error.message });
      else response.status(500).json({ message: "Queue settings could not be changed." });
    }
  });
  app.get("/api/staff/barbers", (request, response) => {
    if (!requireStaff(request, response)) return;
    response.json(getBarbers(db, getCalendarDate(now(), timeZone), true));
  });
  app.post("/api/staff/barbers", (request, response) => {
    if (!requireFrontend(request, response) || !requireStaff(request, response)) return;
    try {
      const barber = createBarber(db, request.body?.name);
      notifyBarbersChanged();
      response.status(201).json(barber);
    } catch (error) {
      if (error instanceof BarberValidationError || error instanceof RegistrationError) response.status(400).json({ message: error.message });
      else response.status(500).json({ message: "Barber could not be added." });
    }
  });
  app.patch("/api/staff/barbers/:id/duty", (request, response) => {
    if (!requireFrontend(request, response) || !requireStaff(request, response)) return;
    try {
      const barber = setBarberDuty(db, request.params.id, getCalendarDate(now(), timeZone), request.body?.onDuty);
      notifyBarbersChanged();
      response.json(barber);
    } catch (error) {
      if (error instanceof BarberValidationError) response.status(400).json({ message: error.message });
      else response.status(500).json({ message: "Barber availability could not be changed." });
    }
  });
  app.patch("/api/staff/barbers/:id/break", (request, response) => {
    if (!requireFrontend(request, response) || !requireStaff(request, response)) return;
    try {
      const barber = setBarberBreak(db, request.params.id, getCalendarDate(now(), timeZone), request.body?.onBreak);
      notifyBarbersChanged();
      response.json(barber);
    } catch (error) {
      if (error instanceof BarberValidationError) response.status(400).json({ message: error.message });
      else response.status(500).json({ message: "Barber break status could not be changed." });
    }
  });
  app.get("/api/staff/statistics", (request, response) => {
    if (!requireStaff(request, response)) return;
    notifyExpired();
    response.json(getStatistics(db, now(), timeZone));
  });

  return app;
}
