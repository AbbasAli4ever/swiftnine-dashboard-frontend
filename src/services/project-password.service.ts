import { api } from "@/lib/api";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface ProjectPasswordResult {
  id: string;
  workspaceId: string;
  passwordUpdatedAt: string;
}

export interface ProjectLockStatus {
  projectId: string;
  isLocked: boolean;
  isUnlocked: boolean;
  unlockedUntil: string | null;
  passwordUpdatedAt: string | null;
}

export interface ProjectUnlockResult {
  projectId: string;
  isLocked: boolean;
  unlockedUntil: string | null;
}

export function getApiErrorCode(error: unknown): string | null {
  const payload = (error as { response?: { data?: unknown } })?.response?.data ?? error;
  const p = payload as { message?: { code?: string }; code?: string } | null;
  return p?.message?.code ?? p?.code ?? null;
}

export const projectPasswordService = {
  setPassword: (projectId: string, password: string) =>
    api
      .post<ApiWrapper<ProjectPasswordResult>>(
        `/projects/${projectId}/password`,
        { password }
      )
      .then((r) => r.data.data),

  changePassword: (projectId: string, currentPassword: string, newPassword: string) =>
    api
      .put<ApiWrapper<ProjectPasswordResult>>(
        `/projects/${projectId}/password`,
        { currentPassword, newPassword }
      )
      .then((r) => r.data.data),

  removePassword: (projectId: string) =>
    api
      .delete<ApiWrapper<null>>(`/projects/${projectId}/password`)
      .then((r) => r.data.data),

  unlock: (projectId: string, password: string) =>
    api
      .post<ApiWrapper<ProjectUnlockResult>>(
        `/projects/${projectId}/unlock`,
        { password }
      )
      .then((r) => r.data.data),

  lockStatus: (projectId: string) =>
    api
      .get<ApiWrapper<ProjectLockStatus>>(
        `/projects/${projectId}/lock-status`
      )
      .then((r) => r.data.data),

  requestReset: (projectId: string) =>
    api
      .post<ApiWrapper<null>>(
        `/projects/${projectId}/password/reset-request`
      )
      .then((r) => r.data.data),

  confirmReset: (projectId: string, token: string, newPassword: string) =>
    api
      .post<ApiWrapper<{ projectId: string; passwordUpdatedAt: string }>>(
        `/projects/${projectId}/password/reset-confirm`,
        { token, newPassword }
      )
      .then((r) => r.data.data),
};
