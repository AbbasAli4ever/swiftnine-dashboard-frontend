import { api } from "@/lib/api";

export interface ProjectStatus {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isClosed: boolean;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  taskIdPrefix: string;
  isArchived: boolean;
  isFavorite?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  statuses: ProjectStatus[];
  _count: { taskLists: number };
  locked?: boolean;
  passwordUpdatedAt?: string | null;
}

export type LockedProjectListItem = {
  id: string;
  workspaceId: string;
  locked: true;
  isFavorite: boolean;
  favoritedAt?: string;
};

export type UnlockedProjectListItem = {
  id: string;
  workspaceId: string;
  locked: false;
  passwordUpdatedAt: string | null;
  isFavorite: boolean;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  taskIdPrefix: string;
  statuses: ProjectStatus[];
  isArchived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  _count?: { taskLists: number };
};

export type ProjectListItem = LockedProjectListItem | UnlockedProjectListItem;

interface ProjectResponse {
  success: boolean;
  data: Project;
  message: string | null;
}

interface ProjectsResponse {
  success: boolean;
  data: Project[];
  message: string | null;
}

export interface CreateProjectPayload {
  name: string;
  taskIdPrefix: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
}

export const projectService = {
  list: () =>
    api.get<ProjectsResponse>("/projects").then((r) => r.data.data),

  listArchived: () =>
    api.get<ProjectsResponse>("/projects/archived").then((r) => r.data.data),

  get: (id: string) =>
    api.get<ProjectResponse>(`/projects/${id}`).then((r) => r.data.data),

  create: (payload: CreateProjectPayload) =>
    api.post<ProjectResponse>("/projects", payload).then((r) => r.data.data),

  update: (id: string, payload: UpdateProjectPayload) =>
    api
      .patch<ProjectResponse>(`/projects/${id}`, payload)
      .then((r) => r.data.data),

  delete: (id: string) => api.delete(`/projects/${id}`),

  archive: (id: string) =>
    api.patch<ProjectResponse>(`/projects/${id}/archive`).then((r) => r.data.data),

  restore: (id: string) =>
    api.patch<ProjectResponse>(`/projects/${id}/restore`).then((r) => r.data.data),

  favorite: (id: string) => api.put(`/projects/${id}/favorite`),

  unfavorite: (id: string) => api.delete(`/projects/${id}/favorite`),
};
