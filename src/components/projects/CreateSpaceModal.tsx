"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useProjects } from "@/context/ProjectContext";
import { parseApiError } from "@/lib/api";
import { statusService, CreateStatusPayload } from "@/services/status.service";
import { ProjectStatus } from "@/services/project.service";
import { taskListService } from "@/services/task-list.service";
import { toast } from "sonner";
import {
  LuX,
  LuLock,
  LuLockOpen,
  LuChevronLeft,
  LuCircleDashed,
  LuPlus,
  LuInfo,
  LuGripVertical,
  LuEllipsis,
  LuTrash2,
  LuPalette,
  LuPencil,
  LuCheck,
} from "react-icons/lu";
import { IoCheckmarkCircle } from "react-icons/io5";
import { IoMdRadioButtonOn } from "react-icons/io";

function generatePrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 6);
}

const COLOR_OPTIONS = [
  "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e",
  "#eab308", "#f97316", "#ef4444", "#ec4899", "#8b5cf6",
  "#a16207", "#64748b",
];

type CreateStep = "details" | "statuses";

type LocalStatus = {
  tempId: string;
  name: string;
  color: string;
  isProtected: boolean;
};

type LocalGroup = {
  title: string;
  apiGroup: "NOT_STARTED" | "ACTIVE" | "DONE" | "CLOSED";
  iconType: "dashed" | "active" | "check";
  statuses: LocalStatus[];
  canAdd: boolean;
};

let _tempId = 0;
function nextTempId() {
  return `tmp_${++_tempId}`;
}

