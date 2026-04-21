"use client";

import { useEffect, useMemo, useState } from "react";
import { LuPlus, LuEllipsis } from "react-icons/lu";
import { StatusItem } from "@/services/status.service";
import { WorkspaceMember } from "@/services/workspace.service";
import { TaskListItem, TaskPriority } from "@/services/task.service";
import { TaskList } from "@/services/task-list.service";
import { useTaskStore } from "@/stores/task.store";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import StatusIcon from "./StatusIcon";
import TaskQuickCreate from "./TaskQuickCreate";
import AssigneePicker from "./AssigneePicker";
import DatePicker from "./DatePicker";
import PriorityPicker from "./PriorityPicker";
import StatusPicker from "./StatusPicker";

const FALLBACK_STATUSES: StatusItem[] = [
  { id: "fallback_todo", projectId: "", name: "TO DO", color: "#94a3b8", group: "NOT_STARTED", position: 1000, isDefault: true, isProtected: true, isClosed: false, createdAt: "", updatedAt: "" },
  { id: "fallback_inprogress", projectId: "", name: "IN PROGRESS", color: "#3b82f6", group: "ACTIVE", position: 2000, isDefault: true, isProtected: false, isClosed: false, createdAt: "", updatedAt: "" },
  { id: "fallback_done", projectId: "", name: "COMPLETE", color: "#2a9764", group: "CLOSED", position: 4000, isDefault: true, isProtected: true, isClosed: true, createdAt: "", updatedAt: "" },
];

function BoardCard({
  task,
  statuses,
  members,
  listId,
  onOpenDetail,
}: {
  task: TaskListItem;
  statuses: StatusItem[];
  members: WorkspaceMember[];
  listId: string;
  onOpenDetail: (taskId: string) => void;
}) {
  const { updateTask, addAssignee, removeAssignee } = useTaskStore();

  const handleUpdateStatus = async (statusId: string) => {
    try { await updateTask(task.id, listId, { statusId }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };

  const handleUpdatePriority = async (priority: TaskPriority) => {
    try { await updateTask(task.id, listId, { priority }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };

  const handleUpdateDates = async (startDate: string | null, dueDate: string | null) => {
    try { await updateTask(task.id, listId, { startDate, dueDate }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };

  const handleAddAssignee = async (userId: string) => {
    try { await addAssignee(task.id, listId, [userId]); }
    catch (err) { toast.error(parseApiError(err).message); }
  };

  const handleRemoveAssignee = async (userId: string) => {
    try { await removeAssignee(task.id, listId, userId); }
    catch (err) { toast.error(parseApiError(err).message); }
  };


  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Title row */}
      <div className="mb-2.5 flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          <StatusIcon
            group={task.status.group}
            color={task.status.group === "CLOSED" ? "#2a9764" : task.status.color}
            size={15}
          />
        </span>
        <button
          type="button"
          onClick={() => onOpenDetail(task.id)}
          className={`flex-1 text-left text-sm font-normal leading-5 hover:text-brand-500 ${task.isCompleted ? "text-gray-400 line-through" : "text-gray-800 dark:text-white"}`}
        >
          {task.title}
        </button>
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((t) => (
            <span
              key={t.tag.id}
              className="rounded px-1.5 py-0.5 text-[9px]"
              style={{ backgroundColor: `${t.tag.color}22`, color: t.tag.color }}
            >
              {t.tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Bottom action row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <AssigneePicker
          assignees={task.assignees}
          members={members}
          onAdd={handleAddAssignee}
          onRemove={handleRemoveAssignee}
          iconSize="sm"
        />
        <DatePicker
          startDate={task.startDate}
          dueDate={task.dueDate}
          onChange={(range) => handleUpdateDates(range.startDate, range.dueDate)}
          iconSize="sm"
        />
        <PriorityPicker
          value={task.priority}
          onChange={handleUpdatePriority}
          onClear={() => handleUpdatePriority("NONE")}
          iconSize="sm"
        />
        <div className="ml-auto">
          <StatusPicker
            statuses={statuses}
            value={task.status.id}
            onChange={handleUpdateStatus}
            align="right"
          />
        </div>
      </div>
    </div>
  );
}

function BoardColumn({
  status,
  statuses,
  list,
  projectId,
  members,
  onOpenDetail,
}: {
  status: StatusItem;
  statuses: StatusItem[];
  list: TaskList;
  projectId: string;
  members: WorkspaceMember[];
  onOpenDetail: (taskId: string) => void;
}) {
  const { tasksByList, loadingLists, fetchTasks, createTask } = useTaskStore();
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  useEffect(() => {
    if (!tasksByList[list.id] && !loadingLists.has(list.id)) {
      void fetchTasks(projectId, list.id);
    }
  }, [list.id, projectId, fetchTasks, tasksByList, loadingLists]);

  const tasks = useMemo(() => {
    const all = tasksByList[list.id] ?? [];
    return all.filter((t) => t.status.id === status.id && t.depth === 0);
  }, [tasksByList, list.id, status.id]);

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
      toast.error(parseApiError(err).message);
    }
    setQuickCreateOpen(false);
  };

  return (
    <div className="w-[275px] shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-800 dark:bg-gray-900/40">
      {/* Column header */}
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-normal tracking-wide uppercase text-white"
          style={{ backgroundColor: status.color }}
        >
          <StatusIcon group={status.group} color="#fff" size={11} />
          {status.name}
        </span>
        <span className="text-xs font-normal text-gray-400">{tasks.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className="rounded p-0.5 text-gray-300 hover:text-gray-600 dark:hover:text-gray-300">
            <LuEllipsis className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setQuickCreateOpen(true)}
            className="rounded p-0.5 text-gray-300 hover:text-brand-500"
          >
            <LuPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Task cards */}
      <div className="space-y-2">
        {loadingLists.has(list.id) && tasks.length === 0 && (
          <p className="px-2 py-3 text-xs text-gray-400">Loading...</p>
        )}
        {tasks.map((task) => (
          <BoardCard
            key={task.id}
            task={task}
            statuses={statuses}
            members={members}
            listId={list.id}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>

      {/* Quick create */}
      {quickCreateOpen ? (
        <div className="mt-2">
          <TaskQuickCreate
            status={status}
            members={members}
            onSave={handleQuickCreate}
            onCancel={() => setQuickCreateOpen(false)}
            variant="board"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setQuickCreateOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-normal text-gray-400 transition-colors hover:text-brand-500"
        >
          <LuPlus className="h-3.5 w-3.5" />
          Add Task
        </button>
      )}
    </div>
  );
}

interface TaskBoardProps {
  projectId: string;
  lists: TaskList[];
  statuses: StatusItem[];
  members: WorkspaceMember[];
  onOpenTaskDetail: (taskId: string) => void;
}

export default function TaskBoard({ projectId, lists, statuses, members, onOpenTaskDetail }: TaskBoardProps) {
  const resolvedStatuses = statuses.length > 0 ? statuses : FALLBACK_STATUSES;

  return (
    <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="flex min-w-[860px] gap-3 items-start">
        {lists.map((list) =>
          resolvedStatuses.map((status) => (
            <BoardColumn
              key={`${list.id}-${status.id}`}
              status={status}
              statuses={resolvedStatuses}
              list={list}
              projectId={projectId}
              members={members}
              onOpenDetail={onOpenTaskDetail}
            />
          ))
        )}

        <div className="w-40 shrink-0 pt-1 text-gray-400">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-base font-normal hover:text-gray-600 dark:hover:text-gray-200"
          >
            <LuPlus className="h-4 w-4" />
            Add group
          </button>
        </div>
      </div>
    </div>
  );
}
