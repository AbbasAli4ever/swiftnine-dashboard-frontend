"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useProjects } from "@/context/ProjectContext";
import { useTaskLists } from "@/context/TaskListContext";
import { Project } from "@/services/project.service";
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
import ListContextMenu from "@/components/projects/ListContextMenu";
import DocsListSidebarSection from "@/components/docs/DocsListSidebarSection";
import { toast } from "sonner";
import { RiHomeSmileFill } from "react-icons/ri";
import { BsCalendar2Date, BsStars } from "react-icons/bs";
import { IoVideocamOutline } from "react-icons/io5";
import { MdGridOn } from "react-icons/md";
import { GoPersonAdd } from "react-icons/go";
import { FaRegArrowAltCircleUp } from "react-icons/fa";
import {
  LuUsers,
  LuPlus,
  LuInbox,
  LuCornerUpLeft,
  LuMessageSquare,
  LuCircleCheck,
  LuSettings,
  LuShield,
  LuTrash2,
  LuRocket,
  LuBrush,
  LuChevronRight,
  LuLogOut,
  LuChevronDown,
  LuSlidersHorizontal,
  LuEllipsis as LuMoreHorizontal,
} from "react-icons/lu";
import { MdChecklist } from "react-icons/md";

// ── Icon Rail items ──────────────────────────────────────────────────────────
type RailItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  panel: "home" | "planner" | "ai" | "teams" | "clips" | "more";
};

const railItems: RailItem[] = [
  { id: "home",    label: "Home",    icon: <RiHomeSmileFill className="w-5 h-5" />,   panel: "home" },
  { id: "planner", label: "Planner", icon: <BsCalendar2Date className="w-5 h-5" />,   panel: "planner" },
  // { id: "ai",      label: "AI",      icon: <BsStars className="w-5 h-5" />,           panel: "ai" },
  // { id: "teams",   label: "Teams",   icon: <LuUsers className="w-5 h-5" />,           panel: "teams" },
  // { id: "clips",   label: "Clips",   icon: <IoVideocamOutline className="w-5 h-5" />, panel: "clips" },
  // { id: "more",    label: "More",    icon: <MdGridOn className="w-5 h-5" />,          panel: "more" },
];

// ── Nav link definitions ─────────────────────────────────────────────────────
type NavLink = { label: string; path: string; icon: React.ReactNode; badge?: number };

