"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuChevronRight,
  LuEllipsis,
  LuGripVertical,
  LuLink,
  LuPencil,
  LuPlus,
  LuTrash2,
  LuLoader,
} from "react-icons/lu";
import { TaskListItem, TaskPriority, CreateSubtaskPayload } from "@/services/task.service";
import { StatusItem } from "@/services/status.service";
import { WorkspaceMember } from "@/services/workspace.service";
import { useTaskStore } from "@/stores/task.store";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import StatusIcon from "./StatusIcon";
import PriorityPicker from "./PriorityPicker";
import AssigneePicker from "./AssigneePicker";
import DatePicker from "./DatePicker";
import StatusPicker from "./StatusPicker";

const COL = "minmax(0,1fr) 72px 110px 110px 80px 100px 32px";

interface TaskRowProps {
  task: TaskListItem;
  statuses: StatusItem[];
  members: WorkspaceMember[];
  listId: string;
  onView: (taskId: string) => void;
  onUpdateStatus: (statusId: string) => void;
  onUpdatePriority: (priority: TaskPriority) => void;
  onUpdateDates: (startDate: string | null, dueDate: string | null) => void;
  onAddAssignee: (userId: string) => void;
  onRemoveAssignee: (userId: string) => void;
  onDelete: () => void;
  dragHandleProps?: Record<string, unknown>;
  indent?: number;
}

