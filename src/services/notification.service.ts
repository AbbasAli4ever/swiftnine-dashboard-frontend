import { api } from "@/lib/api";
import { getAccessToken } from "@/stores/auth.store";
import { getActiveWorkspaceId } from "@/stores/workspace.store";
import { Notification, NotificationSSEHandlers } from "@/types/notification";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

type NotificationApiResponse<T> = ApiWrapper<T> | T;

function unwrapNotificationResponse<T>(payload: NotificationApiResponse<T>): T {
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    "data" in payload
  ) {
    return (payload as ApiWrapper<T>).data;
  }

  return payload as T;
}

function getNotificationList(path: "/notifications/cleared" | "/notifications/snoozed"): Promise<Notification[]> {
  return api
    .get<NotificationApiResponse<Notification[]>>(path, {
      params: { _ts: Date.now() },
    })
    .then((r) => unwrapNotificationResponse(r.data));
}

export const notificationService = {
  getCleared: (): Promise<Notification[]> => getNotificationList("/notifications/cleared"),

  getSnoozed: (): Promise<Notification[]> => getNotificationList("/notifications/snoozed"),

  patchRead: (id: string, isRead: boolean): Promise<Notification> =>
    api
      .patch<NotificationApiResponse<Notification>>(`/notifications/${id}/read`, { isRead })
      .then((r) => unwrapNotificationResponse(r.data)),

  patchClear: (id: string, isCleared: boolean): Promise<Notification> =>
    api
      .patch<NotificationApiResponse<Notification>>(`/notifications/${id}/clear`, { isCleared })
      .then((r) => unwrapNotificationResponse(r.data)),

  patchSnooze: (id: string, isSnoozed: boolean, snoozeUntil?: string): Promise<Notification> =>
    api
      .patch<NotificationApiResponse<Notification>>(`/notifications/${id}/snooze`, {
        isSnoozed,
        ...(snoozeUntil ? { snoozeUntil } : {}),
      })
      .then((r) => unwrapNotificationResponse(r.data)),

  openStream: (memberId: string, handlers: NotificationSSEHandlers, signal: AbortSignal): void => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
    const url = `${baseUrl}/notifications/members/${memberId}/stream`;

    const dispatch = (eventName: string, raw: string) => {
      try {
        const payload = JSON.parse(raw);
        if (eventName === "notifications:init") {
          handlers.onInit(Array.isArray(payload) ? payload : []);
        } else if (eventName === "notification:created") {
          handlers.onCreated(payload as Notification);
        } else if (eventName === "notification:updated") {
          handlers.onUpdated(payload as Notification);
        } else if (eventName === "message" && Array.isArray(payload)) {
          // Fallback: backend sent data without an event: line — treat array as init
          handlers.onInit(payload);
        }
      } catch (err) {
        console.warn("[SSE] dispatch error:", err, "event:", eventName, "raw:", raw);
      }
    };

    // Abort-aware sleep — resolves early if signal fires.
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
      });

    const connect = async (): Promise<"done" | "reconnect"> => {
      if (signal.aborted) return "done";

      // Read token fresh on every attempt — handles post-refresh tokens.
      const token = getAccessToken() ?? "";
      const workspaceId = getActiveWorkspaceId() ?? "";

      // If no token or workspace yet (auth still restoring), wait then retry.
      if (!token || !workspaceId) return "reconnect";

      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-workspace-id": workspaceId,
            Accept: "text/event-stream",
          },
          signal,
        });

        // 401/403 = auth failure — stop retrying, nothing will change without a page reload.
        if (res.status === 401 || res.status === 403) return "done";
        // Other non-ok (5xx, network hiccup) → reconnect with backoff.
        if (!res.ok || !res.body) return "reconnect";

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        // Per-event accumulator — reset on blank line (event boundary)
        let currentEvent = "message";
        let currentData = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done || signal.aborted) return "done";

          buf += decoder.decode(value, { stream: true });
          // Normalise \r\n and \r to \n so split works regardless of line endings
          const lines = buf.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              // Accumulate data (multi-line data fields are joined with \n)
              currentData += (currentData ? "\n" : "") + line.slice(5).trim();
            } else if (line === "") {
              // Blank line = end of event block — dispatch and reset
              if (currentData) {
                dispatch(currentEvent, currentData);
              }
              currentEvent = "message";
              currentData = "";
            }
          }
        }
      } catch {
        if (signal.aborted) return "done";
        return "reconnect"; // network error → reconnect
      }
    };

    const run = async () => {
      let delay = 1000;
      while (!signal.aborted) {
        const result = await connect();
        if (result === "done" || signal.aborted) break;
        // Exponential backoff capped at 30 s, abort-aware.
        await sleep(delay);
        delay = Math.min(delay * 2, 30_000);
      }
    };

    void run();
  },
};
