"use client";

import React, { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  Task,
  TaskPriority,
  SAMPLE_ASSIGNEES,
  SAMPLE_TAGS,
  TaskTag,
  ALL_PRIORITIES,
  TASK_PRIORITY_CONFIG,
} from "@/types/task";
import { useTasks } from "@/context/TaskContext";
import { StatusItem } from "@/services/status.service";
import { TaskList } from "@/services/task-list.service";
import { legacyStatusFromBackendStatus } from "./status-utils";

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  editTask?: Task | null;
  projectId: string | null;
  availableLists: TaskList[];
  statuses: StatusItem[];
  defaultStatusId?: string | null;
  defaultListId?: string | null;
}

type TaskFormState = Omit<Task, "id" | "createdAt">;

function createEmptyTask(
  projectId: string,
  listId: string,
  statuses: StatusItem[],
  defaultStatusId?: string | null
): TaskFormState {
  const firstStatus = statuses.find((status) => status.id === defaultStatusId) ?? statuses[0];
  const status = firstStatus ? legacyStatusFromBackendStatus(firstStatus) : "todo";

  return {
    projectId,
    listId,
    title: "",
    description: "",
    status,
    statusId: firstStatus?.id,
    priority: "normal",
    assignees: [SAMPLE_ASSIGNEES[0]],
    dueDate: "",
    tags: [],
    subtasks: [],
    checklists: [],
    comments: [],
    attachments: [],
  };
}

export default function TaskForm({
  isOpen,
  onClose,
  editTask,
  projectId,
  availableLists,
  statuses,
  defaultStatusId,
  defaultListId,
}: TaskFormProps) {
  const { addTask, updateTask } = useTasks();
  const resolvedStatuses = useMemo(() => {
    if (statuses.length > 0) return statuses;
    return [
      {
        id: "todo",
        projectId: projectId ?? "",
        name: "To Do",
        color: "#e6e6e6",
        group: "NOT_STARTED" as const,
        position: 1000,
        isDefault: true,
        isProtected: false,
        isClosed: false,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "in-progress",
        projectId: projectId ?? "",
        name: "In Progress",
        color: "#3b82f6",
        group: "ACTIVE" as const,
        position: 2000,
        isDefault: true,
        isProtected: false,
        isClosed: false,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "review",
        projectId: projectId ?? "",
        name: "Review",
        color: "#f59e0b",
        group: "DONE" as const,
        position: 3000,
        isDefault: true,
        isProtected: false,
        isClosed: false,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "done",
        projectId: projectId ?? "",
        name: "Complete",
        color: "#2a9764",
        group: "CLOSED" as const,
        position: 4000,
        isDefault: true,
        isProtected: true,
        isClosed: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
  }, [projectId, statuses]);

  const initialForm = useMemo<TaskFormState>(() => {
    if (editTask) {
      return {
        projectId: editTask.projectId,
        listId: editTask.listId,
        title: editTask.title,
        description: editTask.description,
        status: editTask.status,
        statusId: editTask.statusId,
        priority: editTask.priority,
        assignees: editTask.assignees,
        dueDate: editTask.dueDate,
        tags: editTask.tags,
        subtasks: editTask.subtasks,
        checklists: editTask.checklists,
        comments: editTask.comments,
        attachments: editTask.attachments,
      };
    }

    return createEmptyTask(
      projectId ?? "",
      defaultListId ?? availableLists[0]?.id ?? "",
      resolvedStatuses,
      defaultStatusId
    );
  }, [
    availableLists,
    defaultListId,
    defaultStatusId,
    editTask,
    projectId,
    resolvedStatuses,
  ]);
  const [form, setForm] = useState<TaskFormState>(initialForm);
  const [errors, setErrors] = useState<{
    title?: string;
    dueDate?: string;
    listId?: string;
  }>({});

  function validate() {
    const nextErrors: typeof errors = {};
    if (!form.title.trim()) nextErrors.title = "Title is required.";
    if (!form.dueDate) nextErrors.dueDate = "Due date is required.";
    if (!form.listId) nextErrors.listId = "Please select a list.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    if (editTask) updateTask(editTask.id, form);
    else addTask(form);
    onClose();
  }

  function toggleAssignee(assignee: string) {
    setForm((previous) => ({
      ...previous,
      assignees: previous.assignees.includes(assignee)
        ? previous.assignees.filter((value) => value !== assignee)
        : [...previous.assignees, assignee],
    }));
  }

  function toggleTag(tag: TaskTag) {
    setForm((previous) => ({
      ...previous,
      tags: previous.tags.some((value) => value.id === tag.id)
        ? previous.tags.filter((value) => value.id !== tag.id)
        : [...previous.tags, tag],
    }));
  }

  const handleStatusChange = (statusId: string) => {
    const selectedStatus = resolvedStatuses.find((status) => status.id === statusId);
    if (!selectedStatus) return;

    setForm((previous) => ({
      ...previous,
      statusId: selectedStatus.id,
      status: legacyStatusFromBackendStatus(selectedStatus),
    }));
  };

  const inputClass =
    "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white";
  const labelClass =
    "mb-1 block text-xs font-normal uppercase tracking-wide text-gray-500 dark:text-gray-400";

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="mx-4 max-w-lg">
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-normal text-gray-800 dark:text-white">
            {editTask ? "Edit Task" : "Create Task"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, title: event.target.value }))
              }
              placeholder="Task name"
              className={`${inputClass} ${errors.title ? "border-red-400" : ""}`}
            />
            {errors.title ? <p className="mt-0.5 text-xs text-red-500">{errors.title}</p> : null}
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, description: event.target.value }))
              }
              placeholder="Add a description…"
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className={labelClass}>List *</label>
            <select
              value={form.listId}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, listId: event.target.value }))
              }
              className={`${inputClass} ${errors.listId ? "border-red-400" : ""}`}
            >
              <option value="">Select list</option>
              {availableLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
            {errors.listId ? <p className="mt-0.5 text-xs text-red-500">{errors.listId}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={form.statusId ?? ""}
                onChange={(event) => handleStatusChange(event.target.value)}
                className={inputClass}
              >
                {resolvedStatuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    priority: event.target.value as TaskPriority,
                  }))
                }
                className={inputClass}
              >
                {ALL_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {TASK_PRIORITY_CONFIG[priority].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Due Date *</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, dueDate: event.target.value }))
              }
              className={`${inputClass} ${errors.dueDate ? "border-red-400" : ""}`}
            />
            {errors.dueDate ? <p className="mt-0.5 text-xs text-red-500">{errors.dueDate}</p> : null}
          </div>

          <div>
            <label className={labelClass}>Assignees</label>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_ASSIGNEES.map((assignee) => {
                const selected = form.assignees.includes(assignee);
                return (
                  <button
                    key={assignee}
                    type="button"
                    onClick={() => toggleAssignee(assignee)}
                    className={`rounded-full px-3 py-1 text-xs font-normal transition-all ${
                      selected
                        ? "bg-brand-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    }`}
                  >
                    {assignee.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelClass}>Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_TAGS.map((tag) => {
                const selected = form.tags.some((value) => value.id === tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-2.5 py-1 text-xs font-normal transition-all ${
                      selected
                        ? `${tag.color} ring-2 ring-brand-400`
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-gray-200 px-4 text-sm font-normal text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-brand-500 px-5 text-sm font-normal text-white transition-colors hover:bg-brand-600"
            >
              {editTask ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
