"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CreateTaskListPayload,
  taskListService,
  TaskList,
  UpdateTaskListPayload,
} from "@/services/task-list.service";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useProjects } from "@/context/ProjectContext";

type CacheEntry = {
  items: TaskList[];
  loaded: boolean;
  includesArchived: boolean;
  isLoading: boolean;
};

type GetListsOptions = {
  includeArchived?: boolean;
  force?: boolean;
};

interface TaskListContextValue {
  getLists: (projectId: string, options?: GetListsOptions) => Promise<TaskList[]>;
  getProjectLists: (projectId: string, options?: { includeArchived?: boolean }) => TaskList[];
  isProjectLoading: (projectId: string) => boolean;
  createList: (projectId: string, payload: CreateTaskListPayload) => Promise<TaskList>;
  renameList: (
    projectId: string,
    listId: string,
    payload: UpdateTaskListPayload
  ) => Promise<TaskList>;
  archiveList: (projectId: string, listId: string) => Promise<TaskList>;
  restoreList: (projectId: string, listId: string) => Promise<TaskList>;
  reorderLists: (projectId: string, listIds: string[]) => Promise<TaskList[]>;
  deleteList: (projectId: string, listId: string) => Promise<void>;
  clearLists: () => void;
}

const TaskListContext = createContext<TaskListContextValue | null>(null);

function sortLists(items: TaskList[]) {
  return [...items].sort((a, b) => a.position - b.position);
}

function upsertList(items: TaskList[], next: TaskList) {
  const existingIndex = items.findIndex((item) => item.id === next.id);
  if (existingIndex === -1) {
    return sortLists([...items, next]);
  }

  const updated = [...items];
  updated[existingIndex] = next;
  return sortLists(updated);
}

export function TaskListProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const { refetch: refetchProjects } = useProjects();
  const [cache, setCache] = useState<Record<string, CacheEntry>>({});
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const clearLists = useCallback(() => {
    setCache({});
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      clearLists();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeWorkspace?.id, clearLists]);

  const setLoading = useCallback((projectId: string, isLoading: boolean) => {
    setCache((prev) => ({
      ...prev,
      [projectId]: {
        items: prev[projectId]?.items ?? [],
        loaded: prev[projectId]?.loaded ?? false,
        includesArchived: prev[projectId]?.includesArchived ?? false,
        isLoading,
      },
    }));
  }, []);

  const getLists = useCallback(
    async (projectId: string, options?: GetListsOptions) => {
      const includeArchived = options?.includeArchived ?? false;
      const force = options?.force ?? false;
      const existing = cacheRef.current[projectId];
      const canUseCache =
        !force &&
        existing?.loaded &&
        (!includeArchived || existing.includesArchived);

      if (canUseCache) {
        return includeArchived
          ? existing.items
          : existing.items.filter((item) => !item.isArchived);
      }

      if (existing?.isLoading) {
        return existing.items;
      }

      setLoading(projectId, true);
      try {
        const items = await taskListService.list(projectId, includeArchived);
        setCache((prev) => ({
          ...prev,
          [projectId]: {
            items: sortLists(items),
            loaded: true,
            includesArchived: includeArchived,
            isLoading: false,
          },
        }));
        return items;
      } catch (error) {
        setLoading(projectId, false);
        throw error;
      }
    },
    [setLoading]
  );

  const getProjectLists = useCallback(
    (projectId: string, options?: { includeArchived?: boolean }) => {
      const items = cache[projectId]?.items ?? [];
      if (options?.includeArchived) return items;
      return items.filter((item) => !item.isArchived);
    },
    [cache]
  );

  const isProjectLoading = useCallback(
    (projectId: string) => Boolean(cache[projectId]?.isLoading),
    [cache]
  );

  const createList = useCallback(
    async (projectId: string, payload: CreateTaskListPayload) => {
      const created = await taskListService.create(projectId, payload);
      setCache((prev) => {
        const existing = prev[projectId];
        return {
          ...prev,
          [projectId]: {
            items: upsertList(existing?.items ?? [], created),
            loaded: true,
            includesArchived: existing?.includesArchived ?? false,
            isLoading: false,
          },
        };
      });
      await refetchProjects();
      return created;
    },
    [refetchProjects]
  );

  const renameList = useCallback(
    async (projectId: string, listId: string, payload: UpdateTaskListPayload) => {
      const updated = await taskListService.update(projectId, listId, payload);
      setCache((prev) => {
        const existing = prev[projectId];
        return existing
          ? {
              ...prev,
              [projectId]: {
                ...existing,
                items: upsertList(existing.items, updated),
              },
            }
          : prev;
      });
      return updated;
    },
    []
  );

  const archiveList = useCallback(
    async (projectId: string, listId: string) => {
      const archived = await taskListService.archive(projectId, listId);
      setCache((prev) => {
        const existing = prev[projectId];
        if (!existing) return prev;

        const items = existing.includesArchived
          ? upsertList(existing.items, archived)
          : existing.items.filter((item) => item.id !== listId);

        return {
          ...prev,
          [projectId]: {
            ...existing,
            items,
          },
        };
      });
      await refetchProjects();
      return archived;
    },
    [refetchProjects]
  );

  const restoreList = useCallback(
    async (projectId: string, listId: string) => {
      const restored = await taskListService.restore(projectId, listId);
      setCache((prev) => {
        const existing = prev[projectId];
        return {
          ...prev,
          [projectId]: {
            items: upsertList(existing?.items ?? [], restored),
            loaded: true,
            includesArchived: existing?.includesArchived ?? true,
            isLoading: false,
          },
        };
      });
      await refetchProjects();
      return restored;
    },
    [refetchProjects]
  );

  const reorderLists = useCallback(async (projectId: string, listIds: string[]) => {
    const reordered = await taskListService.reorder(projectId, listIds);
    setCache((prev) => {
      const existing = prev[projectId];
      if (!existing) {
        return {
          ...prev,
          [projectId]: {
            items: sortLists(reordered),
            loaded: true,
            includesArchived: false,
            isLoading: false,
          },
        };
      }

      const archived = existing.items.filter((item) => item.isArchived);
      return {
        ...prev,
        [projectId]: {
          ...existing,
          items: sortLists([...reordered, ...archived]),
        },
      };
    });
    return reordered;
  }, []);

  const deleteList = useCallback(
    async (projectId: string, listId: string) => {
      await taskListService.delete(projectId, listId);
      setCache((prev) => {
        const existing = prev[projectId];
        if (!existing) return prev;
        return {
          ...prev,
          [projectId]: {
            ...existing,
            items: existing.items.filter((item) => item.id !== listId),
          },
        };
      });
      await refetchProjects();
    },
    [refetchProjects]
  );

  const value = useMemo<TaskListContextValue>(
    () => ({
      getLists,
      getProjectLists,
      isProjectLoading,
      createList,
      renameList,
      archiveList,
      restoreList,
      reorderLists,
      deleteList,
      clearLists,
    }),
    [
      archiveList,
      clearLists,
      createList,
      deleteList,
      getLists,
      getProjectLists,
      isProjectLoading,
      renameList,
      reorderLists,
      restoreList,
    ]
  );

  return (
    <TaskListContext.Provider value={value}>
      {children}
    </TaskListContext.Provider>
  );
}

export function useTaskLists() {
  const context = useContext(TaskListContext);
  if (!context) {
    throw new Error("useTaskLists must be used within <TaskListProvider>");
  }
  return context;
}
