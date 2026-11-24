import { io } from "socket.io-client";

const socketOrigin = import.meta.env.VITE_API_URL || window.location.origin;

export const queueSocket = io(socketOrigin, {
  path: "/socket.io",
  autoConnect: false,
  withCredentials: true,
});