function SubtaskQuickCreate({
  parentId,
  listId,
  statuses,
  onClose,
}: {
  parentId: string;
  listId: string;
  statuses: StatusItem[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const { createSubtask } = useTaskStore();

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    const defaultStatus = statuses[0];
    if (!defaultStatus) return;
    setSaving(true);
    try {
      const payload: CreateSubtaskPayload = { title: trimmed, statusId: defaultStatus.id };
      await createSubtask(parentId, listId, payload);
      setTitle("");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="grid items-center gap-2 border-t border-brand-100 bg-brand-50/30 py-1 pr-4 dark:border-brand-900/30 dark:bg-brand-950/10"
      style={{ gridTemplateColumns: COL }}
    >
      <div className="flex min-w-0 items-center gap-1 pl-16">
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void handleSave(); }
            if (e.key === "Escape") onClose();
          }}
          placeholder="Subtask name..."
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
        />
      </div>
      <div />
      <div />
      <div />
      <div />
      <div />
      <div className="flex items-center gap-1">
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!title.trim() || saving}
          className="rounded bg-brand-500 px-1.5 py-0.5 text-[11px] text-white hover:bg-brand-600 disabled:opacity-40"
        >
          {saving ? "..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function TaskRow({
  task,
  statuses,
  members,
  listId,
  onView,
  onUpdateStatus,
  onUpdatePriority,
  onUpdateDates,
  onAddAssignee,
  onRemoveAssignee,
  onDelete,
  dragHandleProps,
  indent = 0,
}: TaskRowProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    expandedTasks,
    toggleExpand,
    subtasksByParent,
    loadingSubtasks,
    updateSubtask,
    deleteSubtask,
    addAssignee,
    removeAssignee,
  } = useTaskStore();

  const isExpanded = expandedTasks.has(task.id);
  const subtasks = subtasksByParent[task.id] ?? [];
  const isLoadingSubtasks = loadingSubtasks.has(task.id);
  const hasChildren = task._count.children > 0;

  const handleMenuOpen = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  const indentPx = indent * 24;

  return (
    <>
      <div
        className="group relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className="grid items-center gap-2 py-1 pr-4 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/40"
          style={{ gridTemplateColumns: COL }}
        >
          {/* Name cell */}
          <div className="flex min-w-0 items-center gap-1 pl-2" style={{ paddingLeft: `${8 + indentPx}px` }}>
            {/* Drag handle */}
            {indent < 2 && (
              <span
                className={`cursor-grab shrink-0 text-gray-300 transition-opacity ${hovered ? "opacity-100" : "opacity-0"}`}
                {...dragHandleProps}
              >
                <LuGripVertical className="h-3.5 w-3.5" />
              </span>
            )}
            {indent > 0 && <span className="w-3.5 shrink-0" />}

            {/* Expand/collapse toggle */}
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(task.id)}
                className="shrink-0 text-gray-400 hover:text-gray-600"
              >
                {isLoadingSubtasks ? (
                  <LuLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LuChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                )}
              </button>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}

            {/* Status icon */}
            <span className="shrink-0">
              <StatusIcon
                group={task.status.group}
                color={task.status.group === "CLOSED" ? "#2a9764" : task.status.color}
                size={15}
              />
            </span>

            {/* Title */}
            <button
              type="button"
              onClick={() => onView(task.id)}
              className={`min-w-0 truncate text-left text-sm hover:text-brand-500 ${task.isCompleted ? "line-through text-gray-400" : ""}`}
            >
              {task.title}
            </button>

            {/* Tags */}
            {task.tags.length > 0 && (
              <div className="flex shrink-0 gap-1">
                {task.tags.slice(0, 2).map((t) => (
                  <span
                    key={t.tag.id}
                    className="rounded px-1 py-0.5 text-[9px]"
                    style={{ backgroundColor: `${t.tag.color}22`, color: t.tag.color }}
                  >
                    {t.tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Hover actions */}
          <div className="flex shrink-0 items-center gap-0.5">
            {hovered && (
              <>
                {indent < 2 && (
                  <button
                    type="button"
                    title="Add subtask"
                    onClick={() => { setAddingSubtask(true); if (!isExpanded) toggleExpand(task.id); }}
                    className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700"
                  >
                    <LuPlus className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  title="Copy link"
                  className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700"
                >
                  <LuLink className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  title="Open task"
                  onClick={() => onView(task.id)}
                  className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700"
                >
                  <LuPencil className="h-3 w-3" />
                </button>
              </>
            )}
          </div>

          {/* Assignee */}
          <div>
            <AssigneePicker assignees={task.assignees} members={members} onAdd={onAddAssignee} onRemove={onRemoveAssignee} />
          </div>

          {/* Due date */}
          <div>
            <DatePicker
              startDate={task.startDate}
              dueDate={task.dueDate}
              onChange={(range) => onUpdateDates(range.startDate, range.dueDate)}
            />
          </div>

          {/* Priority */}
          <div>
            <PriorityPicker value={task.priority} onChange={onUpdatePriority} onClear={() => onUpdatePriority("NONE")} />
          </div>

          {/* Status */}
          <div>
            <StatusPicker statuses={statuses} value={task.status.id} onChange={onUpdateStatus} align="right" />
          </div>

          {/* Three dots */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleMenuOpen}
              className={`rounded p-1 text-gray-400 transition-opacity hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 ${hovered || menuOpen ? "opacity-100" : "opacity-0"}`}
            >
              <LuEllipsis className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Subtask rows */}
      {isExpanded && (
        <>
          {isLoadingSubtasks && subtasks.length === 0 && (
            <div className="py-1 pl-20 text-xs text-gray-400">Loading...</div>
          )}
          {subtasks.map((subtask) => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              statuses={statuses}
              members={members}
              listId={listId}
              onView={onView}
              onUpdateStatus={async (statusId) => {
                try { await updateSubtask(subtask.id, task.id, listId, { statusId }); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              onUpdatePriority={async (priority) => {
                try { await updateSubtask(subtask.id, task.id, listId, { priority }); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              onUpdateDates={async (startDate, dueDate) => {
                try { await updateSubtask(subtask.id, task.id, listId, { startDate, dueDate }); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              onAddAssignee={async (userId) => {
                try { await addAssignee(subtask.id, listId, [userId]); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              onRemoveAssignee={async (userId) => {
                try { await removeAssignee(subtask.id, listId, userId); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              onDelete={async () => {
                try { await deleteSubtask(subtask.id, task.id, listId); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              indent={indent + 1}
            />
          ))}

          {indent < 2 && addingSubtask && (
            <SubtaskQuickCreate
              parentId={task.id}
              listId={listId}
              statuses={statuses}
              onClose={() => setAddingSubtask(false)}
            />
          )}

          {indent < 2 && !addingSubtask && (
            <button
              type="button"
              onClick={() => setAddingSubtask(true)}
              className="flex items-center gap-1 py-0.5 text-[11px] text-gray-400 hover:text-brand-500"
              style={{ paddingLeft: `${32 + indentPx + 24}px` }}
            >
              <LuPlus className="h-3 w-3" />
              Add subtask
            </button>
          )}
        </>
      )}

      {/* Fixed dropdown menu */}
      {menuOpen && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            ref={menuRef}
            className="fixed z-50 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <button
              type="button"
              onClick={() => { onView(task.id); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <LuPencil className="h-3.5 w-3.5" />
              Open task
            </button>
            {indent < 2 && (
              <button
                type="button"
                onClick={() => { setAddingSubtask(true); if (!isExpanded) toggleExpand(task.id); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <LuPlus className="h-3.5 w-3.5" />
                Add subtask
              </button>
            )}
            <button
              type="button"
              onClick={() => { onDelete(); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <LuTrash2 className="h-3.5 w-3.5" />
              Delete task
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
