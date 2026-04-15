"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { parseApiError } from "@/lib/api";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { toast } from "sonner";

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

function workspaceInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
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

  return (
    <div className="h-full overflow-y-auto bg-white p-5 dark:bg-white/[0.03] lg:px-6 lg:py-4">
      <div className="mx-auto w-full max-w-[860px]">
        <section className="min-w-0">
          <div className="max-w-[760px]">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              Workspace Settings
            </h1>

            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                General
              </h3>
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="grid grid-cols-[140px_1fr] items-center border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Avatar</p>
                  <div className="flex items-center justify-end gap-3">
                    {logoUrl.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl.trim()}
                        alt={activeWorkspace.name}
                        className="h-8 w-8 rounded-lg object-cover"
                      />
                    ) : (
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold text-white ${workspaceColor(
                          activeWorkspace.id
                        )}`}
                      >
                        {initial}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowLogoInput((v) => !v)}
                      className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      {showLogoInput ? "Hide URL" : "Set URL"}
                    </button>
                  </div>
                </div>

                {showLogoInput && (
                  <div className="grid grid-cols-[140px_1fr] items-center border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Avatar URL
                    </p>
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/workspace-logo.png"
                      className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-[140px_1fr] items-center px-4 py-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                  />
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Custom branding
                </h3>
                <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-400">
                  Enterprise
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                  <p className="text-sm text-gray-300 dark:text-gray-300">
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
                      "We recommend a 232 x 48 px PNG file. This logo appears on emails, your login screen, and public links.",
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
                      className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Add
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
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
                  </div>
                </div>

                <div className="grid grid-cols-[140px_1fr] items-center px-4 py-3">
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    Custom URL
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="h-8 w-full max-w-[180px] rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      .clickup.com
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Personal Layout
              </h3>
              <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Personal Workspace Layout
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Work by yourself? Turn this on to maximize efficiency by
                      removing features designed for team collaboration.
                    </p>
                  </div>
                  <Toggle
                    checked={personalLayoutEnabled}
                    onChange={() => setPersonalLayoutEnabled((current) => !current)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 pb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Danger zone
              </h3>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50/40 px-4 py-3 dark:border-red-500/40 dark:bg-red-500/5">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Delete this Workspace forever
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    This action cannot be undone.
                  </p>
                </div>
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
                  className="rounded-md border border-red-500/70 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                >
                  {deleting ? "Deleting..." : "Delete Workspace"}
                </button>
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
