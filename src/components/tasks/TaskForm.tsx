"use client";
import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  Task, TaskPriority, TaskStatus,
  SAMPLE_ASSIGNEES, SAMPLE_TAGS, TaskTag,
  ALL_STATUSES, ALL_PRIORITIES,
  TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG,
} from "@/types/task";
import { useTasks } from "@/context/TaskContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editTask?: Task | null;
  defaultStatus?: TaskStatus;
}

const EMPTY = (): Omit<Task, "id" | "createdAt"> => ({
  title: "", description: "",
  status: "todo", priority: "normal",
  assignees: [SAMPLE_ASSIGNEES[0]],
  dueDate: "", tags: [],
  subtasks: [], checklists: [], comments: [], attachments: [],
});

export default function TaskForm({ isOpen, onClose, editTask, defaultStatus }: Props) {
  const { addTask, updateTask } = useTasks();
  const [form, setForm] = useState(EMPTY());
  const [errors, setErrors] = useState<{ title?: string; dueDate?: string }>({});

  useEffect(() => {
    if (editTask) {
      setForm({
        title: editTask.title, description: editTask.description,
        status: editTask.status, priority: editTask.priority,
        assignees: editTask.assignees, dueDate: editTask.dueDate,
        tags: editTask.tags, subtasks: editTask.subtasks,
        checklists: editTask.checklists, comments: editTask.comments,
        attachments: editTask.attachments,
      });
    } else {
      const base = EMPTY();
      if (defaultStatus) base.status = defaultStatus;
      setForm(base);
    }
    setErrors({});
  }, [editTask, isOpen, defaultStatus]);

  function validate() {
    const e: typeof errors = {};
    if (!form.title.trim()) e.title = "Title is required.";
    if (!form.dueDate) e.dueDate = "Due date is required.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    if (editTask) updateTask(editTask.id, form);
    else addTask(form);
    onClose();
  }

  function toggleAssignee(a: string) {
    setForm((p) => ({
      ...p, assignees: p.assignees.includes(a) ? p.assignees.filter((x) => x !== a) : [...p.assignees, a],
    }));
  }

  function toggleTag(tag: TaskTag) {
    setForm((p) => ({
      ...p, tags: p.tags.some((t) => t.id === tag.id) ? p.tags.filter((t) => t.id !== tag.id) : [...p.tags, tag],
    }));
  }

  const inp = "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white";
  const lbl = "block mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg mx-4">
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800 dark:text-white">
            {editTask ? "Edit Task" : "Create Task"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className={lbl}>Title *</label>
            <input type="text" value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Task name"
              className={`${inp} ${errors.title ? "border-red-400" : ""}`}
            />
            {errors.title && <p className="mt-0.5 text-xs text-red-500">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>Description</label>
            <textarea value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Add a description…"
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Status</label>
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as TaskStatus }))} className={inp}>
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Priority</label>
              <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as TaskPriority }))} className={inp}>
                {ALL_PRIORITIES.map((p) => <option key={p} value={p}>{TASK_PRIORITY_CONFIG[p].label}</option>)}
              </select>
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className={lbl}>Due Date *</label>
            <input type="date" value={form.dueDate}
              onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
              className={`${inp} ${errors.dueDate ? "border-red-400" : ""}`}
            />
            {errors.dueDate && <p className="mt-0.5 text-xs text-red-500">{errors.dueDate}</p>}
          </div>

          {/* Assignees */}
          <div>
            <label className={lbl}>Assignees</label>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_ASSIGNEES.map((a) => {
                const sel = form.assignees.includes(a);
                return (
                  <button key={a} type="button" onClick={() => toggleAssignee(a)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      sel ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    }`}
                  >
                    {a.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className={lbl}>Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_TAGS.map((tag) => {
                const sel = form.tags.some((t) => t.id === tag.id);
                return (
                  <button key={tag.id} type="button" onClick={() => toggleTag(tag)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${sel ? `${tag.color} ring-2 ring-brand-400` : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"}`}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="h-9 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button type="submit"
              className="h-9 rounded-lg bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              {editTask ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
