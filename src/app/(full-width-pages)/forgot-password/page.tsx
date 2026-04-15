"use client";

import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { api, parseApiError } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const handleSubmit = async (email: string) => {
    try {
      // Response has no body — OTP is sent to the user's email by the server
      await api.post("/auth/forgot-password", { email });
      toast.success("Check your inbox — we sent you a 6-digit code.");
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
      throw err; // keeps react-hook-form isSubmitting=false
    }
  };

  return <ForgotPasswordForm onSubmit={handleSubmit} />;
}
