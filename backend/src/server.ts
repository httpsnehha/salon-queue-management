import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { database } from "./database.js";
import { configureSocketServer } from "./socket.js";

let broadcastStatusUpdate = (_update: { registrationId: string; status: string }) => {};
const app = createApp(database, { onStatusChanged: (update) => broadcastStatusUpdate(update) });
const httpServer = createServer(app);
const io = configureSocketServer(httpServer);
const port = Number(process.env.PORT ?? 3001);

broadcastStatusUpdate = (update) => {
  io.emit("queue:updated", update);
};

io.on("connection", () => {
  // Connected customer, staff, and display screens subscribe to queue:updated.
});

httpServer.listen(port, () => {
  console.log("Salon Queue backend listening at http://localhost:" + port);
});