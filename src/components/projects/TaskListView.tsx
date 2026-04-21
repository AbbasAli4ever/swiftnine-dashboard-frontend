"use client";

import { useEffect, useMemo, useState } from "react";
import { Task } from "@/types/task";
import { TaskList } from "@/services/task-list.service";
import { StatusItem } from "@/services/status.service";
import { WorkspaceMember, workspaceService } from "@/services/workspace.service";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useTaskStore } from "@/stores/task.store";
import { TaskListItem, TaskPriority } from "@/services/task.service";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import StatusIcon from "./StatusIcon";
import TaskRow from "./TaskRow";
import TaskQuickCreate from "./TaskQuickCreate";
import {
  LuChevronDown,
  LuEllipsis,
  LuPlus,
  LuRotateCcw,
  LuTrash2,
} from "react-icons/lu";

const FALLBACK_STATUSES: StatusItem[] = [
  { id: "fallback_todo", projectId: "", name: "TO DO", color: "#94a3b8", group: "NOT_STARTED", position: 1000, isDefault: true, isProtected: true, isClosed: false, createdAt: "", updatedAt: "" },
  { id: "fallback_inprogress", projectId: "", name: "IN PROGRESS", color: "#3b82f6", group: "ACTIVE", position: 2000, isDefault: true, isProtected: false, isClosed: false, createdAt: "", updatedAt: "" },
  { id: "fallback_review", projectId: "", name: "REVIEW", color: "#f59e0b", group: "DONE", position: 3000, isDefault: true, isProtected: false, isClosed: false, createdAt: "", updatedAt: "" },
  { id: "fallback_done", projectId: "", name: "COMPLETE", color: "#2a9764", group: "CLOSED", position: 4000, isDefault: true, isProtected: true, isClosed: true, createdAt: "", updatedAt: "" },
];

export interface TaskListSectionData {
  list: TaskList;
  tasks: Task[];
}

interface TaskListViewProps {
  mode: "project" | "list";
  projectName: string;
  projectId: string;
  sections: TaskListSectionData[];
  statuses: StatusItem[];
  archivedLists?: TaskList[];
  onView: (task: Task) => void;
  onAdd: (options?: { statusId?: string; listId?: string }) => void;
  onCreateList?: () => void;
  onRenameList?: (list: TaskList) => void;
  onArchiveList?: (list: TaskList) => void;
  onRestoreList?: (list: TaskList) => void;
  onDeleteList?: (list: TaskList) => void;
  onOpenTaskDetail?: (taskId: string) => void;
}

const COL = "minmax(0,1fr) 110px 110px 80px 100px 32px";

