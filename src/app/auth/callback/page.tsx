"use client";

import { api } from "@/lib/api";
import { useAuthStore, type UserRole } from "@/stores/auth.store";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        <p className="text-sm text-gray-500">Signing you in...</p>
      </div>
    </div>
  );
}

function CallbackHandler() {
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      window.location.replace("/signin?error=oauth_failed");
      return;
    }

    // The OAuth callback is a redirect, not a JSON body, so the backend appends
    // the role as a flat query param rather than nesting it under `user`.
    const roleParam = searchParams.get("role");
    const urlRole: UserRole | null =
      roleParam === "CEO" || roleParam === "ACCOUNTANT" ? roleParam : null;

    const landingPath = (role: UserRole | null) =>
      role === "ACCOUNTANT" ? "/accounts" : "/";

    // Fetch the real user profile using the token from the URL.
    // Pass Authorization explicitly so we don't depend on the Zustand store
    // being updated before this request fires.
    api
      .get<{
        id: string;
        fullName: string;
        email: string;
        avatarUrl: string | null;
        avatarColor: string;
        role?: UserRole | null;
      }>("/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        // Prefer the profile's role; fall back to the URL param if the profile
        // endpoint omits it.
        const role = data.role ?? urlRole;
        setAuth(token, {
          id: data.id,
          fullName: data.fullName,
          email: data.email,
          avatarUrl: data.avatarUrl,
          avatarColor: data.avatarColor,
          role,
        });
        window.location.replace(landingPath(role));
      })
      .catch(() => {
        // Profile fetch failed — store the token at minimum so the user lands
        // on the portal select. The next page load will restore the full profile.
        setAuth(token, {
          id: "",
          fullName: "User",
          email: "",
          avatarUrl: null,
          avatarColor: "#6366f1",
          role: urlRole,
        });
        window.location.replace(landingPath(urlRole));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Spinner />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackHandler />
    </Suspense>
  );
}
