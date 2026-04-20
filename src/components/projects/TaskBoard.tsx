"use client";

import { Task } from "@/types/task";
import { StatusItem } from "@/services/status.service";
import { getInitials } from "@/context/TaskContext";
import { legacyStatusFromBackendStatus, taskMatchesStatus } from "./status-utils";
import {
  LuCalendarDays,
  LuCircleDashed,
  LuFlag,
  LuPlus,
  LuUser,
} from "react-icons/lu";
import { IoCheckmarkCircle } from "react-icons/io5";
import { IoMdRadioButtonOn } from "react-icons/io";

const FALLBACK_STATUSES: StatusItem[] = [
  {
    id: "fallback_todo",
    projectId: "",
    name: "TO DO",
    color: "#94a3b8",
    group: "NOT_STARTED",
    position: 1000,
    isDefault: true,
    isProtected: true,
    isClosed: false,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "fallback_inprogress",
    projectId: "",
    name: "IN PROGRESS",
    color: "#3b82f6",
    group: "ACTIVE",
    position: 2000,
    isDefault: true,
    isProtected: false,
    isClosed: false,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "fallback_done",
    projectId: "",
    name: "COMPLETE",
    color: "#22c55e",
    group: "CLOSED",
    position: 4000,
    isDefault: true,
    isProtected: true,
    isClosed: true,
    createdAt: "",
    updatedAt: "",
  },
];

function statusIcon(group: StatusItem["group"], color: string) {
  if (group === "NOT_STARTED") {
    return <LuCircleDashed className="h-3 w-3" style={{ color }} />;
  }
  if (group === "ACTIVE") {
    return <IoMdRadioButtonOn className="h-3 w-3" style={{ color }} />;
  }
  return <IoCheckmarkCircle className="h-3 w-3" style={{ color }} />;
}

function MiniAvatar({ assignee }: { assignee?: string }) {
  if (!assignee) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 text-gray-300 dark:border-gray-700 dark:text-gray-600">
        <LuUser className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-300 text-[9px] font-normal text-white">
      {getInitials(assignee)}
    </span>
  );
}

function formatDueLabel(isoDate: string) {
  if (!isoDate) return "";
  const due = new Date(`${isoDate}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TaskBoardCard({ task, onView }: { task: Task; onView: (task: Task) => void }) {
  const dueText = formatDueLabel(task.dueDate);
  const dueClass =
    dueText === "Yesterday"
      ? "bg-rose-100 text-rose-500"
      : dueText === "Today"
        ? "bg-blue-100 text-blue-500"
        : dueText === "Tomorrow"
          ? "bg-amber-100 text-amber-600"
          : "bg-slate-100 text-slate-500";

  return (
    <button
      type="button"
      onClick={() => onView(task)}
      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
    >
      <p className="line-clamp-2 text-sm font-normal leading-5 text-gray-800 dark:text-white">
        {task.title}
      </p>
      <div className="mt-2.5 flex items-center gap-1.5 text-gray-400">
        <MiniAvatar assignee={task.assignees[0]} />
        <LuCalendarDays className="h-3.5 w-3.5" />
        <LuFlag className="h-3.5 w-3.5" />
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        {task.priority === "high" || task.priority === "urgent" ? (
          <div className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-normal text-amber-600">
            <span className="text-[9px]">▶</span>
            High
          </div>
        ) : null}
        {dueText ? (
          <div
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-normal ${dueClass}`}
          >
            <span className="text-[9px]">◉</span>
            {dueText}
          </div>
        ) : null}
      </div>
    </button>
  );
}

interface TaskBoardProps {
  tasks: Task[];
  statuses: StatusItem[];
  onView: (task: Task) => void;
  onAdd: (options?: { statusId?: string }) => void;
}

export default function TaskBoard({
  tasks,
  statuses,
  onView,
  onAdd,
}: TaskBoardProps) {
  const resolvedStatuses = statuses.length > 0 ? statuses : FALLBACK_STATUSES;
  const activeStatuses = resolvedStatuses.filter((status) => !status.isClosed);
  const closedStatuses = resolvedStatuses.filter((status) => status.isClosed);

  const renderColumn = (status: StatusItem) => {
    const matchedTasks = tasks
      .filter((task) =>
        status.id.startsWith("fallback_")
          ? task.status === legacyStatusFromBackendStatus(status)
          : taskMatchesStatus(task, status)
      )
      .slice(0, 8);

    return (
      <div
        key={status.id}
        className="w-[275px] shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-800 dark:bg-gray-900/40"
      >
        <div className="mb-2.5 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-normal tracking-wide text-white uppercase"
            style={{ backgroundColor: status.color }}
          >
            {statusIcon(status.group, "#fff")}
            {status.name}
          </span>
          <span className="text-xs font-normal text-gray-400">{matchedTasks.length}</span>
        </div>

        <div className="space-y-2">
          {matchedTasks.map((task) => (
            <TaskBoardCard key={task.id} task={task} onView={onView} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => onAdd({ statusId: status.id })}
          className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-normal text-gray-400 transition-colors hover:text-brand-500"
        >
          <LuPlus className="h-3.5 w-3.5" />
          Add Task
        </button>
      </div>
    );
  };

  return (
    <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="flex min-w-[860px] gap-3">
        {activeStatuses.map(renderColumn)}
        {closedStatuses.map(renderColumn)}

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
