"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuCalculator, LuChevronDown, LuChevronUp, LuUserPlus, LuX } from "react-icons/lu";
import { toast } from "sonner";
import { useWorkspace } from "@/context/WorkspaceContext";
import { parseApiError } from "@/lib/api";
import {
  workspaceService,
  WorkspaceInviteRole,
  type AccountingRole,
} from "@/services/workspace.service";

interface InvitePeopleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Only the roles `POST /workspaces/:id/invite` actually accepts — its DTO is
 * `z.enum(['OWNER', 'MEMBER'])`.
 *
 * `ADMIN` exists in the Prisma `Role` enum and is honoured by the authorization
 * layer (project archive/restore, deleting others' attachments), but no code
 * path can grant it: workspace creation hardcodes OWNER, and this endpoint
 * rejects `ADMIN` with 422. It's omitted here rather than faked — the previous
 * list offered Admin/Limited Member/Guest and quietly mapped Admin to `OWNER`,
 * so inviting an "admin" handed over full workspace ownership. Add it back once
 * the invite DTO accepts it.
 */
type UiRoleKey = "MEMBER" | "OWNER";

/**
 * Accounting access, independent of the workspace role above — the two are
 * separate fields on the same membership. `null` means no accounting access.
 */
const ACCOUNTING_ROLE_OPTIONS: Array<{
  key: AccountingRole | null;
  label: string;
  description: string;
}> = [
  {
    key: null,
    label: "No access",
    description: "Can't open the accounting area.",
  },
  {
    key: "ACCOUNTANT",
    label: "Accountant",
    description: "Full access: can add sales, clients and bank accounts.",
  },
  {
    key: "CEO",
    label: "CEO",
    description: "Read-only: sees the overview, can't enter or edit data.",
  },
];

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
    key: "OWNER",
    label: "Owner",
    description:
      "Full control: manages People, billing, workspace settings and accounting access.",
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
  const [accountingRole, setAccountingRole] = useState<AccountingRole | null>(null);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [isAccountingOpen, setIsAccountingOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const accountingMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEmailsInput("");
    setSelectedRole("MEMBER");
    setAccountingRole(null);
    setIsRoleOpen(false);
    setIsAccountingOpen(false);
    setInputError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSending) {
        // Escape closes an open dropdown first, and only closes the modal
        // itself once neither is open.
        if (isRoleOpen || isAccountingOpen) {
          setIsRoleOpen(false);
          setIsAccountingOpen(false);
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isRoleOpen, isAccountingOpen, isSending, onClose]);

  useEffect(() => {
    if (!isOpen || (!isRoleOpen && !isAccountingOpen)) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!roleMenuRef.current?.contains(target)) setIsRoleOpen(false);
      if (!accountingMenuRef.current?.contains(target)) setIsAccountingOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen, isRoleOpen, isAccountingOpen]);

  const parsedEmails = useMemo(() => parseEmails(emailsInput), [emailsInput]);
  const currentRole = ROLE_OPTIONS.find((r) => r.key === selectedRole) ?? ROLE_OPTIONS[0];
  const currentAccounting =
    ACCOUNTING_ROLE_OPTIONS.find((option) => option.key === accountingRole) ??
    ACCOUNTING_ROLE_OPTIONS[0];
  // 1:1 with the API now that the UI only offers roles it accepts — no
  // translation layer to drift out of sync.
  const backendRole: WorkspaceInviteRole = selectedRole;

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
          workspaceService.invite(activeWorkspace.id, {
            email,
            role: backendRole,
            accountingRole,
          })
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

        <h2 className="text-2xl font-normal tracking-tight text-gray-900 dark:text-white">
          Invite people for free
        </h2>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-normal text-gray-700 dark:text-gray-300">
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
          <p className="mb-1.5 text-xs font-normal text-gray-700 dark:text-gray-300">
            Invite as
          </p>
          <button
            type="button"
            onClick={() => {
              setIsRoleOpen((v) => !v);
              setIsAccountingOpen(false);
            }}
            className="flex w-full items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-left hover:border-violet-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-gray-000"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300">
              <LuUserPlus className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <p className="text-base font-normal leading-none text-gray-900 dark:text-white">
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
                  <p className="text-xs font-normal text-gray-900 dark:text-gray-100">
                    {currentRole.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    {currentRole.description}
                  </p>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
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
                      <p className="text-xs font-normal text-gray-900 dark:text-gray-100">
                        {option.label}
                      </p>
                      {option.badge && (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-normal text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
            Workspace: {activeWorkspace?.name ?? "No workspace selected"}
          </p>
        </div>

        {/* Separate from the workspace role above: the two are independent
            fields on the same membership. An Admin isn't automatically a CEO,
            and a plain Member can be an Accountant. */}
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-normal text-gray-700 dark:text-gray-300">
            Accounting access
          </p>
          <div className="relative" ref={accountingMenuRef}>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={isAccountingOpen}
              onClick={() => {
                setIsAccountingOpen((v) => !v);
                setIsRoleOpen(false);
              }}
              className="flex w-full items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-left hover:border-violet-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-gray-000"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300">
                <LuCalculator className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <p className="text-base font-normal leading-none text-gray-900 dark:text-white">
                  {currentAccounting.label}
                </p>
                <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
                  {currentAccounting.description}
                </p>
              </div>
              {isAccountingOpen ? (
                <LuChevronUp className="mt-1 h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              ) : (
                <LuChevronDown className="mt-1 h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              )}
            </button>

            {isAccountingOpen && (
              <div
                role="listbox"
                aria-label="Accounting access"
                className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="border-b border-gray-200 px-3 py-2.5 dark:border-gray-800">
                  <p className="text-xs font-normal text-gray-900 dark:text-gray-100">
                    {currentAccounting.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    {currentAccounting.description}
                  </p>
                </div>

                <div className="max-h-56 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
                  {ACCOUNTING_ROLE_OPTIONS.filter(
                    (option) => option.key !== accountingRole
                  ).map((option) => (
                    <button
                      key={option.key ?? "NONE"}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        setAccountingRole(option.key);
                        setIsAccountingOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/70"
                    >
                      <p className="text-xs font-normal text-gray-900 dark:text-gray-100">
                        {option.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        {option.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
            {accountingRole
              ? "Applied when the invite is accepted."
              : "Can also be granted later in People settings."}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="rounded-full px-3 py-1.5 text-xs font-normal text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !activeWorkspace}
            className="rounded-md bg-violet-500 dark:bg-gray-000 dark:text-black dark:hover:bg-gray-200 px-3 py-1.5 text-xs font-normal text-white transition-colors hover:bg-violet-600  disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? "Sending..." : "Send free invite"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
