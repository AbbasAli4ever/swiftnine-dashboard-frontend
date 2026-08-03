"use client";

import Image from "next/image";
import NumberFlow from "@number-flow/react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuChevronDown, LuChevronLeft, LuChevronRight, LuX } from "react-icons/lu";
import { balanceSummary } from "./mockData";
import { internationalBalanceAccounts, pakistanBalanceAccounts, type BalanceAccount } from "./accountBalanceData";

type AccountType = "pakistan" | "international";
const CARDS_PER_PAGE = 9;

function AccountLogo({ account }: { account: BalanceAccount }) {
  if (account.logo) return <Image src={account.logo} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />;
  return <span aria-hidden="true" style={{ backgroundColor: account.color }} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white">{account.initials}</span>;
}

function ModalSelect({ value, options, label, onChange }: { value: string; options: { value: string; label: string }[]; label: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative mt-1.5">
      <button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`flex h-10 w-full items-center rounded-lg border bg-white px-3 text-left text-sm font-normal text-gray-700 outline-none transition-colors dark:bg-gray-800 dark:text-gray-100 ${open ? "border-brand-500 ring-2 ring-brand-500/10" : "border-gray-200 hover:border-gray-300 dark:border-gray-700"}`}>
        <span className="flex-1 truncate">{selectedLabel}</span>
        <LuChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="listbox" aria-label={label} className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {options.map((option) => (
            <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors ${option.value === value ? "bg-brand-500/10 font-medium text-brand-500" : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"}`}>
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BalanceUpdateModal({ account, accounts, onClose, onSave }: { account: BalanceAccount; accounts: BalanceAccount[]; onClose: () => void; onSave: (account: BalanceAccount) => void }) {
  const [selectedAccountId, setSelectedAccountId] = useState(account.id);
  const [currency, setCurrency] = useState<BalanceAccount["currency"]>(account.currency);
  const [balance, setBalance] = useState(String(account.balance));
  const [error, setError] = useState("");
  const selectedAccount = accounts.find((item) => item.id === selectedAccountId) ?? account;
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextBalance = Number(balance);
    if (!Number.isFinite(nextBalance) || nextBalance < 0) {
      setError("Enter a valid balance of zero or more.");
      return;
    }
    const now = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date());
    onSave({ ...selectedAccount, currency, balance: nextBalance, updatedAt: now });
  };

  const selectAccount = (id: string) => {
    const nextAccount = accounts.find((item) => item.id === id);
    if (!nextAccount) return;
    setSelectedAccountId(id);
    setCurrency(nextAccount.currency);
    setBalance(String(nextAccount.balance));
    setError("");
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="update-balance-title">
      <button type="button" aria-label="Close update balance" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      <form onSubmit={submit} className="relative z-10 w-full max-w-[384px] rounded-[22px] bg-white p-6 shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-6 top-5 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"><LuX className="h-4 w-4" /></button>
        <h2 id="update-balance-title" className="pr-10 text-base font-semibold text-gray-800 dark:text-gray-100">Update Account Balance</h2>

        <label className="mt-9 block text-xs font-medium text-gray-600 dark:text-gray-300">Select Account
          <ModalSelect value={selectedAccountId} options={accounts.map((item) => ({ value: item.id, label: item.name }))} label="Select account" onChange={selectAccount} />
        </label>

        <label className="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-300">Select Currency
          <ModalSelect value={currency} options={[{ value: "PKR", label: "PKR" }, { value: "USD", label: "USD" }]} label="Select currency" onChange={(value) => setCurrency(value as BalanceAccount["currency"])} />
        </label>

        <label className="mt-4 block text-xs font-medium text-gray-400">Enter Current Balance
          <div className="relative mt-1.5"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{currency}</span><input type="number" min="0" step="0.01" value={balance} onChange={(event) => setBalance(event.target.value)} className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-12 pr-3 text-sm font-normal text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
        </label>

        <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-900">
          <p className="text-[11px] text-gray-400">Last Updated</p>
          <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">{selectedAccount.updatedAt}</p>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
        <div className="mt-9 grid grid-cols-2 gap-3"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</button><button type="submit" className="h-11 rounded-xl bg-[linear-gradient(90deg,#7357f6_0%,#7c2cf3_100%)] text-sm font-semibold text-white hover:opacity-90">Update Balance</button></div>
      </form>
    </div>, document.body
  );
}

export default function AccountsBalancesView() {
  const [accountType, setAccountType] = useState<AccountType>("pakistan");
  const [pakistanAccounts, setPakistanAccounts] = useState(pakistanBalanceAccounts);
  const [internationalAccounts, setInternationalAccounts] = useState(internationalBalanceAccounts);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BalanceAccount | null>(null);
  const accounts = accountType === "pakistan" ? pakistanAccounts : internationalAccounts;
  const pageCount = Math.max(1, Math.ceil(accounts.length / CARDS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const visibleAccounts = accounts.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE);
  const start = accounts.length ? (currentPage - 1) * CARDS_PER_PAGE + 1 : 0;
  const end = Math.min(currentPage * CARDS_PER_PAGE, accounts.length);

  const selectType = (type: AccountType) => { setAccountType(type); setPage(1); };
  const saveAccount = (updated: BalanceAccount) => {
    const update = (items: BalanceAccount[]) => items.map((item) => item.id === updated.id ? updated : item);
    if (accountType === "pakistan") setPakistanAccounts(update); else setInternationalAccounts(update);
    setEditing(null);
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-[#FAFAFF] p-4 dark:bg-gray-907 sm:p-6">
      <section className="grid shrink-0 grid-cols-1 gap-4 rounded-xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-901 md:grid-cols-3">
        <div className="flex items-center gap-8 md:col-span-2">
          <div><p className="text-sm text-gray-500 dark:text-gray-400">Pakistan Balance</p><p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100"><NumberFlow value={balanceSummary.pakistanBalance} prefix="PKR " /></p><p className="mt-1 text-xs text-gray-400">{balanceSummary.pakistanAccountsCount} accounts</p></div>
          <div className="h-20 w-px shrink-0 bg-gray-200 dark:bg-gray-800" />
          <div><p className="text-sm text-gray-500 dark:text-gray-400">International Balance</p><p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100"><NumberFlow value={balanceSummary.internationalBalance} prefix="USD " /></p><p className="mt-1 text-xs text-gray-400">{balanceSummary.internationalAccountsCount} accounts</p></div>
        </div>
        <div className="rounded-xl bg-black px-5 py-4 text-white"><p className="text-xs text-gray-300">Total Balance</p><p className="mt-1 text-2xl font-semibold"><NumberFlow value={balanceSummary.totalBalance} prefix="USD " /></p><p className="mt-1 text-xs text-gray-400">{balanceSummary.conversionNote}</p></div>
      </section>

      <div className="mt-4 flex w-fit shrink-0 rounded-lg bg-gray-100 p-1 dark:bg-gray-905">
        <button type="button" onClick={() => selectType("pakistan")} className={`rounded-md px-4 py-2 text-sm transition-all ${accountType === "pakistan" ? "bg-white font-medium text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"}`}>Pakistan Accounts</button>
        <button type="button" onClick={() => selectType("international")} className={`rounded-md px-4 py-2 text-sm transition-all ${accountType === "international" ? "bg-white font-medium text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"}`}>International Accounts</button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleAccounts.map((account) => (
          <article key={account.id} className="flex min-h-[178px] flex-col rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-901">
            <div className="flex items-center gap-3"><AccountLogo account={account} /><h2 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{account.name}</h2></div>
            <p className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">{account.currency} {account.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
            <div className="mt-auto flex items-center justify-between gap-3 pt-4"><p className="truncate text-[11px] text-gray-400">Last updated: {account.updatedAt}</p><button type="button" onClick={() => setEditing(account)} className="shrink-0 text-xs font-medium text-brand-500 hover:text-brand-600">Update</button></div>
          </article>
        ))}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 py-3 text-sm text-gray-600 dark:text-gray-400">
        <span>{start}–{end} of {accounts.length}</span>
        <div className="flex gap-2"><button type="button" aria-label="Previous accounts page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-901 dark:hover:bg-gray-905"><LuChevronLeft /></button><button type="button" aria-label="Next accounts page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-901 dark:hover:bg-gray-905"><LuChevronRight /></button></div>
      </div>

      {editing && <BalanceUpdateModal account={editing} accounts={accounts} onClose={() => setEditing(null)} onSave={saveAccount} />}
    </div>
  );
}
