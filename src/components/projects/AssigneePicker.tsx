"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuSearch, LuUsers, LuCheck } from "react-icons/lu";
import { WorkspaceMember } from "@/services/workspace.service";
import { TaskAssignee } from "@/services/task.service";

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "#18181b", "#7c3aed", "#eab308", "#0f172a", "#6d28d9",
  "#ca8a04", "#1e1b4b", "#fbbf24", "#3b0764", "#292524",
];

function avatarBg(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33) ^ id.charCodeAt(i);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface AssigneePickerProps {
  assignees: TaskAssignee[];
  members: WorkspaceMember[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
  align?: "left" | "right";
  iconSize?: "sm" | "md";
  showLabel?: boolean;
}

export default function AssigneePicker({ assignees, members, onAdd, onRemove, align = "left", iconSize = "md", showLabel = false }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; right?: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = ref.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideTrigger && !insideDropdown) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      if (align === "right") {
        setPos({ top: rect.bottom + 4, left: rect.right - 224 });
      } else {
        setPos({ top: rect.bottom + 4, left: rect.left });
      }
    }
    setOpen((v) => !v);
  };

  const assignedIds = new Set(assignees.map((a) => a.user.id));
  const filtered = members.filter((m) =>
    search ? m.fullName.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${iconSize === "sm" ? "p-1" : "px-1.5 py-1"}`}
        title="Assignees"
      >
        {assignees.length === 0 ? (
          <div className="flex items-center gap-2">
            <LuUsers className={`text-gray-600 ${iconSize === "sm" ? "h-3 w-3" : "h-4 w-4"}`} />
            {showLabel && <span className="text-xs text-gray-600">Add assignee</span>}
          </div>
        ) : (
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 3).map((a) => (
              <span
                key={a.user.id}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-medium text-white ring-1 ring-white dark:ring-gray-900"
                style={{ backgroundColor: avatarBg(a.user.id) }}
                title={a.user.fullName}
              >
                {getInitials(a.user.fullName)}
              </span>
            ))}
            {assignees.length > 3 && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[8px] text-gray-600 ring-1 ring-white dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-900">
                +{assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-56 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1 dark:bg-gray-800">
              <LuSearch className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-gray-400"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.map((m) => {
              const assigned = assignedIds.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => assigned ? onRemove(m.id) : onAdd(m.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-white"
                    style={{ backgroundColor: avatarBg(m.id) }}
                  >
                    {getInitials(m.fullName)}
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-medium text-gray-800 dark:text-white">{m.fullName}</p>
                    <p className="truncate text-[10px] text-gray-400">{m.email}</p>
                  </div>
                  {assigned && <LuCheck className="h-3.5 w-3.5 shrink-0 text-brand-500" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-gray-400">No members found</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
