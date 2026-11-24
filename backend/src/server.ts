import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { database } from "./database.js";
import { configureSocketServer } from "./socket.js";

const app = createApp(database);
const httpServer = createServer(app);
const io = configureSocketServer(httpServer);
const port = Number(process.env.PORT ?? 3001);

io.on("connection", () => {
  // Queue realtime events will be added with the relevant staff and display features.
});

httpServer.listen(port, () => {
  console.log("Salon Queue backend listening at http://localhost:" + port);
});