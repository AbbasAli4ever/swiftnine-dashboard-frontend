"use client";

import Image from "next/image";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuCalendarDays,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuCircleUserRound,
  LuCoins,
  LuCreditCard,
  LuDatabase,
  LuPencil,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import type { AddedSale } from "./AddSaleModal";
import { createTransactions, PLATFORM_META, type Transaction } from "./transactionData";

type FilterKey = "clients" | "platforms" | "currencies" | "accounts";
type Filters = Record<FilterKey, string[]>;
type DatePreset = "all" | "7" | "30" | "custom";

const EMPTY_FILTERS: Filters = { clients: [], platforms: [], currencies: [], accounts: [] };
const DATE_LABELS: Record<DatePreset, string> = { all: "Date Range", "7": "Last 7 days", "30": "Last 30 days", custom: "Custom range" };

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function formatAmount(currency: string, amount: number) {
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)}`;
}

function PlatformLogo({ transaction }: { transaction: Pick<Transaction, "platform" | "logo"> }) {
  const meta = PLATFORM_META[transaction.platform] ?? { color: "#6366f1", initials: transaction.platform.slice(0, 2).toUpperCase() };
  if (transaction.logo) {
    return <Image src={transaction.logo} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-[9px] font-bold text-white shadow-sm"
      style={{ backgroundColor: meta.color }}
    >
      {meta.initials}
    </span>
  );
}

function FilterDropdown({
  label,
  icon,
  values,
  selected,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  values: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const buttonLabel = selected.length === 0 ? label : selected.length === 1 ? selected[0] : `${label} (${selected.length})`;
  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-10 min-w-[165px] max-w-[230px] items-center gap-2 rounded-xl border bg-white px-3 text-sm shadow-sm transition-colors dark:bg-gray-901 ${selected.length ? "border-brand-500 text-gray-900 dark:text-gray-100" : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300"}`}
      >
        <span className="text-lg">{icon}</span>
        <span className="flex-1 truncate text-left">{buttonLabel}</span>
        <LuChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-901">
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
            {selected.length > 0 && <button type="button" onClick={() => onChange([])} className="text-xs text-brand-500 hover:text-brand-600">Clear</button>}
          </div>
          <div role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto">
            {values.map((value) => {
              const checked = selected.includes(value);
              return (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange(checked ? selected.filter((item) => item !== value) : [...selected, value])}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="truncate">{value}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DateDropdown({
  preset,
  from,
  to,
  onChange,
}: {
  preset: DatePreset;
  from: string;
  to: string;
  onChange: (preset: DatePreset, from?: string, to?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={`flex h-10 min-w-[185px] items-center gap-2 rounded-xl border bg-white px-3 text-sm shadow-sm dark:bg-gray-901 ${preset !== "all" ? "border-brand-500 text-gray-900 dark:text-gray-100" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300"}`}>
        <LuCalendarDays className="h-5 w-5" />
        <span className="flex-1 text-left">{DATE_LABELS[preset]}</span>
        <LuChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-901">
          {(["all", "7", "30"] as DatePreset[]).map((value) => (
            <button key={value} type="button" onClick={() => { onChange(value); setOpen(false); }} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${preset === value ? "bg-brand-500/10 text-brand-500" : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"}`}>{DATE_LABELS[value]}</button>
          ))}
          <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
          <p className="mb-2 px-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">From<input type="date" value={from} onChange={(event) => onChange("custom", event.target.value, to)} className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></label>
            <label className="text-xs text-gray-500 dark:text-gray-400">To<input type="date" value={to} min={from || undefined} onChange={(event) => onChange("custom", from, event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></label>
          </div>
        </div>
      )}
    </div>
  );
}

function EditCurrencyDropdown({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currencies = ["USD", "EUR", "GBP", "HKD", "PKR"];

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative mt-1.5">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`flex h-9 w-full items-center rounded-xl border bg-white px-3 text-left text-sm text-gray-700 outline-none dark:bg-gray-800 dark:text-gray-100 ${open ? "border-brand-500 ring-2 ring-brand-500/10" : "border-gray-200 dark:border-gray-700"}`}>
        <span className="flex-1">{value}</span><LuChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div role="listbox" aria-label="Currency" className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">{currencies.map((currency) => <button key={currency} type="button" role="option" aria-selected={currency === value} onClick={() => { onChange(currency); setOpen(false); }} className={`block w-full rounded-md px-3 py-2 text-left text-sm ${currency === value ? "bg-brand-500/10 font-medium text-brand-500" : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"}`}>{currency}</button>)}</div>}
    </div>
  );
}

function EditTransactionModal({ transaction, onClose, onSave }: { transaction: Transaction; onClose: () => void; onSave: (transaction: Transaction) => void }) {
  const [amount, setAmount] = useState(String(transaction.amount));
  const [currency, setCurrency] = useState(transaction.currency);
  const [error, setError] = useState("");
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextAmount = Number(amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    onSave({ ...transaction, amount: nextAmount, currency });
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="edit-transaction-title">
      <button type="button" aria-label="Close edit transaction" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      <form onSubmit={submit} className="relative z-10 w-full max-w-[320px] rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950">
        <h2 id="edit-transaction-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">Edit Transaction</h2>
        <label className="mt-6 block text-sm text-gray-500 dark:text-gray-400">Amount<input autoFocus type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1.5 h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></label>
        <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Currency<EditCurrencyDropdown value={currency} onChange={setCurrency} /></div>
        {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="h-10 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</button><button type="submit" className="h-10 rounded-lg bg-[linear-gradient(90deg,#6547f7_0%,#5431ed_100%)] text-sm font-medium text-white hover:opacity-90">Save</button></div>
      </form>
    </div>,
    document.body
  );
}

export default function TransactionsView() {
  const [transactions, setTransactions] = useState(createTransactions);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const tableViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = tableViewportRef.current;
    if (!viewport) return;

    const updateAutomaticPageSize = () => {
      // The sticky table header is 40px and every transaction row is 48px.
      const nextSize = Math.max(1, Math.floor((viewport.clientHeight - 40) / 48));
      setPageSize((current) => current === nextSize ? current : nextSize);
      setPage(1);
    };

    const observer = new ResizeObserver(updateAutomaticPageSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const addSale = (event: Event) => {
      const sale = (event as CustomEvent<AddedSale>).detail;
      setTransactions((current) => [{
        id: sale.id,
        date: sale.date,
        client: sale.client,
        platform: sale.platform,
        account: `${sale.platform} Main`,
        currency: sale.currency,
        amount: sale.amount,
        logo: PLATFORM_META[sale.platform]?.logo,
      }, ...current]);
      setPage(1);
    };
    window.addEventListener("accounting:sale-added", addSale);
    return () => window.removeEventListener("accounting:sale-added", addSale);
  }, []);

  const options = useMemo(() => ({
    clients: [...new Set(transactions.map((item) => item.client))].sort(),
    platforms: [...new Set(transactions.map((item) => item.platform))].sort(),
    currencies: [...new Set(transactions.map((item) => item.currency))].sort(),
    accounts: [...new Set(transactions.map((item) => item.account))].sort(),
  }), [transactions]);

  const newestDate = transactions[0]?.date ?? "2026-07-28";
  const filtered = useMemo(() => transactions.filter((item) => {
    if (filters.clients.length && !filters.clients.includes(item.client)) return false;
    if (filters.platforms.length && !filters.platforms.includes(item.platform)) return false;
    if (filters.currencies.length && !filters.currencies.includes(item.currency)) return false;
    if (filters.accounts.length && !filters.accounts.includes(item.account)) return false;
    if (datePreset === "custom") {
      if (dateFrom && item.date < dateFrom) return false;
      if (dateTo && item.date > dateTo) return false;
    } else if (datePreset === "7" || datePreset === "30") {
      const start = new Date(`${newestDate}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() - Number(datePreset) + 1);
      if (item.date < start.toISOString().slice(0, 10)) return false;
    }
    return true;
  }), [transactions, filters, datePreset, dateFrom, dateTo, newestDate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeFilterCount = Object.values(filters).reduce((total, values) => total + values.length, 0) + (datePreset === "all" ? 0 : 1);

  const updateFilter = (key: FilterKey, values: string[]) => {
    setFilters((current) => ({ ...current, [key]: values }));
    setPage(1);
  };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setDatePreset("all"); setDateFrom(""); setDateTo(""); setPage(1); };
  const start = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, filtered.length);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#fafaff] p-4 dark:bg-gray-907 sm:p-6">
      <div className="mb-5 flex shrink-0 flex-wrap justify-end gap-2">
        <DateDropdown preset={datePreset} from={dateFrom} to={dateTo} onChange={(preset, from = "", to = "") => { setDatePreset(preset); setDateFrom(from); setDateTo(to); setPage(1); }} />
        <FilterDropdown label="Filter client" icon={<LuCircleUserRound />} values={options.clients} selected={filters.clients} onChange={(values) => updateFilter("clients", values)} />
        <FilterDropdown label="Payment Platform" icon={<LuCreditCard />} values={options.platforms} selected={filters.platforms} onChange={(values) => updateFilter("platforms", values)} />
        <FilterDropdown label="Currency" icon={<LuCoins />} values={options.currencies} selected={filters.currencies} onChange={(values) => updateFilter("currencies", values)} />
        <FilterDropdown label="Account" icon={<LuDatabase />} values={options.accounts} selected={filters.accounts} onChange={(values) => updateFilter("accounts", values)} />
        {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="flex h-10 items-center gap-1 rounded-xl px-3 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-905 dark:hover:text-gray-100"><LuX className="h-4 w-4" /> Clear all</button>}
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-901">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-5 dark:border-gray-800">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Transactions</h1>
          <span className="text-xs text-gray-400">Showing {visibleRows.length} of {filtered.length.toLocaleString()} records</span>
        </div>
        <div ref={tableViewportRef} className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[900px] table-fixed text-left">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--color-gray-200)] dark:bg-gray-901 dark:shadow-[0_1px_0_0_var(--color-gray-800)]"><tr className="h-10 text-xs font-normal text-gray-400"><th className="w-[12%] px-5 font-normal">Date</th><th className="w-[23%] px-5 font-normal">Client</th><th className="w-[23%] px-5 font-normal">Platform</th><th className="w-[12%] px-5 font-normal">Currency</th><th className="w-[18%] px-5 text-right font-normal">Amount</th><th className="w-[12%] px-5 text-right font-normal">Actions</th></tr></thead>
            <tbody>
              {visibleRows.map((transaction) => (
                <tr key={transaction.id} className="h-[48px] text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-905/70">
                  <td className="px-5 text-xs whitespace-nowrap">{formatDate(transaction.date)}</td>
                  <td className="truncate px-5">{transaction.client}</td>
                  <td className="px-5"><div className="flex items-center gap-3"><PlatformLogo transaction={transaction} /><span className="truncate">{transaction.platform}</span></div></td>
                  <td className="px-5 text-xs">{transaction.currency}</td>
                  <td className="px-5 text-right font-medium whitespace-nowrap">{formatAmount(transaction.currency, transaction.amount)}</td>
                  <td className="px-5"><div className="flex justify-end gap-1"><button type="button" title={`Delete ${transaction.id}`} aria-label={`Delete transaction ${transaction.id}`} onClick={() => setDeleting(transaction)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><LuTrash2 className="h-[19px] w-[19px]" /></button><button type="button" title={`Edit ${transaction.id}`} aria-label={`Edit transaction ${transaction.id}`} onClick={() => setEditing(transaction)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-brand-500/10 hover:text-brand-500"><LuPencil className="h-[19px] w-[19px]" /></button></div></td>
                </tr>
              ))}
              {visibleRows.length === 0 && <tr><td colSpan={6} className="h-64 px-6 text-center"><div className="mx-auto flex max-w-sm flex-col items-center"><LuDatabase className="mb-3 h-9 w-9 text-gray-300" /><p className="font-medium text-gray-700 dark:text-gray-300">No transactions found</p><p className="mt-1 text-sm text-gray-400">Try changing or clearing your filters.</p><button type="button" onClick={clearFilters} className="mt-4 text-sm font-medium text-brand-500 hover:text-brand-600">Clear filters</button></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pt-3 text-sm text-gray-600 dark:text-gray-400">
        <span>{start.toLocaleString()}–{end.toLocaleString()} of {filtered.length.toLocaleString()}</span>
        <div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-901 dark:hover:bg-gray-905"><LuChevronLeft /></button><button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-901 dark:hover:bg-gray-905"><LuChevronRight /></button></div>
      </div>

      {editing && <EditTransactionModal transaction={editing} onClose={() => setEditing(null)} onSave={(updated) => { setTransactions((items) => items.map((item) => item.id === updated.id ? updated : item)); setEditing(null); }} />}
      <ConfirmActionModal isOpen={Boolean(deleting)} title="Delete transaction?" description={deleting ? `${deleting.id} for ${deleting.client} will be removed from this table.` : ""} confirmLabel="Delete transaction" onClose={() => setDeleting(null)} onConfirm={() => { if (deleting) setTransactions((items) => items.filter((item) => item.id !== deleting.id)); setDeleting(null); }} />
    </div>
  );
}
