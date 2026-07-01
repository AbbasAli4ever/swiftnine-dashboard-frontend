"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { parseApiError } from "@/lib/api";
import { PiExport } from "react-icons/pi";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { toast } from "sonner";
import {
  LuChevronDown,
  LuEllipsis,
  LuSearch,
  LuShield,
  LuTrash2,
} from "react-icons/lu";
import ProfileSettingsForm from "@/components/settings/ProfileSettingsForm";
import ChangePasswordForm from "@/components/settings/ChangePasswordForm";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import { workspaceService, WorkspaceMember } from "@/services/workspace.service";
import InvitePeopleModal from "@/components/workspace/InvitePeopleModal";

const AVATAR_COLOR_STYLES = [
  { bg: "#18181b", text: "#ffffff" },
  { bg: "#7c3aed", text: "#ffffff" },
  { bg: "#eab308", text: "#000000" },
  { bg: "#0f172a", text: "#ffffff" },
  { bg: "#6d28d9", text: "#ffffff" },
  { bg: "#ca8a04", text: "#000000" },
  { bg: "#1e1b4b", text: "#ffffff" },
  { bg: "#fbbf24", text: "#000000" },
  { bg: "#3b0764", text: "#ffffff" },
  { bg: "#292524", text: "#ffffff" },
  { bg: "#854d0e", text: "#ffffff" },
  { bg: "#4c1d95", text: "#ffffff" },
];


function workspaceInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

function memberAvatarStyle(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLOR_STYLES[Math.abs(hash) % AVATAR_COLOR_STYLES.length];
}

