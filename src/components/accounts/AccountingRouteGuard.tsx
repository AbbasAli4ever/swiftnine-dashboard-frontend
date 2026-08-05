"use client";

import { useAccountingAccess } from "@/hooks/useAccountingAccess";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Gates the `/accounts` area by role:
 *
 * - `null` role  → no accounting access at all; toast + bounce to /university.
 * - `CEO`        → Overview (`/accounts`) only; deeper routes bounce back to it.
 * - `ACCOUNTANT` → full access.
 *
 * Client-side only, matching how the rest of the app guards routes (middleware.ts
 * deliberately defers auth to the client). The backend enforces no role checks on
 * the accounting endpoints, so this is UX gating rather than security.
 */
export default function AccountingRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { canAccessAccounting, canSeeAllMenus, isLoading } = useAccountingAccess();
  const router = useRouter();
  const pathname = usePathname();

  // The redirect below runs on a path change too, so without this the toast
  // would fire again on every navigation while the redirect settles.
  const hasWarned = useRef(false);

  const isOverview = pathname === "/accounts";
  const deniedEntirely = !isLoading && !canAccessAccounting;
  const deniedSubRoute = !isLoading && canAccessAccounting && !canSeeAllMenus && !isOverview;

  useEffect(() => {
    if (isLoading) return;

    if (deniedEntirely) {
      if (!hasWarned.current) {
        hasWarned.current = true;
        toast.error("You don't have access to the accounts portal.");
      }
      router.replace("/university");
      return;
    }

    // CEO landed on a sub-route (typed URL or stale bookmark) — send them to
    // the only accounting page they're allowed to see.
    if (deniedSubRoute) {
      router.replace("/accounts");
    }
  }, [isLoading, deniedEntirely, deniedSubRoute, router]);

  // Never flash protected content while the redirect is in flight.
  if (isLoading || deniedEntirely || deniedSubRoute) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center bg-[#FAFAFF] dark:bg-gray-907">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
