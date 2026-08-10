"use client";

import Image from "next/image";
import NumberFlow from "@number-flow/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuChevronLeft,
  LuChevronRight,
  LuLandmark,
  LuPencil,
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
  LOGO_MAX_BYTES,
  LOGO_MIME_TYPES,
  bankAccountService,
  type AccountType,
  type BankAccount,
  type BankAccountListParams,
  type Currency,
  type CurrencyTotal,
} from "@/services/accounting.service";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import { avatarColors, initials } from "@/components/accounts/avatar";
import { formatIsoDateTime, formatMoney } from "@/components/accounts/platformMeta";

// Layout constants used to derive how many rows fit in the available space.
// They must stay in sync with the markup below: the row height, the sticky
// column header, the card's title bar + borders, and the pagination row that
// sits inside the sizer beneath the card.
const ROW_HEIGHT = 55;
const TABLE_HEADER_HEIGHT = 40;
const CARD_TITLE_BAR_HEIGHT = 48;
const CARD_BORDER_HEIGHT = 2;
const PAGINATION_ROW_HEIGHT = 44;

const TYPE_LABELS: Record<AccountType, string> = {
  LOCAL: "Local Accounts",
  INTERNATIONAL: "International Accounts",
};

function formatCurrencyTotals(totals: CurrencyTotal[]): string {
  if (totals.length === 0) return "—";
  return totals.map((entry) => formatMoney(entry.currency, entry.total)).join(" · ");
}

