export const queryKeys = {
  workspaceMembers: (workspaceId: string | null) =>
    ["workspace-members", workspaceId] as const,
  taskLists: (projectId: string, includeArchived = false) =>
    ["task-lists", projectId, { includeArchived }] as const,

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
} as const;
