import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

export function configureSocketServer(httpServer: HttpServer) {
  const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
  return new Server(httpServer, {
    cors: { origin: allowedOrigin, credentials: true, methods: ["GET", "POST"] },
  });
}