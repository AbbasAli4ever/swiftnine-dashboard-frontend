"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useModal } from "@/hooks/useModal";
import { useProjects } from "@/context/ProjectContext";
import { projectService } from "@/services/project.service";
import { useTaskLists } from "@/context/TaskListContext";
import { parseApiError } from "@/lib/api";
import { StatusItem, flattenGroupedStatuses, statusService } from "@/services/status.service";
import { TaskList } from "@/services/task-list.service";
import { WorkspaceTag, tagService } from "@/services/tag.service";
import { TaskListItem } from "@/services/task.service";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { getTaskSearchCacheKey, useTaskSearchStore } from "@/stores/task-search.store";
import { useTaskStore } from "@/stores/task.store";
import TaskListView, { TaskListSectionData } from "./TaskListView";
import TaskBoard from "./TaskBoard";
import TaskDashboardHome from "./TaskDashboardHome";
import TaskCalendarView from "./TaskCalendarView";
import TaskForm from "./TaskForm";
import TaskDetailModal from "./TaskDetailModal";
import MinimizedTaskBar from "./MinimizedTaskBar";
import CreateListModal from "./CreateListModal";
import RenameListModal from "./RenameListModal";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import TaskFiltersModal from "./TaskFiltersModal";
import ProjectTaskHeader from "./ProjectTaskHeader";
import ListTaskHeader from "./ListTaskHeader";
import TaskPagination from "./TaskPagination";
import {
  clearTaskSearchPatch,
  countActiveTaskSearchFilters,
  hasActiveTaskSearchFilters,
  parseTaskSearchParams,
} from "./task-search-utils";
import { toast } from "sonner";
import type { ReactElement } from "react";
import { LuArchive, LuCalendarDays, LuLayoutDashboard, LuList, LuSquareKanban, LuStar } from "react-icons/lu";
import { ICON_MAP } from "@/components/projects/IconColorPicker";

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
  const { projects, isLoading: projectsLoading, patchLocalProject } = useProjects();
  const { getLists, getProjectLists, renameList, archiveList, restoreList, deleteList } = useTaskLists();
  const { members, refetch: refetchMembers } = useWorkspaceMembers();
  const {
    openTaskDetail,
    closeTaskDetail,
    minimizeTask,
    openTask,
    openTaskLoading,
    setTasksForLists,
  } = useTaskStore();
  const { searchProject, searchList } = useTaskSearchStore();
  const [tags, setTags] = useState<WorkspaceTag[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [pendingDefaults, setPendingDefaults] = useState<PendingCreateDefaults>({});
  const [createListOpen, setCreateListOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TaskList | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TaskList | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskList | null>(null);
  const [isMutatingList, setIsMutatingList] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);
  const formModal = useModal();

  const projectId = searchParams.get("projectId");
  const listId = searchParams.get("listId");
  const taskIdParam = searchParams.get("taskId");
  const requestedView = (searchParams.get("view") as ProjectView | null) ?? null;
  const project = projects.find((item) => item.id === projectId) ?? null;
  const taskSearchParams = useMemo(() => parseTaskSearchParams(searchParams), [searchParams]);

  useEffect(() => {
    return () => {
      closeTaskDetail();
    };
  }, [closeTaskDetail]);

  // Auto-open task when taskId is in the URL (e.g. from sidebar favorites)
  useEffect(() => {
    if (!taskIdParam) return;
    void openTaskDetail(taskIdParam);
    // Remove taskId from URL after opening so back-navigation works cleanly
    const next = new URLSearchParams(searchParams.toString());
    next.delete("taskId");
    router.replace(`?${next.toString()}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIdParam]);

  const currentView: ProjectView = useMemo(() => {
    if (listId) {
      if (requestedView && requestedView !== "overview") return requestedView;
      return "list";
    }
    return requestedView ?? "overview";
  }, [listId, requestedView]);

  const allLists = projectId ? getProjectLists(projectId, { includeArchived: true }) : [];
  const activeLists = allLists.filter((list) => !list.isArchived);
  const selectedList = allLists.find((list) => list.id === listId) ?? null;
  const visibleTabs = listId ? VIEW_TABS.filter((tab) => tab.id !== "overview") : VIEW_TABS;

  useEffect(() => {
    if (!projectId) return;
    void getLists(projectId, {
      includeArchived: currentView === "list",
    }).catch(() => {});
  }, [currentView, getLists, listId, projectId]);

  useEffect(() => {
    if (!projectId) return;
    statusService
      .list(projectId)
      .then((grouped) => setStatuses(flattenGroupedStatuses(grouped)))
      .catch(() => setStatuses([]));
  }, [projectId]);

  useEffect(() => {
    if (listId && !selectedList && activeLists.length > 0) {
      router.replace(`/projects?projectId=${projectId}`);
    }
  }, [activeLists.length, listId, projectId, router, selectedList]);

  useEffect(() => {
    tagService.list().then(setTags).catch(() => setTags([]));
  }, []);

  const taskScope = useMemo(() => {
    if (!projectId) return null;
    if (selectedList) {
      return { type: "list" as const, projectId, listId: selectedList.id };
    }
    return { type: "project" as const, projectId };
  }, [projectId, selectedList]);

  const pagedCacheKey = useMemo(() => (
    taskScope ? getTaskSearchCacheKey(taskScope, taskSearchParams, "page") : null
  ), [taskScope, taskSearchParams]);

  const fullCacheKey = useMemo(() => (
    taskScope ? getTaskSearchCacheKey(taskScope, taskSearchParams, "all") : null
  ), [taskScope, taskSearchParams]);

  const pagedCache = useTaskSearchStore((state) => (pagedCacheKey ? state.caches[pagedCacheKey] : undefined));
  const fullCache = useTaskSearchStore((state) => (fullCacheKey ? state.caches[fullCacheKey] : undefined));

  useEffect(() => {
    if (!taskScope) return;
    if (taskScope.type === "list") {
      void searchList(taskScope.projectId, taskScope.listId, taskSearchParams, "page");
      return;
    }
    void searchProject(taskScope.projectId, taskSearchParams, "page");
  }, [taskScope, taskSearchParams, searchList, searchProject]);

  useEffect(() => {
    if (!taskScope || currentView === "list") return;
    if (taskScope.type === "list") {
      void searchList(taskScope.projectId, taskScope.listId, taskSearchParams, "all");
      return;
    }
    void searchProject(taskScope.projectId, taskSearchParams, "all");
  }, [currentView, taskScope, taskSearchParams, searchList, searchProject]);

  const activeSearchItems = useMemo<TaskListItem[]>(
    () => (currentView === "list" ? pagedCache?.items ?? [] : fullCache?.items ?? []),
    [currentView, fullCache?.items, pagedCache?.items]
  );

  const groupedTasksByList = useMemo<Record<string, TaskListItem[]>>(() => {
    const initial = Object.fromEntries(activeLists.map((list) => [list.id, [] as TaskListItem[]]));
    activeSearchItems.forEach((task) => {
      if (!initial[task.list.id]) return;
      initial[task.list.id].push(task);
    });
    return initial;
  }, [activeLists, activeSearchItems]);

  useEffect(() => {
    if (!projectId) return;
    setTasksForLists(groupedTasksByList);
  }, [groupedTasksByList, projectId, setTasksForLists]);

  const listSections = useMemo<TaskListSectionData[]>(() => {
    return allLists.map((list) => ({
      list,
      tasks: groupedTasksByList[list.id] ?? [],
    }));
  }, [allLists, groupedTasksByList]);

  const updateQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    router.push(`${pathname}?${next.toString()}`);
  };

  const filterCount = countActiveTaskSearchFilters(taskSearchParams);
  const hasActiveFilters = hasActiveTaskSearchFilters(taskSearchParams);
  const disableListReorder = hasActiveFilters || (pagedCache?.meta?.total_pages ?? 1) > 1;
  const disableBoardReorder = hasActiveFilters;

  const openCreate = (defaults?: PendingCreateDefaults) => {
    if (!projectId) return;
    if (!selectedList && activeLists.length === 0) {
      setCreateListOpen(true);
      return;
    }

    setPendingDefaults({
      listId: defaults?.listId ?? selectedList?.id ?? null,
      statusId: defaults?.statusId ?? null,
    });
    formModal.openModal();
  };

  const openTaskDetailById = async (taskId: string) => {
    await openTaskDetail(taskId);
  };

  const handleUnarchiveProject = async () => {
    if (!projectId) return;
    try {
      await projectService.restore(projectId);
      patchLocalProject(projectId, { isArchived: false });
      toast.success("Space restored");
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  };

  const handleRenameList = async (name: string) => {
    if (!renameTarget) return;
    setIsMutatingList(true);
    try {
      await renameList(renameTarget.projectId, renameTarget.id, { name });
      toast.success(`List "${name}" renamed`);
      setRenameTarget(null);
    } catch (error) {
      toast.error(parseApiError(error).message);
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
      toast.error(parseApiError(error).message);
    } finally {
      setIsMutatingList(false);
    }
  };

  const handleRestoreList = async (list: TaskList) => {
    try {
      await restoreList(list.projectId, list.id);
      toast.success(`List "${list.name}" restored`);
    } catch (error) {
      toast.error(parseApiError(error).message);
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
      toast.error(parseApiError(error).message);
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
  const scopeHeader = selectedList ? (
    <ListTaskHeader
      listName={selectedList.name}
      searchValue={taskSearchParams.q ?? ""}
      filterCount={filterCount}
      onSearchChange={(value) => updateQuery({ q: value || null, page: null })}
      onOpenFilters={(rect) => { setFilterAnchor(rect); setFiltersOpen(true); }}
      onAddTask={() => openCreate({ listId: selectedList.id })}
    />
  ) : (
    <ProjectTaskHeader
      searchValue={taskSearchParams.q ?? ""}
      filterCount={filterCount}
      onSearchChange={(value) => updateQuery({ q: value || null, page: null })}
      onOpenFilters={(rect) => { setFilterAnchor(rect); setFiltersOpen(true); }}
      onAddTask={() => openCreate({ listId: null })}
    />
  );

  const isLoadingTasks = taskScope
    ? currentView === "list"
      ? !pagedCache || pagedCache.loading
      : !fullCache || fullCache.loading
    : false;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="mb-1 flex items-center gap-2 pt-1">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: project.color }}
          >
            {project.icon && ICON_MAP.has(project.icon)
              ? (() => { const I = ICON_MAP.get(project.icon!)!; return <I className="h-4 w-4" />; })()
              : <span className="text-[11px] font-semibold">{projectInitial}</span>
            }
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
          {/* <button
            type="button"
            className="pb-2 text-sm text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            Add Channel
          </button> */}
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

      {project?.isArchived && (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <LuArchive className="h-4 w-4 shrink-0" />
          <span className="flex-1">This Space is archived.</span>
          <button
            type="button"
            onClick={() => void handleUnarchiveProject()}
            className="font-medium underline hover:no-underline"
          >
            Unarchive
          </button>
        </div>
      )}


      {currentView !== "overview" && scopeHeader}

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoadingTasks ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : null}

        {currentView === "overview" ? (
          <TaskDashboardHome
            projectId={project.id}
            projectName={project.name}
            members={members}
            onCreateList={() => setCreateListOpen(true)}
          />
        ) : null}

        {!isLoadingTasks && currentView === "list" ? (
          <>
            <TaskListView
              mode={selectedList ? "list" : "project"}
              projectName={project.name}
              projectId={project.id}
              sections={selectedList ? [{ list: selectedList, tasks: groupedTasksByList[selectedList.id] ?? [] }] : listSections}
              statuses={statuses}
              onAdd={openCreate}
              onCreateList={() => setCreateListOpen(true)}
              onRenameList={setRenameTarget}
              onArchiveList={setArchiveTarget}
              onRestoreList={handleRestoreList}
              onDeleteList={setDeleteTarget}
              onOpenTaskDetail={(taskId) => void openTaskDetailById(taskId)}
              disableAutoFetch
              disableSameStatusReorder={disableListReorder}
            />
            <TaskPagination
              meta={pagedCache?.meta ?? null}
              onPageChange={(page) => updateQuery({ page: String(page) })}
            />
          </>
        ) : null}

        {!isLoadingTasks && currentView === "board" ? (
          <TaskBoard
            projectId={project.id}
            lists={selectedList ? [selectedList] : activeLists}
            statuses={statuses}
            members={members}
            onOpenTaskDetail={(taskId) => void openTaskDetailById(taskId)}
            onRefetchMembers={refetchMembers}
            disableAutoFetch
            disableSameStatusReorder={disableBoardReorder}
            taskSearchParams={selectedList ? undefined : taskSearchParams}
          />
        ) : null}

        {!isLoadingTasks && currentView === "calendar" ? (
          <TaskCalendarView
            tasks={fullCache?.items ?? []}
            onView={(taskId) => void openTaskDetailById(taskId)}
          />
        ) : null}
      </div>

      <TaskForm
        key={`${project.id}-${pendingDefaults.listId ?? "none"}-${pendingDefaults.statusId ?? "none"}-${formModal.isOpen ? "open" : "closed"}`}
        isOpen={formModal.isOpen}
        onClose={formModal.closeModal}
        projectId={project.id}
        availableLists={activeLists}
        statuses={statuses}
        defaultListId={pendingDefaults.listId ?? selectedList?.id ?? null}
        defaultStatusId={pendingDefaults.statusId ?? null}
      />

      {openTask && !openTaskLoading && (
        <TaskDetailModal
          key={openTask.id}
          task={openTask}
          statuses={statuses}
          listId={openTask.list.id}
          onClose={closeTaskDetail}
          onMinimize={minimizeTask}
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

      <TaskFiltersModal
        key={`project-filters-${project.id}-${selectedList?.id ?? "project"}-${searchParams.toString()}`}
        isOpen={filtersOpen}
        anchorRect={filterAnchor}
        onClose={() => setFiltersOpen(false)}
        value={taskSearchParams}
        statuses={statuses}
        members={members}
        tags={tags}
        onApply={(patch) => updateQuery(patch)}
        onClear={() => {
          updateQuery(clearTaskSearchPatch());
          setFiltersOpen(false);
        }}
      />

      <MinimizedTaskBar />
    </div>
  );
}