export function WorkspaceSettingsContent({ tab }: { tab: string }) {
  const router = useRouter();
  const { activeWorkspace, updateWorkspace, deleteWorkspace } = useWorkspace();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<WorkspaceMember | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentTab = tab;
  const isPeopleTab = currentTab === "people";

  useEffect(() => {
    setName(activeWorkspace?.name ?? "");
    setLogoUrl(activeWorkspace?.logoUrl ?? "");
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace || tab !== "people") return;
    setMembersLoading(true);
    workspaceService.getMembers(activeWorkspace.id)
      .then(setMembers)
      .catch((err) => toast.error(parseApiError(err).message))
      .finally(() => setMembersLoading(false));
  }, [activeWorkspace, tab]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isOwner = activeWorkspace?.createdBy === user?.id;
  const initial = workspaceInitial(name || activeWorkspace?.name || "W");

  const isDirty = useMemo(() => {
    if (!activeWorkspace) return false;
    const nextName = name.trim();
    const nextLogo = logoUrl.trim();
    const currentLogo = activeWorkspace.logoUrl ?? "";
    return nextName !== activeWorkspace.name || nextLogo !== currentLogo;
  }, [activeWorkspace, name, logoUrl]);

  const handleSave = async () => {
    if (!activeWorkspace) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Workspace name is required");
      return;
    }

    const payload: { name?: string; logoUrl?: string | null } = {};
    const nextLogo = logoUrl.trim();
    const currentLogo = activeWorkspace.logoUrl ?? "";

    if (trimmedName !== activeWorkspace.name) {
      payload.name = trimmedName;
    }
    if (nextLogo !== currentLogo) {
      payload.logoUrl = nextLogo ? nextLogo : null;
    }

    if (!Object.keys(payload).length) {
      toast.message("No changes to save");
      return;
    }

    setSaving(true);
    try {
      await updateWorkspace(activeWorkspace.id, payload);
      toast.success("Workspace updated successfully");
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeWorkspace || deleting) return;
    if (!isOwner) {
      toast.error("Only workspace owner can delete this workspace");
      return;
    }

    setDeleting(true);
    try {
      await deleteWorkspace(activeWorkspace.id);
      toast.success("Workspace deleted successfully");
      setDeleteModalOpen(false);
      router.push("/");
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleChangeRole = async (member: WorkspaceMember) => {
    if (!activeWorkspace) return;
    setOpenMenuId(null);
    const newRole = member.role === "OWNER" ? "MEMBER" : "OWNER";
    try {
      await workspaceService.changeMemberRole(activeWorkspace.id, member.id, newRole);
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m));
      toast.success(`Role changed to ${newRole === "OWNER" ? "Owner" : "Member"}`);
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleRemoveMember = async () => {
    if (!activeWorkspace || !confirmRemove) return;
    setRemovingId(confirmRemove.id);
    try {
      await workspaceService.removeMember(activeWorkspace.id, confirmRemove.id);
      setMembers(prev => prev.filter(m => m.id !== confirmRemove.id));
      toast.success("Member removed");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setRemovingId(null);
      setConfirmRemove(null);
    }
  };

  if (!activeWorkspace) {
    return (
      <div className="h-full overflow-y-auto bg-white p-5 dark:bg-white/3 lg:px-6 lg:py-4">
        <div className="mx-auto max-w-[900px] rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-2xl font-normal text-gray-900 dark:text-white">
            Workspace Settings
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No active workspace is selected.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 rounded-lg bg-brand-500 px-4 py-2 text-sm font-normal text-white hover:bg-brand-600"
          >
            Go to home
          </button>
        </div>
      </div>
    );
  }



  if (isPeopleTab) {
    const filteredMembers = members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(peopleQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(peopleQuery.toLowerCase())
    );

    const formatDate = (iso: string | null) => {
      if (!iso) return "—";
      return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
    };

    const formatLastActive = (iso: string | null) => {
      if (!iso) return "Never";
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const getInitials = (name: string) =>
      name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

    return (
      <div className="h-full overflow-y-auto bg-white p-5 dark:bg-gray-900 lg:px-10 lg:py-4">
        <div className="mx-auto w-full max-w-full">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-medium text-gray-900 dark:text-gray-100">Manage people</h1>
            <button
              type="button"
              className="flex gap-1 items-center justify-center rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-normal text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <PiExport className="w-4 h-4 "/>
              Export
            </button>
          </div> 

          <div className="mt-5">
            <div className="relative">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={peopleQuery}
                onChange={(e) => setPeopleQuery(e.target.value)}
                placeholder="Search by name or email"
                className="h-[48px] w-full rounded-lg border border-violet-300  bg-white pl-9 pr-36 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none dark:border-gray-905 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-000"
              />
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-violet-500 px-3 py-1 text-sm font-normal text-white hover:bg-violet-600 dark:bg-white dark:text-black dark:hover:bg-gray-100"
              >
                + Invite people
              </button>
            </div>
          </div>

          <div className="mt-4">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-normal text-violet-700 dark:bg-gray-905 dark:text-gray-100">
              All Users ({members.length}) <LuChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[20%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-normal text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Last Active</th>
                    <th className="px-4 py-3 text-left">Invited By</th>
                    <th className="px-4 py-3 text-left">Invited On</th>
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {membersLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                        Loading members...
                      </td>
                    </tr>
                  ) : filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                        No members found.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => {
                      const isMe = member.id === user?.id;
                      const isOwner = member.role === "OWNER";
                      return (
                        <tr key={member.id} className="border-b border-gray-100 align-middle last:border-0 dark:border-gray-800/70">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-normal"
                                style={{ backgroundColor: memberAvatarStyle(member.id).bg, color: memberAvatarStyle(member.id).text }}
                              >
                                {getInitials(member.fullName)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-normal text-gray-900 dark:text-gray-100">
                                  {member.fullName}
                                  {isMe && (
                                    <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-normal bg-violet-100 text-violet-700 dark:bg-gray-905 dark:text-gray-100">
                                      You
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <p className="truncate text-sm text-gray-700 dark:text-gray-300">{member.email}</p>
                          </td>

                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-normal ${
                              isOwner
                                ? "bg-violet-100 text-violet-700 dark:bg-gray-905 dark:text-gray-100"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            }`}>
                              {isOwner ? "Owner" : "Member"}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {formatLastActive(member.lastActive)}
                          </td>

                          <td className="px-4 py-3">
                            <p className="truncate text-sm text-gray-700 dark:text-gray-300">
                              {member.invitedBy ?? "—"}
                            </p>
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {formatDate(member.invitedOn)}
                          </td>

                          <td className="px-2 py-3">
                            {!isMe && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                  if (openMenuId === member.id) {
                                    setOpenMenuId(null);
                                    setMenuPos(null);
                                  } else {
                                    setOpenMenuId(member.id);
                                    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                  }
                                }}
                                className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                              >
                                <LuEllipsis className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Fixed dropdown — renders outside table so it never affects layout */}
        {openMenuId && menuPos && (() => {
          const member = filteredMembers.find(m => m.id === openMenuId);
          if (!member) return null;
          const isOwner = member.role === "OWNER";
          return (
            <div
              ref={menuRef}
              className="fixed z-9999 w-62 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <button
                type="button"
                onClick={() => handleChangeRole(member)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 rounded-t-xl"
              >
                <LuShield className="h-4 w-4 text-gray-400" />
                Change to {isOwner ? "Member" : "Owner"}
              </button>
              <div className="mx-3 border-t border-gray-100 dark:border-gray-800" />
              <button
                type="button"
                onClick={() => { setOpenMenuId(null); setMenuPos(null); setConfirmRemove(member); }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-b-xl"
              >
                <LuTrash2 className="h-4 w-4" />
                Remove from workspace
              </button>
            </div>
          );
        })()}

        <InvitePeopleModal
          isOpen={inviteOpen}
          onClose={() => setInviteOpen(false)}
        />

        <ConfirmActionModal
          isOpen={!!confirmRemove}
          title="Remove member"
          description={`Remove ${confirmRemove?.fullName} from this workspace? They will lose access to all projects and tasks.`}
          confirmLabel="Remove"
          onClose={() => { if (!removingId) setConfirmRemove(null); }}
          onConfirm={handleRemoveMember}
          isLoading={!!removingId}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white p-5 dark:bg-[#111111] lg:pl-[100px] lg:py-8">
      <div className="mx-auto w-full max-w-[860px]">
        <section className="min-w-0">
          <div className="max-w-[760px] lg:px-6">
            <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100">
              Workspace Settings
            </h1>

            <div className="mt-8">
              <h3 className="text-[16px] font-medium text-gray-900 dark:text-gray-100">
                General
              </h3>
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="grid grid-cols-[140px_1fr] items-center border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avatar</p>
                  <div className="flex items-center justify-end">
                    {logoUrl.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl.trim()}
                        alt={activeWorkspace.name}
                        className="h-8 w-8 rounded-md object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-normal"
                        style={{ backgroundColor: memberAvatarStyle(activeWorkspace.id).bg, color: memberAvatarStyle(activeWorkspace.id).text }}
                      >
                        {initial}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[140px_1fr] items-center px-4 py-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
                  <div className="flex justify-end">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                      className="h-9 w-full max-w-[260px] rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none dark:border-gray-905 dark:focus:border-gray-000 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-normal dark:bg-gray-000 dark:text-black dark:hover:bg-gray-200 text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>

            <div className="mt-8 pb-8">
              <h3 className="text-[16px] font-medium text-gray-900 dark:text-gray-100">
                Danger zone
              </h3>
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Delete this Workspace forever
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isOwner) {
                        toast.error("Only workspace owner can delete this workspace");
                        return;
                      }
                      setDeleteModalOpen(true);
                    }}
                    disabled={!isOwner || deleting}
                    className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    {deleting ? "Deleting..." : "Delete Workspace"}
                  </button>
                </div>
              </div>
              {!isOwner && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Only workspace owner can delete this workspace.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
      {deleteModalOpen && (
        <ConfirmActionModal
          isOpen={deleteModalOpen}
          title="Delete Workspace"
          description={`Delete workspace "${activeWorkspace.name}" forever? This action cannot be undone.`}
          confirmLabel="Delete Workspace"
          onClose={() => {
            if (!deleting) setDeleteModalOpen(false);
          }}
          onConfirm={handleDelete}
          isLoading={deleting}
          requireText={activeWorkspace.name}
          requireTextLabel={`Type "${activeWorkspace.name}" to confirm workspace deletion`}
        />
      )}
    </div>
  );
}

export default WorkspaceSettingsContent;
