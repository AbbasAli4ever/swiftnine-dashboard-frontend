"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  Task, TaskStatus, TaskFilters,
  Subtask, ChecklistItem, Checklist, TaskComment, TaskAttachment,
  SAMPLE_TAGS, SAMPLE_ASSIGNEES,
} from "@/types/task";

// ─── helpers ────────────────────────────────────────────────────────────────
export function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}
function tod(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}
export function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
export function isOverdue(dueDate: string, status: TaskStatus): boolean {
  return dueDate < tod() && status !== "done";
}
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── seed data ──────────────────────────────────────────────────────────────
const SEED: Task[] = [
  {
    id: "1", title: "Design new landing page mockup",
    description: "Create wireframes and high-fidelity mockups for the updated landing page in Figma. Include desktop and mobile variants.",
    status: "todo", priority: "high",
    assignees: [SAMPLE_ASSIGNEES[0], SAMPLE_ASSIGNEES[2]],
    dueDate: tod(3), tags: [SAMPLE_TAGS[0], SAMPLE_TAGS[4]],
    subtasks: [
      { id: "s1", title: "Create wireframes", completed: true },
      { id: "s2", title: "Design desktop layout", completed: false },
      { id: "s3", title: "Design mobile layout", completed: false },
    ],
    checklists: [
      { id: "cl1", name: "Design checklist", items: [
        { id: "ci1", text: "Review brand guidelines", completed: true },
        { id: "ci2", text: "Export assets", completed: false },
      ]},
    ],
    comments: [
      { id: "cm1", author: SAMPLE_ASSIGNEES[0], content: "Starting with the hero section first.", createdAt: tod(-1) },
    ],
    attachments: [], createdAt: tod(-2),
  },
  {
    id: "2", title: "Fix login page validation bug",
    description: "Users report that the email validation error message does not disappear after correction. Investigate and patch the form validation logic.",
    status: "in-progress", priority: "urgent",
    assignees: [SAMPLE_ASSIGNEES[1]],
    dueDate: tod(1), tags: [SAMPLE_TAGS[3], SAMPLE_TAGS[1]],
    subtasks: [
      { id: "s4", title: "Reproduce bug", completed: true },
      { id: "s5", title: "Write regression test", completed: false },
    ],
    checklists: [], comments: [
      { id: "cm2", author: SAMPLE_ASSIGNEES[1], content: "Found the issue — missing `onChange` reset handler.", createdAt: tod(-1) },
      { id: "cm3", author: SAMPLE_ASSIGNEES[0], content: "PR ready for review.", createdAt: tod(0) },
    ],
    attachments: [], createdAt: tod(-3),
  },
  {
    id: "3", title: "Implement dashboard charts",
    description: "Integrate ApexCharts to display monthly sales, user growth, and revenue data. Connect to mock API endpoints.",
    status: "in-progress", priority: "normal",
    assignees: [SAMPLE_ASSIGNEES[2]],
    dueDate: tod(5), tags: [SAMPLE_TAGS[1], SAMPLE_TAGS[4]],
    subtasks: [], checklists: [], comments: [], attachments: [], createdAt: tod(-1),
  },
  {
    id: "4", title: "Write API documentation",
    description: "Document all REST endpoints using OpenAPI/Swagger spec. Include request/response examples and authentication details.",
    status: "todo", priority: "low",
    assignees: [SAMPLE_ASSIGNEES[3]],
    dueDate: tod(10), tags: [SAMPLE_TAGS[2]],
    subtasks: [], checklists: [], comments: [], attachments: [], createdAt: tod(-4),
  },
  {
    id: "5", title: "Set up CI/CD pipeline",
    description: "Configure GitHub Actions for automated build, test, and deployment to staging environment.",
    status: "done", priority: "high",
    assignees: [SAMPLE_ASSIGNEES[4]],
    dueDate: tod(-2), tags: [SAMPLE_TAGS[2], SAMPLE_TAGS[5]],
    subtasks: [
      { id: "s6", title: "Setup GitHub Actions", completed: true },
      { id: "s7", title: "Configure staging deploy", completed: true },
    ],
    checklists: [], comments: [], attachments: [], createdAt: tod(-10),
  },
  {
    id: "6", title: "User profile settings page",
    description: "Build settings page allowing users to update avatar, name, email, and password.",
    status: "done", priority: "normal",
    assignees: [SAMPLE_ASSIGNEES[0]],
    dueDate: tod(-5), tags: [SAMPLE_TAGS[1], SAMPLE_TAGS[4]],
    subtasks: [], checklists: [], comments: [], attachments: [], createdAt: tod(-12),
  },
  {
    id: "7", title: "Mobile responsive audit",
    description: "Review and fix layout breakpoints across all pages for mobile and tablet viewports.",
    status: "review", priority: "normal",
    assignees: [SAMPLE_ASSIGNEES[1], SAMPLE_ASSIGNEES[3]],
    dueDate: tod(7), tags: [SAMPLE_TAGS[0], SAMPLE_TAGS[1]],
    subtasks: [], checklists: [], comments: [], attachments: [], createdAt: tod(-1),
  },
  {
    id: "8", title: "Database query optimisation",
    description: "Profile slow queries and add indexes. Target P95 latency under 50ms for all dashboard queries.",
    status: "in-progress", priority: "urgent",
    assignees: [SAMPLE_ASSIGNEES[3]],
    dueDate: tod(2), tags: [SAMPLE_TAGS[2], SAMPLE_TAGS[5]],
    subtasks: [], checklists: [], comments: [], attachments: [], createdAt: tod(-2),
  },
];

