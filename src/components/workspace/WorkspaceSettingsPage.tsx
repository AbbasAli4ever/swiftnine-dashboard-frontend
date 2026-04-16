"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { parseApiError } from "@/lib/api";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { toast } from "sonner";
import {
  LuChevronDown,
  LuEllipsis,
  LuPencil,
  LuPlus,
  LuSearch,
  LuUserPlus,
} from "react-icons/lu";

const AVATAR_COLORS = [
  "bg-brand-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-teal-500",
];

const COLOR_SCHEME = [
  "#818CF8",
  "#A78BFA",
  "#22D3EE",
  "#F472B6",
  "#D946EF",
  "#6366F1",
  "#F97316",
  "#14B8A6",
  "#F59E0B",
  "#34D399",
];

type PeopleRow = {
  id: string;
  name: string;
  subtitle: string;
  email: string;
  role: string;
  lastActive: string;
  invitedBy: string;
  invitedOn: string;
  statusTag?: { label: string; tone: "violet" | "amber" };
  avatarClass: string;
  avatarText: string;
};

const PEOPLE_ROWS: PeopleRow[] = [
  {
    id: "1",
    name: "Dania Tariq",
    subtitle: "Associate Project Manager",
    email: "dania@swiftnine.com",
    role: "Owner",
    lastActive: "Apr 14",
    invitedBy: "-",
    invitedOn: "04/02/2026",
    statusTag: { label: "Owner", tone: "violet" },
    avatarClass: "bg-gray-900",
    avatarText: "DT",
  },
  {
    id: "2",
    name: "Muhammad Zaeem UI Hassan",
    subtitle: "",
    email: "zaeem@swiftnine.com",
    role: "Member",
    lastActive: "Mar 31",
    invitedBy: "Dania Tariq",
    invitedOn: "04/09/2026",
    statusTag: { label: "Pending", tone: "amber" },
    avatarClass: "bg-blue-500",
    avatarText: "MH",
  },
  {
    id: "3",
    name: "Dania Tariq",
    subtitle: "",
    email: "daniatariq69@gmail.com",
    role: "Admin",
    lastActive: "Apr 11",
    invitedBy: "Dania Tariq",
    invitedOn: "04/10/2026",
    avatarClass: "bg-violet-500",
    avatarText: "DT",
  },
];

function workspaceInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

