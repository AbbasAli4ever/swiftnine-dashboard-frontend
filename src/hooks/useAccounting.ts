"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseApiError } from "@/lib/api";
import { ACCOUNTING_ROOT_KEY, queryKeys } from "@/queries/keys";
import { useAuthStore } from "@/stores/auth.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { workspaceService } from "@/services/workspace.service";
import {
  accountingDashboardService,
  bankAccountService,
  clientService,
  transactionService,
  type BankAccountListParams,
  type ClientListParams,
  type CreateBankAccountPayload,
  type CreateClientPayload,
  type CreateTransactionPayload,
  type OverviewPeriod,
  type TransactionListParams,
  type UpdateBankAccountPayload,
  type UpdateClientPayload,
  type UpdateTransactionPayload,
} from "@/services/accounting.service";

/**
 * Every accounting mutation invalidates the whole "accounting" key root: the
 * dashboard overview is derived from clients, transactions and bank accounts, so
 * changing any one of them can move numbers on the Overview screen.
 *
 * Mutations here follow the house convention (see useWorkspaceTags): plain async
 * callbacks, no useMutation, and they THROW — the calling component owns the toast.
 */
function useInvalidateAccounting() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: [ACCOUNTING_ROOT_KEY],
        // The role query shares this root but can't be changed by a data
        // mutation, so exclude it rather than refetching it every write.
        predicate: (query) => query.queryKey[1] !== "role",
      }),
    [queryClient]
  );
}

/**
 * The backend gates all four accounting controllers with
 * `@RequireUserRole('CEO','ACCOUNTANT')`, so a user whose role was revoked
 * mid-session still passes the client-side guard (their cached `role` is stale)
 * but gets 403 on every request. Surface that as a permission message rather
 * than a bare "Forbidden".
 */
export const ACCOUNTING_FORBIDDEN_MESSAGE =
  "You no longer have access to accounting. Please sign in again.";

function toAccountingError(error: unknown): string | null {
  if (!error) return null;
  const { message, code } = parseApiError(error);
  return code === "FORBIDDEN" ? ACCOUNTING_FORBIDDEN_MESSAGE : message;
}

/** Never retry a permission denial — the answer won't change. */
const ACCOUNTING_RETRY = (failureCount: number, error: unknown) =>
  parseApiError(error).code === "FORBIDDEN" ? false : failureCount < 1;

/**
 * Every accounting request needs both a token and an `x-workspace-id` header
 * (attached by the axios interceptor from the active workspace). Without an
 * active workspace the header is absent and `WorkspaceGuard` 403s, so gate the
 * queries rather than firing requests that can't succeed.
 */
function useAccountingQueryGate() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return { workspaceId, isReady: !!accessToken && !!workspaceId };
}

/**
 * The caller's accounting role in the active workspace. Accounting access moved
 * off `User.role` onto `WorkspaceMember.accountingRole`, so it's per-workspace
 * and only discoverable via `GET /workspaces/:id`. Probing endpoints can't
 * substitute — the backend returns an identical bare 403 for a null role and a
 * merely-insufficient one.
 */
export function useAccountingRole() {
  const { workspaceId, isReady } = useAccountingQueryGate();

  const query = useQuery({
    queryKey: queryKeys.accountingRole(workspaceId),
    queryFn: () => workspaceService.getWorkspace(workspaceId!),
    enabled: isReady,
    staleTime: 5 * 60_000,
    // A 403 here means "not a member of this workspace", which is a real answer
    // rather than a transient failure.
    retry: ACCOUNTING_RETRY,
  });

  return {
    accountingRole: query.data?.accountingRole ?? null,
    workspaceRole: query.data?.role ?? null,
    // Treat "no workspace yet" as loading: the answer is genuinely unknown, and
    // reporting "no access" would flash the accounting UI away mid-restore.
    isLoading: query.isLoading || !isReady,
  };
}

// ── Dashboard overview ────────────────────────────────────────────────────────

export function useAccountingOverview(period: OverviewPeriod = "daily") {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingOverview(workspaceId, period),
    [workspaceId, period]
  );

  const query = useQuery({
    queryKey,
    queryFn: () => accountingDashboardService.overview(period),
    enabled: isReady,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
    // Each period is its own cache entry, so switching to one that hasn't been
    // fetched yet would otherwise blank `data` and tear the whole screen down.
    // Keeping the previous period's response on screen makes the toggle swap
    // just the chart once the new data lands.
    placeholderData: (previous) => previous,
  });

  return {
    overview: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
}

/**
 * Global accounting search backing the header search bar on /accounts routes.
 * Returns up to 5 clients and 5 transactions; not paginated.
 */
export function useDashboardSearch(term: string, debounceMs = 300) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), debounceMs);
    return () => clearTimeout(timer);
  }, [term, debounceMs]);

  // The API caps `q` at 200 chars and rejects anything longer.
  const trimmed = debounced.trim().slice(0, 200);

  const query = useQuery({
    queryKey: queryKeys.accountingDashboardSearch(workspaceId, trimmed),
    queryFn: () => accountingDashboardService.search(trimmed),
    enabled: isReady && trimmed.length > 0,
    staleTime: 30_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    clients: query.data?.clients ?? [],
    transactions: query.data?.transactions ?? [],
    // Treat the debounce gap as loading so the panel doesn't flash "no results"
    // between a keystroke and the request going out.
    isLoading: query.isFetching || (trimmed.length > 0 && debounced !== term),
    error: toAccountingError(query.error),
  };
}

