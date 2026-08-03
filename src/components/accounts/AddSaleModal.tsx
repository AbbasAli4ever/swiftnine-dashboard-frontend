"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuCalendarDays, LuChevronDown, LuX } from "react-icons/lu";

export type AddedSale = {
  id: string;
  client: string;
  platform: string;
  currency: string;
  amount: number;
  date: string;
  referenceId: string;
  description: string;
};

const platforms = ["Whop", "Airwallex", "Slash", "Payoneer", "Wio Bank", "Mamo", "Kraken", "Fanbasis"];
const currencies = ["USD", "EUR", "GBP", "HKD", "PKR"];

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function SaleDropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative mt-1.5">
      <button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`flex h-10 w-full items-center rounded-lg border bg-white px-3 text-left text-sm text-gray-700 outline-none dark:bg-gray-800 dark:text-gray-100 ${open ? "border-brand-500 ring-2 ring-brand-500/10" : "border-gray-200 hover:border-gray-300 dark:border-gray-700"}`}><span className="flex-1 truncate">{value}</span><LuChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} /></button>
      {open && <div role="listbox" aria-label={label} className="absolute left-0 right-0 z-40 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">{options.map((option) => <button key={option} type="button" role="option" aria-selected={option === value} onClick={() => { onChange(option); setOpen(false); }} className={`block w-full rounded-md px-3 py-2 text-left text-sm ${option === value ? "bg-brand-500/10 font-medium text-brand-500" : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"}`}>{option}</button>)}</div>}
    </div>
  );
}

export default function AddSaleModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [client, setClient] = useState("");
  const [platform, setPlatform] = useState("Whop");
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("0.00");
  const [date, setDate] = useState(today);
  const [referenceId, setReferenceId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!client.trim() || !date || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a client, sale date, and an amount greater than zero.");
      return;
    }
    const sale: AddedSale = { id: `SALE-${Date.now()}`, client: client.trim(), platform, currency, amount: numericAmount, date, referenceId: referenceId.trim(), description: description.trim() };
    window.dispatchEvent(new CustomEvent<AddedSale>("accounting:sale-added", { detail: sale }));
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="add-sale-title">
      <button type="button" aria-label="Close add sale" onClick={onClose} className="fixed inset-0 bg-black/45 backdrop-blur-[2px]" />
      <form onSubmit={submit} className="relative z-10 my-auto w-full max-w-[448px] rounded-[22px] bg-white p-6 shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-6 top-5 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"><LuX className="h-4 w-4" /></button>
        <h2 id="add-sale-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">Add Sale</h2>
        <p className="mt-9 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sale Information</p>

        <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">Client<input autoFocus value={client} onChange={(event) => setClient(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-300">Payment Platform<SaleDropdown label="Payment platform" value={platform} options={platforms} onChange={setPlatform} /></div>
          <div className="text-xs font-medium text-gray-600 dark:text-gray-300">Currency<SaleDropdown label="Currency" value={currency} options={currencies} onChange={setCurrency} /></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Sale Amount<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal text-gray-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></label>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Sale Date<div className="relative mt-1.5"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pr-9 text-sm font-normal text-gray-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /><LuCalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" /></div></label>
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Reference Information</p>
        <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">Reference ID<input value={referenceId} onChange={(event) => setReferenceId(event.target.value)} placeholder="e.g. REF-VP-0119" className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></label>
        <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="add description...." className="mt-1.5 h-20 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></label>
        <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-3 text-xs leading-4 text-gray-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-gray-300">After saving, totals for sales, daily revenue, monthly revenue, client revenue, platform revenue, and currency revenue will be updated automatically.</div>
        {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
        <div className="mt-9 grid grid-cols-2 gap-3"><button type="button" onClick={onClose} className="h-11 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</button><button type="submit" className="h-11 rounded-lg bg-[linear-gradient(90deg,#6547f7_0%,#7c2cf3_100%)] text-sm font-semibold text-white hover:opacity-90">Save Sale</button></div>
      </form>
    </div>, document.body
  );
}
