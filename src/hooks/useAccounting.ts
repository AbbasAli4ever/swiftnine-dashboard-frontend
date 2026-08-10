"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseApiError } from "@/lib/api";
import { ACCOUNTING_ROOT_KEY, queryKeys } from "@/queries/keys";
import { useAuthStore } from "@/stores/auth.store";
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
    () => queryClient.invalidateQueries({ queryKey: [ACCOUNTING_ROOT_KEY] }),
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

// ── Dashboard overview ────────────────────────────────────────────────────────

export function useAccountingOverview(period: OverviewPeriod = "daily") {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.accountingOverview(period), [period]);

  const query = useQuery({
    queryKey,
    queryFn: () => accountingDashboardService.overview(period),
    enabled: !!accessToken,
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
  const accessToken = useAuthStore((s) => s.accessToken);
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), debounceMs);
    return () => clearTimeout(timer);
  }, [term, debounceMs]);

  // The API caps `q` at 200 chars and rejects anything longer.
  const trimmed = debounced.trim().slice(0, 200);

  const query = useQuery({
    queryKey: queryKeys.accountingDashboardSearch(trimmed),
    queryFn: () => accountingDashboardService.search(trimmed),
    enabled: !!accessToken && trimmed.length > 0,
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
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.accountingClients(params), [params]);
  const { createClient, renameClient, deleteClient } = useClientMutations();

  const query = useQuery({
    queryKey,
    queryFn: () => clientService.list(params),
    enabled: !!accessToken,
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
  const accessToken = useAuthStore((s) => s.accessToken);

  const query = useQuery({
    queryKey: queryKeys.accountingClient(clientId ?? ""),
    queryFn: () => clientService.get(clientId!),
    enabled: !!accessToken && !!clientId,
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
  const accessToken = useAuthStore((s) => s.accessToken);
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), debounceMs);
    return () => clearTimeout(timer);
  }, [term, debounceMs]);

  const trimmed = debounced.trim();

  const query = useQuery({
    queryKey: queryKeys.accountingClientSearch(trimmed),
    queryFn: () => clientService.search(trimmed),
    enabled: !!accessToken && trimmed.length > 0,
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
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingTransactions(params),
    [params]
  );
  const { createTransaction, updateTransaction, deleteTransaction } =
    useTransactionMutations();

  const query = useQuery({
    queryKey,
    queryFn: () => transactionService.list(params),
    enabled: !!accessToken,
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
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingBankAccounts(params),
    [params]
  );
  const { createBankAccount, updateBankAccount, deleteBankAccount } =
    useBankAccountMutations();

  const query = useQuery({
    queryKey,
    queryFn: () => bankAccountService.list(params),
    enabled: !!accessToken,
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
