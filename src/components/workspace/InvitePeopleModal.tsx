"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuChevronDown, LuChevronUp, LuPlus, LuUserPlus, LuX } from "react-icons/lu";
import { toast } from "sonner";
import { useWorkspace } from "@/context/WorkspaceContext";
import { parseApiError } from "@/lib/api";
import { workspaceService, WorkspaceInviteRole } from "@/services/workspace.service";

interface InvitePeopleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UiRoleKey = "MEMBER" | "LIMITED_MEMBER" | "GUEST" | "ADMIN";

const ROLE_OPTIONS: Array<{
  key: UiRoleKey;
  label: string;
  description: string;
  badge?: string;
}> = [
  {
    key: "MEMBER",
    label: "Member",
    description: "Can access all public items in your Workspace.",
  },
  {
    key: "LIMITED_MEMBER",
    label: "Limited Member",
    description: "Can only access items shared with them.",
    badge: "Chat Collaborator",
  },
  {
    key: "GUEST",
    label: "Guest",
    description:
      "Can't use all features or be added to Spaces. Can only access items shared with them.",
  },
  {
    key: "ADMIN",
    label: "Admin",
    description:
      "Can manage Spaces, People, Billing and other Workspace settings.",
  },
];

function parseEmails(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\s,]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .filter((email) => {
      if (seen.has(email)) return false;
      seen.add(email);
      return true;
    });
}

export default function InvitePeopleModal({
  isOpen,
  onClose,
}: InvitePeopleModalProps) {
  const { activeWorkspace } = useWorkspace();
  const [emailsInput, setEmailsInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<UiRoleKey>("MEMBER");
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEmailsInput("");
    setSelectedRole("MEMBER");
    setIsRoleOpen(false);
    setInputError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSending) {
        if (isRoleOpen) {
          setIsRoleOpen(false);
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isRoleOpen, isSending, onClose]);

  useEffect(() => {
    if (!isOpen || !isRoleOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!roleMenuRef.current?.contains(event.target as Node)) {
        setIsRoleOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen, isRoleOpen]);

  const parsedEmails = useMemo(() => parseEmails(emailsInput), [emailsInput]);
  const currentRole = ROLE_OPTIONS.find((r) => r.key === selectedRole) ?? ROLE_OPTIONS[0];
  const backendRole: WorkspaceInviteRole =
    selectedRole === "ADMIN" ? "OWNER" : "MEMBER";

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!activeWorkspace) {
      toast.error("No active workspace selected.");
      return;
    }

    if (parsedEmails.length === 0) {
      setInputError("Enter at least one email address.");
      return;
    }

    const invalidEmails = parsedEmails.filter((email) => !EMAIL_REGEX.test(email));
    if (invalidEmails.length > 0) {
      setInputError(`Invalid email: ${invalidEmails[0]}`);
      return;
    }

    setInputError(null);
    setIsSending(true);
    try {
      const results = await Promise.allSettled(
        parsedEmails.map((email) =>
          workspaceService.invite(activeWorkspace.id, { email, role: backendRole })
        )
      );

      const failedEmails: string[] = [];
      let firstFailureMessage = "";
      let sentCount = 0;

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          sentCount += 1;
          return;
        }
        failedEmails.push(parsedEmails[index]);
        if (!firstFailureMessage) {
          firstFailureMessage = parseApiError(result.reason).message;
        }
      });

      if (sentCount > 0) {
        toast.success(
          sentCount === 1
            ? "Invite sent successfully."
            : `${sentCount} invites sent successfully.`
        );
      }

      if (failedEmails.length > 0) {
        setEmailsInput(failedEmails.join(", "));
        setInputError(firstFailureMessage || "Some invites failed. Try again.");
        return;
      }

      onClose();
    } finally {
      setIsSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={() => {
          if (!isSending) onClose();
        }}
      />

      <div className="relative z-10 mx-4 w-full max-w-[500px] rounded-xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-800 dark:bg-[#17181C] sm:p-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isSending}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-60 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15 dark:hover:text-white"
        >
          <LuX className="h-3.5 w-3.5" />
        </button>

        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Invite people for free
        </h2>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
            Invite by email
          </p>
          <input
            value={emailsInput}
            onChange={(e) => {
              setEmailsInput(e.target.value);
              if (inputError) setInputError(null);
            }}
            placeholder="Email, comma or space separated"
            className={`h-9 w-full rounded-md border bg-white px-2.5 text-sm leading-none text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 dark:bg-[#111216] dark:text-gray-100 dark:placeholder:text-gray-500 ${
              inputError
                ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                : "border-gray-300 focus:border-brand-500 focus:ring-brand-500/25 dark:border-white/20 dark:focus:border-brand-400"
            }`}
          />
          {inputError && (
            <p className="mt-2 text-sm text-red-500 dark:text-red-400">{inputError}</p>
          )}
        </div>

        <div ref={roleMenuRef} className="relative mt-3">
          <p className="mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
            Invite as
          </p>
          <button
            type="button"
            onClick={() => setIsRoleOpen((v) => !v)}
            className="flex w-full items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-left hover:border-violet-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-violet-500/40"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300">
              <LuUserPlus className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <p className="text-base font-medium leading-none text-gray-900 dark:text-white">
                {currentRole.label}
              </p>
              <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
                {currentRole.description}
              </p>
            </div>
            {isRoleOpen ? (
              <LuChevronUp className="mt-1 h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
            ) : (
              <LuChevronDown className="mt-1 h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
            )}
          </button>

          {isRoleOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-3 py-2.5 dark:border-gray-800">
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {currentRole.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    {currentRole.description}
                  </p>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto">
                {ROLE_OPTIONS.filter((option) => option.key !== selectedRole).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setSelectedRole(option.key);
                      setIsRoleOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/70"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {option.label}
                      </p>
                      {option.badge && (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      {option.description}
                    </p>
                  </button>
                ))}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 border-t border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/70"
                >
                  <LuPlus className="h-3.5 w-3.5" />
                  Add custom role
                </button>
              </div>
            </div>
          )}

          <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
            Workspace: {activeWorkspace?.name ?? "No workspace selected"}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !activeWorkspace}
            className="rounded-md bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? "Sending..." : "Send free invite"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
