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

export type AiModelTier = "PREMIUM" | "STANDARD";

export interface TokenQuotaStatus {
  /** False for standard-tier members and premium members with no allowance set. */
  metered: boolean;
  tokenLimit: number;
  consumedTokens: number;
  remainingTokens: number;
  percentUsed: number;
  estimatedTokens: number;
  costUsdUsed: number;
  periodStart: string;
  resetsAt: string;
  exhausted: boolean;
  fallbackOptIn: boolean;
  band: "ok" | "warn" | "critical";
}

/**
 * Accounting access, granted per workspace membership — NOT a global user
 * attribute. The same person can be ACCOUNTANT in one workspace and have no
 * accounting access in another. `null` means no access at all.
 */
export type AccountingRole = "CEO" | "ACCOUNTANT";

export interface WorkspaceMember {
  id: string;
  fullName: string;
  email: string;
  role: "OWNER" | "MEMBER";
  /** AI model entitlement in this workspace. Separate from role. */
  aiModelTier: AiModelTier;
  /** Independent of `role` — an OWNER isn't automatically CEO, and a plain
   *  MEMBER can be ACCOUNTANT. Pending invites always report null. */
  accountingRole: AccountingRole | null;
  /**
   * Only populated for rows backed by a pending/rejected invite — an accepted
   * member has no invite record left to report, so this is `null` for everyone
   * who has actually joined. Backend types it `InviteStatus | null`.
   */
  inviteStatus: "PENDING" | "ACCEPTED" | "REJECTED" | null;
  lastActive: string | null;
  invitedBy: string | null;
  invitedOn: string | null;
}

/** `GET /workspaces/:id` — includes the caller's own membership context. */
export interface WorkspaceDetail extends Workspace {
  memberCount: number;
  /** The caller's workspace role in this workspace. */
  role: "OWNER" | "ADMIN" | "MEMBER";
  /** The caller's accounting role in this workspace. */
  accountingRole: AccountingRole | null;
}

export const workspaceService = {
  getMembers: (workspaceId: string) =>
    api
      .get<ApiWrapper<WorkspaceMember[]>>(`/workspaces/${workspaceId}/members`, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data.data),

  removeMember: (workspaceId: string, memberId: string) =>
    api
      .delete(`/organizations/members`, {
        headers: { "x-workspace-id": workspaceId },
        data: { workspaceId, memberId },
      })
      .then((r) => r.data),

  changeMemberRole: (workspaceId: string, memberId: string, role: WorkspaceInviteRole) =>
    api
      .put(`/organizations/members/${memberId}/role`, { workspaceId, role }, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data),

  /**
   * The caller's own membership context for a workspace — this is how the app
   * learns its `accountingRole`, which is no longer on the user/auth response.
   */
  getWorkspace: (workspaceId: string) =>
    api
      .get<ApiWrapper<WorkspaceDetail>>(`/workspaces/${workspaceId}`, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data.data),

  /**
   * Grant or revoke accounting access. OWNER-only server-side; `null` revokes.
   * Mirrors `changeMemberRole` above — same endpoint shape and body convention.
   */
  changeMemberAccountingRole: (
    workspaceId: string,
    memberId: string,
    accountingRole: AccountingRole | null
  ) =>
    api
      .put(
        `/organizations/members/${memberId}/accounting-role`,
        { workspaceId, accountingRole },
        { headers: { "x-workspace-id": workspaceId } }
      )
      .then((r) => r.data),

  // Requires the office-admin secret key in addition to OWNER role — the role
  // gates who sees the action, the secret gates who can complete it.
  changeMemberTier: (
    workspaceId: string,
    memberId: string,
    tier: AiModelTier,
    secret: string,
  ) =>
    api
      .patch(`/workspaces/${workspaceId}/members/${memberId}/ai-tier`, { tier, secret }, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data),

  getTokenAllowance: (workspaceId: string, memberId: string) =>
    api
      .get<ApiWrapper<TokenQuotaStatus>>(
        `/workspaces/${workspaceId}/members/${memberId}/token-allowance`,
        { headers: { "x-workspace-id": workspaceId } },
      )
      .then((r) => r.data.data),

  setTokenAllowance: (
    workspaceId: string,
    memberId: string,
    tokenLimit: number,
    secret: string,
  ) =>
    api
      .patch<ApiWrapper<TokenQuotaStatus>>(
        `/workspaces/${workspaceId}/members/${memberId}/token-allowance`,
        { tokenLimit, secret },
        { headers: { "x-workspace-id": workspaceId } },
      )
      .then((r) => r.data.data),

  resetTokenAllowance: (workspaceId: string, memberId: string, secret: string) =>
    api
      .post<ApiWrapper<TokenQuotaStatus>>(
        `/workspaces/${workspaceId}/members/${memberId}/token-allowance/reset`,
        { secret },
        { headers: { "x-workspace-id": workspaceId } },
      )
      .then((r) => r.data.data),

  /**
   * Cost bounds for an allowance. A single figure is impossible: the same tokens
   * cost the input rate on prompts and the output rate on replies.
   */
  getTokenCostQuote: (tokens: number) =>
    api
      .get<ApiWrapper<{ tokens: number; model: string; minCostUsd: number; maxCostUsd: number }>>(
        `/ai-tier/token-cost-quote`,
        { params: { tokens } },
      )
      .then((r) => r.data.data),

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

  inviteBulk: (
    workspaceId: string,
    payload: {
      emails: string[];
      role?: WorkspaceInviteRole;
      /** Accounting access to grant once the invite is accepted. Omit or send
       *  null for none. Stored on the invite and copied onto the membership
       *  row at acceptance. Note the members list reports `accountingRole:
       *  null` for still-pending invites regardless of what was requested. */
      accountingRole?: AccountingRole | null;
    }
  ) =>
    api
      .post(`/workspaces/${workspaceId}/invites`, payload, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data.data),

  invite: (
    workspaceId: string,
    payload: {
      email: string;
      role?: WorkspaceInviteRole;
      /** Accounting access to grant once the invite is accepted. Omit or send
       *  null for none. Stored on the invite and copied onto the membership
       *  row at acceptance. Note the members list reports `accountingRole:
       *  null` for still-pending invites regardless of what was requested. */
      accountingRole?: AccountingRole | null;
    }
  ) =>
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
