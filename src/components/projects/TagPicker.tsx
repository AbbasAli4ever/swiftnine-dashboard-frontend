"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuTag, LuPlus, LuCheck, LuLoader, LuX, LuPencil, LuTrash2 } from "react-icons/lu";
import { tagService, WorkspaceTag } from "@/services/tag.service";
import { TaskTagInfo } from "@/services/task.service";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";

const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b", "#78716c",
];

interface TagPickerProps {
  taskId: string;
  listId: string;
  currentTags: TaskTagInfo[];
  onAdd: (tagId: string) => Promise<void>;
  onRemove: (tagId: string) => Promise<void>;
  variant?: "compact" | "expanded";
}

type Mode = "list" | "create" | "edit";

export default function TagPicker({
  taskId,
  listId,
  currentTags,
  onAdd,
  onRemove,
  variant = "compact",
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [tags, setTags] = useState<WorkspaceTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("list");
  const [editTarget, setEditTarget] = useState<WorkspaceTag | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(TAG_COLORS[0]);
  const [busy, setBusy] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    tagService.list().then(setTags).catch(() => {}).finally(() => setLoading(false));
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (mode !== "list") setTimeout(() => nameRef.current?.focus(), 50);
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !dropRef.current?.contains(t)) {
        closePanel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const closePanel = () => {
    setOpen(false);
    setSearch("");
    setMode("list");
    setEditTarget(null);
  };

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 276)) });
    }
    setOpen((v) => !v);
  };

  const currentTagIds = new Set(currentTags.map((t) => t.tag.id));
  const filtered = tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  const showCreateOption = search.trim() && !tags.some(
    (t) => t.name.toLowerCase() === search.trim().toLowerCase()
  );

  const handleToggle = async (tag: WorkspaceTag) => {
    setBusy(tag.id);
    try {
      if (currentTagIds.has(tag.id)) await onRemove(tag.id);
      else await onAdd(tag.id);
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const openCreate = () => {
    setFormName(search.trim());
    setFormColor(TAG_COLORS[0]);
    setMode("create");
  };

  const openEdit = (tag: WorkspaceTag, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTarget(tag);
    setFormName(tag.name);
    setFormColor(tag.color);
    setMode("edit");
  };

  const handleSaveCreate = async () => {
    const name = formName.trim();
    if (!name) return;
    setBusy("creating");
    try {
      const created = await tagService.create({ name, color: formColor });
      setTags((prev) => [...prev, created]);
      await onAdd(created.id);
      setFormName("");
      setMode("list");
      setSearch("");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const name = formName.trim();
    if (!name) return;
    setBusy("editing");
    try {
      const updated = await tagService.update(editTarget.id, { name, color: formColor });
      setTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast.success("Tag updated");
      setMode("list");
      setEditTarget(null);
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (tag: WorkspaceTag, e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(tag.id + "-del");
    try {
      await tagService.delete(tag.id);
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
      toast.success("Tag deleted");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const ColorGrid = () => (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {TAG_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setFormColor(c)}
          className="h-5 w-5 rounded-full transition-transform hover:scale-110"
          style={{
            backgroundColor: c,
            outline: formColor === c ? `2px solid ${c}` : undefined,
            outlineOffset: formColor === c ? "2px" : undefined,
          }}
        />
      ))}
    </div>
  );

  const FormPanel = ({ onSave, saving }: { onSave: () => void; saving: boolean }) => (
    <div className="px-3 py-2.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: formColor }} />
        <input
          ref={nameRef}
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void onSave(); } if (e.key === "Escape") setMode("list"); }}
          placeholder="Tag name..."
          className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
        />
      </div>
      <ColorGrid />
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => { setMode("list"); setEditTarget(null); }}
          className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving || !formName.trim()}
          className="flex-1 rounded-lg bg-brand-500 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "..." : "Save"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {variant === "expanded" ? (
        <div className="flex flex-wrap items-center gap-1">
          {currentTags.map((t) => (
            <span
              key={t.tag.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${t.tag.color}22`, color: t.tag.color }}
            >
              {t.tag.name}
              <button
                type="button"
                onClick={() => void handleToggle({ id: t.tag.id, name: t.tag.name, color: t.tag.color, workspaceId: "", createdAt: "", updatedAt: "" })}
                className="ml-0.5 opacity-60 hover:opacity-100"
              >
                <LuX className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <button
            ref={triggerRef}
            type="button"
            onClick={handleOpen}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 hover:border-brand-400 hover:text-brand-500 dark:border-gray-600 dark:hover:border-brand-500"
          >
            <LuPlus className="h-3 w-3" />
            Add tag
          </button>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleOpen}
          title="Add tag"
          className="flex h-5.5 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:border-brand-400 hover:text-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500"
        >
          <LuTag className="h-3 w-3" />
        </button>
      )}

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, width: 264 }}
          className="rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
          {/* Header */}
          <div className="flex items-center border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            {mode !== "list" && (
              <button type="button" onClick={() => { setMode("list"); setEditTarget(null); }} className="mr-2 text-gray-400 hover:text-gray-600">
                <LuX className="h-3.5 w-3.5" />
              </button>
            )}
            {mode === "list" ? (
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or add tags..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 dark:text-white"
              />
            ) : (
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {mode === "create" ? "Create tag" : "Edit tag"}
              </span>
            )}
          </div>

          {/* Body */}
          {mode === "list" ? (
            <div className="max-h-60 overflow-y-auto py-1">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <LuLoader className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  {filtered.length > 0 && (
                    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Select an option
                    </p>
                  )}

                  {filtered.map((tag) => {
                    const selected = currentTagIds.has(tag.id);
                    const isDelBusy = busy === tag.id + "-del";
                    return (
                      <div key={tag.id} className="group flex items-center hover:bg-gray-50 dark:hover:bg-gray-800">
                        <button
                          type="button"
                          onClick={() => void handleToggle(tag)}
                          disabled={!!busy}
                          className="flex flex-1 items-center gap-2.5 px-3 py-1.5 text-sm"
                        >
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                          <span className="flex-1 truncate text-left text-gray-700 dark:text-gray-200">{tag.name}</span>
                          {busy === tag.id ? (
                            <LuLoader className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />
                          ) : selected ? (
                            <LuCheck className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                          ) : null}
                        </button>
                        {/* Edit / Delete actions */}
                        <div className="flex shrink-0 items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => openEdit(tag, e)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                            title="Edit tag"
                          >
                            <LuPencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => void handleDelete(tag, e)}
                            disabled={isDelBusy}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 disabled:opacity-40"
                            title="Delete tag"
                          >
                            {isDelBusy
                              ? <LuLoader className="h-3 w-3 animate-spin" />
                              : <LuTrash2 className="h-3 w-3" />
                            }
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {filtered.length === 0 && !showCreateOption && (
                    <p className="px-3 py-4 text-center text-sm italic text-gray-400">No tags created</p>
                  )}

                  {showCreateOption && (
                    <button
                      type="button"
                      onClick={openCreate}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950"
                    >
                      <LuPlus className="h-3.5 w-3.5" />
                      Create &quot;{search.trim()}&quot;
                    </button>
                  )}
                </>
              )}
            </div>
          ) : mode === "create" ? (
            <FormPanel onSave={handleSaveCreate} saving={busy === "creating"} />
          ) : (
            <FormPanel onSave={handleSaveEdit} saving={busy === "editing"} />
          )}

          {/* Footer — create new when no search */}
          {mode === "list" && !search && (
            <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-800">
              <button
                type="button"
                onClick={openCreate}
                className="flex w-full items-center gap-2 text-xs text-gray-400 hover:text-brand-500"
              >
                <LuPlus className="h-3.5 w-3.5" />
                Create new tag
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
