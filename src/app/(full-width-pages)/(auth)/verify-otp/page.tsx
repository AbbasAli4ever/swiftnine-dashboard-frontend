"use client";

import OtpVerifyForm from "@/components/auth/OtpVerifyForm";
import { api, parseApiError } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [otpError, setOtpError] = useState<string | null>(null);

  // Guard: if someone lands here without an email param, send them back
  if (!email) {
    router.replace("/forgot-password");
    return null;
  }

  const handleVerify = async (otp: string) => {
    setOtpError(null);
    // No API call here — OTP is validated server-side in POST /auth/reset-password.
    // We simply carry the email + otp forward to the reset-password screen.
    router.push(
      `/reset-password?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`
    );
  };

  const handleResend = async () => {
    try {
      await api.post("/auth/forgot-password", { email });
      setOtpError(null);
      toast.success("New code sent — check your inbox.");
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
    }
  };

  const handleBack = () => {
    router.replace("/forgot-password");
  };

  return (
    <OtpVerifyForm
      email={email}
      error={otpError}
      onVerify={handleVerify}
      onResend={handleResend}
      onBack={handleBack}
    />
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpContent />
    </Suspense>
  );
}
