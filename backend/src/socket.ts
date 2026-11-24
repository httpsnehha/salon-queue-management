import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

export function configureSocketServer(httpServer: HttpServer) {
  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
    .split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);
  return new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true, methods: ["GET", "POST"] },
  });
}