/** Uploaded logo when present, deterministic initials avatar otherwise. */
function AccountLogo({
  bankName,
  logoUrl,
  size = 48,
}: {
  bankName: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const { background, color } = avatarColors(bankName);

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full bg-white object-contain"
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, backgroundColor: background, color }}
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold"
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
    /** `null` means "no logo picked" — the caller omits it from the request,
     *  since the API rejects a null logoUrl and can't clear a saved one. */
    logoUrl: string | null;
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

  // Logo: `logoUrl` is the saved/uploaded permanent URL; `logoPreview` is a
  // local object URL shown immediately after picking, before upload finishes.
  const [logoUrl, setLogoUrl] = useState<string | null>(account?.logoUrl ?? null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URLs leak until revoked.
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setError("");

    if (!LOGO_MIME_TYPES.includes(file.type as (typeof LOGO_MIME_TYPES)[number])) {
      setError("Logo must be a PNG, JPEG, SVG or WebP image.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError("Logo must be 2MB or smaller.");
      return;
    }

    // Show the picked image straight away; the upload runs behind it.
    const preview = URL.createObjectURL(file);
    setLogoPreview(preview);
    setUploadingLogo(true);
    try {
      setLogoUrl(await bankAccountService.uploadLogo(file));
    } catch (err) {
      setError(parseApiError(err).message || "Couldn't upload the logo.");
      URL.revokeObjectURL(preview);
      setLogoPreview(null);
    } finally {
      setUploadingLogo(false);
      // Allow re-picking the same file after a failure.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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

    if (uploadingLogo) {
      setError("Wait for the logo upload to finish.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        bankName: name,
        accountType,
        currencyType,
        amount: nextAmount,
        logoUrl,
      });
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

        <div className="mt-8 flex items-center gap-4">
          <AccountLogo
            bankName={bankName || "?"}
            logoUrl={logoPreview ?? logoUrl}
            size={56}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Logo</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={uploadingLogo}
                onClick={() => fileInputRef.current?.click()}
                className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {uploadingLogo
                  ? "Uploading..."
                  : logoPreview || logoUrl
                    ? "Replace"
                    : "Upload logo"}
              </button>
              {/* Only offers to discard a logo picked in this session. A saved
                  logo can't be cleared — the API rejects a null logoUrl — so
                  showing Remove for one would silently do nothing. */}
              {logoPreview && !uploadingLogo && (
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(logoPreview);
                    setLogoPreview(null);
                    setLogoUrl(account?.logoUrl ?? null);
                  }}
                  className="h-8 rounded-lg px-2 text-xs text-gray-500 hover:text-red-500"
                >
                  Discard
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-400">PNG, JPEG, SVG or WebP · max 2MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={LOGO_MIME_TYPES.join(",")}
            className="hidden"
            onChange={(event) => void pickLogo(event.target.files?.[0])}
          />
        </div>

        <label className="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-300">
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
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<BankAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const tableSizerRef = useRef<HTMLDivElement>(null);
  const titleBarRef = useRef<HTMLDivElement>(null);
  const paginationRef = useRef<HTMLDivElement>(null);

  // The summary comes from the dashboard aggregate rather than summing the
  // paginated list, so the totals match the Overview screen exactly.
  const { overview } = useAccountingOverview("daily");

  // Derives the page size from the space actually left for rows. Rather than
  // subtracting hardcoded chrome offsets — which overestimate here, since this
  // page has a tall summary card and tab row above the table — measure the two
  // real non-row elements inside the sizer: the card's title bar and the
  // pagination row beneath it.
  useEffect(() => {
    const sizer = tableSizerRef.current;
    if (!sizer) return;

    const updatePageSize = () => {
      const chrome =
        (titleBarRef.current?.offsetHeight ?? CARD_TITLE_BAR_HEIGHT) +
        (paginationRef.current?.offsetHeight ?? PAGINATION_ROW_HEIGHT) +
        CARD_BORDER_HEIGHT +
        TABLE_HEADER_HEIGHT;
      const nextSize = Math.max(
        1,
        Math.floor((sizer.clientHeight - chrome) / ROW_HEIGHT)
      );
      setPageSize((current) => (current === nextSize ? current : nextSize));
    };

    const observer = new ResizeObserver(updatePageSize);
    observer.observe(sizer);
    // Watch the measured chrome too — the pagination row wraps on narrow
    // widths, which changes its height and so the row count.
    if (titleBarRef.current) observer.observe(titleBarRef.current);
    if (paginationRef.current) observer.observe(paginationRef.current);
    return () => observer.disconnect();
  }, []);

  // Switching tab or resizing invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [accountType, pageSize]);

  const params = useMemo<BankAccountListParams>(
    () => ({
      accountType,
      page,
      limit: pageSize,
      sortBy: "amount",
      sortOrder: "desc",
    }),
    [accountType, page, pageSize]
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
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const columnCount = canWrite ? 5 : 4;

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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#FAFAFF] px-4 py-3 dark:bg-gray-907 sm:px-6">
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

      {/* Sizer: claims the leftover vertical space so the ResizeObserver can
          measure it, but renders nothing itself. The card inside sizes to its
          rows and only scrolls once it hits the sizer's height. */}
      <div ref={tableSizerRef} className="mt-4 flex min-h-0 flex-1 flex-col">
      <section className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-901">
        <div
          ref={titleBarRef}
          className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-5 dark:border-gray-800"
        >
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {TYPE_LABELS[accountType]}
          </h1>
          <span className="text-xs text-gray-400">
            {total.toLocaleString()} accounts
          </span>
        </div>

        <div className="min-h-0 overflow-auto">
          <table className="w-full min-w-[720px] table-fixed text-left">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--color-gray-200)] dark:bg-gray-901 dark:shadow-[0_1px_0_0_var(--color-gray-800)]">
              <tr className="h-10 text-xs font-normal text-gray-400">
                <th className="w-[38%] px-5 font-normal">Bank</th>
                <th className="w-[14%] px-5 font-normal">Currency</th>
                <th className="w-[22%] px-5 text-right font-normal">Balance</th>
                <th className="w-[26%] px-5 text-right font-normal">Last Updated</th>
                {canWrite && <th className="w-[12%] px-5 text-right font-normal">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {bankAccounts.map((account) => (
                <tr
                  key={account.id}
                  style={{ height: ROW_HEIGHT }}
                  className="text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-905/70"
                >
                  <td className="px-5">
                    <div className="flex items-center gap-3">
                      <AccountLogo
                        bankName={account.bankName}
                        logoUrl={account.logoUrl}
                        size={32}
                      />
                      <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                        {account.bankName}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 text-xs">{account.currencyType}</td>
                  <td className="px-5 text-right font-medium whitespace-nowrap">
                    {formatMoney(account.currencyType, account.amount)}
                  </td>
                  <td className="px-5 text-right text-xs text-gray-500 whitespace-nowrap dark:text-gray-400">
                    {formatIsoDateTime(account.updatedAt)}
                  </td>
                  {canWrite && (
                    <td className="px-5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          aria-label={`Delete ${account.bankName}`}
                          title={`Delete ${account.bankName}`}
                          onClick={() => setDeleting(account)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                        >
                          <LuTrash2 className="h-[19px] w-[19px]" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Update ${account.bankName}`}
                          title={`Update ${account.bankName}`}
                          onClick={() => setEditing(account)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-brand-500/10 hover:text-brand-500"
                        >
                          <LuPencil className="h-[19px] w-[19px]" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {isLoading && bankAccounts.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="p-5">
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
              {!isLoading && bankAccounts.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="h-64 px-6 text-center">
                    <LuLandmark className="mx-auto mb-3 h-9 w-9 text-gray-300" />
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      No {accountType === "LOCAL" ? "local" : "international"} accounts
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      {canWrite
                        ? "Add an account to start tracking balances."
                        : "Nothing to show yet."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Inside the sizer and directly after the card, so it tracks the card's
          bottom edge instead of being pinned to the bottom of the page. */}
      <div
        ref={paginationRef}
        className="flex shrink-0 items-center justify-between gap-3 pt-3 text-sm text-gray-600 dark:text-gray-400"
      >
        <span>
          {rangeStart.toLocaleString()}&ndash;{rangeEnd.toLocaleString()} of{" "}
          {total.toLocaleString()}
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
      </div>

      {(editing || creating) && canWrite && (
        <BankAccountModal
          account={editing}
          defaultAccountType={accountType}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={async ({ logoUrl, ...rest }) => {
            // Only send logoUrl when there is one — the API rejects null, so a
            // cleared logo simply can't be persisted (see UpdateBankAccountPayload).
            const withLogo = { ...rest, ...(logoUrl ? { logoUrl } : {}) };
            if (editing) {
              await updateBankAccount(editing.id, withLogo);
              toast.success("Balance updated");
            } else {
              await createBankAccount(withLogo);
              toast.success(`${rest.bankName} added`);
            }
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
      <ConfirmActionModal
        isOpen={canWrite && Boolean(deleting)}
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
