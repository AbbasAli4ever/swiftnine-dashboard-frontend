"use client";

import NumberFlow from "@number-flow/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuChevronLeft,
  LuChevronRight,
  LuLandmark,
  LuPlus,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { parseApiError } from "@/lib/api";
import { useAccountingAccess } from "@/hooks/useAccountingAccess";
import { useAccountingOverview, useBankAccounts } from "@/hooks/useAccounting";
import {
  ACCOUNT_TYPES,
  CURRENCIES,
  type AccountType,
  type BankAccount,
  type BankAccountListParams,
  type Currency,
  type CurrencyTotal,
} from "@/services/accounting.service";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import { avatarColors, initials } from "@/components/accounts/avatar";
import { formatIsoDateTime, formatMoney } from "@/components/accounts/platformMeta";

const CARDS_PER_PAGE = 9;

const TYPE_LABELS: Record<AccountType, string> = {
  LOCAL: "Local Accounts",
  INTERNATIONAL: "International Accounts",
};

function formatCurrencyTotals(totals: CurrencyTotal[]): string {
  if (totals.length === 0) return "—";
  return totals.map((entry) => formatMoney(entry.currency, entry.total)).join(" · ");
}

/** Initials avatar — the API stores no logo or colour for bank accounts. */
function AccountLogo({ bankName }: { bankName: string }) {
  const { background, color } = avatarColors(bankName);
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: background, color }}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xs font-bold"
    >
      {initials(bankName)}
    </span>
  );
}

/**
 * Create/update form for a bank account. `PATCH /bank-accounts/:id` accepts any
 * field, so the same form serves both modes.
 */
