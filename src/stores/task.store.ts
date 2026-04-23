import { create } from "zustand";
import {
  taskService,
  TaskListItem,
  TaskDetail,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateSubtaskPayload,
} from "@/services/task.service";

interface TaskState {
  tasksByList: Record<string, TaskListItem[]>;
  subtasksByParent: Record<string, TaskListItem[]>;
  loadingLists: Set<string>;
  loadingSubtasks: Set<string>;
  expandedTasks: Set<string>;
  openTaskId: string | null;
  openTask: TaskDetail | null;
  openTaskLoading: boolean;

  fetchTasks: (projectId: string, listId: string) => Promise<void>;
  fetchSubtasks: (taskId: string) => Promise<void>;
  toggleExpand: (taskId: string) => void;
  openTaskDetail: (taskId: string) => Promise<void>;
  refreshOpenTask: () => Promise<void>;
  closeTaskDetail: () => void;
  createTask: (projectId: string, listId: string, payload: CreateTaskPayload) => Promise<TaskDetail>;
  updateTask: (taskId: string, listId: string, payload: UpdateTaskPayload) => Promise<void>;
  updateSubtask: (subtaskId: string, parentId: string, listId: string, payload: UpdateTaskPayload) => Promise<void>;
  deleteTask: (taskId: string, listId: string) => Promise<void>;
  deleteSubtask: (subtaskId: string, parentId: string, listId: string) => Promise<void>;
  completeTask: (taskId: string, listId: string) => Promise<void>;
  uncompleteTask: (taskId: string, listId: string) => Promise<void>;
  reorderTasks: (projectId: string, listId: string, taskIds: string[]) => Promise<void>;
  createSubtask: (taskId: string, listId: string, payload: CreateSubtaskPayload) => Promise<TaskDetail>;
  addAssignee: (taskId: string, listId: string, userIds: string[]) => Promise<void>;
  removeAssignee: (taskId: string, listId: string, userId: string) => Promise<void>;
  addTag: (taskId: string, listId: string, tagId: string) => Promise<void>;
  removeTag: (taskId: string, listId: string, tagId: string) => Promise<void>;
  purgeTag: (tagId: string) => void;
  updateTagInStore: (tag: { id: string; name: string; color: string }) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasksByList: {},
  subtasksByParent: {},
  loadingLists: new Set(),
  loadingSubtasks: new Set(),
  expandedTasks: new Set(),
  openTaskId: null,
  openTask: null,
  openTaskLoading: false,

  fetchTasks: async (projectId, listId) => {
    set((s) => {
      const next = new Set(s.loadingLists);
      next.add(listId);
      return { loadingLists: next };
    });
    try {
      const tasks = await taskService.list(projectId, listId);
      set((s) => {
        const next = new Set(s.loadingLists);
        next.delete(listId);
        return { tasksByList: { ...s.tasksByList, [listId]: tasks }, loadingLists: next };
      });
    } catch {
      set((s) => {
        const next = new Set(s.loadingLists);
        next.delete(listId);
        return { loadingLists: next };
      });
    }
  },

  fetchSubtasks: async (taskId) => {
    if (get().loadingSubtasks.has(taskId)) return;
    set((s) => {
      const next = new Set(s.loadingSubtasks);
      next.add(taskId);
      return { loadingSubtasks: next };
    });
    try {
      const subtasks = await taskService.getSubtasks(taskId);
      set((s) => {
        const next = new Set(s.loadingSubtasks);
        next.delete(taskId);
        return { subtasksByParent: { ...s.subtasksByParent, [taskId]: subtasks }, loadingSubtasks: next };
      });
    } catch {
      set((s) => {
        const next = new Set(s.loadingSubtasks);
        next.delete(taskId);
        return { loadingSubtasks: next };
      });
    }
  },

