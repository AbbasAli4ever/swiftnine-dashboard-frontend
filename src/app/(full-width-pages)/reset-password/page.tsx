"use client";

import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { api, parseApiError } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const otp = searchParams.get("otp") ?? "";

  // Guard: missing params means the user skipped a step
  if (!email || !otp) {
    router.replace("/forgot-password");
    return null;
  }

  const handleSubmit = async (newPassword: string) => {
    try {
      // Single call — server validates OTP + sets new password atomically
      await api.post("/auth/reset-password", { email, otp, newPassword });
      toast.success("Password reset! Please sign in with your new password.");
      // reset-password logs out all sessions server-side, so hard-navigate to signin
      window.location.replace("/signin");
    } catch (err) {
      const { message } = parseApiError(err);
      // 401 = wrong / expired / already-used OTP → send user back to OTP screen
      const isOtpError =
        (err as { response?: { status?: number } })?.response?.status === 401;

      if (isOtpError) {
        toast.error("Invalid or expired code. Please request a new one.");
        router.replace(`/verify-otp?email=${encodeURIComponent(email)}`);
        return;
      }

      toast.error(message);
      throw err; // keeps react-hook-form isSubmitting=false for other errors
    }
  };

  return <ResetPasswordForm onSubmit={handleSubmit} />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
