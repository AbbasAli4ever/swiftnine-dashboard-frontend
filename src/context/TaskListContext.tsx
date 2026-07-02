"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CreateTaskListPayload,
  taskListService,
  TaskList,
  UpdateTaskListPayload,
} from "@/services/task-list.service";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useProjects } from "@/context/ProjectContext";
import { queryKeys } from "@/queries/keys";

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

export function TaskListProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const { refetch: refetchProjects } = useProjects();
  const queryClient = useQueryClient();

  // Mirrors the query cache for synchronous reads in render (getProjectLists/
  // isProjectLoading are called directly during render across the app, so we
  // need a subscribed snapshot rather than reaching into the cache each render).
  const [, forceRerender] = useState(0);
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] === "task-lists") {
        forceRerender((n) => n + 1);
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const clearLists = useCallback(() => {
    queryClient.removeQueries({ queryKey: ["task-lists"] });
  }, [queryClient]);

  // Previously a setTimeout(0) full-wipe; now scoped removal is safe to run
  // synchronously since queries are keyed per-project, but we keep clearing
  // on workspace switch since project ids aren't guaranteed unique across
  // workspaces in every backend implementation.
  useEffect(() => {
    clearLists();
  }, [activeWorkspace?.id, clearLists]);

  const getLists = useCallback(
    async (projectId: string, options?: GetListsOptions) => {
      const includeArchived = options?.includeArchived ?? false;
      const force = options?.force ?? false;
      const key = queryKeys.taskLists(projectId, includeArchived);

      if (force) {
        await queryClient.invalidateQueries({ queryKey: key });
      }

      const items = await queryClient.fetchQuery({
        queryKey: key,
        queryFn: () => taskListService.list(projectId, includeArchived),
      });
      return sortLists(items);
    },
    [queryClient]
  );

  const getProjectLists = useCallback(
    (projectId: string, options?: { includeArchived?: boolean }) => {
      const includeArchived = options?.includeArchived ?? false;
      const key = queryKeys.taskLists(projectId, includeArchived);
      const items = queryClient.getQueryData<TaskList[]>(key) ?? [];
      const sorted = sortLists(items);
      return includeArchived ? sorted : sorted.filter((item) => !item.isArchived);
    },
    [queryClient]
  );

  const isProjectLoading = useCallback(
    (projectId: string) => {
      return (
        queryClient.isFetching({
          queryKey: ["task-lists", projectId],
        }) > 0
      );
    },
    [queryClient]
  );

  const setListsData = useCallback(
    (projectId: string, updater: (items: TaskList[]) => TaskList[]) => {
      for (const includeArchived of [false, true]) {
        const key = queryKeys.taskLists(projectId, includeArchived);
        if (queryClient.getQueryData<TaskList[]>(key) === undefined) continue;
        queryClient.setQueryData<TaskList[]>(key, (prev) =>
          sortLists(updater(prev ?? []))
        );
      }
    },
    [queryClient]
  );

  const createList = useCallback(
    async (projectId: string, payload: CreateTaskListPayload) => {
      const created = await taskListService.create(projectId, payload);
      setListsData(projectId, (items) => [...items, created]);
      await refetchProjects();
      return created;
    },
    [refetchProjects, setListsData]
  );

  const renameList = useCallback(
    async (projectId: string, listId: string, payload: UpdateTaskListPayload) => {
      const updated = await taskListService.update(projectId, listId, payload);
      setListsData(projectId, (items) =>
        items.map((item) => (item.id === listId ? updated : item))
      );
      return updated;
    },
    [setListsData]
  );

  const archiveList = useCallback(
    async (projectId: string, listId: string) => {
      const archived = await taskListService.archive(projectId, listId);
      // Non-archived view loses the item; archived-inclusive view keeps it updated.
      const nonArchivedKey = queryKeys.taskLists(projectId, false);
      queryClient.setQueryData<TaskList[]>(nonArchivedKey, (prev) =>
        (prev ?? []).filter((item) => item.id !== listId)
      );
      const archivedKey = queryKeys.taskLists(projectId, true);
      if (queryClient.getQueryData<TaskList[]>(archivedKey) !== undefined) {
        queryClient.setQueryData<TaskList[]>(archivedKey, (prev) =>
          sortLists(
            (prev ?? []).map((item) => (item.id === listId ? archived : item))
          )
        );
      }
      await refetchProjects();
      return archived;
    },
    [queryClient, refetchProjects]
  );

  const restoreList = useCallback(
    async (projectId: string, listId: string) => {
      const restored = await taskListService.restore(projectId, listId);
      setListsData(projectId, (items) => {
        const existingIndex = items.findIndex((item) => item.id === listId);
        if (existingIndex === -1) return [...items, restored];
        const updated = [...items];
        updated[existingIndex] = restored;
        return updated;
      });
      await refetchProjects();
      return restored;
    },
    [refetchProjects, setListsData]
  );

  const reorderLists = useCallback(
    async (projectId: string, listIds: string[]) => {
      const reordered = await taskListService.reorder(projectId, listIds);
      const nonArchivedKey = queryKeys.taskLists(projectId, false);
      queryClient.setQueryData<TaskList[]>(nonArchivedKey, sortLists(reordered));
      const archivedKey = queryKeys.taskLists(projectId, true);
      const archivedCache = queryClient.getQueryData<TaskList[]>(archivedKey);
      if (archivedCache !== undefined) {
        const archivedOnly = archivedCache.filter((item) => item.isArchived);
        queryClient.setQueryData<TaskList[]>(
          archivedKey,
          sortLists([...reordered, ...archivedOnly])
        );
      }
      return reordered;
    },
    [queryClient]
  );

  const deleteList = useCallback(
    async (projectId: string, listId: string) => {
      await taskListService.delete(projectId, listId);
      setListsData(projectId, (items) =>
        items.filter((item) => item.id !== listId)
      );
      await refetchProjects();
    },
    [refetchProjects, setListsData]
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
