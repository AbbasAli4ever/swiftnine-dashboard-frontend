"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuCoins,
  LuDatabase,
  LuFileSpreadsheet,
  LuFileText,
  LuLoaderCircle,
  LuUpload,
  LuWallet,
} from "react-icons/lu";
import {
  useAccountingTransactions,
  useBankAccounts,
  useReportExport,
} from "@/hooks/useAccounting";
import { parseApiError } from "@/lib/api";
import {
  ACCOUNT_TYPES,
  CURRENCIES,
  REPORTS_MAX_RANGE_DAYS,
  type AccountType,
  type ClientSearchResult,
  type Currency,
  type ReportExportFormat,
  type ReportFilters,
} from "@/services/accounting.service";
import {
  DateDropdown,
  FilterDropdown,
  type DatePreset,
} from "@/components/accounts/accountingFilters";
import ClientPicker from "@/components/accounts/ClientPicker";
import BankAvatar from "@/components/accounts/BankAvatar";
import {
  formatIsoDate,
  formatMoney,
  toDateInputValue,
} from "@/components/accounts/platformMeta";

// Must stay in sync with the markup below — see TransactionsView, which uses
// the identical measured-row-count approach.
const ROW_HEIGHT = 56;
const TABLE_HEADER_HEIGHT = 40;
const CARD_TITLE_BAR_HEIGHT = 48;
const CARD_BORDER_HEIGHT = 2;
const PAGINATION_ROW_HEIGHT = 44;

/** The two export routes, which take identical params and differ only in the
 *  file they return. */
const EXPORT_FORMATS: {
  format: ReportExportFormat;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
}[] = [
  {
    format: "xlsx",
    label: "Export as Excel",
    icon: LuFileSpreadsheet,
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  {
    format: "pdf",
    label: "Export as PDF",
    icon: LuFileText,
    iconClass: "text-red-500 dark:text-red-400",
  },
];

/** "Payment Platform" in the UI — the account's type is what carries that
 *  meaning now that `PaymentPlatform` is gone from the data model. */
const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  LOCAL: "Local (Pakistan)",
  INTERNATIONAL: "International",
};

/** Today as YYYY-MM-DD in the viewer's timezone. `toISOString()` would give the
 *  UTC date, which is yesterday for a UTC+5 user before 5am. */
function todayLocalIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Steps back N days from a `YYYY-MM-DD`, in UTC so the digits survive the
 *  round trip regardless of the host's offset. */
