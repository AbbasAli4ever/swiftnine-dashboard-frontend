"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useProjects } from "@/context/ProjectContext";
import { Project } from "@/services/project.service";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import {
  LuX,
  LuLock,
  LuLockOpen,
  LuLayers,
  LuCircleDot,
  LuBlocks,
} from "react-icons/lu";

const COLOR_OPTIONS = [
  "#6366f1", "#3b82f6", "#22c55e", "#f59e0b",
  "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6",
  "#f97316", "#64748b",
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export default function EditSpaceModal({ isOpen, onClose, project }: Props) {
  const { updateProject } = useProjects();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [color, setColor] = useState(project.color);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setDescription(project.description ?? "");
      setColor(project.color);
      setIsPrivate(false);
    }
  }, [isOpen, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
        color,
      });
      toast.success("Space updated");
      onClose();
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const initial = name.trim().charAt(0).toUpperCase() || project.name.charAt(0).toUpperCase();

  const modal = (
    <div className="fixed inset-0 z-9999 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg mx-4 bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-normal text-gray-900 dark:text-white">Edit Space settings</h2>
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

        <form onSubmit={handleSubmit}>
          <div className="px-6 space-y-5">
            {/* Icon & Name */}
            <div>
              <label className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-2">
                Icon &amp; name
              </label>
              <div className="flex items-center gap-3">
                {/* Color picker avatar */}
                <div className="relative group">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-normal cursor-pointer shrink-0 hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: color }}
                  >
                    {initial}
                  </div>
                  <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-wrap gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2 w-36 z-10 shadow-xl">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className="w-6 h-6 rounded-lg transition-transform hover:scale-110"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Space name"
                  maxLength={100}
                  autoFocus
                  className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors text-sm"
                />
              </div>
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

            {/* Task ID Prefix (read-only after creation) */}
            <div>
              <label className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1">
                Task ID Prefix
                <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-normal">(cannot be changed)</span>
              </label>
              <input
                type="text"
                value={project.taskIdPrefix}
                readOnly
                className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-400 dark:text-gray-500 text-sm font-mono cursor-not-allowed"
              />
            </div>

            {/* Make Private */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2.5">
                {isPrivate ? (
                  <LuLock className="w-4 h-4 text-gray-400" />
                ) : (
                  <LuLockOpen className="w-4 h-4 text-gray-400" />
                )}
                <div>
                  <p className="text-sm font-normal text-gray-800 dark:text-gray-200">Make Private</p>
                  <p className="text-xs text-gray-500">Only you and invited members have access</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivate((v) => !v)}
                className={`relative w-10 h-5.5 rounded-full transition-colors ${isPrivate ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPrivate ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Info rows (read-only) */}
            <div className="space-y-1 border-t border-gray-100 dark:border-gray-800 pt-4">
              <div className="flex items-center justify-between px-1 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <LuLayers className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 font-normal">Default views</p>
                    <p className="text-xs text-gray-500">List, Board</p>
                  </div>
                </div>
                <span className="text-gray-400 dark:text-gray-600">›</span>
              </div>
              <div className="flex items-center justify-between px-1 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <LuCircleDot className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 font-normal">Task statuses</p>
                    <p className="text-xs text-gray-500">
                      {project.statuses.map((s) => s.name).join(" → ")}
                    </p>
                  </div>
                </div>
                <span className="text-gray-400 dark:text-gray-600">›</span>
              </div>
              <div className="flex items-center justify-between px-1 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <LuBlocks className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 font-normal">ClickApps</p>
                    <p className="text-xs text-gray-500">Priority, Tags, ...</p>
                  </div>
                </div>
                <span className="text-gray-400 dark:text-gray-600">›</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-4 mt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-6 py-2 rounded-xl bg-brand-500 text-white text-sm font-normal hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
