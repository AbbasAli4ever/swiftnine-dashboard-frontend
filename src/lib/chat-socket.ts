import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/stores/auth.store";
import { toast } from "sonner";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v\d+\/?$/, "") ??
  "http://localhost:3000";

let socket: Socket | null = null;

export function getChatSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.auth = { token: getAccessToken() };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(`${WS_BASE}/chat`, {
    auth: { token: getAccessToken() },
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect_error", (err) => {
    console.error("[chat-socket] connect_error:", err.message);
  });

  // Server emits chat:error on JWT failure then disconnects
  socket.on("chat:error", ({ reason }: { reason: string }) => {
    console.error("[chat-socket] server error:", reason);
    toast.error(`Chat connection error: ${reason}`);
  });

  // Catch WS-level errors (e.g. typing rate limit: "Too many typing events. Please slow down.")
  socket.on("error", (err: Error | string) => {
    const msg = typeof err === "string" ? err : err?.message ?? "Socket error";
    if (msg.toLowerCase().includes("typing")) {
      toast.error("Too many typing events. Please slow down.");
    } else {
      console.error("[chat-socket] error:", msg);
    }
  });

  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
