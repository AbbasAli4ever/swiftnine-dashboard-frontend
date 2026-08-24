"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuCalendarDays, LuX } from "react-icons/lu";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import { useTransactionMutations } from "@/hooks/useAccounting";
import {
  COMMISSION_CURRENCIES,
  CURRENCIES,
  LOCAL_CURRENCY,
  transactionCurrenciesForAccountType,
  type BankAccount,
  type ClientSearchResult,
  type CommissionCurrency,
  type Currency,
  type EmployeeSearchResult,
} from "@/services/accounting.service";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import ClientPicker from "@/components/accounts/ClientPicker";
import BankAccountPicker from "@/components/accounts/BankAccountPicker";
import EmployeePicker from "@/components/accounts/EmployeePicker";
import CreateClientModal from "@/components/accounts/CreateClientModal";
import EmployeeFormModal from "@/components/accounts/EmployeeFormModal";
import {
  formatMoney,
  fromDateInputValue,
  todayDateInputValue,
} from "@/components/accounts/platformMeta";

export default function AddSaleModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { createTransaction } = useTransactionMutations();

  const [client, setClient] = useState<ClientSearchResult | null>(null);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [amount, setAmount] = useState("0.00");
  const [saleDate, setSaleDate] = useState(todayDateInputValue);
  const [refId, setRefId] = useState("");
  const [description, setDescription] = useState("");
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  // LOCAL accounts are PKR-only; INTERNATIONAL ones take any currency.
  const isLocalAccount = bankAccount?.accountType === "LOCAL";
  const currencyOptions = isLocalAccount
    ? transactionCurrenciesForAccountType("LOCAL")
    : CURRENCIES;
  const [error, setError] = useState("");
  const [refIdError, setRefIdError] = useState("");
  const [clientError, setClientError] = useState("");
  const [bankError, setBankError] = useState("");
  const [saving, setSaving] = useState(false);

  // Optional: not every sale has an employee/commission attached.
  const [employee, setEmployee] = useState<EmployeeSearchResult | null>(null);
  const [commissionAmount, setCommissionAmount] = useState("");
  const [commissionCurrency, setCommissionCurrency] =
    useState<CommissionCurrency>("USD");

  // Opened from the picker's "Create <term>" row.
  const [createClientName, setCreateClientName] = useState<string | null>(null);
  const [createEmployeeName, setCreateEmployeeName] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setClient(null);
    setCurrency("USD");
    setAmount("0.00");
    setSaleDate(todayDateInputValue());
    setRefId("");
    setDescription("");
    setBankAccount(null);
    setError("");
    setRefIdError("");
    setClientError("");
    setBankError("");
    setEmployee(null);
    setCommissionAmount("");
    setCommissionCurrency("USD");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      // Let a nested create-client/create-employee modal handle Escape first.
      if (event.key === "Escape" && createClientName === null && createEmployeeName === null) {
        onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose, createClientName, createEmployeeName]);

  if (!isOpen) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setRefIdError("");
    setClientError("");
    setBankError("");

    if (!client) {
      setClientError("Select a client.");
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setError("Enter a sale amount of zero or more.");
      return;
    }
    if (!saleDate) {
      setError("Select a sale date.");
      return;
    }
    if (!bankAccount) {
      setBankError("Select the bank account this sale posts to.");
      return;
    }
    if (!refId.trim()) {
      setRefIdError("Reference ID is required.");
      return;
    }
    const trimmedCommission = commissionAmount.trim();
    let numericCommission: number | undefined;
    if (trimmedCommission) {
      if (!employee) {
        setError("Select an employee before entering a commission.");
        return;
      }
      numericCommission = Number(trimmedCommission);
      if (!Number.isFinite(numericCommission) || numericCommission < 0) {
        setError("Enter a commission amount of zero or more.");
        return;
      }
    }

    setSaving(true);
    try {
      await createTransaction({
        clientId: client.id,
        bankAccountId: bankAccount.id,
        refId: refId.trim(),
        saleAmount: numericAmount,
        // The user's choice, not the account's own currency: an INTERNATIONAL
        // account takes any currency now. Only LOCAL is still pinned to PKR,
        // which the picker enforces below.
        currency,
        saleDate: fromDateInputValue(saleDate),
        description: description.trim() || undefined,
        employeeId: employee?.id,
        commissionAmount: numericCommission,
        commissionCurrency: numericCommission !== undefined ? commissionCurrency : undefined,
      });
      toast.success("Sale recorded");
      onClose();
    } catch (err) {
      const { message, code } = parseApiError(err);
      // 409 is always a duplicate refId; 404 means the client/bank
      // account/employee vanished mid-flow.
      if (code === "CONFLICT") {
        setRefIdError("This reference ID is already used.");
      } else if (code === "NOT_FOUND") {
        if (message.toLowerCase().includes("bank")) {
          setBankError("This bank account no longer exists. Pick another.");
          setBankAccount(null);
        } else if (message.toLowerCase().includes("employee")) {
          setError("This employee no longer exists. Pick another.");
          setEmployee(null);
        } else {
          setClientError("This client no longer exists. Pick another.");
          setClient(null);
        }
      } else {
        setError(message || "Couldn't record the sale.");
      }
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-sale-title"
      >
        <button
          type="button"
          aria-label="Close add sale"
          onClick={onClose}
          className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
        />
        {/* Capped at the viewport with the field area as the only scrolling
            region, so the header and Save button stay reachable however many
            fields the form grows to (Employee/Commission added on top of the
            original set). */}
        <form
          onSubmit={submit}
          className="relative z-10 flex max-h-[calc(100vh-4rem)] w-full max-w-[448px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 p-6 pb-4 dark:border-gray-800">
            <h2
              id="add-sale-title"
              className="text-base font-semibold text-gray-900 dark:text-gray-100"
            >
              Add Sale
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Sale Information
          </p>

          <div className="mt-3">
            <ClientPicker
              autoFocus
              value={client}
              onChange={(next) => {
                setClient(next);
                setClientError("");
              }}
              onCreateRequest={setCreateClientName}
              error={clientError}
            />
          </div>

          <div className="mt-3">
            <BankAccountPicker
              value={bankAccount}
              onChange={(next) => {
                setBankAccount(next);
                // A LOCAL account only accepts PKR, so pin it. An
                // INTERNATIONAL one takes any currency — keep whatever the
                // user already picked rather than overwriting their choice.
                if (next?.accountType === "LOCAL") setCurrency(LOCAL_CURRENCY);
                setBankError("");
              }}
              error={bankError}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Currency
              <AccountingSelect
                label="Currency"
                value={currency}
                // A LOCAL account is PKR-only (a hard 400 otherwise), so offer
                // just that. INTERNATIONAL accounts are currency-agnostic —
                // Whop can take an HKD or AED sale — so offer everything.
                options={currencyOptions.map((code) => ({
                  value: code,
                  label: code,
                }))}
                onChange={(next) => setCurrency(next as Currency)}
                disabled={isLocalAccount}
              />
              {isLocalAccount && (
                <span className="mt-1 block text-[11px] font-normal text-gray-400">
                  {bankAccount?.bankName} is a local account (PKR only)
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Sale Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal text-gray-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Sale Date
              <div className="relative mt-1.5">
                <input
                  type="date"
                  value={saleDate}
                  max={todayDateInputValue()}
                  onChange={(event) => setSaleDate(event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pr-9 text-sm font-normal text-gray-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <LuCalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600 dark:text-gray-400" />
              </div>
            </label>
          </div>

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Commission (optional)
          </p>
          <div className="mt-3">
            <EmployeePicker
              value={employee}
              onChange={(next) => {
                setEmployee(next);
                // A commission can't exist without an employee, so clearing
                // the employee clears whatever commission was entered too.
                if (!next) {
                  setCommissionAmount("");
                  setCommissionCurrency("USD");
                }
              }}
              onCreateRequest={setCreateEmployeeName}
            />
          </div>
          {employee && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Commission Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={commissionAmount}
                  onChange={(event) => setCommissionAmount(event.target.value)}
                  placeholder="0.00"
                  className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </label>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Commission Currency
                <AccountingSelect
                  label="Commission Currency"
                  value={commissionCurrency}
                  options={COMMISSION_CURRENCIES.map((code) => ({
                    value: code,
                    label: code,
                  }))}
                  onChange={(next) => setCommissionCurrency(next as CommissionCurrency)}
                />
              </div>
            </div>
          )}

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Reference Information
          </p>
          <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Reference ID
            <input
              value={refId}
              onChange={(event) => {
                setRefId(event.target.value);
                setRefIdError("");
              }}
              placeholder="e.g. REF-VP-0119"
              className={`mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:bg-gray-800 dark:text-gray-100 ${
                refIdError ? "border-red-400" : "border-gray-200 dark:border-gray-700"
              }`}
            />
            {refIdError && (
              <span role="alert" className="mt-1 block text-xs font-normal text-red-500">
                {refIdError}
              </span>
            )}
          </label>
          <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="add description...."
              className="mt-1.5 h-20 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-3 text-xs leading-4 text-gray-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-gray-300">
            {bankAccount ? (
              <>
                Saving will add{" "}
                {formatMoney(bankAccount.currencyType, Number(amount) || 0)} to{" "}
                <span className="font-medium">{bankAccount.bankName}</span> and
                update the dashboard totals. It does not change the client&apos;s
                stored total revenue.
              </>
            ) : (
              <>
                Saving updates the selected bank account&apos;s balance and the
                dashboard totals. It does not change the client&apos;s stored
                total revenue.
              </>
            )}
          </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 p-6 pt-4 dark:border-gray-800">
            {error && (
              <p role="alert" className="mb-3 text-sm text-red-500">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-11 rounded-lg bg-[linear-gradient(90deg,#6547f7_0%,#7c2cf3_100%)] text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Sale"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <CreateClientModal
        isOpen={createClientName !== null}
        initialName={createClientName ?? ""}
        onClose={() => setCreateClientName(null)}
        onCreated={(created) => {
          // Auto-select so the accountant can carry straight on with the sale.
          setClient({ id: created.id, clientName: created.clientName });
          setClientError("");
          setCreateClientName(null);
        }}
      />
      <EmployeeFormModal
        isOpen={createEmployeeName !== null}
        initialName={createEmployeeName ?? ""}
        onClose={() => setCreateEmployeeName(null)}
        onSaved={(created) => {
          setEmployee({ id: created.id, name: created.name });
          setCreateEmployeeName(null);
        }}
      />
    </>,
    document.body
  );
}
