"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuX,
  LuChevronLeft,
  LuChevronRight,
  LuPlus,
  LuArrowUpRight,
  LuStar,
  LuEllipsis,
  LuTag,
  LuCalendarDays,
  LuFlag,
  LuUserRound,
  LuTimer,
  LuTrash2,
  LuPencil,
  LuSearch,
  LuBell,
  LuFilter,
} from "react-icons/lu";
import { activityService, ActivityItem } from "@/services/activity.service";
import { MdOutlineDonutSmall } from "react-icons/md";
import { RiAiGenerate } from "react-icons/ri";
import { TaskDetail, TaskPriority, TaskAssignee, UpdateTaskPayload } from "@/services/task.service";
import { StatusItem } from "@/services/status.service";
import { WorkspaceMember } from "@/services/workspace.service";
import { useTaskStore } from "@/stores/task.store";
import StatusIcon from "./StatusIcon";
import StatusPicker from "./StatusPicker";
import PriorityPicker from "./PriorityPicker";
import AssigneePicker from "./AssigneePicker";
import DatePicker from "./DatePicker";
import TrackTimePanel from "./TrackTimePanel";
import TaskAttachments from "./TaskAttachments";
import TagPicker from "./TagPicker";
import RichTextEditor from "./RichTextEditor";
import TaskComments from "./TaskComments";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";

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

const AVATAR_COLORS = [
  "#18181b", "#7c3aed", "#eab308", "#0f172a", "#6d28d9",
  "#ca8a04", "#1e1b4b", "#fbbf24", "#3b0764", "#292524",
];
function avatarBg(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) hash = (hash * 33) ^ id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const SUBTASK_COL = "minmax(0,1fr) 110px 110px 80px 100px 32px";

