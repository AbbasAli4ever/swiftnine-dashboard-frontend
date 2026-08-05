"use client";

import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/stores/auth.store";

export interface AccountingAccess {
  role: UserRole | null;
  /** CEO and ACCOUNTANT may open the accounting area; `null` role may not. */
  canAccessAccounting: boolean;
  /** Only ACCOUNTANT may create/edit/delete accounting records. */
  canWrite: boolean;
  /** CEO sees Overview only; ACCOUNTANT sees every accounting menu. */
  canSeeAllMenus: boolean;
  isAccountant: boolean;
  isCeo: boolean;
  /** true while the session restore is in flight — guards must wait on this. */
  isLoading: boolean;
}

/**
 * Single source of truth for accounting role gating so no component re-derives
 * it from `user.role` directly.
 *
 * Note: the backend has no role guard on `/clients`, `/transactions`,
 * `/bank-accounts`, or `/accounting-dashboard` — any authenticated user can
 * call them. Everything here is UX gating, not security.
 */
export function useAccountingAccess(): AccountingAccess {
  const { role, isAccountant, isCeo, isLoading } = useAuth();

  return {
    role,
    canAccessAccounting: isAccountant || isCeo,
    canWrite: isAccountant,
    canSeeAllMenus: isAccountant,
    isAccountant,
    isCeo,
    isLoading,
  };
}
