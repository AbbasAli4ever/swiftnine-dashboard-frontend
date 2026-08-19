"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LuChevronDown, LuLandmark } from "react-icons/lu";
import { useBankAccounts } from "@/hooks/useAccounting";
import { formatMoney } from "@/components/accounts/platformMeta";
import BankAvatar from "@/components/accounts/BankAvatar";
import type { BankAccount } from "@/services/accounting.service";

/**
 * Picks the bank account a transaction is recorded against. Required on create.
 *
 * The account no longer dictates the transaction's currency — an INTERNATIONAL
 * account takes any currency (Whop can record an HKD or AED sale). The one
 * remaining rule is that a LOCAL account only accepts PKR, which the calling
 * form enforces on its currency field. The `currencyType` shown per row is the
 * account's own denomination, not a constraint on what it can receive.
 */
export default function BankAccountPicker({
  value,
  onChange,
  label = "Bank Account",
  error,
  disabled = false,
}: {
  value: BankAccount | null;
  onChange: (account: BankAccount | null) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Bank accounts are few; fetch one page and pick from it rather than
  // debounce-searching like the client picker does.
  const { bankAccounts, isLoading } = useBankAccounts({
    page: 1,
    limit: 100,
    sortBy: "bankName",
    sortOrder: "asc",
  });

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // Every transaction needs an account, so with none the form can't be
  // completed — say so instead of showing an empty dropdown.
  if (!isLoading && bankAccounts.length === 0) {
    return (
      <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
        {label}
        <div className="mt-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-center dark:border-gray-700">
          <LuLandmark className="mx-auto mb-1 h-5 w-5 text-gray-300" />
          <p className="text-xs font-normal text-gray-500 dark:text-gray-400">
            No bank accounts yet — every sale must post to one.
          </p>
          <Link
            href="/accounts/balances"
            className="mt-1 inline-block text-xs font-medium text-brand-500 hover:text-brand-600"
          >
            Create a bank account &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
      {label}
      <div ref={containerRef} className="relative mt-1.5">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          onClick={() => setOpen((current) => !current)}
          className={`flex h-10 w-full items-center gap-2 rounded-lg border bg-white px-3 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-800 ${
            error
              ? "border-red-400"
              : open
                ? "border-brand-500 ring-2 ring-brand-500/10"
                : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
          }`}
        >
          {value ? (
            <>
              <BankAvatar bankName={value.bankName} logoUrl={value.logoUrl} size={24} />
              <span className="flex-1 truncate text-gray-800 dark:text-gray-100">
                {value.bankName}
              </span>
              <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {value.currencyType}
              </span>
            </>
          ) : (
            <span className="flex-1 truncate text-gray-400">
              {isLoading ? "Loading accounts..." : "Select a bank account"}
            </span>
          )}
          <LuChevronDown
            className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (
          <div
            role="listbox"
            aria-label={label}
            className="absolute left-0 right-0 z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            {bankAccounts.map((account) => (
              <button
                key={account.id}
                type="button"
                role="option"
                aria-selected={account.id === value?.id}
                onClick={() => {
                  onChange(account);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                  account.id === value?.id
                    ? "bg-brand-500/10"
                    : "hover:bg-gray-100 dark:hover:bg-gray-905"
                }`}
              >
                <BankAvatar bankName={account.bankName} logoUrl={account.logoUrl} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-gray-800 dark:text-gray-100">
                    {account.bankName}
                  </span>
                  <span className="block text-[11px] text-gray-400">
                    {formatMoney(account.currencyType, account.amount)}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {account.currencyType}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs font-normal text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
