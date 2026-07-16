import axios from "axios";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/stores/auth.store";
import { getActiveWorkspaceId } from "@/stores/workspace.store";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // sends httpOnly refresh_token cookie automatically
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Attach access token + active workspace id on every outgoing request
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const workspaceId = getActiveWorkspaceId();
  if (workspaceId) {
    config.headers["x-workspace-id"] = workspaceId;
  }

  return config;
});

// ── Shared refresh session ────────────────────────────────────────────────────
// Single in-flight promise shared by every caller (this interceptor,
// universityApi.ts, the socket clients, the SSE streams, and AuthContext).
// This guarantees only ONE /auth/refresh HTTP call fires at a time per tab,
// preventing rotating-token reuse errors when multiple callers race to refresh.
export interface RefreshResult {
  accessToken: string;
  user: import("@/stores/auth.store").AuthUser;
}

let _refreshPromiseFull: Promise<RefreshResult> | null = null;

// The refresh_token cookie is shared across every tab of this origin, and the
// backend rotates it on each use (old token deleted immediately, no reuse
// grace period). Without this lock, two tabs whose access tokens expire
// around the same moment can both fire /auth/refresh with the same cookie;
// the loser presents an already-consumed token and gets rejected. The Web
// Locks API serializes the network call across tabs — the delayed tab still
// succeeds afterwards because it picks up the already-rotated cookie.
function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    return fn();
  }
  return navigator.locks.request("auth-refresh-lock", fn) as Promise<T>;
}

export function refreshSession(): Promise<RefreshResult> {
  if (!_refreshPromiseFull) {
    _refreshPromiseFull = withCrossTabLock(() =>
      api.post<RefreshResult>("/auth/refresh").then((res) => {
        setAccessToken(res.data.accessToken);
        return res.data;
      })
    ).finally(() => {
      _refreshPromiseFull = null;
    });
  }
  return _refreshPromiseFull;
}

export function redirectToLogin() {
  clearAccessToken();
  if (typeof window !== "undefined") {
    window.location.href = "/signin";
  }
}

// ── 401 interceptor ───────────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error.config;
    const url: string = originalConfig?.url ?? "";

    // These endpoints must NEVER trigger a silent refresh — they handle 401
    // as a normal business error (wrong credentials, expired OTP, etc.)
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/verify-email") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password") ||
      url.includes("/auth/google") ||
      url.includes("/unlock") ||
      url.includes("/password");

    // Pass non-401 errors and auth-endpoint 401s straight through
    if (error.response?.status !== 401 || isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Already retried once with a freshly-refreshed token and still got a 401.
    // That means this specific endpoint has its own problem — refreshSession()
    // already proved the session itself is fine — so don't force a global
    // logout, just let the error surface normally to whoever made this call.
    if (originalConfig._retry) {
      return Promise.reject(error);
    }

    // No token in memory → user was never authenticated in this session.
    // There is nothing to refresh, skip straight to login.
    if (!getAccessToken()) {
      redirectToLogin();
      return Promise.reject(error);
    }

    // Mark this request so we don't retry it again
    originalConfig._retry = true;

    try {
      // Deduplicate — shares the same in-flight refresh as every other
      // caller (universityApi, sockets, SSE streams), so a 401 here never
      // races a second, independent /auth/refresh call against them.
      const { accessToken } = await refreshSession();

      // Retry original request with the fresh token
      originalConfig.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalConfig);
    } catch {
      // Refresh failed — cookie expired or missing, send user to login
      redirectToLogin();
      return Promise.reject(error);
    }
  }
);

// ── Error parser ──────────────────────────────────────────────────────────────
// Normalises both backend error shapes into one consistent object.
//
// Shape 1 — custom envelope: { success: false, error: { code, message, details } }
// Shape 2 — bare NestJS:    { statusCode, message, errors? }
//            (422 includes: errors: [{ field, message }])
export function parseApiError(error: unknown): {
  message: string;
  code: string;
  details: { field: string; message: string }[] | null;
} {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return {
        message: "Cannot connect to server. Is the backend running?",
        code: "NETWORK_ERROR",
        details: null,
      };
    }

    const data = error.response.data;
    const status = error.response.status;

    const codeMap: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "UNPROCESSABLE_ENTITY",
      429: "TOO_MANY_REQUESTS",
      500: "INTERNAL_ERROR",
    };

    // Shape 1
    if (data?.error && typeof data.error === "object") {
      return {
        message: data.error.message ?? "Something went wrong",
        code: data.error.code ?? codeMap[status] ?? "UNKNOWN",
        details: data.error.details ?? null,
      };
    }

    // Shape 2
    if (data?.message) {
      const msg = Array.isArray(data.message)
        ? data.message.join(". ")
        : data.message;

      const details: { field: string; message: string }[] | null =
        Array.isArray(data.errors) && data.errors.length > 0
          ? data.errors
          : null;

      return {
        message: msg,
        code: codeMap[status] ?? "UNKNOWN",
        details,
      };
    }

    return {
      message: error.response.statusText || "Something went wrong",
      code: codeMap[status] ?? "UNKNOWN",
      details: null,
    };
  }

  return {
    message: "Something went wrong",
    code: "UNKNOWN",
    details: null,
  };
}
