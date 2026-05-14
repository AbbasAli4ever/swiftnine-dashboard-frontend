"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { LuLock, LuLoader, LuEye, LuEyeOff } from "react-icons/lu";
import { projectPasswordService, getApiErrorCode } from "@/services/project-password.service";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";

interface ProjectUnlockModalProps {
  isOpen: boolean;
  projectId: string;
  projectName?: string;
  onClose: () => void;
  onUnlocked: () => void;
}

export default function ProjectUnlockModal({
  isOpen,
  projectId,
  projectName,
  onClose,
  onUnlocked,
}: ProjectUnlockModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooManyAttempts, setTooManyAttempts] = useState(false);

  const handleClose = () => {
    if (loading) return;
    setPassword("");
    setError(null);
    setTooManyAttempts(false);
    setShowPassword(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || tooManyAttempts) return;

    setLoading(true);
    setError(null);

    try {
      await projectPasswordService.unlock(projectId, password);
      toast.success("Project unlocked");
      setPassword("");
      setError(null);
      onUnlocked();
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === "INVALID_PASSWORD") {
        setError("Incorrect password. Please try again.");
      } else if (code === "TOO_MANY_ATTEMPTS") {
        setTooManyAttempts(true);
        setError("Too many failed attempts. Please try again later.");
      } else if (code === "PROJECT_PASSWORD_NOT_SET") {
        toast.success("This project is no longer password protected");
        onUnlocked();
      } else {
        setError(parseApiError(err).message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-sm mx-4" showCloseButton={false} backdropClassName="fixed inset-0 h-full w-full bg-black/30 backdrop-blur-[4px]">
      <div className="p-6">
        {/* Icon + heading */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-brand-50 to-brand-100 dark:from-brand-950 dark:to-brand-900">
            <LuLock className="h-7 w-7 text-brand-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {projectName ? `"${projectName}" is locked` : "Project is locked"}
          </h2>
          <p className="mt-1.5 text-sm text-gray-400">
            Enter the password to access this project.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="Enter password…"
                disabled={loading || tooManyAttempts}
                autoFocus
                className={`w-full rounded-xl border px-4 py-3 pr-11 text-sm outline-none transition-colors
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400
                  focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
                  ${error ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}
                  disabled:opacity-60`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                tabIndex={-1}
              >
                {showPassword ? <LuEyeOff className="h-4 w-4" /> : <LuEye className="h-4 w-4" />}
              </button>
            </div>
            {error && (
              <p className={`mt-2 text-xs ${tooManyAttempts ? "text-amber-500" : "text-red-500"}`}>{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || tooManyAttempts || !password.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-60"
          >
            {loading && <LuLoader className="h-4 w-4 animate-spin" />}
            Unlock Project
          </button>

          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </form>
      </div>
    </Modal>
  );
}
