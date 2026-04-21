import { api } from "@/lib/api";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export type TaskPriority = "URGENT" | "HIGH" | "NORMAL" | "LOW" | "NONE";

export interface TaskStatusInfo {
  id: string;
  name: string;
  color: string;
  group: "NOT_STARTED" | "ACTIVE" | "DONE" | "CLOSED";
}

export interface TaskUserInfo {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  avatarColor: string;
}

export interface TaskAssignee {
  user: TaskUserInfo;
  assignedBy: string;
}

export interface TaskTagInfo {
  tag: {
    id: string;
    name: string;
    color: string;
  };
}

export interface TaskListRef {
  id: string;
  name: string;
  project: { id: string; name: string; taskIdPrefix: string };
}

export interface TaskListItem {
  id: string;
  taskId: string;
  taskNumber: number;
  title: string;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  depth: number;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: TaskStatusInfo;
  assignees: TaskAssignee[];
  tags: TaskTagInfo[];
  list: TaskListRef;
  _count: { children: number };
}

export interface TaskDetail {
  id: string;
  taskId: string;
  taskNumber: number;
  parentId: string | null;
  depth: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  isCompleted: boolean;
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  totalTimeLogged: number;
  status: TaskStatusInfo;
  creator: TaskUserInfo;
  assignees: TaskAssignee[];
  tags: TaskTagInfo[];
  list: TaskListRef;
  children: Omit<TaskListItem, "_count">[];
  timeEntries: TaskTimeEntry[];
}

export interface TaskTimeEntry {
  id: string;
  userId: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  isManual: boolean;
  createdAt: string;
  updatedAt: string;
  user: TaskUserInfo;
}

export interface CreateTaskPayload {
  title: string;
  statusId: string;
  description?: string;
  priority?: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  assigneeIds?: string[];
  tagIds?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  statusId?: string;
  priority?: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  listId?: string;
}

export interface CreateSubtaskPayload {
  title: string;
  statusId: string;
  description?: string | null;
  priority?: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
}

export const taskService = {
  list: (projectId: string, listId: string) =>
    api
      .get<ApiWrapper<TaskListItem[]>>(`/projects/${projectId}/lists/${listId}/tasks`)
      .then((r) => r.data.data),

  get: (taskId: string) =>
    api
      .get<ApiWrapper<TaskDetail>>(`/tasks/${taskId}`)
      .then((r) => r.data.data),

  create: (projectId: string, listId: string, payload: CreateTaskPayload) =>
    api
      .post<ApiWrapper<TaskDetail>>(`/projects/${projectId}/lists/${listId}/tasks`, payload)
      .then((r) => r.data.data),

  update: (taskId: string, payload: UpdateTaskPayload) =>
    api
      .patch<ApiWrapper<TaskDetail>>(`/tasks/${taskId}`, payload)
      .then((r) => r.data.data),

  delete: (taskId: string) =>
    api.delete(`/tasks/${taskId}`).then((r) => r.data),

  complete: (taskId: string) =>
    api
      .patch<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/complete`, {})
      .then((r) => r.data.data),

  uncomplete: (taskId: string) =>
    api
      .patch<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/uncomplete`, {})
      .then((r) => r.data.data),

  reorder: (projectId: string, listId: string, taskIds: string[]) =>
    api
      .put<ApiWrapper<TaskListItem[]>>(`/projects/${projectId}/lists/${listId}/tasks/reorder`, { taskIds })
      .then((r) => r.data.data),

  createSubtask: (taskId: string, payload: CreateSubtaskPayload) =>
    api
      .post<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/subtasks`, payload)
      .then((r) => r.data.data),

  getSubtasks: (taskId: string) =>
    api
      .get<ApiWrapper<TaskListItem[]>>(`/tasks/${taskId}/subtasks`)
      .then((r) => r.data.data),

  addAssignee: (taskId: string, userIds: string[]) =>
    api
      .post<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/assignees`, { userIds })
      .then((r) => r.data.data),

  removeAssignee: (taskId: string, userId: string) =>
    api
      .delete<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/assignees/${userId}`)
      .then((r) => r.data.data),

  addTag: (taskId: string, tagId: string) =>
    api
      .post<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/tags`, { tagId })
      .then((r) => r.data.data),

  removeTag: (taskId: string, tagId: string) =>
    api
      .delete<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/tags/${tagId}`)
      .then((r) => r.data.data),
};
