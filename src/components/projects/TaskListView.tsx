"use client";

import { useMemo, useRef, useState } from "react";
import { Task } from "@/types/task";
import { TaskList } from "@/services/task-list.service";
import { StatusItem } from "@/services/status.service";
import { getInitials } from "@/context/TaskContext";
import { findStatusForTask, legacyStatusFromBackendStatus } from "./status-utils";
import ListContextMenu from "./ListContextMenu";
import {
  LuCalendarDays,
  LuChevronDown,
  LuCircleDashed,
  LuEllipsis,
  LuFlag,
  LuPlus,
  LuRotateCcw,
  LuTrash2,
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
    id: "fallback_review",
    projectId: "",
    name: "REVIEW",
    color: "#f59e0b",
    group: "DONE",
    position: 3000,
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

export interface TaskListSectionData {
  list: TaskList;
  tasks: Task[];
}

interface TaskListViewProps {
  mode: "project" | "list";
  projectName: string;
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
}

function StatusIcon({ group, color }: { group: StatusItem["group"]; color: string }) {
  if (group === "NOT_STARTED") {
    return <LuCircleDashed className="h-3.5 w-3.5 shrink-0" style={{ color }} />;
  }
  if (group === "ACTIVE") {
    return <IoMdRadioButtonOn className="h-3.5 w-3.5 shrink-0" style={{ color }} />;
  }
  return <IoCheckmarkCircle className="h-3.5 w-3.5 shrink-0" style={{ color }} />;
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
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-300 text-[9px] font-normal text-white">
      {getInitials(assignee)}
    </span>
  );
}

function TaskStatusIcon({ task, statuses }: { task: Task; statuses: StatusItem[] }) {
  const matched = findStatusForTask(task, statuses);
  if (!matched) return <LuCircleDashed className="h-4 w-4 text-slate-400" />;
  return <StatusIcon group={matched.group} color={matched.color} />;
}

/* ─── Column widths shared between header and rows ─── */
const COL = "grid-cols-[minmax(0,1fr)_120px_120px_100px]";

function StatusGroup({
  list,
  status,
  tasks,
  statuses,
  onView,
  onAdd,
}: {
  list: TaskList;
  status: StatusItem;
  tasks: Task[];
  statuses: StatusItem[];
  onView: (task: Task) => void;
  onAdd: (options?: { statusId?: string; listId?: string }) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
      {/* Status row header */}
      <div className={`grid items-center gap-4 px-4 py-2.5 ${COL}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-2 text-left"
          >
            <LuChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            />
            <span
              className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-normal tracking-wider text-white uppercase"
              style={{ backgroundColor: status.color }}
            >
              <StatusIcon group={status.group} color="#fff" />
              {status.name}
            </span>
            <span className="text-xs font-normal text-gray-400">{tasks.length}</span>
          </button>
        </div>
        {/* Column labels only on the first group row feel wrong — they belong in the list header */}
      </div>

      {!collapsed && (
        <div className="pb-1">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`grid items-center gap-4 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/40 ${COL}`}
            >
              {/* Name */}
              <div className="flex min-w-0 items-center gap-2.5 pl-5">
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                  <TaskStatusIcon task={task} statuses={statuses} />
                </span>
                <button
                  type="button"
                  onClick={() => onView(task)}
                  className="truncate text-left font-normal hover:text-brand-500"
                >
                  {task.title}
                </button>
              </div>
              {/* Assignee */}
              <span>
                <AvatarCell assignee={task.assignees[0]} />
              </span>
              {/* Due date */}
              <span className="text-gray-400">
                <LuCalendarDays className="h-4 w-4" />
              </span>
              {/* Priority */}
              <span className="text-gray-400">
                <LuFlag className="h-4 w-4" />
              </span>
            </div>
          ))}

          {!status.isClosed && (
            <button
              type="button"
              onClick={() => onAdd({ listId: list.id, statusId: status.id })}
              className="flex items-center gap-2 px-[3.25rem] py-2 text-sm text-gray-400 transition-colors hover:text-brand-500"
            >
              <LuCircleDashed className="h-4 w-4" />
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
  tasks,
  projectName,
  statuses,
  onView,
  onAdd,
  onRenameList,
  onArchiveList,
  onDeleteList,
}: {
  list: TaskList;
  tasks: Task[];
  projectName: string;
  statuses: StatusItem[];
  onView: (task: Task) => void;
  onAdd: (options?: { statusId?: string; listId?: string }) => void;
  onRenameList?: (list: TaskList) => void;
  onArchiveList?: (list: TaskList) => void;
  onDeleteList?: (list: TaskList) => void;
}) {
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const statusRows = useMemo(() => {
    return statuses.map((status) => ({
      status,
      tasks: tasks.filter((task) =>
        status.id.startsWith("fallback_")
          ? task.status === legacyStatusFromBackendStatus(status)
          : findStatusForTask(task, [status])?.id === status.id
      ),
    }));
  }, [statuses, tasks]);

  const hasMenu = Boolean(onRenameList || onArchiveList || onDeleteList);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {/* ── List header ── */}
        <div className="border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 px-4 pt-4 pb-1">
            {/* Collapse toggle */}
            <button
              type="button"
              onClick={() => setHeaderCollapsed((c) => !c)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <LuChevronDown
                className={`h-3.5 w-3.5 transition-transform ${headerCollapsed ? "-rotate-90" : ""}`}
              />
            </button>

            {/* Project / List name */}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-normal text-gray-400 dark:text-gray-500">{projectName}</p>
              <p className="text-base font-normal text-gray-800 dark:text-white">{list.name}</p>
            </div>

            {/* Context menu trigger */}
            {hasMenu && (
              <button
                ref={menuTriggerRef}
                type="button"
                onClick={() => setMenuOpen(true)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <LuEllipsis className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Column headers */}
          {!headerCollapsed && (
            <div className={`grid items-center gap-4 px-4 pb-2 pt-3 text-[11px] font-normal text-gray-400 ${COL}`}>
              <span className="pl-12">Name</span>
              <span>Assignee</span>
              <span>Due date</span>
              <span>Priority</span>
              <span />
            </div>
          )}
        </div>

        {/* ── Status groups ── */}
        {!headerCollapsed &&
          statusRows.map(({ status, tasks: groupedTasks }) => (
            <StatusGroup
              key={`${list.id}-${status.id}`}
              list={list}
              status={status}
              tasks={groupedTasks}
              statuses={statuses}
              onView={onView}
              onAdd={onAdd}
            />
          ))}
      </div>

      {hasMenu && (
        <ListContextMenu
          list={list}
          triggerRef={menuTriggerRef}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          onRename={() => onRenameList?.(list)}
          onArchive={() => onArchiveList?.(list)}
          onDelete={() => onDeleteList?.(list)}
        />
      )}
    </>
  );
}

export default function TaskListView({
  mode,
  projectName,
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
}: TaskListViewProps) {
  const [archivedOpen, setArchivedOpen] = useState(false);
  const resolvedStatuses = statuses.length > 0 ? statuses : FALLBACK_STATUSES;

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
          tasks={section.tasks}
          projectName={projectName}
          statuses={resolvedStatuses}
          onView={onView}
          onAdd={onAdd}
          onRenameList={onRenameList}
          onArchiveList={mode === "project" ? onArchiveList : undefined}
          onDeleteList={onDeleteList}
        />
      ))}

      {/* ── + Create List ── */}
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

      {/* ── Archived lists ── */}
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
            <LuChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${archivedOpen ? "rotate-180" : ""}`}
            />
          </button>

          {archivedOpen && (
            <div className="space-y-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              {archivedLists.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-800"
                >
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