// ─── context value ───────────────────────────────────────────────────────────
interface TaskCtx {
  tasks: Task[];
  filters: TaskFilters;
  filteredTasks: Task[];
  // CRUD
  addTask: (t: Omit<Task, "id" | "createdAt">) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  // subtasks
  addSubtask: (taskId: string, title: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  // checklists
  addChecklist: (taskId: string, name: string) => void;
  addChecklistItem: (taskId: string, checklistId: string, text: string) => void;
  toggleChecklistItem: (taskId: string, checklistId: string, itemId: string) => void;
  deleteChecklistItem: (taskId: string, checklistId: string, itemId: string) => void;
  // comments
  addComment: (taskId: string, author: string, content: string) => void;
  deleteComment: (taskId: string, commentId: string) => void;
  // attachments
  addAttachment: (taskId: string, file: File) => void;
  deleteAttachment: (taskId: string, attachmentId: string) => void;
  // filters
  setFilters: (f: Partial<TaskFilters>) => void;
  resetFilters: () => void;
}

const Ctx = createContext<TaskCtx | null>(null);

const DEFAULT_FILTERS: TaskFilters = { search: "", status: "all", priority: "all", assignee: "" };

// ─── provider ────────────────────────────────────────────────────────────────
export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window === "undefined") return SEED;
    try {
      const s = localStorage.getItem("cu_tasks");
      return s ? (JSON.parse(s) as Task[]) : SEED;
    } catch { return SEED; }
  });
  const [filters, setF] = useState<TaskFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    localStorage.setItem("cu_tasks", JSON.stringify(tasks));
  }, [tasks]);

  const filteredTasks = tasks.filter((t) => {
    if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.status !== "all" && t.status !== filters.status) return false;
    if (filters.priority !== "all" && t.priority !== filters.priority) return false;
    if (filters.assignee && !t.assignees.some((a) => a.toLowerCase().includes(filters.assignee.toLowerCase()))) return false;
    return true;
  });

  const mut = useCallback((fn: (prev: Task[]) => Task[]) => setTasks(fn), []);

  const addTask = useCallback((t: Omit<Task, "id" | "createdAt">) => {
    mut((p) => [...p, { ...t, id: genId(), createdAt: tod() }]);
  }, [mut]);

  const updateTask = useCallback((id: string, u: Partial<Task>) => {
    mut((p) => p.map((t) => (t.id === id ? { ...t, ...u } : t)));
  }, [mut]);

  const deleteTask = useCallback((id: string) => {
    mut((p) => p.filter((t) => t.id !== id));
  }, [mut]);

  const updateTaskStatus = useCallback((id: string, status: TaskStatus) => {
    mut((p) => p.map((t) => (t.id === id ? { ...t, status } : t)));
  }, [mut]);

  // subtasks
  const addSubtask = useCallback((taskId: string, title: string) => {
    const s: Subtask = { id: genId(), title, completed: false };
    mut((p) => p.map((t) => t.id === taskId ? { ...t, subtasks: [...t.subtasks, s] } : t));
  }, [mut]);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    mut((p) => p.map((t) => t.id === taskId ? {
      ...t, subtasks: t.subtasks.map((s) => s.id === subtaskId ? { ...s, completed: !s.completed } : s),
    } : t));
  }, [mut]);

  const deleteSubtask = useCallback((taskId: string, subtaskId: string) => {
    mut((p) => p.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t));
  }, [mut]);

  // checklists
  const addChecklist = useCallback((taskId: string, name: string) => {
    const cl: Checklist = { id: genId(), name, items: [] };
    mut((p) => p.map((t) => t.id === taskId ? { ...t, checklists: [...t.checklists, cl] } : t));
  }, [mut]);

  const addChecklistItem = useCallback((taskId: string, checklistId: string, text: string) => {
    const item: ChecklistItem = { id: genId(), text, completed: false };
    mut((p) => p.map((t) => t.id === taskId ? {
      ...t, checklists: t.checklists.map((cl) => cl.id === checklistId ? { ...cl, items: [...cl.items, item] } : cl),
    } : t));
  }, [mut]);

  const toggleChecklistItem = useCallback((taskId: string, checklistId: string, itemId: string) => {
    mut((p) => p.map((t) => t.id === taskId ? {
      ...t, checklists: t.checklists.map((cl) => cl.id === checklistId ? {
        ...cl, items: cl.items.map((i) => i.id === itemId ? { ...i, completed: !i.completed } : i),
      } : cl),
    } : t));
  }, [mut]);

  const deleteChecklistItem = useCallback((taskId: string, checklistId: string, itemId: string) => {
    mut((p) => p.map((t) => t.id === taskId ? {
      ...t, checklists: t.checklists.map((cl) => cl.id === checklistId ? {
        ...cl, items: cl.items.filter((i) => i.id !== itemId),
      } : cl),
    } : t));
  }, [mut]);

  // comments
  const addComment = useCallback((taskId: string, author: string, content: string) => {
    const c: TaskComment = { id: genId(), author, content, createdAt: tod() };
    mut((p) => p.map((t) => t.id === taskId ? { ...t, comments: [...t.comments, c] } : t));
  }, [mut]);

  const deleteComment = useCallback((taskId: string, commentId: string) => {
    mut((p) => p.map((t) => t.id === taskId ? { ...t, comments: t.comments.filter((c) => c.id !== commentId) } : t));
  }, [mut]);

  // attachments
  const addAttachment = useCallback((taskId: string, file: File) => {
    const a: TaskAttachment = {
      id: genId(), name: file.name, size: file.size,
      type: file.type, uploadedAt: tod(),
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    };
    mut((p) => p.map((t) => t.id === taskId ? { ...t, attachments: [...t.attachments, a] } : t));
  }, [mut]);

  const deleteAttachment = useCallback((taskId: string, attachmentId: string) => {
    mut((p) => p.map((t) => t.id === taskId ? { ...t, attachments: t.attachments.filter((a) => a.id !== attachmentId) } : t));
  }, [mut]);

  const setFilters = useCallback((f: Partial<TaskFilters>) => setF((p) => ({ ...p, ...f })), []);
  const resetFilters = useCallback(() => setF(DEFAULT_FILTERS), []);

  return (
    <Ctx.Provider value={{
      tasks, filters, filteredTasks,
      addTask, updateTask, deleteTask, updateTaskStatus,
      addSubtask, toggleSubtask, deleteSubtask,
      addChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem,
      addComment, deleteComment,
      addAttachment, deleteAttachment,
      setFilters, resetFilters,
    }}>
      {children}
    </Ctx.Provider>
  );
}

// ─── hooks ───────────────────────────────────────────────────────────────────
export function useTasks(): TaskCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTasks must be used inside TaskProvider");
  return c;
}

export function useTaskStats() {
  const { tasks } = useTasks();
  const today = tod();
  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    inProgress: tasks.filter((t) => t.status === "in-progress").length,
    review: tasks.filter((t) => t.status === "review").length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter((t) => t.dueDate < today && t.status !== "done").length,
  };
}

export function useAssignees(): string[] {
  const { tasks } = useTasks();
  return Array.from(new Set(tasks.flatMap((t) => t.assignees))).filter(Boolean);
}
