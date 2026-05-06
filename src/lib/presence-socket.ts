import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/stores/auth.store";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v\d+\/?$/, "") ??
  "http://localhost:3000";

let socket: Socket | null = null;

export function getPresenceSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.auth = { token: getAccessToken() };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(`${WS_BASE}/presence`, {
    auth: { token: getAccessToken() },
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    socket?.emit("presence:subscribe");
  });

  socket.on("connect_error", (err) => {
    console.error("[presence-socket] connect_error:", err.message);
  });

  return socket;
}

export function disconnectPresenceSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
