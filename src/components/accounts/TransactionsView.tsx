"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuCalendarDays,
  LuChevronLeft,
  LuChevronRight,
  LuCoins,
  LuDatabase,
  LuPencil,
  LuSearch,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { parseApiError } from "@/lib/api";
import { useAccountingAccess } from "@/hooks/useAccountingAccess";
import { useAccountingTransactions } from "@/hooks/useAccounting";
import {
  CURRENCIES,
  type AccountingTransaction,
  type BankAccount,
  type ClientSearchResult,
  type Currency,
  type TransactionListParams,
} from "@/services/accounting.service";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import ClientPicker from "@/components/accounts/ClientPicker";
import BankAccountPicker from "@/components/accounts/BankAccountPicker";
import BankAvatar from "@/components/accounts/BankAvatar";
import {
  DateDropdown,
  FilterDropdown,
  type DatePreset,
} from "@/components/accounts/accountingFilters";
import {
  formatIsoDate,
  formatMoney,
  fromDateInputValue,
  toDateInputValue,
} from "@/components/accounts/platformMeta";

// Layout constants used to derive how many rows fit in the available space.
// They must stay in sync with the markup below: the row height, the sticky
// column header, the card's title bar + borders, and the pagination row that
// sits inside the sizer beneath the card.
const ROW_HEIGHT = 56;
const TABLE_HEADER_HEIGHT = 40;
const CARD_TITLE_BAR_HEIGHT = 48;
const CARD_BORDER_HEIGHT = 2;
const PAGINATION_ROW_HEIGHT = 44;

/**
 * Full patch form for a transaction. `PATCH /transactions/:id` accepts every
 * field, so unlike the mock version this edits more than amount + currency.
 */
