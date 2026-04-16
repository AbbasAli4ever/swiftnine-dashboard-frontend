"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useProjects } from "@/context/ProjectContext";
import { Project } from "@/services/project.service";
import { parseApiError } from "@/lib/api";
import WorkspaceSwitcher from "@/components/workspace/WorkspaceSwitcher";
import InvitePeopleModal from "@/components/workspace/InvitePeopleModal";
import CreateSpaceModal from "@/components/projects/CreateSpaceModal";
import EditSpaceModal from "@/components/projects/EditSpaceModal";
import SpaceContextMenu from "@/components/projects/SpaceContextMenu";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
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
  { id: "ai",      label: "AI",      icon: <BsStars className="w-5 h-5" />,           panel: "ai" },
  { id: "teams",   label: "Teams",   icon: <LuUsers className="w-5 h-5" />,           panel: "teams" },
  { id: "clips",   label: "Clips",   icon: <IoVideocamOutline className="w-5 h-5" />, panel: "clips" },
  { id: "more",    label: "More",    icon: <MdGridOn className="w-5 h-5" />,          panel: "more" },
];

// ── Nav link definitions ─────────────────────────────────────────────────────
type NavLink = { label: string; path: string; icon: React.ReactNode; badge?: number };

const inboxLinks: NavLink[] = [
  { label: "Inbox",             path: "/",      icon: <LuInbox className="w-4 h-4" /> },
  { label: "Replies",           path: "/tasks", icon: <LuCornerUpLeft className="w-4 h-4" /> },
  { label: "Assigned Comments", path: "/tasks", icon: <LuMessageSquare className="w-4 h-4" /> },
  { label: "My Tasks",          path: "/tasks", icon: <LuCircleCheck className="w-4 h-4" />, badge: 1 },
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

// ── Space row with hover 3-dot menu ─────────────────────────────────────────
function SpaceRow({ project }: { project: Project }) {
  const router = useRouter();
  const { deleteProject } = useProjects();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  const openProject = () => {
    const params = new URLSearchParams({
      projectId: project.id,
      projectName: project.name,
    });
    router.push(`/tasks?${params.toString()}`);
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

  return (
    <>
      <div
        onClick={openProject}
        className="group flex w-full cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {/* Space name + color */}
        <span
          className="flex items-center justify-center w-4 h-4 rounded-sm text-white text-[10px] font-bold shrink-0"
          style={{ backgroundColor: project.color }}
        >
          {project.name.charAt(0).toUpperCase()}
        </span>
        <span className="flex-1 font-medium text-left truncate text-[13px]">
          {project.name}
        </span>

        {/* 3-dot — appears on row hover */}
        <button
          ref={menuTriggerRef}
          onMouseDown={(e) => {
            e.stopPropagation();
            // Only open — outside-click handler is the sole way to close
            if (!menuOpen) setMenuOpen(true);
          }}
          onClick={(e) => e.stopPropagation()}
          className={`flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all shrink-0 ${menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          <LuMoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Context menu — rendered outside the row so it isn't clipped by overflow-hidden */}
      <SpaceContextMenu
        project={project}
        triggerRef={menuTriggerRef}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onEdit={() => { setMenuOpen(false); setEditOpen(true); }}
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
    </>
  );
}

function WorkspacePanelHeader() {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wsName    = activeWorkspace?.name ?? "Workspace";
  const wsInitial = wsName.charAt(0).toUpperCase();

  return (
    <div className="relative flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
      <button
        ref={triggerRef}
        onClick={() => setSwitcherOpen((v) => !v)}
        className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-100 hover:text-brand-500"
      >
        <span className="flex items-center justify-center w-5 h-5 rounded bg-brand-500 text-white text-[10px] font-bold shrink-0">
          {wsInitial}
        </span>
        <span className="truncate max-w-[140px]">{wsName}</span>
        <LuChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>

      {switcherOpen && (
        <WorkspaceSwitcher
          isOpen={switcherOpen}
          onClose={() => setSwitcherOpen(false)}
          anchorRef={triggerRef}
        />
      )}
    </div>
  );
}

// ── Home panel ───────────────────────────────────────────────────────────────
function HomePanelContent() {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const { projects, isLoading: projectsLoading } = useProjects();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-2 py-2 text-[13px]">
      <div className="flex-1 space-y-0.5">

        {/* Home links */}
        <p className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-medium">Home</p>
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
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-[10px] text-gray-600 dark:text-gray-300 font-medium">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Spaces */}
        <div className="pt-3">
          <div className="flex items-center justify-between px-2 mb-1">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">Spaces</p>
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
                <SpaceRow key={project.id} project={project} />
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

        {/* Direct Messages */}
        <div className="pt-3">
          <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-medium">Direct Messages</p>
          {dmUsers.map((u) => (
            <button
              key={u.name}
              className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold ${u.color} shrink-0`}>
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
      <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2.5">
        <button className="flex items-center gap-2 w-full rounded-lg px-2 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-[13px]">
          <LuSlidersHorizontal className="w-3.5 h-3.5" />
          <span>Customize Sidebar</span>
        </button>
      </div>

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
  const isWorkspaceSettingsRoute = pathname.startsWith("/workspace-settings");

  const navigateToTab = (tab: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "general") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    const query = next.toString();
    router.push(`/workspace-settings${query ? `?${query}` : ""}`);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-2 py-2 text-[13px]">
      <h2 className="px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
        All settings
      </h2>

      <div className="pt-3">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-medium">
          Admin
        </p>
        {adminSettingsItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            isWorkspaceSettingsRoute &&
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
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-medium">
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
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-medium">
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
        <button
          type="button"
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
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

// ── Main sidebar ─────────────────────────────────────────────────────────────
const AppSidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [activeRail, setActiveRail] = useState<string>("home");
  const [inviteOpen, setInviteOpen] = useState(false);
  const isWorkspaceSettingsRoute = pathname.startsWith("/workspace-settings");
  const isCalendarRoute = pathname.startsWith("/calendar");

  const shownRail =
    isWorkspaceSettingsRoute && activeRail === "home"
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
          <button
            title="Upgrade"
            className="flex flex-col items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:bg-white/10 hover:text-white transition-all"
          >
            <FaRegArrowAltCircleUp className="w-5 h-5" />
            <span className="text-[9px] mt-0.5 leading-none">Upgrade</span>
          </button>
        </div>
      </div>

      {/* Right contextual panel */}
      <div className="w-[232px] h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        <WorkspacePanelHeader />
        {isWorkspaceSettingsRoute && activeRail === "home" ? (
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
