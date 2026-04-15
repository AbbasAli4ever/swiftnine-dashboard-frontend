import { api } from "@/lib/api";
import { Workspace } from "@/stores/workspace.store";

interface WorkspaceResponse {
  success: boolean;
  data: Workspace;
  message: string | null;
}

interface WorkspacesResponse {
  success: boolean;
  data: Workspace[];
  message: string | null;
}

export const workspaceService = {
  list: () =>
    api.get<WorkspacesResponse>("/workspaces").then((r) => r.data.data),

  get: (id: string) =>
    api
      .get<WorkspaceResponse>(`/workspaces/${id}`, {
        headers: { "x-workspace-id": id },
      })
      .then((r) => r.data.data),

  create: (payload: { name: string; logoUrl?: string }) =>
    api
      .post<WorkspaceResponse>("/workspaces", payload)
      .then((r) => r.data.data),

  update: (id: string, payload: { name?: string; logoUrl?: string | null }) =>
    api
      .patch<WorkspaceResponse>(`/workspaces/${id}`, payload, {
        headers: { "x-workspace-id": id },
      })
      .then((r) => r.data.data),

  delete: (id: string) =>
    api
      .delete(`/workspaces/${id}`, {
        headers: { "x-workspace-id": id },
      })
      .then((r) => r.data),
};
