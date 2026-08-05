import type { TaskSearchScope } from "@/stores/task-search.store";
import type { TaskSearchParams } from "@/services/task.service";
import type { OverviewPeriod } from "@/services/accounting.service";

export const queryKeys = {
  workspaceMembers: (workspaceId: string | null) =>
    ["workspace-members", workspaceId] as const,
  taskLists: (projectId: string, includeArchived = false) =>
    ["task-lists", projectId, { includeArchived }] as const,
  taskBoardInfinite: (scope: TaskSearchScope, params: TaskSearchParams) =>
    ["task-board-infinite", scope, params] as const,
  taskBoard: (projectId: string, params: TaskSearchParams) =>
    ["task-board", projectId, params] as const,

  universityDashboard: () => ["university", "dashboard"] as const,
  universityCourses: (params: unknown) =>
    ["university", "courses", params] as const,
  universityMyCourses: () => ["university", "my-courses"] as const,
  universityCourseDetail: (courseId: string) =>
    ["university", "course-detail", courseId] as const,
  universityPlaybackSession: (lessonId: string) =>
    ["university", "playback-session", lessonId] as const,
  universityLessonNote: (lessonId: string) =>
    ["university", "lesson-note", lessonId] as const,

  projects: (workspaceId: string | null) =>
    ["projects", workspaceId] as const,
  archivedProjects: (workspaceId: string | null) =>
    ["projects", workspaceId, "archived"] as const,
  projectDashboard: (projectId: string) =>
    ["project-dashboard", projectId] as const,
  profile: () => ["profile"] as const,
  myTasks: (workspaceId: string | null) =>
    ["my-tasks", workspaceId] as const,
  docs: (workspaceId: string | null) => ["docs", workspaceId] as const,
  channels: (workspaceId: string | null) =>
    ["channels", workspaceId] as const,
  favorites: (workspaceId: string | null) =>
    ["favorites", workspaceId] as const,
  statuses: (projectId: string) => ["statuses", projectId] as const,
  tags: (workspaceId: string | null) => ["tags", workspaceId] as const,
  aiConversations: (workspaceId: string | null) =>
    ["ai-conversations", workspaceId] as const,
  aiConversation: (workspaceId: string | null, id: string | null) =>
    ["ai-conversations", workspaceId, id] as const,

  // Accounting — deliberately NOT workspace-scoped, unlike every key above:
  // the backend's clients/transactions/bank-accounts modules are global ledgers
  // with no workspaceId column. All share the "accounting" root so a mutation
  // can invalidate the derived overview by prefix.
  accountingOverview: (period: OverviewPeriod) =>
    ["accounting", "overview", period] as const,
  accountingClients: (params: unknown) =>
    ["accounting", "clients", params] as const,
  accountingClient: (clientId: string) =>
    ["accounting", "client", clientId] as const,
  accountingClientSearch: (q: string) =>
    ["accounting", "client-search", q] as const,
  accountingTransactions: (params: unknown) =>
    ["accounting", "transactions", params] as const,
  accountingBankAccounts: (params: unknown) =>
    ["accounting", "bank-accounts", params] as const,
} as const;

/** Root key for every accounting query — used for prefix invalidation. */
export const ACCOUNTING_ROOT_KEY = "accounting" as const;