const DEFAULT_GROUPS: LocalGroup[] = [
  {
    title: "Not started",
    apiGroup: "NOT_STARTED",
    iconType: "dashed",
    canAdd: true,
    statuses: [{ tempId: "default_todo", name: "TO DO", color: "#e6e6e6", isProtected: true }],
  },
  {
    title: "Active",
    apiGroup: "ACTIVE",
    iconType: "active",
    canAdd: true,
    statuses: [{ tempId: "default_inprogress", name: "IN PROGRESS", color: "#3b82f6", isProtected: false }],
  },
  {
    title: "Done",
    apiGroup: "DONE",
    iconType: "check",
    canAdd: true,
    statuses: [],
  },
  {
    title: "Closed",
    apiGroup: "CLOSED",
    iconType: "check",
    canAdd: false,
    statuses: [{ tempId: "default_completed", name: "COMPLETE", color: "#2a9764", isProtected: true }],
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateSpaceModal({ isOpen, onClose }: Props) {
  const { createProject } = useProjects();

  // Step 1 state
  const [step, setStep] = useState<CreateStep>("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [prefix, setPrefix] = useState("");
  const [prefixTouched, setPrefixTouched] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [prefixError, setPrefixError] = useState("");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Step 2 state
  const [groups, setGroups] = useState<LocalGroup[]>(() =>
    DEFAULT_GROUPS.map((g) => ({ ...g, statuses: g.statuses.map((s) => ({ ...s })) }))
  );
  const [addingToGroup, setAddingToGroup] = useState<number | null>(null);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState(COLOR_OPTIONS[0]);
  const [newColorPickerOpen, setNewColorPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null); // tempId
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null); // tempId
  const [renamingTempId, setRenamingTempId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragItem, setDragItem] = useState<{ groupIdx: number; statusIdx: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ groupIdx: number; statusIdx: number } | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  // Pointer-drag state
  const pointerDragRef = useRef<{
    groupIdx: number;
    statusIdx: number;
    startY: number;
    currentY: number;
    itemHeight: number;
  } | null>(null);
  const [pointerDragState, setPointerDragState] = useState<{
    groupIdx: number;
    statusIdx: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("details");
      setName("");
      setDescription("");
      setColor(COLOR_OPTIONS[0]);
      setPrefix("");
      setPrefixTouched(false);
      setIsPrivate(false);
      setPrefixError("");
      setNameError("");
      setLoading(false);
      setGroups(DEFAULT_GROUPS.map((g) => ({ ...g, statuses: g.statuses.map((s) => ({ ...s })) })));
      setAddingToGroup(null);
      setNewStatusName("");
      setNewStatusColor(COLOR_OPTIONS[0]);
      setMenuOpen(null);
      setColorPickerOpen(null);
      setNewColorPickerOpen(false);
      setRenamingTempId(null);
      setRenameValue("");
      setDragItem(null);
      setDragOver(null);
      setPointerDragState(null);
      pointerDragRef.current = null;
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!prefixTouched) setPrefix(generatePrefix(name));
  }, [name, prefixTouched]);

  useEffect(() => {
    if (addingToGroup !== null) {
      setTimeout(() => addInputRef.current?.focus(), 50);
    }
  }, [addingToGroup]);

  const handlePrefixChange = (val: string) => {
    setPrefixTouched(true);
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setPrefix(clean);
    setPrefixError(clean.length < 2 ? "Prefix must be at least 2 characters" : "");
  };

  const handleNameChange = (val: string) => {
    setName(val);
    const trimmed = val.trim();
    setNameError(trimmed.length > 0 && trimmed.length < 2 ? "Name must be at least 2 characters" : "");
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setNameError("Name must be at least 2 characters");
      return;
    }
    if (prefix.length < 2) {
      setPrefixError("Prefix must be at least 2 characters");
      return;
    }
    setStep("statuses");
  };

  // --- Status group editing ---

  const addStatus = (groupIdx: number) => {
    const trimmed = newStatusName.trim();
    setNewColorPickerOpen(false);
    if (!trimmed) {
      setAddingToGroup(null);
      return;
    }
    setGroups((prev) => {
      const next = prev.map((g, i) =>
        i === groupIdx
          ? { ...g, statuses: [...g.statuses, { tempId: nextTempId(), name: trimmed.toUpperCase(), color: newStatusColor, isProtected: false }] }
          : g
      );
      return next;
    });
    setNewStatusName("");
    setNewStatusColor(COLOR_OPTIONS[0]);
    setAddingToGroup(null);
  };

  const deleteStatus = (groupIdx: number, tempId: string) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx ? { ...g, statuses: g.statuses.filter((s) => s.tempId !== tempId) } : g
      )
    );
    setMenuOpen(null);
  };

  const changeStatusColor = (groupIdx: number, tempId: string, newColor: string) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, statuses: g.statuses.map((s) => (s.tempId === tempId ? { ...s, color: newColor } : s)) }
          : g
      )
    );
  };

  const startRename = (tempId: string, currentName: string) => {
    setMenuOpen(null);
    setRenamingTempId(tempId);
    setRenameValue(currentName);
  };

  const commitRename = (groupIdx: number, tempId: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      setGroups((prev) =>
        prev.map((g, i) =>
          i === groupIdx
            ? { ...g, statuses: g.statuses.map((s) => (s.tempId === tempId ? { ...s, name: trimmed.toUpperCase() } : s)) }
            : g
        )
      );
    }
    setRenamingTempId(null);
    setRenameValue("");
  };

  // Pointer-based smooth drag reorder
  const handlePointerDragStart = useCallback((
    e: React.PointerEvent,
    groupIdx: number,
    statusIdx: number,
    itemHeight: number,
  ) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerDragRef.current = { groupIdx, statusIdx, startY: e.clientY, currentY: e.clientY, itemHeight };
    setDragItem({ groupIdx, statusIdx });
    setPointerDragState({ groupIdx, statusIdx, offsetY: 0 });
  }, []);

  const handlePointerDragMove = useCallback((e: React.PointerEvent, groupIdx: number) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.groupIdx !== groupIdx) return;
    const offsetY = e.clientY - drag.startY;
    drag.currentY = e.clientY;
    setPointerDragState({ groupIdx, statusIdx: drag.statusIdx, offsetY });

    // Compute which slot we're hovering: each item is itemHeight + gap(6px)
    const slotSize = drag.itemHeight + 6;
    const hoverIdx = Math.round(drag.statusIdx + offsetY / slotSize);
    const groupLen = groups[groupIdx]?.statuses.length ?? 0;
    const clamped = Math.max(0, Math.min(groupLen - 1, hoverIdx));
    setDragOver({ groupIdx, statusIdx: clamped });
  }, [groups]);

  const handlePointerDragEnd = useCallback((groupIdx: number) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.groupIdx !== groupIdx) {
      pointerDragRef.current = null;
      setDragItem(null);
      setDragOver(null);
      setPointerDragState(null);
      return;
    }
    const from = drag.statusIdx;
    const to = dragOver?.groupIdx === groupIdx ? dragOver.statusIdx : from;
    pointerDragRef.current = null;
    setDragItem(null);
    setDragOver(null);
    setPointerDragState(null);
    if (from !== to) {
      setGroups((prev) =>
        prev.map((g, i) => {
          if (i !== groupIdx) return g;
          const statuses = [...g.statuses];
          const [moved] = statuses.splice(from, 1);
          statuses.splice(to, 0, moved);
          return { ...g, statuses };
        })
      );
    }
  }, [dragOver]);

  // --- Project creation ---

  const handleCreateProject = async () => {
    setLoading(true);
    try {
      // 1. Create project (backend auto-creates To Do, In Progress, Review, Completed)
      const project = await createProject({
        name: name.trim(),
        taskIdPrefix: prefix,
        description: description.trim() || undefined,
        color,
      });

      const projectId = project.id;
      const defaultStatuses: ProjectStatus[] = project.statuses ?? [];

      // Map backend default statuses by approximate name match
      // backend creates: "To Do" (NOT_STARTED), "In Progress" (ACTIVE), "Review" (DONE), "Completed" (CLOSED)
      const findDefault = (names: string[]) =>
        defaultStatuses.find((s) =>
          names.some((n) => s.name.toLowerCase() === n.toLowerCase())
        );

      const backendToDo = findDefault(["To Do", "TODO"]);
      const backendInProgress = findDefault(["In Progress", "IN PROGRESS"]);
      const backendReview = findDefault(["Review"]);
      const backendCompleted = findDefault(["Completed", "Complete", "COMPLETE"]);

      // 2. POST custom statuses (non-default ones user added)
      const newStatusIds: Record<string, string> = {}; // tempId → backend id

      for (const group of groups) {
        if (group.apiGroup === "CLOSED") continue; // Closed group has no addable statuses

        const defaultTempIds = DEFAULT_GROUPS.find((g) => g.apiGroup === group.apiGroup)
          ?.statuses.map((s) => s.tempId) ?? [];

        const customStatuses = group.statuses.filter((s) => !defaultTempIds.includes(s.tempId));

        for (const status of customStatuses) {
          const payload: CreateStatusPayload = {
            projectId,
            name: status.name,
            color: status.color,
            group: group.apiGroup as "NOT_STARTED" | "ACTIVE" | "DONE",
          };
          const created = await statusService.create(payload);
          newStatusIds[status.tempId] = created.id;
        }
      }

      // 3. Build reorder payload — only if user made any changes to default order or added customs
      // We need all status IDs in user-specified order per group
      const buildGroupIds = (groupIdx: number, defaultBackend: (ProjectStatus | undefined)[]): string[] => {
        const group = groups[groupIdx];
        const defaultTempIds = DEFAULT_GROUPS[groupIdx].statuses.map((s) => s.tempId);
        const ids: string[] = [];

        for (const status of group.statuses) {
          if (defaultTempIds.includes(status.tempId)) {
            // Map to backend default id
            const backendStatus = defaultBackend.find(Boolean);
            if (backendStatus) ids.push(backendStatus.id);
          } else {
            const id = newStatusIds[status.tempId];
            if (id) ids.push(id);
          }
        }
        return ids;
      };

      // More precise mapping: match by group
      const notStartedDefaultIds = (backendToDo ? [backendToDo] : []);
      const activeDefaultIds = [backendInProgress, backendReview].filter(Boolean) as ProjectStatus[];
      const doneDefaultIds: ProjectStatus[] = [];
      const closedDefaultIds = (backendCompleted ? [backendCompleted] : []);

      // Build ordered IDs per group respecting user ordering
      const buildGroupIdsV2 = (
        groupIdx: number,
        availableDefaults: ProjectStatus[]
      ): string[] => {
        const group = groups[groupIdx];
        const defaultTempIds = DEFAULT_GROUPS[groupIdx].statuses.map((s) => s.tempId);
        let defaultCursor = 0;
        const ids: string[] = [];

        for (const status of group.statuses) {
          if (defaultTempIds.includes(status.tempId)) {
            const backend = availableDefaults[defaultCursor++];
            if (backend) ids.push(backend.id);
          } else {
            const id = newStatusIds[status.tempId];
            if (id) ids.push(id);
          }
        }
        // Also include any default backend statuses not in user list (backend-only defaults)
        while (defaultCursor < availableDefaults.length) {
          ids.push(availableDefaults[defaultCursor++].id);
        }
        return ids;
      };

      const reorderGroups = {
        notStarted: buildGroupIdsV2(0, notStartedDefaultIds),
        active: buildGroupIdsV2(1, activeDefaultIds),
        done: buildGroupIdsV2(2, doneDefaultIds),
        closed: closedDefaultIds.map((s) => s.id),
      };

      const hasCustomStatuses = Object.values(newStatusIds).length > 0;
      const hasReorder = true; // always reorder to enforce user's intent

      if (hasCustomStatuses || hasReorder) {
        const allIds = [
          ...reorderGroups.notStarted,
          ...reorderGroups.active,
          ...reorderGroups.done,
          ...reorderGroups.closed,
        ];
        if (allIds.length > 0) {
          await statusService.reorder(projectId, reorderGroups);
        }
      }

      // Auto-create a default list named "List"
      await taskListService.create(projectId, { name: "List" });

      toast.success(`Space "${name.trim()}" created`);
      onClose();
    } catch (err) {
      const { message, code } = parseApiError(err);
      if (code === "CONFLICT") {
        setPrefixError("This prefix is already taken in this workspace");
        setStep("details");
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const initial = name.trim().charAt(0).toUpperCase() || "S";
  const titleName = name.trim() || "Space";
  const isNameValid = name.trim().length >= 2;

  const modal = (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center"
      onClick={() => { setMenuOpen(null); setColorPickerOpen(null); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {step === "details" ? (
        /* ───────────── STEP 1: Details ───────────── */
        <div className="relative z-10 w-full max-w-[760px] mx-4 bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-start justify-between px-6 pt-6 pb-4">
            <div>
              <h2 className="text-lg font-normal text-gray-900 dark:text-white">Create a Space</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                A Space represents teams, departments, or groups, each with its own Lists, workflows, and settings.
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              <LuX className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleDetailsSubmit}>
            <div className="px-6 space-y-5">
              {/* Icon & Name */}
              <div>
                <label className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-2">Icon &amp; name</label>
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-normal cursor-pointer shrink-0 transition-opacity hover:opacity-80"
                      style={{ backgroundColor: color }}
                    >
                      {initial}
                    </div>
                    <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-wrap gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2 w-36 z-10 shadow-xl">
                      {COLOR_OPTIONS.map((c) => (
                        <button key={c} type="button" onClick={() => setColor(c)} className="w-6 h-6 rounded-lg transition-transform hover:scale-110" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <input
                    ref={nameRef}
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Marketing, Engineering, HR"
                    maxLength={100}
                    className={`flex-1 bg-gray-50 dark:bg-gray-800 border rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none transition-colors text-sm ${nameError ? "border-red-500 focus:ring-1 focus:ring-red-500" : "border-gray-200 dark:border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"}`}
                  />
                </div>
                {nameError && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{nameError}</p>}
              </div>

              {/* Task ID Prefix */}
              <div>
                <label className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1">
                  Task ID Prefix
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-normal">(2–6 chars, e.g. API, MKT)</span>
                </label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => handlePrefixChange(e.target.value)}
                  placeholder="e.g. MKT"
                  className={`w-full bg-gray-50 dark:bg-gray-800 border rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none transition-colors text-sm font-mono ${prefixError ? "border-red-500 focus:ring-1 focus:ring-red-500" : "border-gray-200 dark:border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"}`}
                />
                {prefixError && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{prefixError}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1">
                  Description <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors text-sm resize-none"
                />
              </div>

              {/* Make Private */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5">
                  {isPrivate ? <LuLock className="w-4 h-4 text-gray-400" /> : <LuLockOpen className="w-4 h-4 text-gray-400" />}
                  <div>
                    <p className="text-sm font-normal text-gray-800 dark:text-gray-200">Make Private</p>
                    <p className="text-xs text-gray-500">Only you and invited members have access</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrivate((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${isPrivate ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPrivate ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 mt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="submit"
                disabled={loading || !isNameValid || prefix.length < 2}
                className="px-6 py-2 rounded-xl bg-brand-500 text-white text-sm font-normal hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ───────────── STEP 2: Statuses ───────────── */
        <div
          className="relative z-10 w-full max-w-[720px] mx-4 bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden max-h-[86vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <LuChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-normal text-gray-900 dark:text-white">Edit {titleName} statuses</h2>
            </div>
            <button
              onClick={onClose}
              className="ml-4 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              <LuX className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[200px_1fr] overflow-hidden">
            {/* Left panel */}
            <div className="px-4 py-5 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 shrink-0">
              <p className="text-sm font-normal text-gray-700 dark:text-gray-300 mb-2">Status template</p>
              <select
                disabled
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 appearance-none"
              >
                <option>Custom</option>
              </select>
            </div>

            {/* Right panel: groups */}
            <div className="overflow-y-auto px-5 py-5 space-y-6">
              {groups.map((group, groupIdx) => (
                <StatusGroupEditor
                  key={group.apiGroup}
                  group={group}
                  groupIdx={groupIdx}
                  addingToGroup={addingToGroup}
                  newStatusName={newStatusName}
                  newStatusColor={newStatusColor}
                  menuOpen={menuOpen}
                  colorPickerOpen={colorPickerOpen}
                  dragItem={dragItem}
                  dragOver={dragOver}
                  addInputRef={addInputRef}
                  onStartAdd={() => { setAddingToGroup(groupIdx); setNewStatusName(""); setNewStatusColor(COLOR_OPTIONS[0]); setNewColorPickerOpen(true); }}
                  onCancelAdd={() => { setAddingToGroup(null); setNewColorPickerOpen(false); }}
                  onNewNameChange={setNewStatusName}
                  onNewColorChange={setNewStatusColor}
                  newColorPickerOpen={newColorPickerOpen}
                  onNewColorPickerToggle={() => setNewColorPickerOpen((v) => !v)}
                  onNewColorPickerClose={() => setNewColorPickerOpen(false)}
                  onAddStatus={() => addStatus(groupIdx)}
                  onDeleteStatus={(tid) => deleteStatus(groupIdx, tid)}
                  onChangeColor={(tid, c) => changeStatusColor(groupIdx, tid, c)}
                  onMenuOpen={(tid) => { setMenuOpen(tid); setColorPickerOpen(null); }}
                  onMenuClose={() => setMenuOpen(null)}
                  onColorPickerOpen={(tid) => { setColorPickerOpen(tid); setMenuOpen(null); }}
                  onColorPickerClose={() => setColorPickerOpen(null)}
                  renamingTempId={renamingTempId}
                  renameValue={renameValue}
                  onStartRename={(tid, name) => startRename(tid, name)}
                  onRenameChange={setRenameValue}
                  onCommitRename={(tid) => commitRename(groupIdx, tid)}
                  pointerDragState={pointerDragState}
                  onPointerDragStart={(e, sIdx, h) => handlePointerDragStart(e, groupIdx, sIdx, h)}
                  onPointerDragMove={(e) => handlePointerDragMove(e, groupIdx)}
                  onPointerDragEnd={() => handlePointerDragEnd(groupIdx)}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
            <button type="button" className="text-sm text-gray-400 flex items-center gap-1.5 hover:text-gray-600 dark:hover:text-gray-200">
              <LuInfo className="w-4 h-4" />
              Learn more about statuses
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Save as template
              </button>
              <button
                type="button"
                onClick={handleCreateProject}
                disabled={loading}
                className="px-6 py-2 rounded-xl bg-brand-500 text-white text-sm font-normal hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Creating..." : "Apply changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}

// ─── Sub-component: StatusGroupEditor ───────────────────────────────────────

interface GroupEditorProps {
  group: LocalGroup;
  groupIdx: number;
  addingToGroup: number | null;
  newStatusName: string;
  newStatusColor: string;
  menuOpen: string | null;
  colorPickerOpen: string | null;
  dragItem: { groupIdx: number; statusIdx: number } | null;
  dragOver: { groupIdx: number; statusIdx: number } | null;
  addInputRef: React.RefObject<HTMLInputElement | null>;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onNewNameChange: (v: string) => void;
  onNewColorChange: (v: string) => void;
  newColorPickerOpen: boolean;
  onNewColorPickerToggle: () => void;
  onNewColorPickerClose: () => void;
  onAddStatus: () => void;
  onDeleteStatus: (tempId: string) => void;
  onChangeColor: (tempId: string, color: string) => void;
  onMenuOpen: (tempId: string) => void;
  onMenuClose: () => void;
  onColorPickerOpen: (tempId: string) => void;
  onColorPickerClose: () => void;
  renamingTempId: string | null;
  renameValue: string;
  onStartRename: (tempId: string, currentName: string) => void;
  onRenameChange: (v: string) => void;
  onCommitRename: (tempId: string) => void;
  pointerDragState: { groupIdx: number; statusIdx: number; offsetY: number } | null;
  onPointerDragStart: (e: React.PointerEvent, statusIdx: number, itemHeight: number) => void;
  onPointerDragMove: (e: React.PointerEvent) => void;
  onPointerDragEnd: () => void;
}

function GroupIcon({ iconType, color }: { iconType: LocalGroup["iconType"]; color: string }) {
  if (iconType === "dashed") return <LuCircleDashed className="w-4 h-4 shrink-0" style={{ color }} />;
  if (iconType === "active") return <IoMdRadioButtonOn className="w-4 h-4 shrink-0" style={{ color }} />;
  return <IoCheckmarkCircle className="w-4 h-4 shrink-0" style={{ color }} />;
}

function StatusGroupEditor({
  group, groupIdx, addingToGroup, newStatusName, newStatusColor,
  menuOpen, colorPickerOpen, renamingTempId, renameValue,
  newColorPickerOpen, onNewColorPickerToggle, onNewColorPickerClose,
  dragItem, dragOver, pointerDragState,
  addInputRef, onStartAdd, onCancelAdd, onNewNameChange, onNewColorChange,
  onAddStatus, onDeleteStatus, onChangeColor, onMenuOpen, onMenuClose,
  onColorPickerOpen, onColorPickerClose,
  onStartRename, onRenameChange, onCommitRename,
  onPointerDragStart, onPointerDragMove, onPointerDragEnd,
}: GroupEditorProps) {
  const isAddingHere = addingToGroup === groupIdx;
  const isClosed = group.apiGroup === "CLOSED";
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-normal text-gray-700 dark:text-gray-200">{group.title}</p>
          <LuInfo className="w-3.5 h-3.5 text-gray-400" />
        </div>
        {group.canAdd && !isClosed && (
          <button type="button" onClick={onStartAdd} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            <LuPlus className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {group.statuses.map((status, statusIdx) => {
          const isMenuOpen = menuOpen === status.tempId;
          const isColorOpen = colorPickerOpen === status.tempId;
          const isThisDragging = pointerDragState?.groupIdx === groupIdx && pointerDragState?.statusIdx === statusIdx;
          const isDragTarget = dragOver?.groupIdx === groupIdx && dragOver?.statusIdx === statusIdx && !isThisDragging;

          // Smooth shift via margin (avoids stacking context — transforms break z-index)
          let extraMarginTop = 0;
          if (
            pointerDragState?.groupIdx === groupIdx &&
            dragOver?.groupIdx === groupIdx &&
            !isThisDragging
          ) {
            const from = pointerDragState.statusIdx;
            const to = dragOver.statusIdx;
            const itemH = (itemRefs.current[from]?.offsetHeight ?? 40) + 6;
            if (from < to && statusIdx > from && statusIdx <= to) extraMarginTop = -itemH;
            if (from > to && statusIdx >= to && statusIdx < from) extraMarginTop = itemH;
          }

          return (
            <div
              key={status.tempId}
              ref={(el) => { itemRefs.current[statusIdx] = el; }}
              onPointerMove={isThisDragging ? onPointerDragMove : undefined}
              onPointerUp={isThisDragging ? onPointerDragEnd : undefined}
              style={isThisDragging
                ? { transform: `translateY(${pointerDragState.offsetY}px)`, zIndex: 50, position: "relative" }
                : { marginTop: extraMarginTop !== 0 ? `${extraMarginTop}px` : undefined, transition: "margin 150ms ease" }
              }
              className={`flex items-center gap-2 h-10 rounded-xl border px-3 text-sm ${
                isThisDragging
                  ? "border-brand-400 shadow-lg bg-white dark:bg-gray-900 opacity-95"
                  : isDragTarget
                    ? "border-brand-300 bg-brand-50/50 dark:bg-brand-950/10"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              }`}
            >
              {/* Drag handle — pointer capture on this element only */}
              {!isClosed && (
                <div
                  className="shrink-0 cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => {
                    const h = itemRefs.current[statusIdx]?.offsetHeight ?? 40;
                    onPointerDragStart(e, statusIdx, h);
                  }}
                >
                  <LuGripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                </div>
              )}

              {/* Status icon — click to open color picker */}
              <div className="relative shrink-0">
                {isClosed ? (
                  <GroupIcon iconType={group.iconType} color="#2a9764" />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); isColorOpen ? onColorPickerClose() : onColorPickerOpen(status.tempId); }}
                    className="flex items-center justify-center rounded hover:opacity-70 transition-opacity"
                    title="Change color"
                  >
                    <GroupIcon iconType={group.iconType} color={status.color} />
                  </button>
                )}

                {/* Color picker popover — anchored to the icon */}
                {isColorOpen && (
                  <div
                    className="absolute left-0 top-6 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-52"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mb-2">Color</p>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { onChangeColor(status.tempId, c); onColorPickerClose(); }}
                          className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                          style={{ backgroundColor: c }}
                        >
                          {status.color === c && <LuCheck className="w-3 h-3 text-white" />}
                        </button>
                      ))}
                      <label className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform" title="Custom color">
                        <LuPlus className="w-3.5 h-3.5 text-gray-500" />
                        <input type="color" className="sr-only" value={status.color} onChange={(e) => onChangeColor(status.tempId, e.target.value)} />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Name — inline editable on rename */}
              {renamingTempId === status.tempId ? (
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => onRenameChange(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); onCommitRename(status.tempId); }
                    if (e.key === "Escape") { onCommitRename(status.tempId); }
                  }}
                  onBlur={() => onCommitRename(status.tempId)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-transparent text-xs font-normal tracking-wide text-gray-800 dark:text-gray-100 focus:outline-none"
                />
              ) : (
                <span
                  className="flex-1 font-normal text-gray-800 dark:text-gray-100 truncate text-xs tracking-wide cursor-text"
                  onClick={(e) => { e.stopPropagation(); onStartRename(status.tempId, status.name); }}
                >
                  {status.name}
                </span>
              )}

              {/* Save button while renaming (only if changed), otherwise ··· menu */}
              {renamingTempId === status.tempId && renameValue.trim() && renameValue.trim() !== status.name ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.stopPropagation(); onCommitRename(status.tempId); }}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-500 text-white text-xs font-normal hover:bg-brand-600 transition-colors"
                >
                  Save
                  <span className="opacity-70 text-[10px]">↵</span>
                </button>
              ) : (
              <div className="relative ml-auto">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); isMenuOpen ? onMenuClose() : onMenuOpen(status.tempId); }}
                  className="flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <LuEllipsis className="w-3.5 h-3.5" />
                </button>

                {isMenuOpen && (
                  <div
                    className="absolute right-0 top-7 z-50 w-44 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl py-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => { onMenuClose(); onStartRename(status.tempId, status.name); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <LuPencil className="w-3.5 h-3.5" />
                      Rename
                    </button>
                    {!isClosed && (
                      <button
                        type="button"
                        onClick={() => { onMenuClose(); onColorPickerOpen(status.tempId); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <LuPalette className="w-3.5 h-3.5" />
                        Change color
                      </button>
                    )}
                    {!status.isProtected && !isClosed && (
                      <button
                        type="button"
                        onClick={() => onDeleteStatus(status.tempId)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <LuTrash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
              )}
            </div>
          );
        })}

        {/* Add status — same bar style as existing rows */}
        {isAddingHere ? (
          <div
            className="flex items-center gap-2 h-10 rounded-xl border-2 border-brand-400 bg-white dark:bg-gray-900 px-3"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node) && !newStatusName.trim()) {
                onCancelAdd();
              }
            }}
          >
            {/* Drag handle placeholder (non-functional, just for visual consistency) */}
            <div className="shrink-0 opacity-0 pointer-events-none">
              <LuGripVertical className="w-3.5 h-3.5" />
            </div>

            {/* Group icon button — click opens color picker */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNewColorPickerToggle(); }}
                className="flex items-center justify-center rounded hover:opacity-70 transition-opacity"
                title="Choose color"
              >
                <GroupIcon iconType={group.iconType} color={newStatusColor} />
              </button>

              {/* Color picker — open by default so user picks color first */}
              {newColorPickerOpen && (
                <div
                  className="absolute left-0 top-6 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-52"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mb-2">Color</p>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { onNewColorChange(c); onNewColorPickerClose(); addInputRef.current?.focus(); }}
                        className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                        style={{ backgroundColor: c }}
                      >
                        {newStatusColor === c && <LuCheck className="w-3 h-3 text-white" />}
                      </button>
                    ))}
                    <label
                      className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                      title="Custom color"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <LuPlus className="w-3.5 h-3.5 text-gray-500" />
                      <input
                        type="color"
                        className="sr-only"
                        value={newStatusColor}
                        onChange={(e) => { onNewColorChange(e.target.value); onNewColorPickerClose(); addInputRef.current?.focus(); }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Name input */}
            <input
              ref={addInputRef}
              type="text"
              value={newStatusName}
              onChange={(e) => onNewNameChange(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); onAddStatus(); }
                if (e.key === "Escape") onCancelAdd();
              }}
              onBlur={() => { /* intentionally blank — commit only via Enter/Escape/X */ }}
              placeholder="Status name..."
              className="flex-1 bg-transparent text-xs font-normal tracking-wide text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
            />

            {/* Save button — only when name is non-empty */}
            {newStatusName.trim() && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onAddStatus}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-500 text-white text-xs font-normal hover:bg-brand-600 transition-colors"
              >
                Save
                <span className="opacity-70 text-[10px]">↵</span>
              </button>
            )}
          </div>
        ) : (
          group.canAdd && !isClosed && (
            <button
              type="button"
              onClick={onStartAdd}
              className="w-full h-10 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-sm flex items-center justify-center gap-2 hover:border-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              <LuPlus className="w-3.5 h-3.5" />
              Add status
            </button>
          )
        )}
      </div>
    </div>
  );
}
