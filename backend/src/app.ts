import { createHmac, timingSafeEqual } from "node:crypto";
import cors from "cors";
import express from "express";
import type { DatabaseSync } from "node:sqlite";
import {
  getDisplayQueue,
  getRegistration,
  getServices,
  getStaffQueue,
  registerCustomer,
  RegistrationError,
  QueueEntryNotFoundError,
  QueueTransitionError,
  updateQueueStatus,
  type RegistrationInput,
  type QueueStatus,
} from "./queueRepository.js";

type StatusUpdate = { registrationId: string; status: QueueStatus };
type AppOptions = {
  timeZone?: string;
  now?: () => Date;
  staffAccessCode?: string;
  sessionSecret?: string;
  sessionTtlSeconds?: number;
  onStatusChanged?: (update: StatusUpdate) => void;
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
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) return item.slice(separator + 1).trim();
  }
  return undefined;
}

function hasValidSession(cookieHeader: string | undefined, secret: string, now: Date) {
  const value = readCookie(cookieHeader, cookieName);
  if (!value) return false;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return false;

  const payload = value.slice(0, separator);
  const receivedSignature = Buffer.from(value.slice(separator + 1), "base64url");
  const expectedSignature = Buffer.from(sign(payload, secret), "base64url");
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) {
    return false;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { expiresAt?: unknown };
    return typeof session.expiresAt === "number" && session.expiresAt > Math.floor(now.getTime() / 1000);
  } catch {
    return false;
  }
}

function isValidAccessCode(supplied: unknown, expected: string) {
  if (typeof supplied !== "string") return false;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length) {
    const padded = Buffer.alloc(expectedBytes.length);
    suppliedBytes.copy(padded, 0, 0, Math.min(suppliedBytes.length, padded.length));
    timingSafeEqual(expectedBytes, padded);
    return false;
  }
  return timingSafeEqual(suppliedBytes, expectedBytes);
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

  function hasStaffSession(request: express.Request) {
    return sessionSecret.length >= 32 && hasValidSession(request.headers.cookie, sessionSecret, now());
  }

  function requestComesFromFrontend(request: express.Request) {
    return request.get("origin") === allowedOrigin;
  }

  app.use(cors({ origin: allowedOrigin, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE"] }));
  app.use(express.json());
  app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/api/services", (_request, response) => response.json(getServices(db)));

  app.post("/api/registrations", (request, response) => {
    try {
      const registration = registerCustomer(db, (request.body ?? {}) as RegistrationInput, now(), timeZone);
      response.status(201).json(registration);
    } catch (error) {
      if (error instanceof RegistrationError) {
        response.status(400).json({ message: error.message });
        return;
      }
      console.error("Unable to create queue registration:", error);
      response.status(500).json({ message: "Registration could not be completed. Please try again." });
    }
  });

  app.get("/api/registrations/:id", (request, response) => {
    const registration = getRegistration(db, request.params.id);
    if (!registration) {
      response.status(404).json({ message: "This queue registration could not be found." });
      return;
    }
    response.json(registration);
  });

  app.get("/api/display/queue", (_request, response) => {
    response.json(getDisplayQueue(db, now(), timeZone));
  });

  app.post("/api/staff/session", (request, response) => {
    if (!requestComesFromFrontend(request)) {
      response.status(403).json({ message: "This request origin is not allowed." });
      return;
    }
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
    const maxAge = "Max-Age=" + sessionTtlSeconds;
    const secure = secureCookie ? "; Secure" : "";
    response.setHeader("Set-Cookie", cookieName + "=" + cookieValue + "; Path=/; HttpOnly; SameSite=" + sameSite + "; " + maxAge + secure);
    response.json({ authenticated: true, expiresAt });
  });

  app.delete("/api/staff/session", (request, response) => {
    if (!requestComesFromFrontend(request)) {
      response.status(403).json({ message: "This request origin is not allowed." });
      return;
    }
    const secure = secureCookie ? "; Secure" : "";
    response.setHeader("Set-Cookie", cookieName + "=; Path=/; HttpOnly; SameSite=" + sameSite + "; Max-Age=0" + secure);
    response.status(204).end();
  });

  app.get("/api/staff/queue", (request, response) => {
    if (!hasStaffSession(request)) {
      response.status(401).json({ message: "A valid staff session is required." });
      return;
    }
    response.json({ entries: getStaffQueue(db, now(), timeZone) });
  });

  app.patch("/api/staff/queue/:id/status", (request, response) => {
    if (!requestComesFromFrontend(request)) {
      response.status(403).json({ message: "This request origin is not allowed." });
      return;
    }
    if (!hasStaffSession(request)) {
      response.status(401).json({ message: "A valid staff session is required." });
      return;
    }

    try {
      const status = updateQueueStatus(db, request.params.id, request.body?.status);
      const update = { registrationId: request.params.id, status };
      notifyStatusChanged(update);
      response.json(update);
    } catch (error) {
      if (error instanceof QueueEntryNotFoundError) {
        response.status(404).json({ message: error.message });
      } else if (error instanceof QueueTransitionError) {
        response.status(409).json({ message: error.message });
      } else {
        console.error("Unable to update queue status:", error);
        response.status(500).json({ message: "Queue status could not be updated. Please try again." });
      }
    }
  });

  return app;
}