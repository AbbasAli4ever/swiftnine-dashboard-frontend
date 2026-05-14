"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  LuLock, LuLockOpen, LuShield, LuLoader, LuEye, LuEyeOff, LuTriangle, LuCheck,
} from "react-icons/lu";
import { projectPasswordService, getApiErrorCode } from "@/services/project-password.service";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";

type Mode = "set" | "change" | "remove";

interface ProjectPasswordModalProps {
  isOpen: boolean;
  projectId: string;
  projectName?: string;
  hasPassword: boolean;
  onClose: () => void;
  onPasswordChanged: (removed?: boolean) => void;
}

const PASSWORD_REGEX = /^(?=.*\d).{8,}$/;

function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled,
  error,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  error?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`w-full rounded-xl border px-4 py-2.5 pr-11 text-sm outline-none transition-colors
            bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400
            focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
            ${error ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}
            disabled:opacity-60`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          {show ? <LuEyeOff className="h-4 w-4" /> : <LuEye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function ProjectPasswordModal({
  isOpen,
  projectId,
  projectName,
  hasPassword,
  onClose,
  onPasswordChanged,
}: ProjectPasswordModalProps) {
  const [mode, setMode] = useState<Mode>(hasPassword ? "change" : "set");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Sync mode whenever hasPassword changes (e.g. after remove/set succeeds)
  useEffect(() => {
    setMode(hasPassword ? "change" : "set");
  }, [hasPassword]);

  // Set / Change fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleClose = () => {
    if (loading) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
    setResetSent(false);
    setMode(hasPassword ? "change" : "set");
    onClose();
  };

  const validateNew = (pw: string, confirm: string): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!pw) {
      errs.newPassword = "Password is required";
    } else if (!PASSWORD_REGEX.test(pw)) {
      errs.newPassword = "At least 8 characters and 1 digit required";
    }
    if (pw && confirm && pw !== confirm) {
      errs.confirmPassword = "Passwords do not match";
    }
    return errs;
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateNew(newPassword, confirmPassword);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await projectPasswordService.setPassword(projectId, newPassword);
      toast.success("Password protection enabled");
      onPasswordChanged(false);
      handleClose();
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === "INVALID_PASSWORD_FORMAT") {
        setErrors({ newPassword: "At least 8 characters and 1 digit required" });
      } else if (code === "PASSWORD_ALREADY_SET") {
        toast.error("A password is already set. Use Change Password.");
        setMode("change");
      } else {
        toast.error(parseApiError(err).message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = "Current password is required";
    Object.assign(errs, validateNew(newPassword, confirmPassword));
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await projectPasswordService.changePassword(projectId, currentPassword, newPassword);
      toast.success("Password updated — all sessions invalidated");
      onPasswordChanged(false);
      handleClose();
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === "INVALID_PASSWORD") {
        setErrors({ currentPassword: "Incorrect current password" });
      } else if (code === "INVALID_PASSWORD_FORMAT") {
        setErrors({ newPassword: "At least 8 characters and 1 digit required" });
      } else {
        toast.error(parseApiError(err).message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePassword = async () => {
    setLoading(true);
    try {
      await projectPasswordService.removePassword(projectId);
      toast.success("Password protection removed");
      onPasswordChanged(true);
      handleClose();
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === "PROJECT_PASSWORD_NOT_SET") {
        toast.success("Password protection is already disabled");
        onPasswordChanged(true);
        handleClose();
      } else {
        toast.error(parseApiError(err).message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async () => {
    setLoading(true);
    try {
      await projectPasswordService.requestReset(projectId);
      setResetSent(true);
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === "RESET_REQUEST_RATE_LIMITED") {
        toast.error("A reset email was already sent recently. Please check your inbox.");
      } else {
        toast.error(parseApiError(err).message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-md mx-4" showCloseButton={false} backdropClassName="fixed inset-0 h-full w-full bg-black/30 backdrop-blur-[4px]">
      <div className="p-6">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950">
            <LuShield className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Password Protection</h2>
            {projectName && <p className="max-w-60 truncate text-xs text-gray-400">{projectName}</p>}
          </div>
        </div>

        {/* Mode tabs (only when password already set) */}
        {hasPassword && (
          <div className="mb-5 flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-700 p-1">
            {(["change", "remove"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setErrors({}); setResetSent(false); }}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  mode === m
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {m === "change" ? "Change Password" : "Remove Protection"}
              </button>
            ))}
          </div>
        )}

        {/* ── Set Password ─────────────────────────────────────────── */}
        {mode === "set" && (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="rounded-xl border border-brand-100 dark:border-brand-900 bg-brand-50/60 dark:bg-brand-950/30 px-4 py-3 text-xs text-brand-700 dark:text-brand-300">
              <p className="flex items-center gap-1.5">
                <LuLock className="h-3.5 w-3.5 shrink-0" />
                All workspace members will need to enter this password to access the project.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                New Password <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                value={newPassword}
                onChange={(v) => { setNewPassword(v); setErrors((p) => ({ ...p, newPassword: "" })); }}
                placeholder="Min 8 chars + 1 digit"
                disabled={loading}
                error={errors.newPassword}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(v) => { setConfirmPassword(v); setErrors((p) => ({ ...p, confirmPassword: "" })); }}
                placeholder="Repeat password"
                disabled={loading}
                error={errors.confirmPassword}
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={handleClose} disabled={loading} className="rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-60">
                {loading && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
                <LuLock className="h-3.5 w-3.5" />
                Enable Protection
              </button>
            </div>
          </form>
        )}

        {/* ── Change Password ──────────────────────────────────────── */}
        {mode === "change" && (
          <form onSubmit={handleChangePassword} className="space-y-4">
            {resetSent ? (
              <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                <LuCheck className="h-4 w-4 shrink-0" />
                Reset email sent! Check your inbox and follow the link to set a new password.
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Current Password <span className="text-red-500">*</span></label>
                  <PasswordInput
                    value={currentPassword}
                    onChange={(v) => { setCurrentPassword(v); setErrors((p) => ({ ...p, currentPassword: "" })); }}
                    placeholder="Enter current password"
                    disabled={loading}
                    error={errors.currentPassword}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleRequestReset}
                    disabled={loading}
                    className="mt-1.5 text-xs text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                  >
                    Forgot password? Send reset email
                  </button>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">New Password <span className="text-red-500">*</span></label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(v) => { setNewPassword(v); setErrors((p) => ({ ...p, newPassword: "" })); }}
                    placeholder="Min 8 chars + 1 digit"
                    disabled={loading}
                    error={errors.newPassword}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password <span className="text-red-500">*</span></label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(v) => { setConfirmPassword(v); setErrors((p) => ({ ...p, confirmPassword: "" })); }}
                    placeholder="Repeat new password"
                    disabled={loading}
                    error={errors.confirmPassword}
                  />
                </div>
              </>
            )}
            {!resetSent && (
              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={handleClose} disabled={loading} className="rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-60">
                  {loading && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
                  Update Password
                </button>
              </div>
            )}
            {resetSent && (
              <button type="button" onClick={handleClose} className="w-full rounded-xl py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Close</button>
            )}
          </form>
        )}

        {/* ── Remove Password ──────────────────────────────────────── */}
        {mode === "remove" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <LuTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Removing password protection will allow all workspace members to access this project without a password.</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <LuLockOpen className="h-4 w-4 text-gray-400" />
                <span>This project will become accessible to all workspace members.</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={handleClose} disabled={loading} className="rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">Cancel</button>
              <button
                type="button"
                onClick={handleRemovePassword}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {loading && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
                <LuLockOpen className="h-3.5 w-3.5" />
                Remove Protection
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