function isoDaysBefore(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export default function ReportsView() {
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [client, setClient] = useState<ClientSearchResult | null>(null);
  const clientId = client?.id ?? null;
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [bankAccountIds, setBankAccountIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const tableSizerRef = useRef<HTMLDivElement>(null);

  /**
   * Every filter change also resets to page 1 — staying on page 4 of a
   * narrower result set would show an empty table.
   *
   * Done here at the event rather than in an effect watching the filters: a
   * `setPage` inside an effect body triggers a second render pass on every
   * filter change (and trips `react-hooks/set-state-in-effect`).
   */
  function withPageReset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  // Derives the page size from the space the table could occupy, so the list
  // fills the viewport without the page itself scrolling.
  useEffect(() => {
    const sizer = tableSizerRef.current;
    if (!sizer) return;

    const updateAutomaticPageSize = () => {
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
      const days = Number(datePreset);
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      return { from: toDateInputValue(start.toISOString()), to: todayLocalIso() };
    }
    return { from: undefined, to: undefined };
  }, [datePreset, dateFrom, dateTo]);

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      sortBy: "saleDate" as const,
      sortOrder: "desc" as const,
      ...(clientId ? { clientId } : {}),
      ...(accountTypes.length ? { accountType: accountTypes } : {}),
      ...(currencies.length ? { currency: currencies } : {}),
      // The API takes a single bank account, so only a lone selection narrows
      // the query; more than one falls back to "all" rather than silently
      // showing just the first.
      ...(bankAccountIds.length === 1 ? { bankAccountId: bankAccountIds[0] } : {}),
      ...(dateRange.from ? { dateFrom: dateRange.from } : {}),
      ...(dateRange.to ? { dateTo: dateRange.to } : {}),
    }),
    [page, pageSize, clientId, accountTypes, currencies, bankAccountIds, dateRange]
  );

  const { transactions, meta, isLoading, error } = useAccountingTransactions(params);
  const { bankAccounts } = useBankAccounts({ limit: 100 });
  const { exportReport, exportingFormat, isExporting } = useReportExport();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // Dismiss the format menu on an outside click, the same as the filter
  // dropdowns beside it.
  useEffect(() => {
    if (!exportMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [exportMenuOpen]);

  const total = meta?.total ?? transactions.length;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  // `bankAccountId` is the one filter the API still takes as a single value, so
  // a multi-selection can't narrow either the table or the export.
  const droppedFilters =
    bankAccountIds.length > 1 ? ["Account"] : ([] as string[]);

  const handleExport = async (format: ReportExportFormat) => {
    setExportMenuOpen(false);
    // Mirrors the table's query exactly — the export takes the same filter set
    // as `GET /transactions`, including comma-separated currency/accountType.
    // Both formats accept identical params, so this is shared.
    const filters: ReportFilters = {
      ...(clientId ? { clientId } : {}),
      ...(accountTypes.length ? { accountType: accountTypes } : {}),
      ...(currencies.length ? { currency: currencies } : {}),
      ...(bankAccountIds.length === 1 ? { bankAccountId: bankAccountIds[0] } : {}),
    };

    // Always send an explicit range: given no dates the endpoint silently
    // exports *today*, which would contradict a table showing all history.
    // With no date filter set, fall back to the widest span the API accepts
    // (400 days) rather than an open-ended one it would reject.
    const to = dateRange.to ?? todayLocalIso();
    const from = dateRange.from ?? isoDaysBefore(to, REPORTS_MAX_RANGE_DAYS);

    try {
      await exportReport(from, to, filters, format);
      toast.success(
        format === "pdf" ? "PDF downloaded" : "Excel file downloaded"
      );
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#fafaff] px-4 py-3 dark:bg-gray-907 sm:px-6">
      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DateDropdown
          preset={datePreset}
          from={dateFrom}
          to={dateTo}
          align="left"
          onChange={(preset, from, to) => {
            setDatePreset(preset);
            setDateFrom(from ?? "");
            setDateTo(to ?? "");
            setPage(1);
          }}
        />
        <div className="w-[190px]">
          <ClientPicker
            value={client}
            onChange={withPageReset(setClient)}
            label=""
            placeholder="Filter client..."
          />
        </div>
        <FilterDropdown
          label="Payment Platform"
          icon={<LuWallet className="h-[18px] w-[18px]" />}
          values={ACCOUNT_TYPES}
          selected={accountTypes}
          onChange={withPageReset(setAccountTypes)}
          align="left"
          formatValue={(value) => ACCOUNT_TYPE_LABELS[value]}
        />
        <FilterDropdown
          label="Currency"
          icon={<LuCoins className="h-[18px] w-[18px]" />}
          values={CURRENCIES}
          selected={currencies}
          onChange={withPageReset(setCurrencies)}
          align="left"
        />
        <FilterDropdown
          label="Account"
          icon={<LuDatabase className="h-[18px] w-[18px]" />}
          values={bankAccounts.map((account) => account.id)}
          selected={bankAccountIds}
          onChange={withPageReset(setBankAccountIds)}
          align="left"
          formatValue={(id) =>
            bankAccounts.find((account) => account.id === id)?.bankName ?? "Account"
          }
        />
        <div ref={exportMenuRef} className="relative ml-auto shrink-0">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            onClick={() => setExportMenuOpen((open) => !open)}
            disabled={isExporting}
            title="Download the filtered report"
            className="flex h-10 items-center gap-2 rounded-xl border border-brand-500 bg-white px-4 text-sm font-medium text-brand-500 shadow-sm transition-colors hover:bg-brand-500/5 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-901 dark:hover:bg-brand-500/10"
          >
            {isExporting ? (
              <LuLoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LuUpload className="h-4 w-4" />
            )}
            {isExporting ? "Exporting…" : "Export Report"}
            <LuChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                exportMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Kept mounted and collapsed rather than unmounted, so the rows can
              animate out as well as in. `pointer-events-none` while closed
              stops the hidden rows swallowing clicks on the table beneath. */}
          <div
            role="menu"
            aria-label="Export format"
            className={`absolute right-0 top-full z-30 mt-2 w-[190px] origin-top rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl transition-all duration-200 ease-out dark:border-gray-700 dark:bg-gray-901 ${
              exportMenuOpen
                ? "visible translate-y-0 scale-100 opacity-100"
                : "invisible pointer-events-none -translate-y-1 scale-95 opacity-0"
            }`}
          >
            {EXPORT_FORMATS.map((option, index) => (
              <button
                key={option.format}
                type="button"
                role="menuitem"
                disabled={isExporting}
                onClick={() => handleExport(option.format)}
                // Staggered so the rows cascade rather than appearing as one
                // block; the delay only applies on the way in.
                style={{
                  transitionDelay: exportMenuOpen ? `${index * 45}ms` : "0ms",
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 transition-all duration-200 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-300 dark:hover:bg-gray-905 ${
                  exportMenuOpen
                    ? "translate-y-0 opacity-100"
                    : "-translate-y-1 opacity-0"
                }`}
              >
                {exportingFormat === option.format ? (
                  <LuLoaderCircle className="h-4 w-4 shrink-0 animate-spin text-brand-500" />
                ) : (
                  <option.icon className={`h-4 w-4 shrink-0 ${option.iconClass}`} />
                )}
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {droppedFilters.length > 0 && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          The API filters on one bank account at a time, so selecting several
          shows all of them. Pick a single account to narrow the results.
        </p>
      )}

      <div ref={tableSizerRef} className="flex min-h-0 flex-1 flex-col">
        <section className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-901">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-5 dark:border-gray-800">
            <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Report
            </h1>
            <span className="text-xs text-gray-400">
              Showing {transactions.length} of {total.toLocaleString()} records
            </span>
          </div>
          <div className="min-h-0 overflow-auto">
            <table className="w-full min-w-[880px] table-fixed text-left">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--color-gray-200)] dark:bg-gray-901 dark:shadow-[0_1px_0_0_var(--color-gray-800)]">
                <tr className="h-10 text-xs font-normal text-gray-400">
                  <th className="w-[14%] px-5 font-normal">Date</th>
                  <th className="w-[28%] px-5 font-normal">Client</th>
                  <th className="w-[26%] px-5 font-normal">Bank</th>
                  <th className="w-[12%] px-5 font-normal">Currency</th>
                  <th className="w-[20%] px-5 font-normal">Amount</th>
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
                    <td className="truncate px-5" title={transaction.clientName}>
                      {transaction.clientName}
                    </td>
                    <td className="px-5">
                      <div className="flex items-center gap-3">
                        <BankAvatar
                          bankName={transaction.bankAccount?.bankName ?? "?"}
                          logoUrl={transaction.bankAccount?.logoUrl}
                          size={28}
                        />
                        <span className="truncate">
                          {transaction.bankAccount?.bankName ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 text-xs">{transaction.currency}</td>
                    {/* The native amount — a transaction carries no
                        USD-converted field, so nothing here is re-based. */}
                    <td className="px-5 font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">
                      {formatMoney(transaction.currency, transaction.saleAmount)}
                    </td>
                  </tr>
                ))}
                {isLoading && transactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-5">
                      <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && transactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="h-64 px-6 text-center">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        No transactions match these filters
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        Try widening the date range or clearing a filter.
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
    </div>
  );
}
