"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useProjects } from "@/context/ProjectContext";
import { useTaskLists } from "@/context/TaskListContext";
import { Project, projectService } from "@/services/project.service";
import { taskService } from "@/services/task.service";
import { useUiStore } from "@/stores/ui.store";
import { TaskList } from "@/services/task-list.service";
import { parseApiError } from "@/lib/api";
import WorkspaceSwitcher from "@/components/workspace/WorkspaceSwitcher";
import CreateWorkspaceModal from "@/components/workspace/CreateWorkspaceModal";
import InvitePeopleModal from "@/components/workspace/InvitePeopleModal";
import CreateSpaceModal from "@/components/projects/CreateSpaceModal";
import EditSpaceModal from "@/components/projects/EditSpaceModal";
import SpaceContextMenu from "@/components/projects/SpaceContextMenu";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import CreateListModal from "@/components/projects/CreateListModal";
import ProjectUnlockModal from "@/components/projects/ProjectUnlockModal";
import ProjectPasswordModal from "@/components/projects/ProjectPasswordModal";
import ListContextMenu from "@/components/projects/ListContextMenu";
import DocsListSidebarSection from "@/components/docs/DocsListSidebarSection";
import DmSidebarSection from "@/components/dm/DmSidebarSection";
import ChannelSidebarSection from "@/components/channels/ChannelSidebarSection";
import { ICON_MAP } from "@/components/projects/IconColorPicker";
import { toast } from "sonner";
import { RiHomeSmileFill,RiInbox2Fill } from "react-icons/ri";
import { BsReply,BsPersonCheck,BsPersonWorkspace  } from "react-icons/bs";
import { GoPersonAdd } from "react-icons/go";
import {
  LuUsers,
  LuPlus,




  LuSettings,
  LuChevronRight,
  LuLogOut,
  LuChevronDown,
  LuSlidersHorizontal,
  LuEllipsis as LuMoreHorizontal,
  LuStar,
  LuArchive,
  LuLock,
  LuLayoutGrid,
  LuBookOpen,
  LuPlay,
} from "react-icons/lu";
import { MdChecklist } from "react-icons/md";

// ── Icon Rail items ──────────────────────────────────────────────────────────
type RailItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  panel: "home" | "lms" | "ai" | "teams" | "clips" | "more";
};

const railItems: RailItem[] = [
  { id: "home", label: "Home", icon: <RiHomeSmileFill className="w-5 h-5" />, panel: "home" },
  { id: "lms",  label: "LMS",  icon: <LuBookOpen className="w-5 h-5" />,      panel: "lms" },
];

// ── Nav link definitions ─────────────────────────────────────────────────────
type NavLink = { label: string; path: string; icon: React.ReactNode; badge?: number };

const inboxLinks: NavLink[] = [
  { label: "Inbox",             path: "/",      icon: <RiInbox2Fill className="w-4 h-4" /> },
  { label: "Replies",           path: "/replies",           icon: <BsReply  className="w-4 h-4" /> },
  { label: "Assigned Comments", path: "/assigned-comments", icon: <BsPersonWorkspace  className="w-4 h-4" /> },
  { label: "My Tasks",          path: "/my-tasks", icon: <BsPersonCheck className="w-4 h-4" /> },
];

const dmUsers = [
  { name: "Numan Zafar", initials: "NZ", color: "bg-orange-400" },
  { name: "sufian",      initials: "S",  color: "bg-brand-500", you: true },
];

type SettingsNavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tab?: string;
};

const workspaceSettingsItems: SettingsNavItem[] = [
  { label: "General",  icon: LuSettings, tab: "general" },
  { label: "People",   icon: LuUsers,    tab: "people" },
];

const mySettingsItems: SettingsNavItem[] = [
  { label: "Preferences", icon: LuSlidersHorizontal, tab: "preferences" },
];

