"use client";

import { useMemo } from "react";
import { Task, TaskStatus } from "@/types/task";
import { getInitials, useTasks } from "@/context/TaskContext";
import { LuCalendarDays, LuChevronDown, LuCircleDashed, LuFlag, LuPlus, LuUser } from "react-icons/lu";
import { IoCheckmarkCircle } from "react-icons/io5";
import { IoMdRadioButtonOn } from "react-icons/io";

interface Props {
  onView: (task: Task) => void;
  onAdd: (status?: TaskStatus) => void;
  projectName: string;
}

type GroupRow = {
  id: "todo" | "active" | "done" | "closed";
  statusForAdd?: TaskStatus;
  label: string;
  badgeClass: string;
  iconClass: string;
  tasks: Task[];
};

type ProjectSection = {
  title: string;
  rows: GroupRow[];
};

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

function buildRows(tasks: Task[]): GroupRow[] {
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress" || t.status === "review");
  const todoTasks = tasks.filter((t) => t.status === "todo");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return [
    {
      id: "todo",
      statusForAdd: "todo",
      label: "TO DO",
      badgeClass: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
      iconClass: "text-slate-400",
      tasks: todoTasks,
    },
    {
      id: "active",
      statusForAdd: "in-progress",
      label: "ACTIVE",
      badgeClass: "bg-blue-500 text-white",
      iconClass: "text-blue-500",
      tasks: inProgressTasks,
    },
    {
      id: "done",
      statusForAdd: "done",
      label: "DONE",
      badgeClass: "bg-emerald-500 text-white",
      iconClass: "text-emerald-500",
      tasks: doneTasks,
    },
    {
      id: "closed",
      label: "CLOSED",
      badgeClass: "bg-slate-200 text-slate-600 dark:bg-gray-700 dark:text-gray-300",
      iconClass: "text-slate-500",
      tasks: [],
    },
  ];
}

function RowStatusIcon({ id, className }: { id: GroupRow["id"]; className: string }) {
  if (id === "todo") return <LuCircleDashed className={`h-3.5 w-3.5 ${className}`} />;
  if (id === "active") return <IoMdRadioButtonOn className={`h-3.5 w-3.5 ${className}`} />;
  return <IoCheckmarkCircle className={`h-3.5 w-3.5 ${className}`} />;
}

function TaskStatusIcon({ status }: { status: TaskStatus }) {
  if (status === "todo") return <LuCircleDashed className="h-4 w-4 text-slate-400" />;
  if (status === "in-progress" || status === "review") return <IoMdRadioButtonOn className="h-4 w-4 text-blue-500" />;
  return <IoCheckmarkCircle className="h-4 w-4 text-emerald-500" />;
}

export default function TaskListView({ onView, onAdd, projectName }: Props) {
  const { filteredTasks } = useTasks();

  const sections = useMemo<ProjectSection[]>(() => {
    const splitAt = Math.max(1, Math.ceil(filteredTasks.length / 2));
    const firstChunk = filteredTasks.slice(0, splitAt);
    const secondChunk = filteredTasks.slice(splitAt);

    const firstRows = buildRows(firstChunk);
    const secondRows = buildRows(secondChunk);

    return [
      { title: `Team Space ${projectName}`, rows: firstRows },
      { title: "Team Space Project 2", rows: secondRows },
    ];
  }, [filteredTasks, projectName]);

  return (
    <div className="space-y-5 pb-3">
      {sections.map((section) => (
        <div
          key={section.title}
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
            <LuChevronDown className="h-4 w-4 text-gray-300" />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-300">
              {section.title.split(" ").slice(0, 2).join(" ")}
            </span>
            <span className="text-[23px] font-semibold leading-none text-gray-800 dark:text-white">
              {section.title.split(" ").slice(2).join(" ")}
            </span>
          </div>

          {section.rows.map((row) => (
            <div
              key={`${section.title}-${row.id}`}
              className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
            >
              <div className="flex items-center px-5 py-2">
                <LuChevronDown className="h-4 w-4 text-gray-300" />
                <div className="ml-2 inline-flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${row.badgeClass}`}>
                    <RowStatusIcon id={row.id} className={row.iconClass} />
                    {row.label}
                  </span>
                  <span className="text-xs font-semibold text-gray-400">{row.tasks.length}</span>
                </div>

                <div className="ml-auto hidden grid-cols-3 gap-14 pr-4 text-[11px] font-semibold text-gray-400 lg:grid">
                  <span>Assignee</span>
                  <span>Due date</span>
                  <span>Priority</span>
                </div>
              </div>

              <div className="space-y-0.5 pb-2">
                {row.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-1 items-center gap-2 px-9 py-2 text-sm text-gray-700 hover:bg-gray-50 lg:grid-cols-[minmax(0,1fr)_90px_90px_90px] dark:text-gray-200 dark:hover:bg-gray-800/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-4 w-4 items-center justify-center">
                        <TaskStatusIcon status={task.status} />
                      </span>
                      <button
                        type="button"
                        onClick={() => onView(task)}
                        className="truncate text-left font-medium hover:text-brand-500"
                      >
                        {task.title}
                      </button>
                    </div>
                    <span className="hidden lg:inline-flex"><AvatarCell assignee={task.assignees[0]} /></span>
                    <span className="hidden text-gray-400 lg:inline-flex">
                      <LuCalendarDays className="h-4 w-4" />
                    </span>
                    <span className="hidden text-gray-400 lg:inline-flex">
                      <LuFlag className="h-4 w-4" />
                    </span>
                  </div>
                ))}

                {row.statusForAdd ? (
                  <button
                    type="button"
                    onClick={() => onAdd(row.statusForAdd)}
                    className="flex items-center gap-2 px-9 py-2 text-sm text-gray-400 transition-colors hover:text-brand-500"
                  >
                    <LuPlus className="h-4 w-4" />
                    Add Task
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