const inboxLinks: NavLink[] = [
  { label: "Inbox",             path: "/",      icon: <LuInbox className="w-4 h-4" /> },
  { label: "Replies",           path: "/replies",           icon: <LuCornerUpLeft className="w-4 h-4" /> },
  { label: "Assigned Comments", path: "/assigned-comments", icon: <LuMessageSquare className="w-4 h-4" /> },
  { label: "My Tasks",          path: "/my-tasks", icon: <LuCircleCheck className="w-4 h-4" />, badge: 1 },
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

const adminSettingsItems: SettingsNavItem[] = [
  { label: "General", icon: LuSettings, tab: "general" },
  { label: "People", icon: LuUsers, tab: "people" },
  { label: "Teams", icon: LuUsers },
  { label: "Upgrade", icon: LuRocket },
  { label: "AI Usage", icon: LuBrush },
  { label: "Security & Permissions", icon: LuShield },
  { label: "Audit Logs", icon: LuCircleCheck },
  { label: "Trash", icon: LuTrash2 },
];

const featureSettingsItems = [
  "Custom Field Manager",
  "Template Center",
  "Automations Manager",
  "AI Notetaker",
  "Spaces",
  "Task Types",
  "Work Schedule",
];

const integrationSettingsItems = [
  "App Center",
  "Imports / Exports",
  "ClickUp API",
  "Email Integration",
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
  const { renameList, archiveList, deleteList } = useTaskLists();
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
}: {
  project: Project;
  activeProjectId: string | null;
  activeListId: string | null;
}) {
  const router = useRouter();
  const { deleteProject, updateProject } = useProjects();
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
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const lists = getProjectLists(project.id, { includeArchived: false });
  const isProjectActive = activeProjectId === project.id && !activeListId;
  const isWithinProject = activeProjectId === project.id;

  useEffect(() => {
    if (isWithinProject) setExpanded(true);
  }, [isWithinProject]);

  useEffect(() => {
    if (renamingProject) {
      setTimeout(() => renameInputRef.current?.focus(), 30);
    }
  }, [renamingProject]);

  const openProject = () => {
    router.push(`/projects?projectId=${project.id}`);
  };

  const startRename = () => {
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
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-normal text-white"
                style={{ backgroundColor: project.color }}
              >
                {project.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate font-normal text-[13px]">{project.name}</span>
            </button>
          )}

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

        {expanded ? (
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
    <div className="relative flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
      <button
        ref={triggerRef}
        onClick={() => setSwitcherOpen((v) => !v)}
        className="flex items-center gap-1.5 font-normal text-gray-800 dark:text-gray-100 hover:text-brand-500"
      >
        <span className="flex items-center justify-center w-5 h-5 rounded bg-brand-500 text-white text-[10px] font-normal shrink-0">
          {wsInitial}
        </span>
        <span className="truncate max-w-[140px]">{wsName}</span>
        <LuChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>

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

// ── Home panel ───────────────────────────────────────────────────────────────
function HomePanelContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const { projects, isLoading: projectsLoading } = useProjects();
  const { getLists } = useTaskLists();
  const activeProjectId = searchParams.get("projectId");
  const activeListId = searchParams.get("listId");

  useEffect(() => {
    projects.forEach((project) => {
      void getLists(project.id).catch(() => {
        // Sidebar can render without lists if the request fails.
      });
    });
  }, [getLists, projects]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-2 py-2 text-[13px]">
      <div className="flex-1 space-y-0.5">

        {/* Home links */}
        <p className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">Home</p>
        {inboxLinks.map((item) => {
          const active = item.path === pathname && item.label === "Inbox";
          return (
            <Link
              key={item.label}
              href={item.path}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors
                ${active
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
            >
              <span className={active ? "text-brand-500" : "text-gray-400"}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-[10px] text-gray-600 dark:text-gray-300 font-normal">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Spaces */}
        <div className="pt-3">
          <div className="flex items-center justify-between px-2 mb-1">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-normal">Spaces</p>
            <button
              onClick={() => setCreateOpen(true)}
              className="text-gray-400 hover:text-brand-500 transition-colors"
            >
              <LuPlus className="w-4 h-4" />
            </button>
          </div>
          {/* Live projects from backend */}
          {projectsLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <p className="px-2.5 py-2 text-[12px] text-gray-400 italic">No spaces yet</p>
          ) : (
            <div className="space-y-0.5 mt-0.5">
              {projects.map((project) => (
                <SpaceRow
                  key={project.id}
                  project={project}
                  activeProjectId={activeProjectId}
                  activeListId={activeListId}
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

        {/* Direct Messages */}
        <div className="pt-3">
          <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">Direct Messages</p>
          {dmUsers.map((u) => (
            <button
              key={u.name}
              className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-normal ${u.color} shrink-0`}>
                {u.initials}
              </span>
              <span className="truncate">
                {u.name}
                {u.you && <span className="text-gray-400 ml-1">— You</span>}
              </span>
            </button>
          ))}
          <button className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 mt-0.5 w-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand-500 transition-colors">
            <LuPlus className="w-4 h-4" />
            <span>New message</span>
          </button>
        </div>
      </div>

      {/* Bottom: Customize Sidebar */}
      {/* <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2.5">
        <button className="flex items-center gap-2 w-full rounded-lg px-2 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-[13px]">
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

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-2 py-2 text-[13px]">
      <h2 className="px-2 py-1 text-sm font-normal text-gray-900 dark:text-gray-100">
        All settings
      </h2>

      <div className="pt-3">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">
          Admin
        </p>
        {adminSettingsItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            isSettingsRoute &&
            !!item.tab &&
            currentTab === item.tab;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.tab) navigateToTab(item.tab);
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                isActive
                  ? "bg-violet-100/80 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                  : "text-gray-600 hover:bg-violet-50 hover:text-violet-700 dark:text-gray-400 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="pt-3">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">
          Features
        </p>
        {featureSettingsItems.map((item) => (
          <button
            key={item}
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-600 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-gray-400 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
          >
            <LuChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
            <span className="truncate">{item}</span>
          </button>
        ))}
      </div>

      <div className="pt-3">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">
          Integrations & ClickApps
        </p>
        {integrationSettingsItems.map((item) => (
          <button
            key={item}
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-600 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-gray-400 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
          >
            <LuChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
            <span className="truncate">{item}</span>
          </button>
        ))}
      </div>

      {/* My Settings — personal profile preferences */}
      <div className="pt-3">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">
          My Settings
        </p>
        {[
          { label: "Preferences", tab: "preferences", icon: LuSlidersHorizontal },
          { label: "Notifications", tab: null, icon: LuChevronRight },
          { label: "Workspaces", tab: null, icon: LuChevronRight },
          { label: "Chat", tab: null, icon: LuMessageSquare },
          { label: "Referrals", tab: null, icon: LuChevronRight },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = isSettingsRoute && !!item.tab && currentTab === item.tab;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => { if (item.tab) navigateToTab(item.tab); }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                isActive
                  ? "bg-violet-100/80 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                  : "text-gray-600 hover:bg-violet-50 hover:text-violet-700 dark:text-gray-400 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-600 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-gray-400 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
        >
          <LuLogOut className="h-4 w-4 shrink-0" />
          <span>Log out</span>
        </button>
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

// ── Main sidebar ─────────────────────────────────────────────────────────────
const AppSidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [activeRail, setActiveRail] = useState<string>("home");
  const [inviteOpen, setInviteOpen] = useState(false);
  const isSettingsRoute = pathname.startsWith("/settings");
  const isCalendarRoute = pathname.startsWith("/calendar");

  const shownRail =
    isSettingsRoute && activeRail === "home"
      ? null
      : isCalendarRoute && activeRail === "home"
        ? "planner"
        : activeRail;

  const handleRailClick = (id: string) => {
    if (id === "home") {
      setActiveRail("home");
      router.push("/");
      return;
    }

    if (id === "planner") {
      setActiveRail("planner");
      router.push("/calendar");
      return;
    }

    setActiveRail(id);
  };

  return (
    <aside className="fixed top-0 left-0 h-screen flex z-50">
      {/* Left icon rail */}
      <div className="flex flex-col w-[56px] h-full bg-gray-950 shrink-0">
        <nav className="flex flex-col items-center gap-3 flex-1 pt-2">
          {railItems.map((item) => {
            const isActive = shownRail !== null && shownRail === item.id;
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
          {/* <button
            title="Upgrade"
            className="flex flex-col items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:bg-white/10 hover:text-white transition-all"
          >
            <FaRegArrowAltCircleUp className="w-5 h-5" />
            <span className="text-[9px] mt-0.5 leading-none">Upgrade</span>
          </button> */}
        </div>
      </div>

      {/* Right contextual panel */}
      <div className="w-[232px] h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        <WorkspacePanelHeader />
        {isSettingsRoute && activeRail === "home" ? (
          <SettingsPanelContent />
        ) : (
          <>
            {activeRail === "home"    && <HomePanelContent />}
            {activeRail === "planner" && <PlaceholderPanel label="Planner" />}
            {activeRail === "ai"      && <PlaceholderPanel label="AI" />}
            {activeRail === "teams"   && <PlaceholderPanel label="Teams" />}
            {activeRail === "clips"   && <PlaceholderPanel label="Clips" />}
            {activeRail === "more"    && <PlaceholderPanel label="More" />}
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