function SubtaskRow({
  subtask,
  parentId,
  listId,
  statuses,
  members,
  onOpen,
}: {
  subtask: TaskDetail["children"][number];
  parentId: string;
  listId: string;
  statuses: StatusItem[];
  members: WorkspaceMember[];
  onOpen: (id: string) => void;
}) {
  const { updateSubtask, deleteSubtask, addAssignee, removeAssignee } = useTaskStore();
  const [hovered, setHovered] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(subtask.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const commit = async () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === subtask.title) { setTitleDraft(subtask.title); return; }
    try { await updateSubtask(subtask.id, parentId, listId, { title: trimmed } as UpdateTaskPayload); }
    catch (err) { toast.error(parseApiError(err).message); setTitleDraft(subtask.title); }
  };

  const handleMenuOpen = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="grid cursor-pointer items-center gap-2 py-1 pr-4 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/40"
        style={{ gridTemplateColumns: SUBTASK_COL }}
        onClick={() => { if (!editingTitle) onOpen(subtask.id); }}
      >
        {/* Name cell */}
        <div className="flex min-w-0 items-center gap-2 pl-2">
          <span className="w-3.5 shrink-0" />
          <span className="shrink-0">
            <StatusIcon group={subtask.status.group} color={subtask.status.group === "CLOSED" ? "#2a9764" : subtask.status.color} size={15} />
          </span>
          {editingTitle ? (
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void commit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); inputRef.current?.blur(); }
                if (e.key === "Escape") { setTitleDraft(subtask.title); setEditingTitle(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm text-gray-700 outline-none ring-1 ring-brand-400 dark:text-gray-200"
            />
          ) : (
            <span
              onClick={(e) => { e.stopPropagation(); setEditingTitle(true); setTitleDraft(subtask.title); }}
              className={`min-w-0 truncate cursor-text hover:text-brand-500 ${subtask.isCompleted ? "line-through text-gray-400" : ""}`}
            >
              {subtask.title}
            </span>
          )}
          {(subtask.tags?.length ?? 0) > 0 && (
            <div className="flex shrink-0 gap-1">
              {subtask.tags.slice(0, 2).map((t) => (
                <span key={t.tag.id} className="rounded px-1 py-0.5 text-[9px]" style={{ backgroundColor: `${t.tag.color}22`, color: t.tag.color }}>
                  {t.tag.name}
                </span>
              ))}
            </div>
          )}
          {/* Hover open button */}
          <button
            type="button"
            title="Open task"
            onClick={(e) => { e.stopPropagation(); onOpen(subtask.id); }}
            className={`ml-1 flex h-5 w-7 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-gray-400 shadow-sm transition-opacity hover:border-brand-400 hover:text-brand-500 dark:border-gray-700 dark:bg-gray-900 ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <LuPencil className="h-3 w-3" />
          </button>
        </div>

        {/* Assignee */}
        <div onClick={(e) => e.stopPropagation()}>
          <AssigneePicker
            assignees={subtask.assignees}
            members={members}
            onAdd={async (userId) => { try { await addAssignee(subtask.id, listId, [userId]); } catch (err) { toast.error(parseApiError(err).message); } }}
            onRemove={async (userId) => { try { await removeAssignee(subtask.id, listId, userId); } catch (err) { toast.error(parseApiError(err).message); } }}
          />
        </div>

        {/* Due date */}
        <div onClick={(e) => e.stopPropagation()}>
          <DatePicker
            startDate={subtask.startDate}
            dueDate={subtask.dueDate}
            onChange={async (range) => { try { await updateSubtask(subtask.id, parentId, listId, { startDate: range.startDate, dueDate: range.dueDate }); } catch (err) { toast.error(parseApiError(err).message); } }}
          />
        </div>

        {/* Priority */}
        <div onClick={(e) => e.stopPropagation()}>
          <PriorityPicker
            value={subtask.priority}
            onChange={async (priority) => { try { await updateSubtask(subtask.id, parentId, listId, { priority }); } catch (err) { toast.error(parseApiError(err).message); } }}
            onClear={async () => { try { await updateSubtask(subtask.id, parentId, listId, { priority: "NONE" }); } catch (err) { toast.error(parseApiError(err).message); } }}
          />
        </div>

        {/* Status */}
        <div onClick={(e) => e.stopPropagation()}>
          <StatusPicker
            statuses={statuses}
            value={subtask.status.id}
            onChange={async (statusId) => { try { await updateSubtask(subtask.id, parentId, listId, { statusId }); } catch (err) { toast.error(parseApiError(err).message); } }}
            align="right"
          />
        </div>

        {/* Three dots */}
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleMenuOpen}
            className={`rounded p-1 text-gray-400 transition-opacity hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 ${hovered || menuOpen ? "opacity-100" : "opacity-0"}`}
          >
            <LuEllipsis className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {menuOpen && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
          <div
            ref={menuRef}
            className="fixed z-[70] w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <button
              type="button"
              onClick={() => { onOpen(subtask.id); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <LuPencil className="h-3.5 w-3.5" />
              Open task
            </button>
            <button
              type="button"
              onClick={async () => {
                setMenuOpen(false);
                try { await deleteSubtask(subtask.id, parentId, listId); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <LuTrash2 className="h-3.5 w-3.5" />
              Delete subtask
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function SubtaskQuickAdd({
  parentId,
  listId,
  statuses,
  members,
  onClose,
}: {
  parentId: string;
  listId: string;
  statuses: StatusItem[];
  members: WorkspaceMember[];
  onClose: () => void;
}) {
  const { createSubtask } = useTaskStore();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("NONE");

  const handleAddAssignee = (userId: string) => {
    const member = members.find((m) => m.id === userId);
    if (!member || assigneeIds.includes(userId)) return;
    setAssigneeIds((prev) => [...prev, userId]);
    setAssignees((prev) => [...prev, { user: { id: member.id, fullName: member.fullName, avatarUrl: null, avatarColor: "#6366f1" }, assignedBy: "" }]);
  };

  const handleRemoveAssignee = (userId: string) => {
    setAssigneeIds((prev) => prev.filter((id) => id !== userId));
    setAssignees((prev) => prev.filter((a) => a.user.id !== userId));
  };

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    const defaultStatus = statuses[0];
    if (!defaultStatus) return;
    setSaving(true);
    try {
      await createSubtask(parentId, listId, { title: trimmed, statusId: defaultStatus.id, startDate, dueDate, priority });
      setTitle("");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const defaultStatus = statuses[0];

  return (
    <div className="flex items-center gap-2 border-t border-brand-100 bg-brand-50/30 py-1.5 pr-4 dark:border-brand-900/30 dark:bg-brand-950/10" style={{ paddingLeft: "0.5rem" }}>
      {defaultStatus && (
        <div className="flex w-6 shrink-0 items-center justify-center">
          <StatusIcon group={defaultStatus.group} color={defaultStatus.color} size={13} />
        </div>
      )}
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); void handleSave(); }
          if (e.key === "Escape") onClose();
        }}
        placeholder="Task Name or type '/' for commands"
        className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-300 dark:text-gray-200 dark:placeholder:text-gray-600"
      />
      <div className="flex shrink-0 items-center gap-1.5 border-l border-gray-200 pl-3 dark:border-gray-700">
        <div className="rounded-md border border-gray-200 dark:border-gray-700">
          <AssigneePicker assignees={assignees} members={members} onAdd={handleAddAssignee} onRemove={handleRemoveAssignee} iconSize="sm" />
        </div>
        <div className="rounded-md border border-gray-200 dark:border-gray-700">
          <DatePicker startDate={startDate} dueDate={dueDate} onChange={(range) => { setStartDate(range.startDate); setDueDate(range.dueDate); }} iconSize="sm" />
        </div>
        <div className="rounded-md border border-gray-200 dark:border-gray-700">
          <PriorityPicker value={priority} onChange={setPriority} onClear={() => setPriority("NONE")} iconSize="sm" />
        </div>
      </div>
      <button type="button" onClick={onClose} className="shrink-0 rounded-lg px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
      <button type="button" onClick={() => void handleSave()} disabled={!title.trim() || saving} className="shrink-0 rounded-lg bg-brand-500 px-2.5 py-1 text-xs text-white hover:bg-brand-600 disabled:opacity-50">
        {saving ? "..." : "Save ↵"}
      </button>
    </div>
  );
}


function ActivityFeed({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const page = await activityService.getTaskActivity(taskId, { cursor, limit: 25 });
      setItems((prev) => cursor ? [...prev, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch {
      // silently fail — activity is non-critical
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    setItems([]);
    setNextCursor(undefined);
    void load();
  }, [load]);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && nextCursor && !loading) void load(nextCursor);
      },
      { root: containerRef.current, threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loading, load]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
      <div className="space-y-4">
        {[...items].reverse().map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
        {loading && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-gray-400">Loading...</span>
          </div>
        )}
        {!loading && items.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">No activity yet.</p>
        )}
        <div ref={bottomRef} className="h-px" />
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const bg = avatarBg(item.actor.id);
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
        style={{ backgroundColor: bg }}
      >
        {getInitials(item.actor.fullName)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{item.displayText}</p>
        <p className="mt-0.5 text-[11px] text-gray-400">{formatDate(item.createdAt)}</p>
      </div>
    </div>
  );
}

export default function TaskDetailModal({ task, statuses, members, listId, onClose }: TaskDetailModalProps) {
  const { updateTask, addAssignee, removeAssignee, addTag, removeTag, openTaskDetail, refreshOpenTask } = useTaskStore();
  const currentUser = useAuthStore(s => s.user);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [rightTab, setRightTab] = useState<"comments" | "activity">("comments");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const saveDescription = useCallback(async (val: string) => {
    try { await updateTask(task.id, listId, { description: val || null }); }
    catch (err) { toast.error(parseApiError(err).message); }
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

  const listName = task.list.name;
  const projectName = task.list.project.name;

  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-6">
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
                  <TagPicker
                    taskId={task.id}
                    listId={listId}
                    currentTags={task.tags}
                    onAdd={(tagId) => addTag(task.id, listId, tagId)}
                    onRemove={(tagId) => removeTag(task.id, listId, tagId)}
                    variant="expanded"
                  />
                </div>

                {/* Track Time */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <LuTimer className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    Track Time
                  </div>
                  <TrackTimePanel
                    taskId={task.id}
                    totalTimeLogged={task.totalTimeLogged}
                    userName={currentUser?.fullName ?? "Me"}
                    userId={currentUser?.id ?? task.creator.id}
                    onUpdate={() => void refreshOpenTask()}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <RichTextEditor
                  value={description}
                  onChange={(html) => { setDescription(html); saveDescription(html); }}
                  placeholder="Add description..."
                />
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
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-800 dark:text-white">Subtasks</h3>
                  <button
                    type="button"
                    onClick={() => setAddingSubtask(true)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-500"
                  >
                    <LuPlus className="h-3.5 w-3.5" />
                    Add subtask
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  {task.children.map((child) => (
                    <SubtaskRow
                      key={child.id}
                      subtask={child}
                      parentId={task.id}
                      listId={listId}
                      statuses={statuses}
                      members={members}
                      onOpen={(id) => { void openTaskDetail(id); }}
                    />
                  ))}
                  {addingSubtask && (
                    <SubtaskQuickAdd
                      parentId={task.id}
                      listId={listId}
                      statuses={statuses}
                      members={members}
                      onClose={() => setAddingSubtask(false)}
                    />
                  )}
                  {task.children.length === 0 && !addingSubtask && (
                    <div className="px-3 py-4 text-center text-sm text-gray-400">No subtasks yet</div>
                  )}
                </div>
              </div>

              {/* Attachments */}
              <TaskAttachments taskId={task.id} userId={currentUser?.id ?? task.creator.id} />
            </div>
          </div>

          {/* ── Right: Comments + Activity panel ── */}
          <div className="w-80 shrink-0 border-l border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="flex shrink-0 items-center border-b border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setRightTab("comments")}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  rightTab === "comments"
                    ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Comments
              </button>
              <button
                type="button"
                onClick={() => setRightTab("activity")}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  rightTab === "activity"
                    ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Activity
              </button>
              <div className="flex items-center gap-1 pr-2">
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

            {rightTab === "comments" ? (
              <TaskComments taskId={task.id} currentUser={currentUser} members={members} />
            ) : (
              <ActivityFeed taskId={task.id} />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