function truncateWithDots(value: string, maxChars = 12) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...`;
}

function workspaceColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative h-5 w-9 rounded-full transition-colors ${
        checked ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeWorkspace, updateWorkspace, deleteWorkspace } = useWorkspace();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [showLogoInput, setShowLogoInput] = useState(false);
  const [customBrandingEnabled, setCustomBrandingEnabled] = useState(false);
  const [personalLayoutEnabled, setPersonalLayoutEnabled] = useState(false);
  const [customUrl, setCustomUrl] = useState("app");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState("");
  const currentTab = (searchParams.get("tab") ?? "general").toLowerCase();
  const isPeopleTab = currentTab === "people";

  useEffect(() => {
    setName(activeWorkspace?.name ?? "");
    setLogoUrl(activeWorkspace?.logoUrl ?? "");
    setShowLogoInput(Boolean(activeWorkspace?.logoUrl));
  }, [activeWorkspace]);

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

  if (!activeWorkspace) {
    return (
      <div className="h-full overflow-y-auto bg-white p-5 dark:bg-white/[0.03] lg:px-6 lg:py-4">
        <div className="mx-auto max-w-[900px] rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Workspace Settings
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No active workspace is selected.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Go to home
          </button>
        </div>
      </div>
    );
  }

  if (isPeopleTab) {
    return (
      <div className="h-full overflow-y-auto bg-white p-5 dark:bg-white/[0.03] lg:px-6 lg:py-4">
        <div className="mx-auto w-full max-w-[1040px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                Manage people
              </h1>
              <button
                type="button"
                className="text-xs font-medium text-brand-500 hover:text-brand-600"
              >
                Learn more
              </button>
            </div>
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Export
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="relative flex-1">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={peopleQuery}
                onChange={(e) => setPeopleQuery(e.target.value)}
                placeholder="Search or invite by email"
                className="h-10 w-full rounded-lg border border-violet-300 bg-white pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-violet-500/40 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <button
              type="button"
              className="h-10 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white hover:bg-violet-600"
            >
              + Invite people
            </button>
          </div>

          <div className="mt-4">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
            >
              All Users ({PEOPLE_ROWS.length}) <LuChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] table-fixed">
                <colgroup>
                  <col className="w-[27%]" />
                  <col className="w-[19%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[9%]" />
                  <col className="w-[6%]" />
                  <col className="w-[4%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Last Active</th>
                    <th className="px-4 py-3 text-left">Invited By</th>
                    <th className="px-4 py-3 text-left">Invited On</th>
                    <th className="px-1 py-3 text-center">Teams</th>
                    <th className="px-1 py-3 text-center" />
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                          <LuPlus className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          Invite people
                        </span>
                      </div>
                    </td>
                    <td className="px-1 py-3" />
                    <td className="px-1 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                  </tr>

                  {PEOPLE_ROWS.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b border-gray-100 align-middle last:border-0 dark:border-gray-800/70"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${member.avatarClass}`}
                          >
                            {member.avatarText}
                          </span>
                          <div className="min-w-0">
                            <p
                              title={member.name}
                              className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100"
                            >
                              {truncateWithDots(member.name, 12)}{" "}
                              {member.statusTag && (
                                <span
                                  className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                    member.statusTag.tone === "amber"
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                      : "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                                  }`}
                                >
                                  {member.statusTag.label}
                                </span>
                              )}
                            </p>
                            {member.subtitle && (
                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                {member.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <p className="truncate text-sm text-gray-700 dark:text-gray-300">
                          {member.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {member.role}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {member.lastActive}
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate text-sm text-gray-700 dark:text-gray-300">
                          {member.invitedBy}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {member.invitedOn}
                      </td>
                      <td className="px-1 py-3">
                        <button
                          type="button"
                          className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        >
                          <LuUserPlus className="h-5 w-5" />
                        </button>
                      </td>
                      <td className="px-1 py-3">
                        <button
                          type="button"
                          className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        >
                          <LuEllipsis className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white p-5 dark:bg-white/[0.03] lg:px-6 lg:py-4">
      <div className="mx-auto w-full max-w-[860px]">
        <section className="min-w-0">
          <div className="max-w-[760px]">
            <h1 className="text-4xl font-semibold text-gray-900 dark:text-gray-100">
              Workspace Settings
            </h1>

            <div className="mt-8">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
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
                        className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold text-white ${workspaceColor(
                          activeWorkspace.id
                        )}`}
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
                      className="h-9 w-full max-w-[260px] rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Custom branding
                </h3>
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                  Enterprise
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Enable custom branding
                  </p>
                  <Toggle
                    checked={customBrandingEnabled}
                    onChange={() =>
                      setCustomBrandingEnabled((current) => !current)
                    }
                  />
                </div>

                {[
                  {
                    title: "Round logo",
                    description:
                      "We recommend a 72 x 72 px PNG file. This logo is used in-app as your Workspace avatar.",
                  },
                  {
                    title: "Rectangle logo",
                    description:
                      "We recommend a 232 x 48 px PNG file. This logo appears on emails, your login screen, and public links to items like forms, docs, dashboards, and tasks.",
                  },
                  {
                    title: "Social media graphic",
                    description:
                      "We recommend a 500 x 260 px PNG file. This graphic serves as the preview image when links are shared.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800"
                  >
                    <div>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {item.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-md bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Add
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    Color scheme
                  </p>
                  <div className="flex items-center gap-2">
                    {COLOR_SCHEME.map((color) => (
                      <span
                        key={color}
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <button
                      type="button"
                      className="ml-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <LuPencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pb-8">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Danger zone
              </h3>
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Transfer full ownership to another person
                  </p>
                  <button
                    type="button"
                    className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Select new owner
                  </button>
                </div>
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
                    className="rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10"
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
