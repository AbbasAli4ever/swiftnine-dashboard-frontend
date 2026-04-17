import { api } from "@/lib/api";
import { AuthUser } from "@/stores/auth.store";
import { Workspace } from "@/stores/workspace.store";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export type WorkspaceUse = "WORK" | "PERSONAL" | "SCHOOL";
export type WorkspaceManagementType =
  | "HR_RECRUITING" | "CREATIVE_DESIGN" | "PROFESSIONAL_SERVICES"
  | "FINANCE_ACCOUNTING" | "OPERATIONS" | "SOFTWARE_DEVELOPMENT"
  | "IT" | "SALES_CRM" | "PERSONAL_USE" | "SUPPORT"
  | "STARTUP" | "PMO" | "MARKETING" | "OTHER";
export type WorkspaceInviteRole = "OWNER" | "MEMBER";
export type WorkspaceInviteNextStep = "claim_account" | "login";

export interface WorkspaceInvitePreview {
  workspaceId: string;
  workspaceName: string;
  invitedEmail: string;
  role: WorkspaceInviteRole;
  inviterName: string;
  nextStep: WorkspaceInviteNextStep;
}

export interface WorkspaceInviteClaimResult {
  user: AuthUser;
  accessToken: string;
  workspaceId: string;
}

export const workspaceService = {
  list: () =>
    api.get<ApiWrapper<Workspace[]>>("/workspaces").then((r) => r.data.data),

  get: (id: string) =>
    api
      .get<ApiWrapper<Workspace>>(`/workspaces/${id}`, {
        headers: { "x-workspace-id": id },
      })
      .then((r) => r.data.data),

  create: (payload: { name: string; workspaceUse: WorkspaceUse; managementType: WorkspaceManagementType; logoUrl?: string }) =>
    api
      .post<ApiWrapper<Workspace>>("/workspaces", payload)
      .then((r) => r.data.data),

  update: (id: string, payload: { name?: string; logoUrl?: string | null }) =>
    api
      .patch<ApiWrapper<Workspace>>(`/workspaces/${id}`, payload, {
        headers: { "x-workspace-id": id },
      })
      .then((r) => r.data.data),

  delete: (id: string) =>
    api
      .delete(`/workspaces/${id}`, {
        headers: { "x-workspace-id": id },
      })
      .then((r) => r.data),

  inviteBulk: (workspaceId: string, payload: { emails: string[]; role?: WorkspaceInviteRole }) =>
    api
      .post(`/workspaces/${workspaceId}/invites`, payload, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data.data),

  invite: (workspaceId: string, payload: { email: string; role?: WorkspaceInviteRole }) =>
    api
      .post<ApiWrapper<null>>(`/workspaces/${workspaceId}/invite`, payload, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data.message),

  previewInvite: (token: string) =>
    api
      .get<ApiWrapper<WorkspaceInvitePreview>>(`/workspaces/invite/${token}`)
      .then((r) => r.data.data),

  claimInvite: (payload: { token: string; fullName: string; password: string }) =>
    api
      .post<ApiWrapper<WorkspaceInviteClaimResult>>("/workspaces/invite/claim", payload)
      .then((r) => r.data.data),

  acceptInvite: (token: string) =>
    api
      .post<ApiWrapper<{ workspaceId: string }>>("/workspaces/invite/accept", { token })
      .then((r) => r.data.data),
};
