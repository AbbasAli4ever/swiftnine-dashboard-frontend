"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { LuEye, LuEyeOff, LuLoader, LuCircleCheck } from "react-icons/lu";
import Image from "next/image";
import { projectPasswordService, getApiErrorCode } from "@/services/project-password.service";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import type { KeyboardEvent, ClipboardEvent } from "react";

const PASSWORD_REGEX = /^(?=.*\d).{8,}$/;
const OTP_LENGTH = 6;

function ProjectResetPasswordContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const projectId = (params?.id as string) ?? "";
  const state = searchParams.get("state");

  // OTP state
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(OTP_LENGTH).fill(null));
  const [otpError, setOtpError] = useState<string | null>(null);

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwErrors, setPwErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // OTP input handlers
  const focusNext = (i: number) => { if (i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus(); };
  const focusPrev = (i: number) => { if (i > 0) inputRefs.current[i - 1]?.focus(); };

  const handleDigitChange = (i: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    setOtpError(null);
    if (digit) focusNext(i);
  };

  const handleDigitKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const next = [...digits];
        next[i] = "";
        setDigits(next);
      } else {
        focusPrev(i);
      }
    } else if (e.key === "ArrowLeft") {
      focusPrev(i);
    } else if (e.key === "ArrowRight") {
      focusNext(i);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const validate = () => {
    const otp = digits.join("");
    let valid = true;

    if (otp.length < OTP_LENGTH) {
      setOtpError("Please enter the 6-digit code from your email");
      valid = false;
    }

    const errs: { newPassword?: string; confirmPassword?: string } = {};
    if (!newPassword) {
      errs.newPassword = "Password is required";
    } else if (!PASSWORD_REGEX.test(newPassword)) {
      errs.newPassword = "At least 8 characters and 1 digit required";
    }
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }
    if (Object.keys(errs).length) {
      setPwErrors(errs);
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await projectPasswordService.confirmReset(projectId, digits.join(""), newPassword);
      setSuccess(true);
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === "RESET_OTP_INVALID") {
        setOtpError("This code is invalid or has expired.");
        setDigits(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      } else if (code === "INVALID_PASSWORD_FORMAT") {
        setPwErrors({ newPassword: "At least 8 characters and 1 digit required" });
      } else {
        toast.error(parseApiError(err).message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-[0_-4px_20px_rgba(0,0,0,0.08),0_4px_20px_rgba(0,0,0,0.08)] p-8 sm:p-10 flex flex-col items-center text-center gap-4">
            <LuCircleCheck className="h-14 w-14 text-green-500" />
            <h1 className="text-2xl font-normal text-gray-900 dark:text-white">Password Reset!</h1>
            <p className="text-sm text-gray-400">Your project password has been updated. You can now unlock the project with the new password.</p>
            <button
              type="button"
              onClick={() => router.replace(`/projects?projectId=${projectId}`)}
              className="mt-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-normal text-white hover:bg-brand-600 transition-colors"
            >
              Go to Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  const otpComplete = digits.every((d) => d !== "");

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto space-y-4">

        {state === "sent" && (
          <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            Reset email sent! Check your inbox for the 6-digit code.
          </div>
        )}
        {state === "cooldown" && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            A reset code was already sent recently. No new email was sent — check your inbox, the code is valid for 15 minutes.
          </div>
        )}

        <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-[0_-4px_20px_rgba(0,0,0,0.08),0_4px_20px_rgba(0,0,0,0.08)] p-8 sm:p-10">
          <h1 className="text-center text-2xl font-normal text-gray-900 dark:text-white mb-6">
            Reset project password
          </h1>

          {/* Email icon */}
          <div className="flex justify-center mb-6">
            <div className="relative w-[108px] h-[122px]">
              <Image src="/images/auth/email.svg" alt="Email" width={108} height={122} priority />
              <div className="absolute inset-0 flex items-center justify-center pb-4">
                <Image src="/images/auth/slogo.svg" alt="SwiftNine" width={40} height={40} priority />
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mb-1">
            Enter the 6-digit code from your email and set a new password.
          </p>
          <p className="text-center text-xs text-gray-400 mb-6">
            Confirmation code
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* OTP boxes */}
            <div>
              <div className="flex justify-center gap-3 mb-2">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    autoFocus={i === 0}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    onPaste={handlePaste}
                    className={[
                      "w-11 h-11 rounded-lg border text-center text-lg font-normal text-gray-900 dark:text-white dark:bg-gray-800 outline-none transition-colors caret-transparent",
                      otpError
                        ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
                        : "border-gray-300 dark:border-gray-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                    ].join(" ")}
                  />
                ))}
              </div>
              {otpError && <p className="text-center text-xs text-red-500">{otpError}</p>}
            </div>

            {/* New password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPwErrors((p) => ({ ...p, newPassword: undefined })); }}
                  placeholder="Min 8 chars + 1 digit"
                  disabled={loading}
                  className={`w-full rounded-lg border px-4 py-3 pr-11 text-sm outline-none transition-colors
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400
                    focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
                    ${pwErrors.newPassword ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-700"}
                    disabled:opacity-60`}
                />
                <button type="button" onClick={() => setShowNew((v) => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <LuEyeOff className="h-4 w-4" /> : <LuEye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.newPassword && <p className="mt-1 text-xs text-red-500">{pwErrors.newPassword}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPwErrors((p) => ({ ...p, confirmPassword: undefined })); }}
                  placeholder="Repeat new password"
                  disabled={loading}
                  className={`w-full rounded-lg border px-4 py-3 pr-11 text-sm outline-none transition-colors
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400
                    focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
                    ${pwErrors.confirmPassword ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-700"}
                    disabled:opacity-60`}
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <LuEyeOff className="h-4 w-4" /> : <LuEye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.confirmPassword && <p className="mt-1 text-xs text-red-500">{pwErrors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || !otpComplete || !newPassword || !confirmPassword}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-3 text-sm font-normal text-white hover:bg-brand-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <LuLoader className="h-4 w-4 animate-spin" />}
              {loading ? "Resetting..." : "Reset Password"}
            </button>

            <p className="text-center text-sm text-gray-400">
              <button
                type="button"
                onClick={() => router.replace("/projects")}
                className="text-brand-500 hover:text-brand-600 font-normal"
              >
                Go back
              </button>
            </p>
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
