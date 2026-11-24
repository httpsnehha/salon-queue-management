import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { database } from "./database.js";
import { expireCalledCustomers } from "./queueRepository.js";
import { configureSocketServer } from "./socket.js";

const timeZone = process.env.QUEUE_TIME_ZONE ?? "Asia/Kolkata";
let ioRef: ReturnType<typeof configureSocketServer> | undefined;
const app = createApp(database, {
  onStatusChanged: (update) => ioRef?.emit("queue:updated", update),
  onSettingsChanged: () => ioRef?.emit("settings:updated"),
  onServicesChanged: () => ioRef?.emit("services:updated"),
  onBarbersChanged: () => ioRef?.emit("barbers:updated"),
});
const httpServer = createServer(app);
ioRef = configureSocketServer(httpServer);
const port = Number(process.env.PORT ?? 3001);

const noShowTimer = setInterval(() => {
  const expiredIds = expireCalledCustomers(database, new Date(), timeZone);
  for (const registrationId of expiredIds) {
    ioRef?.emit("queue:updated", { registrationId, status: "No-show" });
  }
}, 5000);
noShowTimer.unref();

ioRef.on("connection", () => {
  // Queue and owner-settings screens subscribe to the documented update events.
});

httpServer.listen(port, () => {
  console.log("Salon Queue backend listening at http://localhost:" + port);
});
