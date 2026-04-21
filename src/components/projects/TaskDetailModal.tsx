"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LuX,
  LuChevronLeft,
  LuChevronRight,
  LuPlus,
  LuArrowUpRight,
  LuStar,
  LuEllipsis,
  LuSearch,
  LuBell,
  LuFilter,
  LuTag,
  LuCalendarDays,
  LuFlag,
  LuUserRound,
  LuTimer,
  LuLink2,
} from "react-icons/lu";
import { MdOutlineDonutSmall } from "react-icons/md";
import { RiAiGenerate } from "react-icons/ri";
import { TaskDetail, TaskPriority, CreateSubtaskPayload, taskService } from "@/services/task.service";
import { StatusItem } from "@/services/status.service";
import { WorkspaceMember } from "@/services/workspace.service";
import { useTaskStore } from "@/stores/task.store";
import StatusIcon from "./StatusIcon";
import StatusPicker from "./StatusPicker";
import PriorityPicker from "./PriorityPicker";
import AssigneePicker from "./AssigneePicker";
import DatePicker from "./DatePicker";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";

interface TaskDetailModalProps {
  task: TaskDetail;
  statuses: StatusItem[];
  members: WorkspaceMember[];
  listId: string;
  onClose: () => void;
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const AVATAR_COLORS = [
  "#18181b", "#7c3aed", "#eab308", "#0f172a", "#6d28d9",
  "#ca8a04", "#1e1b4b", "#fbbf24", "#3b0764", "#292524",
];
function avatarBg(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) hash = (hash * 33) ^ id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function TaskDetailModal({ task, statuses, members, listId, onClose }: TaskDetailModalProps) {
  const { updateTask, addAssignee, removeAssignee, createSubtask, openTaskDetail } = useTaskStore();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [editingDesc, setEditingDesc] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [savingSubtask, setSavingSubtask] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const titleSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
  }, [task.id, task.title, task.description]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const saveTitle = useCallback((val: string) => {
    if (titleSaveTimeout.current) clearTimeout(titleSaveTimeout.current);
    titleSaveTimeout.current = setTimeout(async () => {
      const trimmed = val.trim();
      if (!trimmed || trimmed === task.title) return;
      try { await updateTask(task.id, listId, { title: trimmed }); }
      catch (err) { toast.error(parseApiError(err).message); }
    }, 800);
  }, [task.id, task.title, listId, updateTask]);

  const saveDescription = useCallback((val: string) => {
    if (descSaveTimeout.current) clearTimeout(descSaveTimeout.current);
    descSaveTimeout.current = setTimeout(async () => {
      try { await updateTask(task.id, listId, { description: val || null }); }
      catch (err) { toast.error(parseApiError(err).message); }
    }, 1000);
  }, [task.id, listId, updateTask]);

