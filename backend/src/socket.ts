import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
export function configureSocketServer(httpServer: HttpServer) {
  return new Server(httpServer, { cors: { origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173", methods: ["GET","POST"] } });
}
