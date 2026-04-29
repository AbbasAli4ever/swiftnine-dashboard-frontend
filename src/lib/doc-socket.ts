import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/stores/auth.store";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v\d+\/?$/, "") ??
  "http://localhost:3000";

let socket: Socket | null = null;

export function getDocSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    // Update auth before reconnecting in case token rotated
    socket.auth = { token: getAccessToken() };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(`${WS_BASE}/docs`, {
    auth: { token: getAccessToken() },
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
  });

  socket.on("connect_error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[doc-socket] connect_error:", err.message);
  });

  socket.on("doc:error", ({ reason }: { reason: string }) => {
    // eslint-disable-next-line no-console
    console.error("[doc-socket] server error:", reason);
  });

  return socket;
}

export function disconnectDocSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
