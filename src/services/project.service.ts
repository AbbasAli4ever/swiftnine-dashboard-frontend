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
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  statuses: ProjectStatus[];
  _count: { taskLists: number };
}

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

  get: (id: string) =>
    api.get<ProjectResponse>(`/projects/${id}`).then((r) => r.data.data),

  create: (payload: CreateProjectPayload) =>
    api.post<ProjectResponse>("/projects", payload).then((r) => r.data.data),

  update: (id: string, payload: UpdateProjectPayload) =>
    api
      .patch<ProjectResponse>(`/projects/${id}`, payload)
      .then((r) => r.data.data),

  delete: (id: string) => api.delete(`/projects/${id}`),
};
