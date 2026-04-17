"use client";

import { useMemo } from "react";
import { Task, TaskStatus } from "@/types/task";
import { StatusItem } from "@/services/status.service";
import { getInitials, useTasks } from "@/context/TaskContext";
import {
  LuCalendarDays,
  LuChevronDown,
  LuCircleDashed,
  LuFlag,
  LuPlus,
  LuUser,
} from "react-icons/lu";
import { IoCheckmarkCircle } from "react-icons/io5";
import { IoMdRadioButtonOn } from "react-icons/io";

// Fallback when no backend statuses yet
const FALLBACK_STATUSES: StatusItem[] = [
  {
    id: "fallback_todo", projectId: "", name: "TO DO", color: "#94a3b8",
    group: "NOT_STARTED", position: 1000, isDefault: true, isProtected: true, isClosed: false,
    createdAt: "", updatedAt: "",
  },
  {
    id: "fallback_inprogress", projectId: "", name: "IN PROGRESS", color: "#3b82f6",
    group: "ACTIVE", position: 2000, isDefault: true, isProtected: false, isClosed: false,
    createdAt: "", updatedAt: "",
  },
  {
    id: "fallback_review", projectId: "", name: "REVIEW", color: "#f59e0b",
    group: "DONE", position: 3000, isDefault: true, isProtected: false, isClosed: false,
    createdAt: "", updatedAt: "",
  },
  {
    id: "fallback_done", projectId: "", name: "COMPLETE", color: "#22c55e",
    group: "CLOSED", position: 4000, isDefault: true, isProtected: true, isClosed: true,
    createdAt: "", updatedAt: "",
  },
];

function matchTaskToStatus(task: Task, status: StatusItem): boolean {
  if (task.statusId) return task.statusId === status.id;

  const name = status.name.toLowerCase().replace(/[\s_-]/g, "");
  const legacyMap: Record<string, string[]> = {
    todo: ["todo"],
    inprogress: ["in-progress", "inprogress"],
    review: ["review"],
    done: ["done"],
    complete: ["done"],
    completed: ["done"],
  };
  const taskStatus = task.status.replace(/[\s_-]/g, "");
  return (legacyMap[name] ?? [name]).includes(taskStatus);
}

function StatusIcon({ group, color }: { group: StatusItem["group"]; color: string }) {
  if (group === "NOT_STARTED")
    return <LuCircleDashed className="h-3.5 w-3.5 shrink-0" style={{ color }} />;
  if (group === "ACTIVE")
    return <IoMdRadioButtonOn className="h-3.5 w-3.5 shrink-0" style={{ color }} />;
  return <IoCheckmarkCircle className="h-3.5 w-3.5 shrink-0" style={{ color }} />;
}

function TaskStatusIcon({ task, statuses }: { task: Task; statuses: StatusItem[] }) {
  const matched = statuses.find((s) => matchTaskToStatus(task, s));
  if (!matched) return <LuCircleDashed className="h-4 w-4 text-slate-400" />;
  return <StatusIcon group={matched.group} color={matched.color} />;
}

function AvatarCell({ assignee }: { assignee?: string }) {
  if (!assignee) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 text-gray-300 dark:border-gray-700 dark:text-gray-600">
        <LuUser className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-300 text-[9px] font-bold text-white">
      {getInitials(assignee)}
    </span>
  );
}

interface Props {
  onView: (task: Task) => void;
  onAdd: (status?: TaskStatus) => void;
  projectName: string;
  statuses: StatusItem[];
}

export default function TaskListView({ onView, onAdd, projectName, statuses }: Props) {
  const { filteredTasks } = useTasks();

  const resolvedStatuses = statuses.length > 0 ? statuses : FALLBACK_STATUSES;

  const statusRows = useMemo(() => {
    return resolvedStatuses.map((status) => ({
      status,
      tasks: filteredTasks.filter((t) => matchTaskToStatus(t, status)),
    }));
  }, [filteredTasks, resolvedStatuses]);

  return (
    <div className="space-y-5 pb-3">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {/* Section header */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <LuChevronDown className="h-4 w-4 text-gray-300" />
          <span className="text-sm font-medium text-gray-500 dark:text-gray-300">Team Space</span>
          <span className="text-[23px] font-semibold leading-none text-gray-800 dark:text-white">
            {projectName}
          </span>
        </div>

        {/* Column headers */}
        <div className="hidden items-center border-b border-gray-100 px-5 py-2 dark:border-gray-800 lg:flex">
          <div className="flex-1 pl-16 text-[11px] font-semibold text-gray-400">Name</div>
          <div className="grid grid-cols-3 gap-14 pr-4 text-[11px] font-semibold text-gray-400">
            <span>Assignee</span>
            <span>Due date</span>
            <span>Priority</span>
          </div>
        </div>

        {/* Status rows */}
        {statusRows.map(({ status, tasks }) => (
          <div
            key={status.id}
            className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
          >
            {/* Group header */}
            <div className="flex items-center px-5 py-2">
              <LuChevronDown className="h-4 w-4 text-gray-300 shrink-0" />
              <div className="ml-2 inline-flex items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide text-white"
                  style={{ backgroundColor: status.color }}
                >
                  <StatusIcon group={status.group} color="#fff" />
                  {status.name}
                </span>
                <span className="text-xs font-semibold text-gray-400">{tasks.length}</span>
              </div>

              <div className="ml-auto hidden grid-cols-3 gap-14 pr-4 text-[11px] font-semibold text-gray-400 lg:grid">
                <span>Assignee</span>
                <span>Due date</span>
                <span>Priority</span>
              </div>
            </div>

            {/* Task rows */}
            <div className="space-y-0.5 pb-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="grid grid-cols-1 items-center gap-2 px-9 py-2 text-sm text-gray-700 hover:bg-gray-50 lg:grid-cols-[minmax(0,1fr)_90px_90px_90px] dark:text-gray-200 dark:hover:bg-gray-800/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-4 w-4 items-center justify-center shrink-0">
                      <TaskStatusIcon task={task} statuses={resolvedStatuses} />
                    </span>
                    <button
                      type="button"
                      onClick={() => onView(task)}
                      className="truncate text-left font-medium hover:text-brand-500"
                    >
                      {task.title}
                    </button>
                  </div>
                  <span className="hidden lg:inline-flex">
                    <AvatarCell assignee={task.assignees[0]} />
                  </span>
                  <span className="hidden text-gray-400 lg:inline-flex">
                    <LuCalendarDays className="h-4 w-4" />
                  </span>
                  <span className="hidden text-gray-400 lg:inline-flex">
                    <LuFlag className="h-4 w-4" />
                  </span>
                </div>
              ))}

              {!status.isClosed && (
                <button
                  type="button"
                  onClick={() => onAdd()}
                  className="flex items-center gap-2 px-9 py-2 text-sm text-gray-400 transition-colors hover:text-brand-500"
                >
                  <LuPlus className="h-4 w-4" />
                  Add Task
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