function StatusGroup({
  list,
  projectId,
  status,
  statuses,
  members,
  onOpenTaskDetail,
  onLegacyView,
  onAdd,
}: {
  list: TaskList;
  projectId: string;
  status: StatusItem;
  statuses: StatusItem[];
  members: WorkspaceMember[];
  onOpenTaskDetail: (taskId: string) => void;
  onLegacyView: (task: Task) => void;
  onAdd: (options?: { statusId?: string; listId?: string }) => void;
}) {
  const { tasksByList, loadingLists, fetchTasks, updateTask, completeTask, uncompleteTask, deleteTask, addAssignee, removeAssignee, createTask } = useTaskStore();
  const [collapsed, setCollapsed] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  // Fetch tasks for this list on mount
  useEffect(() => {
    if (!tasksByList[list.id] && !loadingLists.has(list.id)) {
      void fetchTasks(projectId, list.id);
    }
  }, [list.id, projectId, fetchTasks, tasksByList, loadingLists]);

  const allListTasks = tasksByList[list.id] ?? [];
  const tasks = useMemo(
    () => allListTasks.filter((t) => t.status.id === status.id && t.depth === 0),
    [allListTasks, status.id]
  );

  const handleQuickCreate = async (payload: {
    title: string;
    assigneeIds: string[];
    startDate: string | null;
    dueDate: string | null;
    priority: TaskPriority;
  }) => {
    try {
      await createTask(projectId, list.id, {
        title: payload.title,
        statusId: status.id,
        assigneeIds: payload.assigneeIds.length ? payload.assigneeIds : undefined,
        startDate: payload.startDate ?? undefined,
        dueDate: payload.dueDate ?? undefined,
        priority: payload.priority !== "NONE" ? payload.priority : undefined,
      });
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
    }
    setQuickCreateOpen(false);
  };

  const handleUpdateStatus = async (task: TaskListItem, statusId: string) => {
    try {
      await updateTask(task.id, list.id, { statusId });
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
    }
  };

  const handleUpdatePriority = async (task: TaskListItem, priority: TaskPriority) => {
    try {
      await updateTask(task.id, list.id, { priority });
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
    }
  };

  const handleUpdateDates = async (task: TaskListItem, startDate: string | null, dueDate: string | null) => {
    try {
      await updateTask(task.id, list.id, { startDate, dueDate });
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
    }
  };

  const handleAddAssignee = async (task: TaskListItem, userId: string) => {
    try {
      await addAssignee(task.id, list.id, [userId]);
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
    }
  };

  const handleRemoveAssignee = async (task: TaskListItem, userId: string) => {
    try {
      await removeAssignee(task.id, list.id, userId);
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
    }
  };

  const handleDelete = async (task: TaskListItem) => {
    try {
      await deleteTask(task.id, list.id);
      toast.success("Task deleted");
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
    }
  };

  const handleComplete = async (task: TaskListItem) => {
    try {
      if (task.isCompleted) await uncompleteTask(task.id, list.id);
      else await completeTask(task.id, list.id);
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
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
        <div className="flex items-center gap-1 ml-auto">
          <button type="button" className="rounded p-0.5 text-gray-300 hover:text-gray-600 dark:hover:text-gray-300">
            <LuEllipsis className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setQuickCreateOpen(true)}
            className="rounded p-0.5 text-gray-300 hover:text-brand-500"
            title="Add task"
          >
            <LuPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div>
          {/* Column headers — only shown when there are tasks */}
          {tasks.length > 0 && (
            <div
              className="grid items-center gap-2 border-b border-gray-100 px-4 py-1.5 text-[11px] text-gray-400 dark:border-gray-800"
              style={{ gridTemplateColumns: COL }}
            >
              <span className="pl-3">Name</span>
              <span>Assignee</span>
              <span>Due date</span>
              <span>Priority</span>
              <span>Status</span>
              <span />
            </div>
          )}

          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              statuses={statuses}
              members={members}
              listId={list.id}
              onView={onOpenTaskDetail}
              onUpdateStatus={(statusId) => handleUpdateStatus(task, statusId)}
              onUpdatePriority={(priority) => handleUpdatePriority(task, priority)}
              onUpdateDates={(start, due) => handleUpdateDates(task, start, due)}
              onAddAssignee={(userId) => handleAddAssignee(task, userId)}
              onRemoveAssignee={(userId) => handleRemoveAssignee(task, userId)}
              onDelete={() => handleDelete(task)}
            />
          ))}

          {loadingLists.has(list.id) && tasks.length === 0 && (
            <div className="px-8 py-3 text-xs text-gray-400">Loading...</div>
          )}

          {quickCreateOpen ? (
            <TaskQuickCreate
              status={status}
              members={members}
              onSave={handleQuickCreate}
              onCancel={() => setQuickCreateOpen(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setQuickCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 text-sm text-gray-400 transition-colors hover:text-brand-500"
            >
              <span className="flex w-8 shrink-0 items-center justify-center">
                <LuPlus className="h-3.5 w-3.5" />
              </span>
              Add Task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ListSection({
  list,
  projectId,
  statuses,
  members,
  onOpenTaskDetail,
  onLegacyView,
  onAdd,
  showListHeader,
}: {
  list: TaskList;
  projectId: string;
  statuses: StatusItem[];
  members: WorkspaceMember[];
  onOpenTaskDetail: (taskId: string) => void;
  onLegacyView: (task: Task) => void;
  onAdd: (options?: { statusId?: string; listId?: string }) => void;
  showListHeader: boolean;
}) {
  const groups = statuses.map((status) => (
    <StatusGroup
      key={`${list.id}-${status.id}`}
      list={list}
      projectId={projectId}
      status={status}
      statuses={statuses}
      members={members}
      onOpenTaskDetail={onOpenTaskDetail}
      onLegacyView={onLegacyView}
      onAdd={onAdd}
    />
  ));

  if (!showListHeader) return <>{groups}</>;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <span className="text-sm font-medium text-gray-800 dark:text-white">{list.name}</span>
      </div>
      {groups}
    </div>
  );
}

export default function TaskListView({
  mode,
  projectName,
  projectId,
  sections,
  statuses,
  archivedLists = [],
  onView,
  onAdd,
  onCreateList,
  onRenameList,
  onArchiveList,
  onRestoreList,
  onDeleteList,
  onOpenTaskDetail,
}: TaskListViewProps) {
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const { activeWorkspaceId } = useWorkspaceStore();
  const resolvedStatuses = statuses.length > 0 ? statuses : FALLBACK_STATUSES;

  // Load workspace members for assignee picker
  useEffect(() => {
    if (!activeWorkspaceId) return;
    workspaceService.getMembers(activeWorkspaceId).then(setMembers).catch(() => {});
  }, [activeWorkspaceId]);

  const handleOpenTaskDetail = (taskId: string) => {
    onOpenTaskDetail?.(taskId);
  };

  return (
    <div className="space-y-4 pb-4">
      {sections.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-400">No active lists yet.</p>
          {mode === "project" && (
            <button
              type="button"
              onClick={onCreateList}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-normal text-white transition-colors hover:bg-brand-600"
            >
              <LuPlus className="h-4 w-4" />
              Create your first list
            </button>
          )}
        </div>
      )}

      {sections.map((section) => (
        <ListSection
          key={section.list.id}
          list={section.list}
          projectId={projectId}
          statuses={resolvedStatuses}
          members={members}
          onOpenTaskDetail={handleOpenTaskDetail}
          onLegacyView={onView}
          onAdd={onAdd}
          showListHeader={mode === "project" && sections.length > 1}
        />
      ))}

      {mode === "project" && (
        <button
          type="button"
          onClick={onCreateList}
          className="inline-flex items-center gap-1.5 px-1 text-sm font-normal text-gray-500 transition-colors hover:text-brand-500"
        >
          <LuPlus className="h-4 w-4" />
          Create List
        </button>
      )}

      {mode === "project" && archivedLists.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setArchivedOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div>
              <p className="text-sm font-normal text-gray-900 dark:text-white">Archived Lists</p>
              <p className="text-xs text-gray-400">{archivedLists.length} archived</p>
            </div>
            <LuChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${archivedOpen ? "rotate-180" : ""}`} />
          </button>

          {archivedOpen && (
            <div className="space-y-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              {archivedLists.map((list) => (
                <div key={list.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-800">
                  <div>
                    <p className="font-normal text-gray-800 dark:text-white">{list.name}</p>
                    <p className="text-xs text-gray-400">Archived list</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRestoreList?.(list)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-normal text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <LuRotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteList?.(list)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-normal text-red-500 transition-colors hover:bg-red-50 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <LuTrash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
