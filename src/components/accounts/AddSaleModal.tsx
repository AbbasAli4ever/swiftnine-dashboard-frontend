"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuCalendarDays, LuX } from "react-icons/lu";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import { useTransactionMutations } from "@/hooks/useAccounting";
import {
  CURRENCIES,
  PAYMENT_PLATFORMS,
  type ClientSearchResult,
  type Currency,
  type PaymentPlatform,
} from "@/services/accounting.service";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import ClientPicker from "@/components/accounts/ClientPicker";
import CreateClientModal from "@/components/accounts/CreateClientModal";
import {
  formatPlatform,
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
  const [platform, setPlatform] = useState<PaymentPlatform>(PAYMENT_PLATFORMS[0]);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [amount, setAmount] = useState("0.00");
  const [saleDate, setSaleDate] = useState(todayDateInputValue);
  const [refId, setRefId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [refIdError, setRefIdError] = useState("");
  const [clientError, setClientError] = useState("");
  const [saving, setSaving] = useState(false);

  // Opened from the picker's "Create <term>" row.
  const [createClientName, setCreateClientName] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setClient(null);
    setPlatform(PAYMENT_PLATFORMS[0]);
    setCurrency("USD");
    setAmount("0.00");
    setSaleDate(todayDateInputValue());
    setRefId("");
    setDescription("");
    setError("");
    setRefIdError("");
    setClientError("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      // Let the nested create-client modal handle Escape while it's open.
      if (event.key === "Escape" && createClientName === null) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose, createClientName]);

  if (!isOpen) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setRefIdError("");
    setClientError("");

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
    if (!refId.trim()) {
      setRefIdError("Reference ID is required.");
      return;
    }

    setSaving(true);
    try {
      await createTransaction({
        clientId: client.id,
        refId: refId.trim(),
        saleAmount: numericAmount,
        currency,
        paymentPlatform: platform,
        saleDate: fromDateInputValue(saleDate),
        description: description.trim() || undefined,
      });
      toast.success("Sale recorded");
      onClose();
    } catch (err) {
      const { message, code } = parseApiError(err);
      // 409 is always a duplicate refId; 404 means the client vanished mid-flow.
      if (code === "CONFLICT") {
        setRefIdError("This reference ID is already used.");
      } else if (code === "NOT_FOUND") {
        setClientError("This client no longer exists. Pick another.");
        setClient(null);
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
        className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto p-4"
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
        <form
          onSubmit={submit}
          className="relative z-10 my-auto w-full max-w-[448px] rounded-[22px] bg-white p-6 shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-6 top-5 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
          >
            <LuX className="h-4 w-4" />
          </button>
          <h2
            id="add-sale-title"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            Add Sale
          </h2>
          <p className="mt-9 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
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

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Payment Platform
              <AccountingSelect
                label="Payment platform"
                value={platform}
                options={PAYMENT_PLATFORMS.map((value) => ({
                  value,
                  label: formatPlatform(value),
                }))}
                onChange={(next) => setPlatform(next as PaymentPlatform)}
              />
            </div>
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Currency
              <AccountingSelect
                label="Currency"
                value={currency}
                options={CURRENCIES.map((code) => ({ value: code, label: code }))}
                onChange={(next) => setCurrency(next as Currency)}
              />
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
            Saving updates the dashboard revenue totals and platform/currency
            breakdowns. It does not change the client&apos;s stored total revenue.
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-500">
              {error}
            </p>
          )}
          <div className="mt-9 grid grid-cols-2 gap-3">
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
    </>,
    document.body
  );
}
