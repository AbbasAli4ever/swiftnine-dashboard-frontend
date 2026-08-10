"use client";

import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/stores/auth.store";

export interface AccountingAccess {
  role: UserRole | null;
  /** CEO and ACCOUNTANT may open the accounting area; `null` role may not. */
  canAccessAccounting: boolean;
  /** Only ACCOUNTANT may create/edit/delete accounting records. */
  canWrite: boolean;
  /** Both roles read every accounting page; only the write controls differ. */
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
 * Mirrors the backend guards: all four accounting controllers are
 * `@RequireUserRole('CEO','ACCOUNTANT')` at class level (both roles can read),
 * with every POST/PATCH/DELETE overridden to `@RequireUserRole('ACCOUNTANT')`.
 * So a CEO is read-only and a `null` role gets 403 everywhere — this hook hides
 * what the server would reject anyway.
 */
export function useAccountingAccess(): AccountingAccess {
  const { role, isAccountant, isCeo, isLoading } = useAuth();
  const canAccessAccounting = isAccountant || isCeo;

  return {
    role,
    canAccessAccounting,
    canWrite: isAccountant,
    canSeeAllMenus: canAccessAccounting,
    isAccountant,
    isCeo,
    isLoading,
  };
}
