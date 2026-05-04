"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LuChevronDown, LuRefreshCcw } from "react-icons/lu";
import { taskService, TaskListItem, TaskPriority } from "@/services/task.service";
import { StatusItem } from "@/services/status.service";
import { WorkspaceMember, workspaceService } from "@/services/workspace.service";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useTaskStore } from "@/stores/task.store";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import TaskRow from "@/components/projects/TaskRow";
import StatusIcon from "@/components/projects/StatusIcon";

const GROUP_ORDER: Record<string, number> = {
  NOT_STARTED: 0,
  ACTIVE: 1,
  DONE: 2,
  CLOSED: 3,
};

function deriveStatuses(tasks: TaskListItem[]): StatusItem[] {
  const seen = new Map<string, StatusItem>();
  for (const t of tasks) {
    if (!seen.has(t.status.id)) {
      seen.set(t.status.id, {
        id: t.status.id,
        projectId: t.list.project.id,
        name: t.status.name,
        color: t.status.color,
        group: t.status.group as StatusItem["group"],
        position: 0,
        isDefault: false,
        isProtected: false,
        isClosed: t.status.group === "CLOSED",
        createdAt: "",
        updatedAt: "",
      });
    }
  }
  return Array.from(seen.values()).sort((a, b) => {
    const gDiff = (GROUP_ORDER[a.group] ?? 99) - (GROUP_ORDER[b.group] ?? 99);
    if (gDiff !== 0) return gDiff;
    return a.name.localeCompare(b.name);
  });
}