// ── Mutations without a list subscription ─────────────────────────────────────
// Modals that only write (Add Sale, Add Client) use these so they don't fire a
// throwaway list request just to reach a mutation callback.

export function useClientMutations() {
  const invalidateAccounting = useInvalidateAccounting();

  const createClient = useCallback(
    async (payload: CreateClientPayload) => {
      const created = await clientService.create(payload);
      await invalidateAccounting();
      return created;
    },
    [invalidateAccounting]
  );

  const renameClient = useCallback(
    async (clientId: string, payload: UpdateClientPayload) => {
      const updated = await clientService.update(clientId, payload);
      await invalidateAccounting();
      return updated;
    },
    [invalidateAccounting]
  );

  const deleteClient = useCallback(
    async (clientId: string) => {
      await clientService.delete(clientId);
      await invalidateAccounting();
    },
    [invalidateAccounting]
  );

  return { createClient, renameClient, deleteClient };
}

export function useTransactionMutations() {
  const invalidateAccounting = useInvalidateAccounting();

  const createTransaction = useCallback(
    async (payload: CreateTransactionPayload) => {
      const created = await transactionService.create(payload);
      await invalidateAccounting();
      return created;
    },
    [invalidateAccounting]
  );

  const updateTransaction = useCallback(
    async (transactionId: string, payload: UpdateTransactionPayload) => {
      const updated = await transactionService.update(transactionId, payload);
      await invalidateAccounting();
      return updated;
    },
    [invalidateAccounting]
  );

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      await transactionService.delete(transactionId);
      await invalidateAccounting();
    },
    [invalidateAccounting]
  );

  return { createTransaction, updateTransaction, deleteTransaction };
}

export function useBankAccountMutations() {
  const invalidateAccounting = useInvalidateAccounting();

  const createBankAccount = useCallback(
    async (payload: CreateBankAccountPayload) => {
      const created = await bankAccountService.create(payload);
      await invalidateAccounting();
      return created;
    },
    [invalidateAccounting]
  );

  const updateBankAccount = useCallback(
    async (bankAccountId: string, payload: UpdateBankAccountPayload) => {
      const updated = await bankAccountService.update(bankAccountId, payload);
      await invalidateAccounting();
      return updated;
    },
    [invalidateAccounting]
  );

  const deleteBankAccount = useCallback(
    async (bankAccountId: string) => {
      await bankAccountService.delete(bankAccountId);
      await invalidateAccounting();
    },
    [invalidateAccounting]
  );

  return { createBankAccount, updateBankAccount, deleteBankAccount };
}

// ── Clients ───────────────────────────────────────────────────────────────────

export function useAccountingClients(params: ClientListParams) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingClients(workspaceId, params),
    [workspaceId, params]
  );
  const { createClient, renameClient, deleteClient } = useClientMutations();

  const query = useQuery({
    queryKey,
    queryFn: () => clientService.list(params),
    enabled: isReady,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    clients: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
    createClient,
    renameClient,
    deleteClient,
  };
}

export function useAccountingClient(clientId: string | null) {
  const { workspaceId, isReady } = useAccountingQueryGate();

  const query = useQuery({
    queryKey: queryKeys.accountingClient(workspaceId, clientId ?? ""),
    queryFn: () => clientService.get(clientId!),
    enabled: isReady && !!clientId,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    client: query.data ?? null,
    isLoading: query.isLoading,
    error: toAccountingError(query.error),
  };
}

/**
 * Debounced client lookup for the transaction client picker. `POST /transactions`
 * requires a resolved clientId, so this is the only way to attach a sale.
 */
export function useClientSearch(term: string, debounceMs = 300) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), debounceMs);
    return () => clearTimeout(timer);
  }, [term, debounceMs]);

  const trimmed = debounced.trim();

  const query = useQuery({
    queryKey: queryKeys.accountingClientSearch(workspaceId, trimmed),
    queryFn: () => clientService.search(trimmed),
    enabled: isReady && trimmed.length > 0,
    staleTime: 30_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    results: query.data ?? [],
    // Treat the debounce gap as loading so the dropdown doesn't flash "no
    // results" between a keystroke and the request going out.
    isLoading: query.isFetching || (trimmed.length > 0 && debounced !== term),
    error: toAccountingError(query.error),
  };
}

// ── Transactions ──────────────────────────────────────────────────────────────

export function useAccountingTransactions(params: TransactionListParams) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingTransactions(workspaceId, params),
    [workspaceId, params]
  );
  const { createTransaction, updateTransaction, deleteTransaction } =
    useTransactionMutations();

  const query = useQuery({
    queryKey,
    queryFn: () => transactionService.list(params),
    enabled: isReady,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    transactions: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}

// ── Bank accounts ─────────────────────────────────────────────────────────────

export function useBankAccounts(params: BankAccountListParams) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingBankAccounts(workspaceId, params),
    [workspaceId, params]
  );
  const { createBankAccount, updateBankAccount, deleteBankAccount } =
    useBankAccountMutations();

  const query = useQuery({
    queryKey,
    queryFn: () => bankAccountService.list(params),
    enabled: isReady,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    bankAccounts: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
  };
}
