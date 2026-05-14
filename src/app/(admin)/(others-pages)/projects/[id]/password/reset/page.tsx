"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { LuShield, LuLoader, LuEye, LuEyeOff, LuCircleX, LuCircleCheck } from "react-icons/lu";
import { projectPasswordService, getApiErrorCode } from "@/services/project-password.service";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";

const PASSWORD_REGEX = /^(?=.*\d).{8,}$/;

function ProjectResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();

  const projectId = (params?.id as string) ?? "";
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [invalidToken, setInvalidToken] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!projectId || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <LuCircleX className="h-12 w-12 text-red-400" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Invalid Reset Link</h1>
          <p className="text-sm text-gray-400">This link is missing required parameters. Please request a new reset email.</p>
          <button
            type="button"
            onClick={() => router.replace("/projects")}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            Go to Projects
          </button>
        </div>
      </div>
    );
  }

  if (invalidToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <LuCircleX className="h-12 w-12 text-red-400" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Link Expired or Invalid</h1>
          <p className="max-w-sm text-sm text-gray-400">
            This reset link is invalid or has already been used. Use &quot;Forgot password?&quot; from the project to request a new one.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/projects")}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            Go to Projects
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <LuCircleCheck className="h-12 w-12 text-green-400" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Password Reset!</h1>
          <p className="text-sm text-gray-400">Your project password has been updated. You can now unlock the project with the new password.</p>
          <button
            type="button"
            onClick={() => router.replace(`/projects?projectId=${projectId}`)}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            Go to Project
          </button>
        </div>
      </div>
    );
  }

  const validate = () => {
    const errs: { newPassword?: string; confirmPassword?: string } = {};
    if (!newPassword) {
      errs.newPassword = "Password is required";
    } else if (!PASSWORD_REGEX.test(newPassword)) {
      errs.newPassword = "At least 8 characters and 1 digit required";
    }
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      await projectPasswordService.confirmReset(projectId, token, newPassword);
      toast.success("Project password reset successfully");
      setSuccess(true);
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === "RESET_TOKEN_INVALID") {
        setInvalidToken(true);
      } else if (code === "INVALID_PASSWORD_FORMAT") {
        setErrors({ newPassword: "At least 8 characters and 1 digit required" });
      } else {
        toast.error(parseApiError(err).message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-brand-50 to-brand-100 dark:from-brand-950 dark:to-brand-900">
              <LuShield className="h-7 w-7 text-brand-500" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Reset Project Password</h1>
            <p className="mt-1.5 text-sm text-gray-400">Enter a new password for your project.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setErrors((p) => ({ ...p, newPassword: undefined })); }}
                  placeholder="Min 8 chars + 1 digit"
                  disabled={loading}
                  autoFocus
                  className={`w-full rounded-xl border px-4 py-3 pr-11 text-sm outline-none transition-colors
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400
                    focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
                    ${errors.newPassword ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}
                    disabled:opacity-60`}
                />
                <button type="button" onClick={() => setShowNew((v) => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <LuEyeOff className="h-4 w-4" /> : <LuEye className="h-4 w-4" />}
                </button>
              </div>
              {errors.newPassword && <p className="mt-1 text-xs text-red-500">{errors.newPassword}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: undefined })); }}
                  placeholder="Repeat new password"
                  disabled={loading}
                  className={`w-full rounded-xl border px-4 py-3 pr-11 text-sm outline-none transition-colors
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400
                    focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
                    ${errors.confirmPassword ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}
                    disabled:opacity-60`}
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <LuEyeOff className="h-4 w-4" /> : <LuEye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-60 mt-2"
            >
              {loading && <LuLoader className="h-4 w-4 animate-spin" />}
              Reset Password
            </button>

            <button
              type="button"
              onClick={() => router.replace("/projects")}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ProjectResetPasswordPage() {
  return (
    <Suspense>
      <ProjectResetPasswordContent />
    </Suspense>
  );
}
