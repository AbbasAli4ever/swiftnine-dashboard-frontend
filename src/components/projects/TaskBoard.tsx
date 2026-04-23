"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const CARD_HEIGHT = 110;

interface DragState {
  task: TaskListItem;
  listId: string;
  fromStatusId: string;
  fromIdx: number;
  startX: number;
  startY: number;
  cardWidth: number;
  cardOffsetX: number; // cursor offset within the card
  cardOffsetY: number;
}

// ── Ghost card that follows the cursor ──────────────────────────────────────
function GhostCard({
  task,
  x,
  y,
  width,
}: {
  task: TaskListItem;
  x: number;
  y: number;
  width: number;
}) {
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: y,
        left: x,
        width,
        zIndex: 9999,
        pointerEvents: "none",
        opacity: 0.75,
        transform: "rotate(1.5deg) scale(1.02)",
      }}
      className="rounded-xl border border-brand-400 bg-white p-3 shadow-2xl dark:bg-gray-900 select-none"
    >
      <div className="mb-2.5 flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          <StatusIcon
            group={task.status.group}
            color={task.status.group === "CLOSED" ? "#2a9764" : task.status.color}
            size={15}
          />
        </span>
        <span className={`flex-1 text-left text-sm font-normal leading-5 ${task.isCompleted ? "text-gray-400 line-through" : "text-gray-800 dark:text-white"}`}>
          {task.title}
        </span>
      </div>
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
      <div className="flex items-center gap-1.5 mt-1">
        {task.assignees.slice(0, 3).map((a) => (
          <span
            key={a.user.id}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-medium text-white"
            style={{ backgroundColor: "#6366f1" }}
          >
            {a.user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </span>
        ))}
      </div>
    </div>,
    document.body
  );
}

function CardContent({
  task,
  statuses,
  members,
  listId,
  ghost,
}: {
  task: TaskListItem;
  statuses: StatusItem[];
  members: WorkspaceMember[];
  listId: string;
  ghost?: boolean;
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
    <>
      <div className="mb-2.5 flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          <StatusIcon
            group={task.status.group}
            color={task.status.group === "CLOSED" ? "#2a9764" : task.status.color}
            size={15}
          />
        </span>
        <span className={`flex-1 text-left text-sm font-normal leading-5 ${task.isCompleted ? "text-gray-400 line-through" : "text-gray-800 dark:text-white"}`}>
          {task.title}
        </span>
      </div>
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
      {!ghost && (
        <div className="flex items-center gap-1.5 flex-wrap" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <AssigneePicker assignees={task.assignees} members={members} onAdd={handleAddAssignee} onRemove={handleRemoveAssignee} iconSize="sm" />
          <DatePicker startDate={task.startDate} dueDate={task.dueDate} onChange={(r) => handleUpdateDates(r.startDate, r.dueDate)} iconSize="sm" />
          <PriorityPicker value={task.priority} onChange={handleUpdatePriority} onClear={() => handleUpdatePriority("NONE")} iconSize="sm" />
          <div className="ml-auto">
            <StatusPicker statuses={statuses} value={task.status.id} onChange={handleUpdateStatus} align="right" />
          </div>
        </div>
      )}
    </>
  );
}

function BoardCard({
  task,
  statuses,
  members,
  listId,
  isDragging,
  suppressClickRef,
  onOpenDetail,
  onDragStart,
}: {
  task: TaskListItem;
  statuses: StatusItem[];
  members: WorkspaceMember[];
  listId: string;
  isDragging: boolean;
  suppressClickRef: React.RefObject<boolean>;
  onOpenDetail: (taskId: string) => void;
  onDragStart: (e: React.PointerEvent, task: TaskListItem, listId: string, cardEl: HTMLDivElement) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={cardRef}
      onPointerDown={(e) => {
        // Don't start a drag if a modal/overlay is open above us
        if (document.querySelector("[data-modal]")) return;
        if (cardRef.current) onDragStart(e, task, listId, cardRef.current);
      }}
      onClick={(e) => {
        if (isDragging || suppressClickRef.current) return;
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("input") || target.closest("a")) return;
        onOpenDetail(task.id);
      }}
      style={{ opacity: isDragging ? 0 : 1 }}
      className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900 select-none transition-opacity cursor-pointer"
    >
      <CardContent task={task} statuses={statuses} members={members} listId={listId} />
    </div>
  );
}