  const handleStatusChange = async (statusId: string) => {
    try { await updateTask(task.id, listId, { statusId }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };

  const handlePriorityChange = async (priority: TaskPriority) => {
    try { await updateTask(task.id, listId, { priority }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };

  const handleDatesChange = async (startDate: string | null, dueDate: string | null) => {
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

  const handleCreateSubtask = async () => {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed || savingSubtask) return;
    const defaultStatus = statuses[0];
    if (!defaultStatus) return;
    setSavingSubtask(true);
    try {
      const payload: CreateSubtaskPayload = { title: trimmed, statusId: defaultStatus.id };
      await createSubtask(task.id, listId, payload);
      setNewSubtaskTitle("");
      setAddingSubtask(false);
      toast.success("Subtask created");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setSavingSubtask(false);
    }
  };

  const listName = task.list.name;
  const projectName = task.list.project.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-950" style={{ maxHeight: "calc(100vh - 48px)" }}>

        {/* ── Top bar ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
          {/* Left: nav + breadcrumb */}
          <div className="flex items-center gap-2">
            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <LuChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <LuChevronRight className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <span>{projectName}</span>
              <span className="text-gray-300">/</span>
              <span>{listName}</span>
            </div>
            <button type="button" className="rounded border border-gray-200 p-0.5 text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
              <LuPlus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Created {formatDate(task.createdAt)}</span>
            <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
            <button type="button" className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              <RiAiGenerate className="mr-1 inline h-3.5 w-3.5" />
              Ask AI
            </button>
            <button type="button" className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              Share
            </button>
            <button type="button" className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
              <LuEllipsis className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
              <LuStar className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
              <LuArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <LuX className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">

          {/* ── Left: main content ── */}
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-8 py-6">

              {/* Task type + ID */}
              <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
                <span className="rounded border border-gray-200 px-2 py-0.5 text-gray-500 dark:border-gray-700">Task ▾</span>
                <span className="font-mono">{task.taskId}</span>
                <button type="button" className="ml-1 rounded border border-gray-200 px-2 py-0.5 text-[11px] hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                  <RiAiGenerate className="mr-0.5 inline h-3 w-3" />
                  Ask AI
                </button>
              </div>

              {/* Title */}
              <h1
                ref={titleRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  const val = e.currentTarget.textContent ?? "";
                  setTitle(val);
                  saveTitle(val);
                }}
                className="mb-4 text-2xl font-bold text-gray-900 outline-none dark:text-white"
                style={{ wordBreak: "break-word" }}
              >
                {task.title}
              </h1>

              {/* Ask Brain banner */}
              <button
                type="button"
                className="mb-6 flex w-full items-center gap-3 rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50 to-pink-50 px-4 py-3 text-left hover:from-rose-100 hover:to-pink-100 dark:border-rose-900/30 dark:from-rose-950/20 dark:to-pink-950/20"
              >
                <RiAiGenerate className="h-4 w-4 shrink-0 text-rose-400" />
                <span className="text-sm text-rose-400">Ask Brain to write a description, generate subtasks or find similar tasks</span>
              </button>

              {/* Fields — row layout */}
              <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-0 divide-y-0">
                {/* Status */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <MdOutlineDonutSmall className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    Status
                  </div>
                  <StatusPicker statuses={statuses} value={task.status.id} onChange={handleStatusChange} />
                </div>

                {/* Assignees */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <LuUserRound className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    Assignees
                  </div>
                  <AssigneePicker assignees={task.assignees} members={members} onAdd={handleAddAssignee} onRemove={handleRemoveAssignee} showLabel />
                </div>

                {/* Dates */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <LuCalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    Dates
                  </div>
                  <DatePicker startDate={task.startDate} dueDate={task.dueDate} onChange={(range) => handleDatesChange(range.startDate, range.dueDate)} showLabel />
                </div>

                {/* Priority */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <LuFlag className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    Priority
                  </div>
                  <PriorityPicker value={task.priority} onChange={handlePriorityChange} onClear={() => handlePriorityChange("NONE")} showLabel />
                </div>

                {/* Tags */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <LuTag className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    Tags
                  </div>
                  {task.tags.length === 0 ? (
                    <span className="text-sm text-gray-400">Empty</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {task.tags.map((t) => (
                        <span key={t.tag.id} className="rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: `${t.tag.color}22`, color: t.tag.color }}>
                          {t.tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Track Time */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <LuTimer className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    Track Time
                  </div>
                  {task.totalTimeLogged > 0 ? (
                    <span className="text-sm text-gray-700 dark:text-gray-300">{formatDuration(task.totalTimeLogged)}</span>
                  ) : (
                    <button type="button" className="text-sm text-gray-400 hover:text-brand-500">+ Add time</button>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                {editingDesc ? (
                  <textarea
                    ref={descRef}
                    autoFocus
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); saveDescription(e.target.value); }}
                    onBlur={() => setEditingDesc(false)}
                    rows={5}
                    placeholder="Add description..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDesc(true)}
                    className="w-full rounded-xl border border-dashed border-gray-200 p-3 text-left text-sm text-gray-400 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                  >
                    {description || "Add description"}
                  </button>
                )}
              </div>

              {/* Add fields */}
              <div className="mb-6">
                <button type="button" className="text-sm text-gray-400 hover:text-brand-500">
                  <LuPlus className="mr-1 inline h-3.5 w-3.5" />
                  Create a field in this List
                </button>
              </div>

              {/* Subtasks */}
              <div className="mb-6">
                <h3 className="mb-3 text-base font-semibold text-gray-800 dark:text-white">Add subtask</h3>

                {task.children.length > 0 && (
                  <div className="mb-2 space-y-0.5">
                    {task.children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => { void openTaskDetail(child.id); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 group"
                      >
                        <StatusIcon group={child.status.group} color={child.status.group === "CLOSED" ? "#2a9764" : child.status.color} size={13} />
                        <span className={`flex-1 text-sm group-hover:text-brand-500 ${child.isCompleted ? "text-gray-400 line-through" : "text-gray-700 dark:text-gray-200"}`}>
                          {child.title}
                        </span>
                        <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100">Open →</span>
                      </button>
                    ))}
                  </div>
                )}

                {addingSubtask ? (
                  <div className="rounded-xl border border-brand-300 p-3 dark:border-brand-700">
                    <input
                      autoFocus
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleCreateSubtask();
                        if (e.key === "Escape") { setAddingSubtask(false); setNewSubtaskTitle(""); }
                      }}
                      placeholder="Subtask name..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button type="button" onClick={() => { setAddingSubtask(false); setNewSubtaskTitle(""); }} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCreateSubtask()}
                        disabled={!newSubtaskTitle.trim() || savingSubtask}
                        className="rounded-lg bg-brand-500 px-3 py-1 text-xs text-white hover:bg-brand-600 disabled:opacity-50"
                      >
                        {savingSubtask ? "..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingSubtask(true)}
                    className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-500"
                  >
                    <LuPlus className="h-4 w-4" />
                    Add Task
                  </button>
                )}
              </div>

              {/* Attachments */}
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center dark:border-gray-800">
                <p className="text-sm text-gray-400">Drop your files here to upload</p>
              </div>
            </div>
          </div>

          {/* ── Right: Activity panel ── */}
          <div className="w-80 shrink-0 border-l border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
            {/* Activity header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Activity</h3>
              <div className="flex items-center gap-1.5">
                <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <LuSearch className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <LuBell className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <LuFilter className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Activity feed */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: avatarBg(task.creator.id) }}
                  >
                    {getInitials(task.creator.fullName)}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 dark:text-gray-300">
                      <span className="font-semibold">{task.creator.fullName}</span>
                      {" "}created this task
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">{formatDate(task.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Reply box — pinned to bottom */}
            <div className="shrink-0 border-t border-gray-100 p-3 dark:border-gray-800">
              <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                <p className="text-sm text-gray-400">Reply to comment...</p>
                <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                  <button type="button" className="text-gray-400 hover:text-gray-600"><LuPlus className="h-4 w-4" /></button>
                  <button type="button" className="text-xs text-gray-400 hover:text-gray-600">@</button>
                  <button type="button" className="text-gray-400 hover:text-gray-600"><LuLink2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

