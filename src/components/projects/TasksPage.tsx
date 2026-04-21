"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Task } from "@/types/task";
import { useModal } from "@/hooks/useModal";
import { useProjects } from "@/context/ProjectContext";
import { useTaskLists } from "@/context/TaskListContext";
import { useTasks } from "@/context/TaskContext";
import { parseApiError } from "@/lib/api";
import { StatusItem, flattenGroupedStatuses, statusService } from "@/services/status.service";
import { TaskList } from "@/services/task-list.service";
import { WorkspaceMember, workspaceService } from "@/services/workspace.service";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useTaskStore } from "@/stores/task.store";
import TaskListView, { TaskListSectionData } from "./TaskListView";
import TaskBoard from "./TaskBoard";
import TaskDashboardHome from "./TaskDashboardHome";
import TaskCalendarView from "./TaskCalendarView";
import TaskForm from "./TaskForm";
import TaskDetailPanel from "./TaskDetailPanel";
import TaskDetailModal from "./TaskDetailModal";
import CreateListModal from "./CreateListModal";
import RenameListModal from "./RenameListModal";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { toast } from "sonner";
import type { ReactElement } from "react";
import {
  LuChevronDown,
  LuCircle,
  LuCalendarDays,
  LuFilter,
  LuLayoutDashboard,
  LuList,
  LuSearch,
  LuSettings,
  LuSquareKanban,
  LuStar,
  LuUser,
} from "react-icons/lu";

type ProjectView = "overview" | "list" | "board" | "calendar";

type PendingCreateDefaults = {
  listId?: string | null;
  statusId?: string | null;
};

const VIEW_TABS: Array<{
  id: ProjectView;
  label: string;
  icon: ReactElement;
}> = [
  { id: "overview", label: "Overview", icon: <LuLayoutDashboard className="h-4 w-4" /> },
  { id: "list", label: "List", icon: <LuList className="h-4 w-4" /> },
  { id: "board", label: "Board", icon: <LuSquareKanban className="h-4 w-4" /> },
  { id: "calendar", label: "Calendar", icon: <LuCalendarDays className="h-4 w-4" /> },
];