function BoardColumn({
  status,
  statuses,
  list,
  projectId,
  members,
  dragState,
  dragOverStatusId,
  dropIdx,
  suppressClickRef,
  onOpenDetail,
  onDragStart,
}: {
  status: StatusItem;
  statuses: StatusItem[];
  list: TaskList;
  projectId: string;
  members: WorkspaceMember[];
  dragState: DragState | null;
  dragOverStatusId: string | null;
  dropIdx: number | null;
  suppressClickRef: React.RefObject<boolean>;
  onOpenDetail: (taskId: string) => void;
  onDragStart: (e: React.PointerEvent, task: TaskListItem, listId: string, cardEl: HTMLDivElement) => void;
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

  const isOver = dragState !== null && dragOverStatusId === status.id;
  const isDraggingFromHere = dragState?.fromStatusId === status.id;
  const isCrossColumnTarget = isOver && !isDraggingFromHere;

  const cardRefsMap = useRef<Record<string, HTMLDivElement | null>>({});

  const getCardShift = (task: TaskListItem, idx: number): number => {
    if (!isDraggingFromHere || !dragState) return 0;
    if (task.id === dragState.task.id) return 0;
    const from = dragState.fromIdx;
    const to = dropIdx ?? from;
    const draggedCard = cardRefsMap.current[dragState.task.id];
    const draggedHeight = (draggedCard?.offsetHeight ?? CARD_HEIGHT) + 8; // +8 for gap
    if (from < to && idx > from && idx <= to) return -draggedHeight;
    if (from > to && idx < from && idx >= to) return draggedHeight;
    return 0;
  };

  return (
    <div
      data-status-id={status.id}
      className={`w-[275px] shrink-0 rounded-xl border p-2.5 transition-colors ${
        isCrossColumnTarget
          ? "border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/20"
          : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40"
      }`}
    >
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
      <div className="space-y-2" style={{ userSelect: dragState ? "none" : undefined }}>
        {loadingLists.has(list.id) && tasks.length === 0 && (
          <p className="px-2 py-3 text-xs text-gray-400">Loading...</p>
        )}
        {tasks.map((task, idx) => {
          const isDraggingThis = dragState?.task.id === task.id;
          return (
            <div
              key={task.id}
              ref={(el) => { cardRefsMap.current[task.id] = el; }}
              style={{
                transform: `translateY(${getCardShift(task, idx)}px)`,
                transition: "transform 180ms ease",
                opacity: isDraggingThis ? 0 : 1,
              }}
            >
              <BoardCard
                task={task}
                statuses={statuses}
                members={members}
                listId={list.id}
                isDragging={isDraggingThis}
                suppressClickRef={suppressClickRef}
                onOpenDetail={onOpenDetail}
                onDragStart={onDragStart}
              />
            </div>
          );
        })}
        {/* Space that opens in target column when dragging in from another status */}
        <div
          style={{
            height: isCrossColumnTarget ? CARD_HEIGHT : 0,
            transition: "height 180ms ease",
            overflow: "hidden",
          }}
        />
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

  const { tasksByList, updateTask, reorderTasks, fetchTasks } = useTaskStore();

  const dragRef = useRef<DragState | null>(null);
  const pendingRef = useRef<{ state: DragState } | null>(null);
  const suppressClickRef = useRef(false);
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);
  const [dragOverStatusId, setDragOverStatusId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [cursorX, setCursorX] = useState(0);
  const [cursorY, setCursorY] = useState(0);

  const DRAG_THRESHOLD = 5;

  // Use window-level listeners so they always fire regardless of render state
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // Threshold check — activate drag once moved enough
      if (pendingRef.current && !dragRef.current) {
        const { state } = pendingRef.current;
        const dx = Math.abs(e.clientX - state.startX);
        const dy = Math.abs(e.clientY - state.startY);
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          e.preventDefault();
          dragRef.current = state;
          let styleEl = document.getElementById("__drag_cursor__") as HTMLStyleElement | null;
          if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "__drag_cursor__"; document.head.appendChild(styleEl); }
          styleEl.textContent = "*{cursor:grabbing!important}";
          setActiveDrag(state);
          setDragOverStatusId(state.fromStatusId);
          setDropIdx(state.fromIdx);
          setCursorX(state.startX - state.cardOffsetX);
          setCursorY(state.startY - state.cardOffsetY);
          pendingRef.current = null;
        }
        return;
      }

      if (!dragRef.current) return;
      const drag = dragRef.current;
      setCursorX(e.clientX - drag.cardOffsetX);
      setCursorY(e.clientY - drag.cardOffsetY);

      // Detect which column the cursor is over via elementFromPoint
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const colEl = el?.closest("[data-status-id]");
      const hoveredStatusId = colEl?.getAttribute("data-status-id") ?? null;
      if (hoveredStatusId) {
        setDragOverStatusId((prev) => {
          if (prev !== hoveredStatusId) {
            if (hoveredStatusId !== drag.fromStatusId) setDropIdx(null);
            return hoveredStatusId;
          }
          return prev;
        });
      }

      setDropIdx((currentDrop) => {
        if ((hoveredStatusId ?? dragOverStatusIdRef.current) === drag.fromStatusId) {
          const dy = e.clientY - drag.startY;
          const columnTasks = (useTaskStore.getState().tasksByList[drag.listId] ?? []).filter(
            (t) => t.status.id === drag.fromStatusId && t.depth === 0
          );
          const slot = Math.round(drag.fromIdx + dy / CARD_HEIGHT);
          return Math.max(0, Math.min(columnTasks.length - 1, slot));
        }
        return currentDrop;
      });
    };

    const onUp = () => {
      // Released before threshold — clear pending, allow normal click
      if (pendingRef.current) {
        pendingRef.current = null;
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;

      // Suppress the click that fires right after pointerUp
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 80);

      const targetStatusId = dragOverStatusIdRef.current ?? drag.fromStatusId;
      const from = drag.fromIdx;
      const to = dropIdxRef.current ?? from;

      dragRef.current = null;
      const styleEl = document.getElementById("__drag_cursor__");
      if (styleEl) styleEl.textContent = "";
      setActiveDrag(null);
      setDragOverStatusId(null);
      setDropIdx(null);

      const isSameStatus = targetStatusId === drag.fromStatusId;
      if (isSameStatus && from === to) return;

      if (!isSameStatus) {
        updateTask(drag.task.id, drag.listId, { statusId: targetStatusId }).catch((err) => {
          toast.error(parseApiError(err).message);
          void fetchTasks(projectId, drag.listId);
        });
      } else {
        const allListTasks = useTaskStore.getState().tasksByList[drag.listId] ?? [];
        const columnTasks = allListTasks.filter((t) => t.status.id === drag.fromStatusId && t.depth === 0);
        const reordered = [...columnTasks];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);

        const others = allListTasks.filter((t) => !(t.status.id === drag.fromStatusId && t.depth === 0));
        useTaskStore.setState((s) => ({
          tasksByList: { ...s.tasksByList, [drag.listId]: [...others, ...reordered] },
        }));

        const allRoot = allListTasks.filter((t) => t.depth === 0);
        const reorderedIds = new Set(reordered.map((t) => t.id));
        const withGap = allRoot.filter((t) => !reorderedIds.has(t.id));
        const firstOfGroup = allRoot.find((t) => t.status.id === drag.fromStatusId);
        const insertAt = firstOfGroup ? withGap.findIndex((t) => {
          const origIdx = allRoot.findIndex((r) => r.id === t.id);
          const groupStart = allRoot.findIndex((r) => r.id === firstOfGroup.id);
          return origIdx > groupStart;
        }) : -1;
        const finalInsert = insertAt < 0 ? withGap.length : insertAt;
        withGap.splice(finalInsert, 0, ...reordered);
        reorderTasks(projectId, drag.listId, withGap.map((t) => t.id)).catch((err) => {
          toast.error(parseApiError(err).message);
          void fetchTasks(projectId, drag.listId);
        });
      }
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, updateTask, reorderTasks, fetchTasks]);

  // Refs to read latest state inside the window listener without stale closure
  const dragOverStatusIdRef = useRef<string | null>(null);
  const dropIdxRef = useRef<number | null>(null);
  useEffect(() => { dragOverStatusIdRef.current = dragOverStatusId; }, [dragOverStatusId]);
  useEffect(() => { dropIdxRef.current = dropIdx; }, [dropIdx]);

  const handleDragStart = useCallback((
    e: React.PointerEvent,
    task: TaskListItem,
    listId: string,
    cardEl: HTMLDivElement
  ) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) return;

    const rect = cardEl.getBoundingClientRect();
    pendingRef.current = {
      state: {
        task,
        listId,
        fromStatusId: task.status.id,
        fromIdx: (tasksByList[listId] ?? [])
          .filter((t) => t.status.id === task.status.id && t.depth === 0)
          .findIndex((t) => t.id === task.id),
        startX: e.clientX,
        startY: e.clientY,
        cardWidth: rect.width,
        cardOffsetX: e.clientX - rect.left,
        cardOffsetY: e.clientY - rect.top,
      },
    };
  }, [tasksByList]);

  return (
    <div
      className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      style={{ userSelect: activeDrag ? "none" : undefined }}
    >
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
              dragState={activeDrag}
              dragOverStatusId={dragOverStatusId}
              dropIdx={dropIdx}
              suppressClickRef={suppressClickRef}
              onOpenDetail={onOpenTaskDetail}
              onDragStart={handleDragStart}
            />
          ))
        )}

        <div className="w-40 shrink-0 pt-1 text-gray-400">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-base font-normal hover:text-gray-600 dark:hover:text-gray-300"
          >
            <LuPlus className="h-4 w-4" />
            Add group
          </button>
        </div>
      </div>

      {/* Floating ghost card */}
      {activeDrag && (
        <GhostCard
          task={activeDrag.task}
          x={cursorX}
          y={cursorY}
          width={activeDrag.cardWidth}
        />
      )}
    </div>
  );
}
