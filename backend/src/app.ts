import cors from "cors";
import express from "express";
import type { DatabaseSync } from "node:sqlite";
import { getRegistration, getServices, registerCustomer, RegistrationError, type RegistrationInput } from "./queueRepository.js";

type AppOptions = { timeZone?: string; now?: () => Date };

export function createApp(db: DatabaseSync, options: AppOptions = {}) {
  const app = express();
  const timeZone = options.timeZone ?? process.env.QUEUE_TIME_ZONE ?? "Asia/Kolkata";
  const now = options.now ?? (() => new Date());

  app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());
  app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/api/services", (_request, response) => response.json(getServices(db)));

  app.post("/api/registrations", (request, response) => {
    try {
      const registration = registerCustomer(db, request.body ?? {} as RegistrationInput, now(), timeZone);
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

  return app;
}