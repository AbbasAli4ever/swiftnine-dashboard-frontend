"use client";

import { Task, TaskStatus } from "@/types/task";
import { getInitials, useTasks } from "@/context/TaskContext";
import {
  LuCalendarDays,
  LuFlag,
  LuPlus,
  LuUser,
} from "react-icons/lu";

interface Props {
  onView: (task: Task) => void;
  onAdd: (status?: TaskStatus) => void;
}

type ColumnDef = {
  status: TaskStatus | "review";
  label: string;
  chipClass: string;
};

const COLUMNS: ColumnDef[] = [
  { status: "todo", label: "TO DO", chipClass: "bg-slate-200 text-slate-600" },
  { status: "in-progress", label: "IN PROGRESS", chipClass: "bg-blue-500 text-white" },
  { status: "done", label: "COMPLETE", chipClass: "bg-emerald-500 text-white" },
];

function MiniAvatar({ assignee }: { assignee?: string }) {
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

function formatDueLabel(isoDate: string): string {
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
  const dueClass = dueText === "Yesterday"
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
      <p className="line-clamp-2 text-sm font-semibold leading-5 text-gray-800 dark:text-white">
        {task.title}
      </p>
      <div className="mt-2.5 flex items-center gap-1.5 text-gray-400">
        <MiniAvatar assignee={task.assignees[0]} />
        <LuCalendarDays className="h-3.5 w-3.5" />
        <LuFlag className="h-3.5 w-3.5" />
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        {task.priority === "high" || task.priority === "urgent" ? (
          <div className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
            <span className="text-[9px]">▶</span>
            High
          </div>
        ) : null}
        {dueText ? (
          <div className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${dueClass}`}>
            <span className="text-[9px]">◉</span>
            {dueText}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function byColumnStatus(task: Task, status: ColumnDef["status"]): boolean {
  if (status === "in-progress") return task.status === "in-progress" || task.status === "review";
  return task.status === status;
}

export default function TaskBoard({ onView, onAdd }: Props) {
  const { filteredTasks } = useTasks();

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-[860px] gap-3">
        {COLUMNS.map((column) => {
          const tasks = filteredTasks.filter((t) => byColumnStatus(t, column.status)).slice(0, 8);
          return (
            <div
              key={column.status}
              className="w-[275px] shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-800 dark:bg-gray-900/40"
            >
              <div className="mb-2.5 flex items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ${column.chipClass}`}>
                  {column.label}
                </span>
                <span className="text-xs font-semibold text-gray-400">{tasks.length}</span>
              </div>

              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskBoardCard key={task.id} task={task} onView={onView} />
                ))}
              </div>

              <button
                type="button"
                onClick={() => onAdd(column.status === "review" ? "in-progress" : column.status)}
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-brand-500"
              >
                <LuPlus className="h-3.5 w-3.5" />
                Add Task
              </button>
            </div>
          );
        })}

        <div className="w-[160px] shrink-0 pt-1 text-gray-400">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-base font-semibold hover:text-gray-600 dark:hover:text-gray-200"
          >
            <LuPlus className="h-4 w-4" />
            Add group
          </button>
        </div>
      </div>
    </div>
  );
}
