"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  Project,
  CreateProjectPayload,
  UpdateProjectPayload,
  projectService,
} from "@/services/project.service";
import { useWorkspace } from "@/context/WorkspaceContext";

interface ProjectContextValue {
  projects: Project[];
  isLoading: boolean;
  createProject: (payload: CreateProjectPayload) => Promise<Project>;
  updateProject: (id: string, payload: UpdateProjectPayload) => Promise<void>;
  patchLocalProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
  fetchArchivedProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!activeWorkspace) return;
    setIsLoading(true);
    try {
      const data = await projectService.list();
      setProjects(data);
    } catch {
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  // Re-fetch whenever the active workspace changes
  useEffect(() => {
    if (!activeWorkspace) {
      setProjects([]);
      return;
    }
    fetchProjects();
  }, [activeWorkspace, fetchProjects]);

  const createProject = useCallback(
    async (payload: CreateProjectPayload) => {
      const project = await projectService.create(payload);
      setProjects((prev) => [...prev, project]);
      return project;
    },
    []
  );

  const updateProject = useCallback(
    async (id: string, payload: UpdateProjectPayload) => {
      const updated = await projectService.update(id, payload);
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    },
    []
  );

  const patchLocalProject = useCallback((id: string, patch: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await projectService.delete(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const fetchArchivedProjects = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const archived = await projectService.listArchived();
      setProjects((prev) => {
        const activeIds = new Set(prev.filter((p) => !p.isArchived).map((p) => p.id));
        const merged = [...prev.filter((p) => !p.isArchived)];
        for (const p of archived) {
          if (!activeIds.has(p.id)) merged.push(p);
        }
        return merged;
      });
    } catch {
      // silently fail — archived projects are optional display
    }
  }, [activeWorkspace]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        isLoading,
        createProject,
        updateProject,
        patchLocalProject,
        deleteProject,
        refetch: fetchProjects,
        fetchArchivedProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx)
    throw new Error("useProjects must be used within <ProjectProvider>");
  return ctx;
}