export default function TasksPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { getLists, getProjectLists, renameList, archiveList, restoreList, deleteList } =
    useTaskLists();
  const { getFilteredTasks } = useTasks();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { openTaskDetail, closeTaskDetail, openTask, openTaskLoading } = useTaskStore();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  const projectId = searchParams.get("projectId");
  const listId = searchParams.get("listId");
  const requestedView = (searchParams.get("view") as ProjectView | null) ?? null;
  const project = projects.find((item) => item.id === projectId) ?? null;
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pendingDefaults, setPendingDefaults] = useState<PendingCreateDefaults>({});
  const [createListOpen, setCreateListOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TaskList | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TaskList | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskList | null>(null);
  const [isMutatingList, setIsMutatingList] = useState(false);
  const formModal = useModal();

  const currentView: ProjectView = useMemo(() => {
    if (listId) {
      if (requestedView && requestedView !== "overview") return requestedView;
      return "list";
    }
    return requestedView ?? "overview";
  }, [listId, requestedView]);

  const allLists = projectId ? getProjectLists(projectId, { includeArchived: true }) : [];
  const activeLists = allLists.filter((list) => !list.isArchived);
  const archivedLists = allLists.filter((list) => list.isArchived);
  const selectedList = activeLists.find((list) => list.id === listId) ?? null;

  useEffect(() => {
    if (!projectId) return;
    void getLists(projectId, {
      includeArchived: !listId && currentView === "list",
    }).catch(() => {
      // The page can still render structure without list data.
    });
  }, [currentView, getLists, listId, projectId]);

  useEffect(() => {
    if (!projectId) return;
    statusService
      .list(projectId)
      .then((grouped) => setStatuses(flattenGroupedStatuses(grouped)))
      .catch(() => {
        setStatuses([]);
      });
  }, [projectId]);

  useEffect(() => {
    if (listId && !selectedList && activeLists.length > 0) {
      router.replace(`/projects?projectId=${projectId}`);
    }
  }, [activeLists.length, listId, projectId, router, selectedList]);

  // Load workspace members for task assignee picker
  useEffect(() => {
    if (!activeWorkspaceId) return;
    workspaceService.getMembers(activeWorkspaceId).then(setMembers).catch(() => {});
  }, [activeWorkspaceId]);

  const updateQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    router.push(`${pathname}?${next.toString()}`);
  };

  const projectTasks = useMemo(() => {
    if (!projectId) return [];
    const scoped = getFilteredTasks({ projectId });
    const activeListIds = new Set(activeLists.map((list) => list.id));
    return scoped.filter((task) => activeListIds.has(task.listId));
  }, [activeLists, getFilteredTasks, projectId]);

  const selectedListTasks = useMemo(() => {
    if (!projectId || !selectedList) return [];
    return getFilteredTasks({ projectId, listId: selectedList.id });
  }, [getFilteredTasks, projectId, selectedList]);

  const listSections = useMemo<TaskListSectionData[]>(() => {
    return activeLists.map((list) => ({
      list,
      tasks: getFilteredTasks({ projectId: projectId ?? undefined, listId: list.id }),
    }));
  }, [activeLists, getFilteredTasks, projectId]);

  const visibleTabs = listId
    ? VIEW_TABS.filter((tab) => tab.id !== "overview")
    : VIEW_TABS;

  const openCreate = (defaults?: PendingCreateDefaults) => {
    if (!projectId) return;
    if (!selectedList && activeLists.length === 0) {
      setCreateListOpen(true);
      return;
    }

    setEditTask(null);
    setPendingDefaults({
      listId: defaults?.listId ?? selectedList?.id ?? null,
      statusId: defaults?.statusId ?? null,
    });
    formModal.openModal();
  };

  const openEdit = (task: Task) => {
    setPanelOpen(false);
    setEditTask(task);
    setPendingDefaults({
      listId: task.listId,
      statusId: task.statusId ?? null,
    });
    formModal.openModal();
  };

  const openDetail = (task: Task) => {
    setViewTask(task);
    setPanelOpen(true);
  };

  const openTaskDetailById = async (taskId: string) => {
    await openTaskDetail(taskId);
  };

  const handleRenameList = async (name: string) => {
    if (!renameTarget) return;
    setIsMutatingList(true);
    try {
      await renameList(renameTarget.projectId, renameTarget.id, { name });
      toast.success(`List "${name}" renamed`);
      setRenameTarget(null);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setIsMutatingList(false);
    }
  };

  const handleArchiveList = async () => {
    if (!archiveTarget) return;
    setIsMutatingList(true);
    try {
      await archiveList(archiveTarget.projectId, archiveTarget.id);
      if (selectedList?.id === archiveTarget.id) {
        router.push(`/projects?projectId=${archiveTarget.projectId}`);
      }
      toast.success(`List "${archiveTarget.name}" archived`);
      setArchiveTarget(null);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setIsMutatingList(false);
    }
  };

  const handleRestoreList = async (list: TaskList) => {
    try {
      await restoreList(list.projectId, list.id);
      toast.success(`List "${list.name}" restored`);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    }
  };

  const handleDeleteList = async () => {
    if (!deleteTarget) return;
    setIsMutatingList(true);
    try {
      await deleteList(deleteTarget.projectId, deleteTarget.id);
      if (selectedList?.id === deleteTarget.id) {
        router.push(`/projects?projectId=${deleteTarget.projectId}`);
      }
      toast.success(`List "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setIsMutatingList(false);
    }
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-normal text-gray-900 dark:text-white">Select a Space</h2>
          <p className="mt-2 text-sm text-gray-400">
            Choose a project from the sidebar to open its lists and boards.
          </p>
        </div>
      </div>
    );
  }

  if (projectsLoading && !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-normal text-gray-900 dark:text-white">Project not found</h2>
          <p className="mt-2 text-sm text-gray-400">
            The selected space is unavailable in this workspace.
          </p>
        </div>
      </div>
    );
  }

  const projectInitial = project.name.charAt(0).toUpperCase();
  const heading = selectedList ? selectedList.name : project.name;
  const subheading = selectedList ? project.name : "Space";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="mb-1 flex items-center gap-2 pt-1">
          <span
            className="flex h-5 w-5 items-center justify-center rounded text-[11px] font-normal text-white"
            style={{ backgroundColor: project.color }}
          >
            {projectInitial}
          </span>
          <div className="flex items-center gap-2">
            {selectedList ? (
              <>
                <h1 className="text-lg font-normal text-gray-800 dark:text-white">{project.name}</h1>
                <span className="text-gray-300">/</span>
              </>
            ) : null}
            <h1 className="text-lg font-normal text-gray-800 dark:text-white">{heading}</h1>
          </div>
          <button
            type="button"
            className="text-gray-300 transition-colors hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300"
            aria-label="Favorite project"
          >
            <LuStar className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-5">
          <button
            type="button"
            className="pb-2 text-sm text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            Add Channel
          </button>
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => updateQuery({ view: tab.id })}
              className={`inline-flex items-center gap-1.5 border-b-2 pb-2 text-sm font-normal transition-colors ${
                currentView === tab.id
                  ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {currentView !== "overview" ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-sm font-normal text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"
            >
              Group: Status
              <LuChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="text-sm font-normal text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Subtasks
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <LuFilter className="h-4 w-4" />
              Filter
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <LuCircle className="h-4 w-4" />
              Closed
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <LuUser className="h-4 w-4" />
              Assignee
            </button>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-normal text-white dark:bg-white dark:text-gray-900">
              {subheading.charAt(0).toUpperCase()}
            </span>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <LuSearch className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <LuSettings className="h-4 w-4" />
              Customize
            </button>
            <button
              onClick={() =>
                openCreate({
                  listId: selectedList?.id ?? null,
                })
              }
              className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-3 py-1.5 font-normal text-white transition-colors hover:bg-brand-600"
            >
              Add Task
              <LuChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {currentView === "overview" ? (
          <TaskDashboardHome
            projectName={project.name}
            lists={activeLists}
            tasks={projectTasks}
            onCreateList={() => setCreateListOpen(true)}
          />
        ) : null}

        {currentView === "list" ? (
          <TaskListView
            mode={selectedList ? "list" : "project"}
            projectName={project.name}
            projectId={project.id}
            sections={selectedList ? [{ list: selectedList, tasks: selectedListTasks }] : listSections}
            statuses={statuses}
            archivedLists={selectedList ? [] : archivedLists}
            onView={openDetail}
            onAdd={openCreate}
            onCreateList={() => setCreateListOpen(true)}
            onRenameList={setRenameTarget}
            onArchiveList={setArchiveTarget}
            onRestoreList={handleRestoreList}
            onDeleteList={setDeleteTarget}
            onOpenTaskDetail={(taskId) => void openTaskDetailById(taskId)}
          />
        ) : null}

        {currentView === "board" ? (
          <TaskBoard
            projectId={project.id}
            lists={selectedList ? [selectedList] : activeLists}
            statuses={statuses}
            members={members}
            onOpenTaskDetail={(taskId) => void openTaskDetailById(taskId)}
          />
        ) : null}

        {currentView === "calendar" ? (
          <TaskCalendarView tasks={selectedList ? selectedListTasks : projectTasks} onView={openDetail} />
        ) : null}
      </div>

      <TaskForm
        key={`${editTask?.id ?? "new"}-${project.id}-${pendingDefaults.listId ?? "none"}-${pendingDefaults.statusId ?? "none"}-${formModal.isOpen ? "open" : "closed"}`}
        isOpen={formModal.isOpen}
        onClose={formModal.closeModal}
        editTask={editTask}
        projectId={project.id}
        availableLists={activeLists}
        statuses={statuses}
        defaultListId={pendingDefaults.listId ?? selectedList?.id ?? null}
        defaultStatusId={pendingDefaults.statusId ?? null}
      />

      <TaskDetailPanel
        key={viewTask?.id ?? "task-detail"}
        task={viewTask}
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onEdit={openEdit}
        statuses={statuses}
        lists={allLists}
      />

      {/* New full-screen task detail modal from task store */}
      {openTask && !openTaskLoading && (
        <TaskDetailModal
          key={openTask.id}
          task={openTask}
          statuses={statuses}
          members={members}
          listId={openTask.list.id}
          onClose={closeTaskDetail}
        />
      )}

      <CreateListModal
        isOpen={createListOpen}
        onClose={() => setCreateListOpen(false)}
        initialProjectId={project.id}
      />

      <RenameListModal
        key={renameTarget?.id ?? "rename-list"}
        isOpen={Boolean(renameTarget)}
        initialName={renameTarget?.name ?? ""}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRenameList}
        isLoading={isMutatingList}
      />

      <ConfirmActionModal
        isOpen={Boolean(archiveTarget)}
        title="Archive List"
        description={`Archive "${archiveTarget?.name ?? "this list"}"? It will disappear from the default list view.`}
        confirmLabel="Archive List"
        onClose={() => {
          if (!isMutatingList) setArchiveTarget(null);
        }}
        onConfirm={handleArchiveList}
        isLoading={isMutatingList}
      />

      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        title="Delete List"
        description={`Delete "${deleteTarget?.name ?? "this list"}" and all of its tasks? This action cannot be undone.`}
        confirmLabel="Delete List"
        onClose={() => {
          if (!isMutatingList) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteList}
        isLoading={isMutatingList}
      />
    </div>
  );
}