function SidebarListRow({
  project,
  list,
  isActive,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  project: Project;
  list: TaskList;
  isActive: boolean;
  onDragStart: (listId: string) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (targetListId: string) => void;
}) {
  const router = useRouter();
  const { renameList, archiveList, restoreList, deleteList } = useTaskLists();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renamingInline, setRenamingInline] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const navigateToList = () => {
    router.push(`/projects?projectId=${project.id}&listId=${list.id}&view=list`);
  };

  const startInlineRename = () => {
    setRenameValue(list.name);
    setRenamingInline(true);
    setTimeout(() => renameInputRef.current?.focus(), 30);
  };

  const commitInlineRename = async () => {
    const trimmed = renameValue.trim();
    setRenamingInline(false);
    if (!trimmed || trimmed === list.name) return;
    setIsMutating(true);
    try {
      await renameList(project.id, list.id, { name: trimmed });
      toast.success(`List renamed to "${trimmed}"`);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleArchive = async () => {
    setIsMutating(true);
    try {
      await archiveList(project.id, list.id);
      if (isActive) {
        router.push(`/projects?projectId=${project.id}`);
      }
      toast.success(`List "${list.name}" archived`);
      setArchiveOpen(false);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleRestore = async () => {
    setIsMutating(true);
    try {
      await restoreList(project.id, list.id);
      toast.success(`List "${list.name}" restored`);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    setIsMutating(true);
    try {
      await deleteList(project.id, list.id);
      if (isActive) {
        router.push(`/projects?projectId=${project.id}`);
      }
      toast.success(`List "${list.name}" deleted`);
      setDeleteOpen(false);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <>
      <div
        draggable
        onDragStart={() => onDragStart(list.id)}
        onDragOver={onDragOver}
        onDrop={() => onDrop(list.id)}
        className={`group ml-7 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors ${
          isActive
            ? "bg-violet-100/80 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
      >
        <MdChecklist className="h-3.5 w-3.5 shrink-0 text-gray-400" />

        {renamingInline ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitInlineRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitInlineRename();
              if (e.key === "Escape") setRenamingInline(false);
            }}
            className="min-w-0 flex-1 rounded px-1 py-0 text-[13px] bg-white dark:bg-gray-800 border border-brand-500 text-gray-900 dark:text-white outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            onClick={navigateToList}
            className="flex min-w-0 flex-1 items-center text-left"
          >
            <span className="truncate font-normal">{list.name}</span>
            {list.isArchived && <LuArchive className="h-3 w-3 shrink-0 ml-1 text-gray-400" />}
          </button>
        )}

        <button
          ref={menuTriggerRef}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen(true);
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-gray-400 opacity-0 transition-all hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <LuMoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      <ListContextMenu
        list={list}
        triggerRef={menuTriggerRef}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onRename={() => { setMenuOpen(false); startInlineRename(); }}
        onArchive={() => setArchiveOpen(true)}
        onRestore={handleRestore}
        onDelete={() => setDeleteOpen(true)}
      />

      <ConfirmActionModal
        isOpen={archiveOpen}
        title="Archive List"
        description={`Archive "${list.name}"? It will disappear from the sidebar until restored from the project view.`}
        confirmLabel="Archive List"
        onClose={() => {
          if (!isMutating) setArchiveOpen(false);
        }}
        onConfirm={handleArchive}
        isLoading={isMutating}
      />

      <ConfirmActionModal
        isOpen={deleteOpen}
        title="Delete List"
        description={`Delete "${list.name}" and all of its tasks? This action cannot be undone.`}
        confirmLabel="Delete List"
        onClose={() => {
          if (!isMutating) setDeleteOpen(false);
        }}
        onConfirm={handleDelete}
        isLoading={isMutating}
      />
    </>
  );
}

// ── Space row with nested list items ────────────────────────────────────────
function SpaceRow({
  project,
  activeProjectId,
  activeListId,
  showArchivedLists = false,
}: {
  project: Project;
  activeProjectId: string | null;
  activeListId: string | null;
  showArchivedLists?: boolean;
}) {
  const router = useRouter();
  const { deleteProject, updateProject, patchLocalProject, refetch: refetchProjects } = useProjects();
  const { getProjectLists, reorderLists } = useTaskLists();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [draggedListId, setDraggedListId] = useState<string | null>(null);
  const [renamingProject, setRenamingProject] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const lists = getProjectLists(project.id, { includeArchived: showArchivedLists });
  const isProjectActive = activeProjectId === project.id && !activeListId;
  const isWithinProject = activeProjectId === project.id;
  const isLocked = project.locked === true;

  useEffect(() => {
    if (isWithinProject) setExpanded(true);
  }, [isWithinProject]);

  useEffect(() => {
    if (renamingProject) {
      setTimeout(() => renameInputRef.current?.focus(), 30);
    }
  }, [renamingProject]);

  const openProject = () => {
    if (isLocked) {
      setUnlockModalOpen(true);
      return;
    }
    router.push(`/projects?projectId=${project.id}`);
  };

  const startRename = () => {
    if (isLocked) return;
    setRenameValue(project.name);
    setRenamingProject(true);
  };

  const commitProjectRename = async () => {
    const trimmed = renameValue.trim();
    setRenamingProject(false);
    if (!trimmed || trimmed === project.name) return;
    try {
      await updateProject(project.id, { name: trimmed });
      toast.success(`Space renamed to "${trimmed}"`);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteProject(project.id);
      toast.success(`Space "${project.name}" deleted`);
      setDeleteOpen(false);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFavorite = async () => {
    try {
      if (project.isFavorite) {
        await projectService.unfavorite(project.id);
        patchLocalProject(project.id, { isFavorite: false });
      } else {
        await projectService.favorite(project.id);
        patchLocalProject(project.id, { isFavorite: true });
      }
      useUiStore.getState().invalidateFavorites();
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    }
  };

  const handleArchive = async () => {
    try {
      await projectService.archive(project.id);
      patchLocalProject(project.id, { isArchived: true });
      toast.success(`Space "${project.name}" archived`);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    }
  };

  const handleRestore = async () => {
    try {
      await projectService.restore(project.id);
      patchLocalProject(project.id, { isArchived: false });
      toast.success(`Space "${project.name}" restored`);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    }
  };

  const handleReorder = async (targetListId: string) => {
    if (!draggedListId || draggedListId === targetListId) return;

    const ids = lists.map((list) => list.id);
    const fromIndex = ids.indexOf(draggedListId);
    const toIndex = ids.indexOf(targetListId);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = [...ids];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    try {
      await reorderLists(project.id, next);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setDraggedListId(null);
    }
  };

  return (
    <>
      <div className="space-y-0.5">
        <div
          className={`group flex w-full items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
            isProjectActive
              ? "bg-violet-100/80 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
              : isWithinProject
                ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          }`}
        >
          {isLocked ? (
            <span className="flex h-5 w-5 items-center justify-center" />
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((value) => !value);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              {expanded ? (
                <LuChevronDown className="h-3.5 w-3.5" />
              ) : (
                <LuChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {renamingProject ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitProjectRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitProjectRename();
                if (e.key === "Escape") setRenamingProject(false);
              }}
              className="min-w-0 flex-1 rounded px-1 py-0 text-[13px] bg-white dark:bg-gray-800 border border-brand-500 text-gray-900 dark:text-white outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              onClick={openProject}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              {isLocked ? (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-gray-300 dark:bg-gray-600">
                  <LuLock className="h-2.5 w-2.5 text-gray-500 dark:text-gray-400" />
                </span>
              ) : (
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-white"
                  style={{ backgroundColor: project.color }}
                >
                  {project.icon && ICON_MAP.has(project.icon)
                    ? (() => { const I = ICON_MAP.get(project.icon!)!; return <I className="h-2.5 w-2.5" />; })()
                    : <span className="text-[10px] font-normal">{project.name?.charAt(0).toUpperCase() ?? ""}</span>
                  }
                </span>
              )}
              <span className={`truncate font-normal text-[13px] ${isLocked ? "text-gray-400 dark:text-gray-500 italic" : ""}`}>
                {isLocked ? "Locked Project" : (project.name ?? "")}
              </span>
              {!isLocked && project.isArchived && <LuArchive className="h-3 w-3 shrink-0 text-gray-400" />}
            </button>
          )}

          {!isLocked && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setCreateListOpen(true);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-gray-400 opacity-0 transition-all hover:bg-gray-200 hover:text-brand-500 group-hover:opacity-100 dark:hover:bg-gray-700"
            >
              <LuPlus className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            ref={menuTriggerRef}
            onMouseDown={(event) => {
              event.stopPropagation();
              if (!menuOpen) setMenuOpen(true);
            }}
            onClick={(event) => event.stopPropagation()}
            className={`flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-all hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 ${menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            <LuMoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>

        {expanded && !isLocked ? (
          <div className="space-y-0.5">
            {lists.map((list) => (
              <SidebarListRow
                key={list.id}
                project={project}
                list={list}
                isActive={activeProjectId === project.id && activeListId === list.id}
                onDragStart={setDraggedListId}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleReorder}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Context menu — rendered outside the row so it isn't clipped by overflow-hidden */}
      <SpaceContextMenu
        project={project}
        triggerRef={menuTriggerRef}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onEdit={() => { setMenuOpen(false); setEditOpen(true); }}
        onRename={() => startRename()}
        onDelete={() => {
          setMenuOpen(false);
          setDeleteOpen(true);
        }}
        onIconColorChange={async (icon, color) => {
          try {
            await updateProject(project.id, { icon, color });
          } catch {
            toast.error("Failed to update icon & color");
          }
        }}
        onFavorite={handleFavorite}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onPasswordProtection={() => setPasswordModalOpen(true)}
      />

      {/* Edit modal — lives here so it survives after the context menu unmounts */}
      <EditSpaceModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        project={project}
      />

      {deleteOpen && (
        <ConfirmActionModal
          isOpen={deleteOpen}
          title="Delete Space"
          description={`Delete space "${project.name}"? This action cannot be undone.`}
          confirmLabel="Delete Space"
          onClose={() => {
            if (!deleteLoading) setDeleteOpen(false);
          }}
          onConfirm={handleDelete}
          isLoading={deleteLoading}
        />
      )}

      <CreateListModal
        isOpen={createListOpen}
        onClose={() => setCreateListOpen(false)}
        initialProjectId={project.id}
        lockProject
      />

      <ProjectUnlockModal
        isOpen={unlockModalOpen}
        projectId={project.id}
        projectName={isLocked ? undefined : project.name}
        onClose={() => setUnlockModalOpen(false)}
        onUnlocked={() => {
          setUnlockModalOpen(false);
          void refetchProjects();
          router.push(`/projects?projectId=${project.id}`);
        }}
      />

      {!isLocked && (
        <ProjectPasswordModal
          isOpen={passwordModalOpen}
          projectId={project.id}
          projectName={project.name}
          hasPassword={!!project.passwordUpdatedAt}
          onClose={() => setPasswordModalOpen(false)}
          onPasswordChanged={(removed) => {
            setPasswordModalOpen(false);
            if (removed) {
              patchLocalProject(project.id, { passwordUpdatedAt: null });
            } else {
              void refetchProjects();
            }
          }}
        />
      )}
    </>
  );
}

function WorkspacePanelHeader() {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wsName    = activeWorkspace?.name ?? "Workspace";
  const wsInitial = wsName.charAt(0).toUpperCase();

  return (
    <div className="relative flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800">
      <button
        ref={triggerRef}
        onClick={() => setSwitcherOpen((v) => !v)}
        className="flex items-center gap-1.5 font-normal text-gray-800 dark:text-gray-100 hover:text-brand-500"
      >
        <span className="flex items-center justify-center w-5 h-5 rounded bg-[#6366f1] dark:bg-gray-000 dark:text-black text-white text-[10px] font-normal shrink-0">
          {wsInitial}
        </span>
        <span className="truncate max-w-[140px]">{wsName}</span>
        <LuChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>

      {/* <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
        aria-label="Open calendar"
      >
        <LuCalendarDays className="h-4 w-4" />
      </button> */}

      <WorkspaceSwitcher
        isOpen={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        onCreateWorkspace={() => { setSwitcherOpen(false); setCreateModalOpen(true); }}
        anchorRef={triggerRef}
      />

      <CreateWorkspaceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}

// ── Favorites section ────────────────────────────────────────────────────────
function FavoritesSidebarSection() {
  const router = useRouter();
  const { favoritesRefreshKey } = useUiStore();
  const { patchLocalProject } = useProjects();
  const [expanded, setExpanded] = useState(true);
  const [favProjects, setFavProjects] = useState<Project[]>([]);
  const [favTasks, setFavTasks] = useState<import("@/services/task.service").TaskListItem[]>([]);

  useEffect(() => {
    import("@/services/favorite.service").then(({ favoriteService }) => {
      Promise.all([favoriteService.listProjects(), favoriteService.listTasks()])
        .then(([projs, tasks]) => {
          setFavProjects(projs);
          setFavTasks(tasks);
        })
        .catch(() => {});
    });
  }, [favoritesRefreshKey]);

  const hasAny = favProjects.length > 0 || favTasks.length > 0;

  if (!hasAny) return null;

  return (
    <div className="mt-1 border-t border-gray-100 pt-4 dark:border-gray-800">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-2 mb-1 group"
      >
        <div className="flex items-center gap-1.5">
          <LuStar className="h-3 w-3 text-amber-400" style={{ fill: "currentColor" }} />
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-normal">Favorites</p>
        </div>
        {expanded ? (
          <LuChevronDown className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
        ) : (
          <LuChevronRight className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
        )}
      </button>

      {expanded && (
        <div className="space-y-0.5">
          {favProjects.map((p) => (
            <div
              key={p.id}
              className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
            >
              <button
                type="button"
                onClick={() => router.push(`/projects?projectId=${p.id}`)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-white text-[10px]"
                  style={{ backgroundColor: p.color }}
                >
                  {p.icon && ICON_MAP.has(p.icon)
                    ? (() => { const I = ICON_MAP.get(p.icon!)!; return <I className="h-2.5 w-2.5" />; })()
                    : p.name.charAt(0).toUpperCase()
                  }
                </span>
                <span className="truncate">{p.name}</span>
              </button>
              <button
                type="button"
                title="Remove from favorites"
                onClick={async () => {
                  try {
                    await projectService.unfavorite(p.id);
                    setFavProjects((prev) => prev.filter((x) => x.id !== p.id));
                    patchLocalProject(p.id, { isFavorite: false });
                    useUiStore.getState().invalidateFavorites();
                  } catch {
                    toast.error("Failed to remove from favorites");
                  }
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-amber-400 opacity-0 transition-all hover:bg-gray-200 group-hover:opacity-100 dark:hover:bg-gray-700"
              >
                <LuStar className="h-3.5 w-3.5" style={{ fill: "currentColor" }} />
              </button>
            </div>
          ))}
          {favTasks.map((t) => (
            <div
              key={t.id}
              className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
            >
              <button
                type="button"
                onClick={() => router.push(`/projects?projectId=${t.list.project.id}&taskId=${t.id}`)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {t.taskId}
                </span>
                <span className="truncate">{t.title}</span>
              </button>
              <button
                type="button"
                title="Remove from favorites"
                onClick={async () => {
                  try {
                    await taskService.unfavorite(t.id);
                    setFavTasks((prev) => prev.filter((x) => x.id !== t.id));
                    useUiStore.getState().setTaskFavoriteOverride(t.id, false);
                    useUiStore.getState().invalidateFavorites();
                  } catch {
                    toast.error("Failed to remove from favorites");
                  }
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-amber-400 opacity-0 transition-all hover:bg-gray-200 group-hover:opacity-100 dark:hover:bg-gray-700"
              >
                <LuStar className="h-3.5 w-3.5" style={{ fill: "currentColor" }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Home panel ───────────────────────────────────────────────────────────────
function HomePanelContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [spacesMenuOpen, setSpacesMenuOpen] = useState(false);
  const spacesMenuRef = useRef<HTMLDivElement>(null);
  const spacesMenuBtnRef = useRef<HTMLButtonElement>(null);
  const { projects, isLoading: projectsLoading, fetchArchivedProjects } = useProjects();
  const { getLists } = useTaskLists();
  const activeProjectId = searchParams.get("projectId");
  const activeListId = searchParams.get("listId");

  useEffect(() => {
    if (!spacesMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        !spacesMenuRef.current?.contains(e.target as Node) &&
        !spacesMenuBtnRef.current?.contains(e.target as Node)
      ) setSpacesMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [spacesMenuOpen]);

  useEffect(() => {
    projects.forEach((project) => {
      void getLists(project.id).catch(() => {
        // Sidebar can render without lists if the request fails.
      });
    });
  }, [getLists, projects]);

  useEffect(() => {
    if (!showArchived) return;
    projects.forEach((project) => {
      void getLists(project.id, { includeArchived: true }).catch(() => {});
    });
  }, [showArchived, getLists, projects]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 py-3 text-[14px]">
      <div className="flex-1 space-y-0.5 overflow-y-auto no-scrollbar pb-4">

        {/* Home links */}
        <p className="px-2 pb-2 text-[16px] font-semibold text-gray-900 dark:text-gray-100">Home</p>
        {inboxLinks.map((item) => {
          const active = item.path === pathname || (item.path === "/" && pathname === "/");
          return (
            <Link
              key={item.label}
              href={item.path}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors
                ${active
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-905 dark:text-gray-100"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-905"}`}
            >
              <span className={active ? "text-gray-500" : "text-gray-400"}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Favorites */}
        <FavoritesSidebarSection />

        {/* Spaces */}
        <div className="mt-3 border-t border-gray-100 pt-5 dark:border-gray-800">
          <div className="relative flex items-center justify-between px-2 mb-1">
            <p className="text-[12px] uppercase tracking-wide text-[#646464] font-semibold">Spaces</p>
            <div className="flex items-center gap-1">
              <button
                ref={spacesMenuBtnRef}
                type="button"
                onClick={() => setSpacesMenuOpen((v) => !v)}
                className="text-gray-400 hover:text-brand-500 transition-colors"
              >
                <LuMoreHorizontal className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="text-gray-400 hover:text-brand-500 transition-colors"
              >
                <LuPlus className="w-4 h-4" />
              </button>
            </div>

            {spacesMenuOpen && (
              <div
                ref={spacesMenuRef}
                className="absolute top-6 right-0 z-50 w-52 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900"
              >
                <button
                  type="button"
                  onClick={() => { setCreateOpen(true); setSpacesMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <LuPlus className="h-4 w-4 text-gray-400" />
                  Create Space
                </button>
                <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                <button
                  type="button"
                  onClick={() => {
                    const next = !showArchived;
                    setShowArchived(next);
                    if (next) void fetchArchivedProjects();
                  }}
                  className="flex w-full items-center justify-between gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2.5">
                    <LuArchive className="h-4 w-4 text-gray-400" />
                    Show archived
                  </div>
                  <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${showArchived ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${showArchived ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Live projects from backend */}
          {projectsLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <p className="px-2.5 py-2 text-[14px] text-gray-400 italic">No spaces yet</p>
          ) : (
            <div className="space-y-0.5 mt-0.5">
              {projects
                .filter((p) => showArchived || !p.isArchived)
                .map((project) => (
                  <SpaceRow
                    key={project.id}
                    project={project}
                    activeProjectId={activeProjectId}
                    activeListId={activeListId}
                    showArchivedLists={showArchived}
                  />
                ))}
            </div>
          )}

          {/* New Space button */}
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 mt-1 w-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand-500 transition-colors"
          >
            <LuPlus className="w-4 h-4" />
            <span>New Space</span>
          </button>
        </div>

        {/* Docs */}
        <DocsListSidebarSection />

        {/* Channels */}
        <ChannelSidebarSection />

        {/* Direct Messages */}
        <DmSidebarSection />
      </div>

      {/* <div className="border-t border-gray-100 px-1 pt-3 dark:border-gray-800">
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-50 px-2 py-2 text-[13px] text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
          <LuSlidersHorizontal className="w-3.5 h-3.5" />
          <span>Customize Sidebar</span>
        </button>
      </div> */}

      {/* Create Space Modal */}
      <CreateSpaceModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function SettingsPanelContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("tab") ?? "general").toLowerCase();
  const isSettingsRoute = pathname.startsWith("/settings");
  const { logout } = useAuth();

  const navigateToTab = (tab: string) => {
    const query = tab === "general" ? "" : `?tab=${tab}`;
    router.push(`/settings${query}`);
  };

  const navItem = (item: SettingsNavItem) => {
    const Icon = item.icon;
    const isActive = isSettingsRoute && !!item.tab && currentTab === item.tab;
    return (
      <button
        key={item.label}
        type="button"
        onClick={() => { if (item.tab) navigateToTab(item.tab); }}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
          isActive
            ? "bg-violet-100/80 text-violet-700 dark:bg-gray-905 dark:text-gray-100"
            : "text-gray-600 hover:bg-violet-50 hover:text-violet-700 dark:text-gray-400 dark:hover:bg-gray-905 dark:hover:text-gray-100"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-2 py-2 text-[13px]">
      <h2 className="px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
        Settings
      </h2>

      <div className="pt-3">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">
          Workspace
        </p>
        {workspaceSettingsItems.map(navItem)}
      </div>

      <div className="pt-3">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">
          My Settings
        </p>
        {mySettingsItems.map(navItem)}
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          <LuLogOut className="h-4 w-4 shrink-0" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}

const lmsMainItems = [
  { label: "Dashboard",     icon: LuLayoutGrid,  href: "/university",                exact: true },
  { label: "Course Library", icon: LuBookOpen,    href: "/university/course-library", exact: false },
  { label: "My Learning",   icon: LuPlay,        href: "/university/my-learning",    exact: false },
];

function LmsPanelContent() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-2 py-3 text-[13px]">
      <p className="px-2 pb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">LMS</p>

      <div className="space-y-0.5">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">Main</p>
        {lmsMainItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => router.push(item.href)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                isActive
                  ? "bg-violet-100/80 text-violet-700 dark:bg-gray-905 dark:text-gray-100"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-400">
      <span className="text-2xl">🚧</span>
      <p className="text-sm font-normal">{label}</p>
    </div>
  );
}

// ── Panel header — workspace name for home/settings, university name for LMS ──
function LmsPanelHeader() {
  return (
    <div className="flex items-center px-6 py-[15.5px] border-b border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-1.5">
        <span className="flex items-center justify-center w-5 h-5 rounded bg-violet-600 text-white text-[10px] font-normal shrink-0">
          <LuBookOpen className="w-3 h-3" />
        </span>
        <span className="font-normal text-gray-800 dark:text-gray-100 truncate max-w-[180px]">
          SwiftNine University
        </span>
      </div>
    </div>
  );
}

// ── Main sidebar ─────────────────────────────────────────────────────────────
const AppSidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [activeRail, setActiveRail] = useState<string>("home");
  const [inviteOpen, setInviteOpen] = useState(false);
  const isSettingsRoute = pathname.startsWith("/settings");
  const isLmsRoute = pathname.startsWith("/university");

  // Keep rail in sync with route on first load / direct navigation
  React.useEffect(() => {
    if (isLmsRoute) setActiveRail("lms");
    else if (!isSettingsRoute) setActiveRail("home");
  }, [isLmsRoute, isSettingsRoute]);

  const isSettingsActive = isSettingsRoute && activeRail !== "lms";

  const handleRailClick = (id: string) => {
    if (id === "home") {
      setActiveRail("home");
      router.push("/");
      return;
    }
    if (id === "lms") {
      setActiveRail("lms");
      router.push("/university");
      return;
    }
    setActiveRail(id);
  };

  const handleSettingsClick = () => {
    setActiveRail("home");
    router.push("/settings");
  };

  return (
    <aside className="fixed top-0 left-0 h-screen flex z-50">
      {/* Left icon rail */}
      <div className="flex flex-col w-14 h-full mx-1 bg-gray-901 shrink-0">
        <nav className="flex flex-col items-center gap-3 flex-1 pt-2">
          {railItems.map((item) => {
            const isActive = activeRail === item.id && !isSettingsActive;
            return (
              <button
                key={item.id}
                onClick={() => handleRailClick(item.id)}
                title={item.label}
                className={`relative flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all duration-150
                  ${isActive
                    ? "text-white"
                    : "text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                style={isActive ? { background: "linear-gradient(180deg, #FB64B6 0%, #AD46FF 50%, #2B7FFF 100%)" } : undefined}
              >
                {item.icon}
                <span className="text-[9px] mt-0.5 leading-none">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom rail actions */}
        <div className="flex flex-col items-center gap-1 pb-3 border-t border-white/10 pt-2">
          <button
            title="Invite"
            onClick={() => setInviteOpen(true)}
            className="flex flex-col items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:bg-white/10 hover:text-white transition-all"
          >
            <GoPersonAdd className="w-5 h-5" />
            <span className="text-[9px] mt-0.5 leading-none">Invite</span>
          </button>
          <button
            title="Settings"
            onClick={handleSettingsClick}
            className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all duration-150
              ${isSettingsActive
                ? "text-white"
                : "text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            style={isSettingsActive ? { background: "linear-gradient(180deg, #FB64B6 0%, #AD46FF 50%, #2B7FFF 100%)" } : undefined}
          >
            <LuSettings className="w-5 h-5" />
            <span className="text-[9px] mt-0.5 leading-none">Settings</span>
          </button>
        </div>
      </div>

      {/* Right contextual panel */}
      <div className="w-[264px] h-full bg-white dark:bg-gray-901 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        {activeRail === "lms" ? <LmsPanelHeader /> : <WorkspacePanelHeader />}
        {isSettingsActive ? (
          <SettingsPanelContent />
        ) : (
          <>
            {activeRail === "home" && <HomePanelContent />}
            {activeRail === "lms"  && <LmsPanelContent />}
          </>
        )}
      </div>

      <InvitePeopleModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
    </aside>
  );
};

export default AppSidebar;