  toggleExpand: (taskId) => {
    const { expandedTasks, fetchSubtasks, subtasksByParent } = get();
    const next = new Set(expandedTasks);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
      if (!subtasksByParent[taskId]) {
        void fetchSubtasks(taskId);
      }
    }
    set({ expandedTasks: next });
  },

  openTaskDetail: async (taskId) => {
    set({ openTaskId: taskId, openTaskLoading: true, openTask: null });
    try {
      const task = await taskService.get(taskId);
      set({ openTask: task, openTaskLoading: false });
    } catch {
      set({ openTaskLoading: false });
    }
  },

  refreshOpenTask: async () => {
    const { openTaskId } = get();
    if (!openTaskId) return;
    try {
      const task = await taskService.get(openTaskId);
      set({ openTask: task });
    } catch {}
  },

  closeTaskDetail: () => {
    set({ openTaskId: null, openTask: null, openTaskLoading: false });
  },

  createTask: async (projectId, listId, payload) => {
    const created = await taskService.create(projectId, listId, payload);
    const listItem: TaskListItem = {
      id: created.id,
      taskId: created.taskId,
      taskNumber: created.taskNumber,
      title: created.title,
      priority: created.priority,
      startDate: created.startDate,
      dueDate: created.dueDate,
      position: created.position,
      depth: created.depth,
      isCompleted: created.isCompleted,
      completedAt: created.completedAt,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      status: created.status,
      assignees: created.assignees,
      tags: created.tags,
      list: created.list,
      _count: { children: 0 },
    };
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: [...(s.tasksByList[listId] ?? []), listItem],
      },
    }));
    return created;
  },

  updateTask: async (taskId, listId, payload) => {
    const updated = await taskService.update(taskId, payload);
    set((s) => {
      const updatedTasks = (s.tasksByList[listId] ?? []).map((t) =>
        t.id === taskId
          ? {
              ...t,
              title: updated.title,
              priority: updated.priority,
              startDate: updated.startDate,
              dueDate: updated.dueDate,
              status: updated.status,
              assignees: updated.assignees,
              tags: updated.tags,
              isCompleted: updated.isCompleted,
              completedAt: updated.completedAt,
              updatedAt: updated.updatedAt,
            }
          : t
      );

      const newState: Partial<TaskState> = {
        tasksByList: { ...s.tasksByList, [listId]: updatedTasks },
      };

      if (payload.listId && payload.listId !== listId) {
        const oldListTasks = (s.tasksByList[listId] ?? []).filter((t) => t.id !== taskId);
        const newListItem: TaskListItem = {
          id: updated.id,
          taskId: updated.taskId,
          taskNumber: updated.taskNumber,
          title: updated.title,
          priority: updated.priority,
          startDate: updated.startDate,
          dueDate: updated.dueDate,
          position: updated.position,
          depth: updated.depth,
          isCompleted: updated.isCompleted,
          completedAt: updated.completedAt,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          status: updated.status,
          assignees: updated.assignees,
          tags: updated.tags,
          list: updated.list,
          _count: { children: updated.children.length },
        };
        newState.tasksByList = {
          ...s.tasksByList,
          [listId]: oldListTasks,
          [payload.listId]: [...(s.tasksByList[payload.listId] ?? []), newListItem],
        };
      }

      if (s.openTask?.id === taskId) {
        return { ...newState, openTask: updated } as Partial<TaskState>;
      }
      return newState as Partial<TaskState>;
    });
  },

  updateSubtask: async (subtaskId, parentId, listId, payload) => {
    const updated = await taskService.update(subtaskId, payload);
    set((s) => {
      const updatedSubs = (s.subtasksByParent[parentId] ?? []).map((t) =>
        t.id === subtaskId
          ? {
              ...t,
              title: updated.title,
              priority: updated.priority,
              startDate: updated.startDate,
              dueDate: updated.dueDate,
              status: updated.status,
              assignees: updated.assignees,
              tags: updated.tags,
              isCompleted: updated.isCompleted,
              completedAt: updated.completedAt,
              updatedAt: updated.updatedAt,
            }
          : t
      );
      // Also update parent task _count if needed
      const updatedList = (s.tasksByList[listId] ?? []).map((t) =>
        t.id === parentId ? { ...t, _count: { children: updatedSubs.length } } : t
      );
      const newState: Partial<TaskState> = {
        subtasksByParent: { ...s.subtasksByParent, [parentId]: updatedSubs },
        tasksByList: { ...s.tasksByList, [listId]: updatedList },
      };
      if (s.openTask?.id === subtaskId) {
        return { ...newState, openTask: updated } as Partial<TaskState>;
      }
      return newState as Partial<TaskState>;
    });
  },

  deleteTask: async (taskId, listId) => {
    await taskService.delete(taskId);
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).filter((t) => t.id !== taskId),
      },
      openTask: s.openTask?.id === taskId ? null : s.openTask,
      openTaskId: s.openTaskId === taskId ? null : s.openTaskId,
    }));
  },

  deleteSubtask: async (subtaskId, parentId, listId) => {
    await taskService.delete(subtaskId);
    set((s) => {
      const updatedSubs = (s.subtasksByParent[parentId] ?? []).filter((t) => t.id !== subtaskId);
      const updatedList = (s.tasksByList[listId] ?? []).map((t) =>
        t.id === parentId ? { ...t, _count: { children: updatedSubs.length } } : t
      );
      return {
        subtasksByParent: { ...s.subtasksByParent, [parentId]: updatedSubs },
        tasksByList: { ...s.tasksByList, [listId]: updatedList },
        openTask: s.openTask?.id === subtaskId ? null : s.openTask,
        openTaskId: s.openTaskId === subtaskId ? null : s.openTaskId,
      };
    });
  },

  completeTask: async (taskId, listId) => {
    const updated = await taskService.complete(taskId);
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).map((t) =>
          t.id === taskId ? { ...t, isCompleted: true, completedAt: updated.completedAt } : t
        ),
      },
      openTask: s.openTask?.id === taskId ? updated : s.openTask,
    }));
  },

  uncompleteTask: async (taskId, listId) => {
    const updated = await taskService.uncomplete(taskId);
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).map((t) =>
          t.id === taskId ? { ...t, isCompleted: false, completedAt: null } : t
        ),
      },
      openTask: s.openTask?.id === taskId ? updated : s.openTask,
    }));
  },

  reorderTasks: async (projectId, listId, taskIds) => {
    await taskService.reorder(projectId, listId, taskIds);
    // Optimistic update already applied by the caller — don't overwrite with server response
  },

  createSubtask: async (taskId, listId, payload) => {
    const subtask = await taskService.createSubtask(taskId, payload);
    const subtaskItem: TaskListItem = {
      id: subtask.id,
      taskId: subtask.taskId,
      taskNumber: subtask.taskNumber,
      title: subtask.title,
      priority: subtask.priority,
      startDate: subtask.startDate,
      dueDate: subtask.dueDate,
      position: subtask.position,
      depth: subtask.depth,
      isCompleted: subtask.isCompleted,
      completedAt: subtask.completedAt,
      createdAt: subtask.createdAt,
      updatedAt: subtask.updatedAt,
      status: subtask.status,
      assignees: subtask.assignees,
      tags: subtask.tags,
      list: subtask.list,
      _count: { children: 0 },
    };
    set((s) => {
      // Add subtask to subtasksByParent
      const existingSubs = s.subtasksByParent[taskId] ?? [];
      const updatedSubs = [...existingSubs, subtaskItem];
      // Increment parent _count in tasksByList
      const updatedList = (s.tasksByList[listId] ?? []).map((t) =>
        t.id === taskId ? { ...t, _count: { children: updatedSubs.length } } : t
      );
      // Auto-expand parent
      const nextExpanded = new Set(s.expandedTasks);
      nextExpanded.add(taskId);
      // Refresh openTask if it's the parent
      const openTask = s.openTask?.id === taskId
        ? { ...s.openTask, children: [...(s.openTask.children ?? []), subtaskItem] }
        : s.openTask;
      return {
        subtasksByParent: { ...s.subtasksByParent, [taskId]: updatedSubs },
        tasksByList: { ...s.tasksByList, [listId]: updatedList },
        expandedTasks: nextExpanded,
        openTask,
      };
    });
    return subtask;
  },

  addAssignee: async (taskId, listId, userIds) => {
    const updated = await taskService.addAssignee(taskId, userIds);
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).map((t) =>
          t.id === taskId ? { ...t, assignees: updated.assignees } : t
        ),
      },
      openTask: s.openTask?.id === taskId ? updated : s.openTask,
    }));
  },

  removeAssignee: async (taskId, listId, userId) => {
    const updated = await taskService.removeAssignee(taskId, userId);
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).map((t) =>
          t.id === taskId ? { ...t, assignees: updated.assignees } : t
        ),
      },
      openTask: s.openTask?.id === taskId ? updated : s.openTask,
    }));
  },

  addTag: async (taskId, listId, tagId) => {
    const updated = await taskService.addTag(taskId, tagId);
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).map((t) =>
          t.id === taskId ? { ...t, tags: updated.tags } : t
        ),
      },
      openTask: s.openTask?.id === taskId ? updated : s.openTask,
    }));
  },

  removeTag: async (taskId, listId, tagId) => {
    const updated = await taskService.removeTag(taskId, tagId);
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).map((t) =>
          t.id === taskId ? { ...t, tags: updated.tags } : t
        ),
      },
      openTask: s.openTask?.id === taskId ? updated : s.openTask,
    }));
  },

  purgeTag: (tagId) => {
    set((s) => ({
      tasksByList: Object.fromEntries(
        Object.entries(s.tasksByList).map(([listId, tasks]) => [
          listId,
          tasks.map((t) => ({ ...t, tags: t.tags.filter((tag) => tag.tag.id !== tagId) })),
        ])
      ),
      subtasksByParent: Object.fromEntries(
        Object.entries(s.subtasksByParent).map(([parentId, tasks]) => [
          parentId,
          tasks.map((t) => ({ ...t, tags: t.tags.filter((tag) => tag.tag.id !== tagId) })),
        ])
      ),
      openTask: s.openTask
        ? { ...s.openTask, tags: s.openTask.tags.filter((tag) => tag.tag.id !== tagId) }
        : null,
    }));
  },

  updateTagInStore: (tag) => {
    set((s) => ({
      tasksByList: Object.fromEntries(
        Object.entries(s.tasksByList).map(([listId, tasks]) => [
          listId,
          tasks.map((t) => ({
            ...t,
            tags: t.tags.map((tt) => tt.tag.id === tag.id ? { ...tt, tag: { ...tt.tag, ...tag } } : tt),
          })),
        ])
      ),
      subtasksByParent: Object.fromEntries(
        Object.entries(s.subtasksByParent).map(([parentId, tasks]) => [
          parentId,
          tasks.map((t) => ({
            ...t,
            tags: t.tags.map((tt) => tt.tag.id === tag.id ? { ...tt, tag: { ...tt.tag, ...tag } } : tt),
          })),
        ])
      ),
      openTask: s.openTask
        ? {
            ...s.openTask,
            tags: s.openTask.tags.map((tt) =>
              tt.tag.id === tag.id ? { ...tt, tag: { ...tt.tag, ...tag } } : tt
            ),
          }
        : null,
    }));
  },
}));