function EditTransactionModal({
  transaction,
  onClose,
  onSave,
}: {
  transaction: AccountingTransaction;
  onClose: () => void;
  onSave: (
    id: string,
    payload: {
      clientId?: string;
      clientName?: string;
      saleAmount?: number;
      currency?: Currency;
      bankAccountId?: string;
      saleDate?: string;
      description?: string;
    }
  ) => Promise<void>;
}) {
  const [client, setClient] = useState<ClientSearchResult | null>(null);
  const [amount, setAmount] = useState(String(transaction.saleAmount));
  const [saleDate, setSaleDate] = useState(() =>
    toDateInputValue(transaction.saleDate)
  );
  const [currency, setCurrency] = useState<Currency>(transaction.currency);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [description, setDescription] = useState(transaction.description ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextAmount = Number(amount);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      setError("Enter an amount of zero or more.");
      return;
    }

    setSaving(true);
    try {
      await onSave(transaction.id, {
        // Reassigning the client does NOT refresh the denormalized clientName
        // server-side, so send both whenever the client changes.
        ...(client && client.id !== transaction.clientId
          ? { clientId: client.id, clientName: client.clientName }
          : {}),
        saleAmount: nextAmount,
        // Reassigning the bank account also moves the currency: the API rejects
        // a transaction whose currency differs from its account's.
        ...(bankAccount
          ? { bankAccountId: bankAccount.id, currency: bankAccount.currencyType }
          : { currency }),
        saleDate: fromDateInputValue(saleDate),
        description: description.trim(),
      });
    } catch (err) {
      setError(parseApiError(err).message || "Couldn't update the transaction.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-transaction-title"
    >
      <button
        type="button"
        aria-label="Close edit transaction"
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <form
        onSubmit={submit}
        className="relative z-10 my-auto w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950"
      >
        <h2
          id="edit-transaction-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          Edit Transaction
        </h2>
        <p className="mt-1 text-xs text-gray-400">Ref {transaction.refId}</p>

        <div className="mt-5">
          <ClientPicker
            label="Reassign Client (optional)"
            placeholder={transaction.clientName}
            value={client}
            onChange={setClient}
          />
        </div>

        <div className="mt-3">
          <BankAccountPicker
            label="Move to Bank Account (optional)"
            value={bankAccount}
            onChange={(next) => {
              setBankAccount(next);
              if (next) setCurrency(next.currencyType);
            }}
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Currently {transaction.bankAccount?.bankName ?? "—"}. Moving it
            reverses the old balance effect and applies it to the new account.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Currency
            <AccountingSelect
              label="Currency"
              value={currency}
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
              onChange={(next) => setCurrency(next as Currency)}
              // Locked while a new account is selected — its currency wins.
              disabled={!!bankAccount}
            />
            {bankAccount && (
              <span className="mt-1 block text-[11px] font-normal text-gray-400">
                Set by {bankAccount.bankName}
              </span>
            )}
          </div>
        </div>

        <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Sale Date
          <div className="relative mt-1.5">
            <input
              type="date"
              value={saleDate}
              onChange={(event) => setSaleDate(event.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pr-9 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <LuCalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600 dark:text-gray-400" />
          </div>
        </label>

        <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1.5 h-16 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {error}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-[linear-gradient(90deg,#6547f7_0%,#5431ed_100%)] text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function TransactionsView() {
  const { canWrite } = useAccountingAccess();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<AccountingTransaction | null>(null);
  const [deleting, setDeleting] = useState<AccountingTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const tableSizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Measures the space the table *could* occupy to derive the page size (and so
  // the max-height cap). The card itself shrinks to fit however many rows the
  // current page actually has — this only sets the ceiling.
  useEffect(() => {
    const sizer = tableSizerRef.current;
    if (!sizer) return;

    const updateAutomaticPageSize = () => {
      // Space left for rows = the sizer minus everything in it that isn't a row.
      const available =
        sizer.clientHeight -
        CARD_TITLE_BAR_HEIGHT -
        CARD_BORDER_HEIGHT -
        PAGINATION_ROW_HEIGHT -
        TABLE_HEADER_HEIGHT;
      const nextSize = Math.max(1, Math.floor(available / ROW_HEIGHT));
      setPageSize((current) => (current === nextSize ? current : nextSize));
    };

    const observer = new ResizeObserver(updateAutomaticPageSize);
    observer.observe(sizer);
    return () => observer.disconnect();
  }, []);

  // A relative preset resolves to concrete dates; the API expands a bare
  // YYYY-MM-DD to UTC day boundaries on `saleDate`.
  const dateRange = useMemo(() => {
    if (datePreset === "custom") {
      return { from: dateFrom || undefined, to: dateTo || undefined };
    }
    if (datePreset === "7" || datePreset === "30") {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - (Number(datePreset) - 1));
      return { from: start.toISOString().slice(0, 10), to: undefined };
    }
    return { from: undefined, to: undefined };
  }, [datePreset, dateFrom, dateTo]);

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, currencies, pageSize, dateRange]);

  const params = useMemo<TransactionListParams>(
    () => ({
      q: debouncedSearch.trim() || undefined,
      page,
      limit: pageSize,
      currency: currencies.length ? currencies : undefined,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      // Order by when the sale happened, not when the row was inserted — a
      // backdated entry belongs in its historical position.
      sortBy: "saleDate",
      sortOrder: "desc",
    }),
    [debouncedSearch, page, pageSize, currencies, dateRange]
  );

  const {
    transactions,
    meta,
    isLoading,
    error,
    updateTransaction,
    deleteTransaction,
  } = useAccountingTransactions(params);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const activeFilterCount =
    currencies.length +
    (debouncedSearch.trim() ? 1 : 0) +
    (datePreset === "all" ? 0 : 1);

  const clearFilters = () => {
    setSearch("");
    setCurrencies([]);
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const total = meta?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(deleting.id);
      toast.success("Transaction deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't delete the transaction.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#fafaff] px-4 py-3 dark:bg-gray-907 sm:px-6">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-end gap-2">
        <div className="relative w-full sm:w-[240px]">
          <LuSearch
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search client or ref ID..."
            aria-label="Search transactions"
            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-800 shadow-sm outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-901 dark:text-gray-100"
          />
        </div>
        <DateDropdown
          preset={datePreset}
          from={dateFrom}
          to={dateTo}
          onChange={(preset, from = "", to = "") => {
            setDatePreset(preset);
            setDateFrom(from);
            setDateTo(to);
          }}
        />
        <FilterDropdown
          label="Currency"
          icon={<LuCoins />}
          values={CURRENCIES}
          selected={currencies}
          onChange={setCurrencies}
        />
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex h-10 items-center gap-1 rounded-xl px-3 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-905 dark:hover:text-gray-100"
          >
            <LuX className="h-4 w-4" /> Clear all
          </button>
        )}
      </div>

      {/* Sizer: claims the leftover vertical space so the ResizeObserver can
          measure it, but renders nothing itself. The card inside sizes to its
          rows and only scrolls once it hits the sizer's height. */}
      <div ref={tableSizerRef} className="flex min-h-0 flex-1 flex-col">
      <section className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-901">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-5 dark:border-gray-800">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            All Transactions
          </h1>
          <span className="text-xs text-gray-400">
            Showing {transactions.length} of {total.toLocaleString()} records
          </span>
        </div>
        <div className="min-h-0 overflow-auto">
          <table className="w-full min-w-[900px] table-fixed text-left">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--color-gray-200)] dark:bg-gray-901 dark:shadow-[0_1px_0_0_var(--color-gray-800)]">
              <tr className="h-10 text-xs font-normal text-gray-400">
                <th className="w-[11%] px-5 font-normal">Sale Date</th>
                <th className="w-[24%] px-5 font-normal">Client</th>
                <th className="w-[22%] px-5 font-normal">Bank Account</th>
                <th className="w-[12%] px-5 font-normal">Ref ID</th>
                <th className="w-[15%] px-5 text-right font-normal">Amount</th>
                {canWrite && <th className="w-[9%] px-5 text-right font-normal">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  style={{ height: ROW_HEIGHT }}
                  className="text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-905/70"
                >
                  <td
                    className="px-5 text-xs whitespace-nowrap"
                    title={`Entered ${formatIsoDate(transaction.createdAt)}`}
                  >
                    {formatIsoDate(transaction.saleDate)}
                  </td>
                  <td className="truncate px-5">{transaction.clientName}</td>
                  <td className="px-5">
                    <div className="flex items-center gap-3">
                      <BankAvatar
                        bankName={transaction.bankAccount?.bankName ?? "?"}
                        logoUrl={transaction.bankAccount?.logoUrl}
                      />
                      <span className="truncate">
                        {transaction.bankAccount?.bankName ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td className="truncate px-5 text-xs text-gray-500 dark:text-gray-400">
                    {transaction.refId}
                  </td>
                  <td className="px-5 text-right font-medium whitespace-nowrap">
                    {formatMoney(transaction.currency, transaction.saleAmount)}
                  </td>
                  {canWrite && (
                    <td className="px-5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title={`Delete ${transaction.refId}`}
                          aria-label={`Delete transaction ${transaction.refId}`}
                          onClick={() => setDeleting(transaction)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                        >
                          <LuTrash2 className="h-[19px] w-[19px]" />
                        </button>
                        <button
                          type="button"
                          title={`Edit ${transaction.refId}`}
                          aria-label={`Edit transaction ${transaction.refId}`}
                          onClick={() => setEditing(transaction)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-brand-500/10 hover:text-brand-500"
                        >
                          <LuPencil className="h-[19px] w-[19px]" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {isLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 6 : 5} className="p-5">
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-9 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 6 : 5} className="h-64 px-6 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <LuDatabase className="mb-3 h-9 w-9 text-gray-300" />
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        No transactions found
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        {activeFilterCount > 0
                          ? "Try changing or clearing your filters."
                          : "Recorded sales will appear here."}
                      </p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-4 text-sm font-medium text-brand-500 hover:text-brand-600"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Inside the sizer and directly after the card, so it tracks the card's
          bottom edge instead of being pinned to the bottom of the page. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pt-3 text-sm text-gray-600 dark:text-gray-400">
        <span>
          {rangeStart.toLocaleString()}&ndash;{rangeEnd.toLocaleString()} of{" "}
          {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous page"
            disabled={!meta?.has_prev}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-901 dark:hover:bg-gray-905"
          >
            <LuChevronLeft />
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={!meta?.has_next}
            onClick={() => setPage((current) => current + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-901 dark:hover:bg-gray-905"
          >
            <LuChevronRight />
          </button>
        </div>
      </div>
      </div>

      {editing && canWrite && (
        <EditTransactionModal
          transaction={editing}
          onClose={() => setEditing(null)}
          onSave={async (id, payload) => {
            await updateTransaction(id, payload);
            toast.success("Transaction updated");
            setEditing(null);
          }}
        />
      )}
      <ConfirmActionModal
        isOpen={canWrite && Boolean(deleting)}
        title="Delete transaction?"
        description={
          deleting
            ? `${deleting.refId} for ${deleting.clientName} will be permanently deleted.`
            : ""
        }
        confirmLabel="Delete transaction"
        isLoading={isDeleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