function BankAccountModal({
  account,
  defaultAccountType,
  onClose,
  onSave,
}: {
  /** `null` creates a new account. */
  account: BankAccount | null;
  defaultAccountType: AccountType;
  onClose: () => void;
  onSave: (payload: {
    bankName: string;
    accountType: AccountType;
    currencyType: Currency;
    amount: number;
  }) => Promise<void>;
}) {
  const isEditing = account !== null;
  const [bankName, setBankName] = useState(account?.bankName ?? "");
  const [accountType, setAccountType] = useState<AccountType>(
    account?.accountType ?? defaultAccountType
  );
  const [currencyType, setCurrencyType] = useState<Currency>(
    account?.currencyType ?? "PKR"
  );
  const [amount, setAmount] = useState(String(account?.amount ?? 0));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = bankName.trim();
    const nextAmount = Number(amount);

    if (!name) {
      setError("Enter a bank name.");
      return;
    }
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      setError("Enter a valid balance of zero or more.");
      return;
    }

    setSaving(true);
    try {
      await onSave({ bankName: name, accountType, currencyType, amount: nextAmount });
    } catch (err) {
      setError(parseApiError(err).message || "Couldn't save the account.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bank-account-title"
    >
      <button
        type="button"
        aria-label="Close account form"
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <form
        onSubmit={submit}
        className="relative z-10 my-auto w-full max-w-[384px] rounded-[22px] bg-white p-6 shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-6 top-5 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <LuX className="h-4 w-4" />
        </button>
        <h2
          id="bank-account-title"
          className="pr-10 text-base font-semibold text-gray-800 dark:text-gray-100"
        >
          {isEditing ? "Update Account Balance" : "Add Bank Account"}
        </h2>

        <label className="mt-8 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Bank Name
          <input
            autoFocus={!isEditing}
            value={bankName}
            onChange={(event) => setBankName(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Account Type
            <AccountingSelect
              label="Account type"
              value={accountType}
              options={ACCOUNT_TYPES.map((type) => ({
                value: type,
                label: type === "LOCAL" ? "Local" : "International",
              }))}
              onChange={(next) => setAccountType(next as AccountType)}
            />
          </div>
          <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Currency
            <AccountingSelect
              label="Currency"
              value={currencyType}
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
              onChange={(next) => setCurrencyType(next as Currency)}
            />
          </div>
        </div>

        <label className="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-300">
          {isEditing ? "Current Balance" : "Opening Balance"}
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              {currencyType}
            </span>
            <input
              autoFocus={isEditing}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-12 pr-3 text-sm font-normal text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </label>

        {isEditing && (
          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-900">
            <p className="text-[11px] text-gray-400">Last Updated</p>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
              {formatIsoDateTime(account.updatedAt)}
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {error}
          </p>
        )}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-xl bg-[linear-gradient(90deg,#7357f6_0%,#7c2cf3_100%)] text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : isEditing ? "Update Balance" : "Add Account"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function AccountsBalancesView() {
  const { canWrite } = useAccountingAccess();
  const [accountType, setAccountType] = useState<AccountType>("LOCAL");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<BankAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // The summary comes from the dashboard aggregate rather than summing the
  // paginated list, so the totals match the Overview screen exactly.
  const { overview } = useAccountingOverview("daily");

  const params = useMemo<BankAccountListParams>(
    () => ({
      accountType,
      page,
      limit: CARDS_PER_PAGE,
      sortBy: "amount",
      sortOrder: "desc",
    }),
    [accountType, page]
  );

  const {
    bankAccounts,
    meta,
    isLoading,
    error,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
  } = useBankAccounts(params);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const local = overview?.balances.byAccountType.find((e) => e.accountType === "LOCAL") ?? null;
  const international =
    overview?.balances.byAccountType.find((e) => e.accountType === "INTERNATIONAL") ?? null;

  const total = meta?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * CARDS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * CARDS_PER_PAGE, total);

  const selectType = (type: AccountType) => {
    setAccountType(type);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteBankAccount(deleting.id);
      toast.success(`${deleting.bankName} deleted`);
      setDeleting(null);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't delete the account.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-[#FAFAFF] p-4 dark:bg-gray-907 sm:p-6">
      <section className="grid shrink-0 grid-cols-1 gap-4 rounded-xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-901 md:grid-cols-3">
        <div className="flex items-center gap-8 md:col-span-2">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Local Balance</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrencyTotals(local?.totals ?? [])}
            </p>
            <p className="mt-1 text-xs text-gray-400">{local?.accountCount ?? 0} accounts</p>
          </div>
          <div className="h-20 w-px shrink-0 bg-gray-200 dark:bg-gray-800" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">International Balance</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrencyTotals(international?.totals ?? [])}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {international?.accountCount ?? 0} accounts
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-black px-5 py-4 text-white">
          <p className="text-xs text-gray-300">Total Balance</p>
          <p className="mt-1 text-2xl font-semibold">
            <NumberFlow value={overview?.balances.totalBalanceUsd ?? 0} prefix="USD " />
          </p>
          <p className="mt-1 text-xs text-gray-400">Converted at fixed reference rates</p>
        </div>
      </section>

      <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit rounded-lg bg-gray-100 p-1 dark:bg-gray-905">
          {ACCOUNT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => selectType(type)}
              className={`rounded-md px-4 py-2 text-sm transition-all ${
                accountType === type
                  ? "bg-white font-medium text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#6547f7_0%,#7c2cf3_100%)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <LuPlus className="h-4 w-4" />
            Add Account
          </button>
        )}
      </div>

      {isLoading && bankAccounts.length === 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[178px] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800"
            />
          ))}
        </div>
      ) : bankAccounts.length === 0 ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-gray-100 bg-white py-16 dark:border-gray-800 dark:bg-gray-901">
          <LuLandmark className="mb-3 h-9 w-9 text-gray-300" />
          <p className="font-medium text-gray-700 dark:text-gray-300">
            No {accountType === "LOCAL" ? "local" : "international"} accounts
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {canWrite ? "Add an account to start tracking balances." : "Nothing to show yet."}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bankAccounts.map((account) => (
            <article
              key={account.id}
              className="flex min-h-[178px] flex-col rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-901"
            >
              <div className="flex items-center gap-3">
                <AccountLogo bankName={account.bankName} />
                <h2 className="flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {account.bankName}
                </h2>
                {canWrite && (
                  <button
                    type="button"
                    aria-label={`Delete ${account.bankName}`}
                    title={`Delete ${account.bankName}`}
                    onClick={() => setDeleting(account)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                  >
                    <LuTrash2 className="h-[17px] w-[17px]" />
                  </button>
                )}
              </div>
              <p className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {formatMoney(account.currencyType, account.amount)}
              </p>
              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <p className="truncate text-[11px] text-gray-400">
                  Last updated: {formatIsoDateTime(account.updatedAt)}
                </p>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => setEditing(account)}
                    className="shrink-0 text-xs font-medium text-brand-500 hover:text-brand-600"
                  >
                    Update
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between gap-3 py-3 text-sm text-gray-600 dark:text-gray-400">
        <span>
          {rangeStart}&ndash;{rangeEnd} of {total}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous accounts page"
            disabled={!meta?.has_prev}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-901 dark:hover:bg-gray-905"
          >
            <LuChevronLeft />
          </button>
          <button
            type="button"
            aria-label="Next accounts page"
            disabled={!meta?.has_next}
            onClick={() => setPage((current) => current + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-901 dark:hover:bg-gray-905"
          >
            <LuChevronRight />
          </button>
        </div>
      </div>

      {(editing || creating) && canWrite && (
        <BankAccountModal
          account={editing}
          defaultAccountType={accountType}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={async (payload) => {
            if (editing) {
              await updateBankAccount(editing.id, payload);
              toast.success("Balance updated");
            } else {
              await createBankAccount(payload);
              toast.success(`${payload.bankName} added`);
            }
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
      <ConfirmActionModal
        isOpen={Boolean(deleting)}
        title="Delete bank account?"
        description={
          deleting
            ? `${deleting.bankName} and its recorded balance will be permanently deleted.`
            : ""
        }
        confirmLabel="Delete account"
        isLoading={isDeleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
