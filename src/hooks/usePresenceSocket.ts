"use client";

import { useEffect } from "react";
import { getPresenceSocket } from "@/lib/presence-socket";
import { useDmStore } from "@/stores/dm.store";
import type { PresenceChangedEvent } from "@/types/chat";

export function usePresenceSocket() {
  const { setOnline } = useDmStore();

  useEffect(() => {
    const socket = getPresenceSocket();

    const onPresenceChanged = ({ userId, isOnline, lastSeenAt }: PresenceChangedEvent) => {
      setOnline(userId, isOnline, lastSeenAt);
    };

    socket.on("presence:changed", onPresenceChanged);

    // Re-subscribe on reconnect
    const onConnect = () => {
      socket.emit("presence:subscribe");
    };
    if (socket.connected) onConnect();
    socket.on("connect", onConnect);

    return () => {
      socket.off("presence:changed", onPresenceChanged);
      socket.off("connect", onConnect);
    };
  }, [setOnline]);
}