function MyStatusGroup({
  status,
  tasks,
  allStatuses,
  members,
  onRefresh,
}: {
  status: StatusItem;
  tasks: TaskListItem[];
  allStatuses: StatusItem[];
  members: WorkspaceMember[];
  onRefresh: () => void;
}) {
  const { updateTask, deleteTask, addAssignee, removeAssignee, openTaskDetail } = useTaskStore();
  const [collapsed, setCollapsed] = useState(false);

  // Group tasks within this status by project
  const byProject = useMemo<{ projectId: string; projectName: string; tasks: TaskListItem[] }[]>(() => {
    const map = new Map<string, { projectId: string; projectName: string; tasks: TaskListItem[] }>();
    for (const t of tasks) {
      const pid = t.list.project.id;
      if (!map.has(pid)) {
        map.set(pid, { projectId: pid, projectName: t.list.project.name, tasks: [] });
      }
      map.get(pid)!.tasks.push(t);
    }
    return Array.from(map.values());
  }, [tasks]);

  const handleUpdateStatus = async (task: TaskListItem, statusId: string) => {
    try {
      await updateTask(task.id, task.list.id, { statusId });
      onRefresh();
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleUpdatePriority = async (task: TaskListItem, priority: TaskPriority) => {
    try {
      await updateTask(task.id, task.list.id, { priority });
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleUpdateDates = async (task: TaskListItem, startDate: string | null, dueDate: string | null) => {
    try {
      await updateTask(task.id, task.list.id, { startDate, dueDate });
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleAddAssignee = async (task: TaskListItem, userId: string) => {
    try {
      await addAssignee(task.id, task.list.id, [userId]);
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleRemoveAssignee = async (task: TaskListItem, userId: string) => {
    try {
      await removeAssignee(task.id, task.list.id, userId);
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleDelete = async (task: TaskListItem) => {
    try {
      await deleteTask(task.id, task.list.id);
      toast.success("Task deleted");
      onRefresh();
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  return (
    <div className="border-b border-gray-100 last:border-b-0 dark:border-gray-700">
      {/* Status group header */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-left"
        >
          <LuChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase text-white"
            style={{ backgroundColor: status.color }}
          >
            <StatusIcon group={status.group} color="#fff" size={11} />
            {status.name}
          </span>
          <span className="text-xs text-gray-400">{tasks.length}</span>
        </button>
      </div>

      {!collapsed && (
        <div>
          {tasks.length > 0 && (
            <div
              className="grid items-center gap-2 border-b border-gray-100 px-4 py-1.5 text-[11px] text-gray-400 dark:border-gray-800"
              style={{ gridTemplateColumns: "minmax(0,1fr) 110px 110px 80px 100px 32px" }}
            >
              <span className="pl-3">Name</span>
              <span>Assignee</span>
              <span>Due date</span>
              <span>Priority</span>
              <span>Status</span>
              <span />
            </div>
          )}

          {byProject.map((group) => (
            <div key={group.projectId}>
              {/* Project label divider */}
              <div className="flex items-center gap-2 px-4 py-1 mt-0.5">
                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                <span className="shrink-0 text-[11px] text-gray-400 font-normal">{group.projectName}</span>
                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
              </div>

              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  statuses={allStatuses}
                  members={members}
                  listId={task.list.id}
                  onView={() => openTaskDetail(task.id)}
                  onUpdateStatus={(statusId) => handleUpdateStatus(task, statusId)}
                  onUpdatePriority={(priority) => handleUpdatePriority(task, priority)}
                  onUpdateDates={(start, due) => handleUpdateDates(task, start, due)}
                  onAddAssignee={(userId) => handleAddAssignee(task, userId)}
                  onRemoveAssignee={(userId) => handleRemoveAssignee(task, userId)}
                  onDelete={() => handleDelete(task)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyTasksPage() {
  const { activeWorkspaceId } = useWorkspaceStore();
  const { setTasksForLists } = useTaskStore();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const fetchRef = useRef(0);

  const fetchTasks = useCallback(async () => {
    const id = ++fetchRef.current;
    setLoading(true);
    try {
      const allItems: TaskListItem[] = [];
      let page = 1;
      const limit = 100;
      while (page <= 5) {
        const result = await taskService.searchWorkspace({
          me: true,
          include_closed: true,
          include_archived: false,
          include_subtasks: false,
          limit,
          page,
        });
        if (id !== fetchRef.current) return;
        allItems.push(...result.items);
        if (!result.meta.has_next) {
          setTotalCount(result.meta.total);
          break;
        }
        if (page === 5) {
          setTotalCount(result.meta.total);
          break;
        }
        page++;
      }
      if (id !== fetchRef.current) return;

      setTasks(allItems);

      // Inject into store so TaskRow mutation callbacks work
      const byList: Record<string, TaskListItem[]> = {};
      allItems.forEach((t) => {
        (byList[t.list.id] ??= []).push(t);
      });
      setTasksForLists(byList);
    } catch (err) {
      if (id !== fetchRef.current) return;
      toast.error(parseApiError(err).message);
    } finally {
      if (id === fetchRef.current) setLoading(false);
    }
  }, [setTasksForLists]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    workspaceService.getMembers(activeWorkspaceId).then(setMembers).catch(() => setMembers([]));
  }, [activeWorkspaceId]);

  const statuses = useMemo(() => deriveStatuses(tasks), [tasks]);

  const tasksByStatus = useMemo<Map<string, TaskListItem[]>>(() => {
    const map = new Map<string, TaskListItem[]>();
    for (const t of tasks) {
      if (!map.has(t.status.id)) map.set(t.status.id, []);
      map.get(t.status.id)!.push(t);
    }
    return map;
  }, [tasks]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">My Tasks</h1>
          {!loading && tasks.length > 0 && (
            <p className="text-[12px] text-gray-400 mt-0.5">
              {tasks.length === totalCount
                ? `${totalCount} task${totalCount !== 1 ? "s" : ""} assigned to you`
                : `Showing ${tasks.length} of ${totalCount} tasks assigned to you`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void fetchTasks()}
          title="Refresh"
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
        >
          <LuRefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800">
              <StatusIcon group="DONE" color="#9ca3af" size={28} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No tasks assigned to you</p>
              <p className="mt-1 text-xs text-gray-400">Tasks assigned to you across all spaces will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="pb-8">
            {statuses.map((status) => {
              const statusTasks = tasksByStatus.get(status.id) ?? [];
              if (statusTasks.length === 0) return null;
              return (
                <MyStatusGroup
                  key={status.id}
                  status={status}
                  tasks={statusTasks}
                  allStatuses={statuses}
                  members={members}
                  onRefresh={fetchTasks}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
