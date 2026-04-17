"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Task, TaskStatus } from "@/types/task";
import { useModal } from "@/hooks/useModal";
import { statusService, StatusItem, flattenGroupedStatuses } from "@/services/status.service";
import TaskListView from "./TaskListView";
import TaskBoard from "./TaskBoard";
import TaskDashboardHome from "./TaskDashboardHome";
import TaskCalendarView from "./TaskCalendarView";
import TaskForm from "./TaskForm";
import TaskDetailPanel from "./TaskDetailPanel";
import type { ReactElement } from "react";
import {
  LuChevronDown,
  LuCircle,
  LuCalendarDays,
  LuFilter,
  LuLayoutDashboard,
  LuList,
  LuSearch,
  LuSettings,
  LuSquareKanban,
  LuStar,
  LuUser,
} from "react-icons/lu";

type ProjectView = "overview" | "list" | "board" | "calendar";

const VIEW_TABS: Array<{
  id: ProjectView;
  label: string;
  icon: ReactElement;
}> = [
  { id: "overview", label: "Overview", icon: <LuLayoutDashboard className="h-4 w-4" /> },
  { id: "list", label: "List", icon: <LuList className="h-4 w-4" /> },
  { id: "board", label: "Board", icon: <LuSquareKanban className="h-4 w-4" /> },
  { id: "calendar", label: "Calendar", icon: <LuCalendarDays className="h-4 w-4" /> },
];

export default function TasksPage() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<ProjectView>("overview");
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus | undefined>();
  const [panelOpen, setPanelOpen] = useState(false);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const formModal = useModal();
  const projectName = searchParams.get("projectName")?.trim() || "Project 1";
  const projectId = searchParams.get("projectId") ?? null;
  const projectInitial = projectName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!projectId) return;
    statusService
      .list(projectId)
      .then((grouped) => setStatuses(flattenGroupedStatuses(grouped)))
      .catch(() => {
        // Silently fail — views will fall back to local status grouping
      });
  }, [projectId]);

  function openCreate(status?: TaskStatus) {
    setEditTask(null);
    setDefaultStatus(status);
    formModal.openModal();
  }

  function openEdit(task: Task) {
    setPanelOpen(false);
    setEditTask(task);
    setDefaultStatus(undefined);
    formModal.openModal();
  }

  function openDetail(task: Task) {
    setViewTask(task);
    setPanelOpen(true);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Project Header + View Tabs ─────────────────────── */}
      <div className="mb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="mb-1 flex items-center gap-2 pt-1">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-500 text-[11px] font-bold text-white">
            {projectInitial}
          </span>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-white">{projectName}</h1>
          <button
            type="button"
            className="text-gray-300 transition-colors hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300"
            aria-label="Favorite project"
          >
            <LuStar className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-5">
          <button
            type="button"
            className="pb-2 text-sm text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            Add Channel
          </button>
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`inline-flex items-center gap-1.5 border-b-2 pb-2 text-sm font-medium transition-colors ${
                view === tab.id
                  ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────── */}
      {view !== "overview" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"
            >
              Group: Status
              <LuChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Subtasks
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <button type="button" className="inline-flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-gray-200">
              <LuFilter className="h-4 w-4" />
              Filter
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-gray-200">
              <LuCircle className="h-4 w-4" />
              Closed
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-gray-200">
              <LuUser className="h-4 w-4" />
              Assignee
            </button>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white dark:bg-white dark:text-gray-900">
              S
            </span>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <LuSearch className="h-4 w-4" />
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-gray-200">
              <LuSettings className="h-4 w-4" />
              Customize
            </button>
            <button
              onClick={() => openCreate()}
              className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-3 py-1.5 font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              Add Task
              <LuChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">
        {view === "overview" && <TaskDashboardHome />}
        {view === "list" && (
          <TaskListView
            onView={openDetail}
            onAdd={openCreate}
            projectName={projectName}
            statuses={statuses}
          />
        )}
        {view === "board" && (
          <TaskBoard
            onView={openDetail}
            onAdd={openCreate}
            statuses={statuses}
          />
        )}
        {view === "calendar" && <TaskCalendarView onView={openDetail} />}
      </div>

      {/* ── Modals / Panels ────────────────────────────────── */}
      <TaskForm
        isOpen={formModal.isOpen}
        onClose={formModal.closeModal}
        editTask={editTask}
        defaultStatus={defaultStatus}
      />
      <TaskDetailPanel
        task={viewTask}
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onEdit={openEdit}
      />
    </div>
  );
}
