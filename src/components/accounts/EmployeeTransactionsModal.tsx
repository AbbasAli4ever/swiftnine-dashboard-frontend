"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import NameAvatar from "@/components/accounts/NameAvatar";
import { formatIsoDate, formatMoney } from "@/components/accounts/platformMeta";
import type { AccountingEmployee } from "@/services/accounting.service";

/**
 * Read-only list of every sale one employee is credited on, same shape as
 * `ClientTransactionsModal`. The rows come straight off the employee row —
 * `GET /employees` embeds each employee's full transaction list — so opening
 * this needs no extra request.
 */
export default function EmployeeTransactionsModal({
  employee,
  onClose,
}: {
  employee: AccountingEmployee | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!employee) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [employee, onClose]);

  if (!employee) return null;

  const transactions = employee.transactions ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-transactions-title"
    >
      <button
        type="button"
        aria-label="Close transactions"
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <div className="relative z-10 flex max-h-[calc(100vh-4rem)] w-full max-w-[680px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 p-6 pb-4 dark:border-gray-800">
          <div className="flex min-w-0 items-center gap-3">
            <NameAvatar name={employee.name} size={36} />
            <div className="min-w-0">
              <h2
                id="employee-transactions-title"
                className="truncate text-base font-semibold text-gray-900 dark:text-gray-100"
              >
                {employee.name}
              </h2>
              <p className="mt-0.5 text-xs text-gray-400">
                {employee._count.transactions}{" "}
                {employee._count.transactions === 1 ? "sale" : "sales"}
                {employee.totalCommission.length > 0 && (
                  <>
                    {" · "}
                    {employee.totalCommission
                      .map((entry) => formatMoney(entry.currency, entry.total))
                      .join(" · ")}{" "}
                    commission
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <LuX className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
          {transactions.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              No sales recorded for this employee.
            </p>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-white dark:bg-gray-950">
                <tr className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-3 text-left font-normal">Reference</th>
                  <th className="px-3 py-2 text-left font-normal">Client</th>
                  <th className="px-3 py-2 text-left font-normal">Date</th>
                  <th className="px-3 py-2 text-right font-normal">Sale</th>
                  <th className="py-2 pl-3 text-right font-normal">Commission</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-t border-gray-100 dark:border-gray-800/60"
                  >
                    <td className="py-3 pr-3">
                      <p className="truncate text-sm text-gray-800 dark:text-gray-100">
                        {transaction.refId}
                      </p>
                      {transaction.description && (
                        <p
                          className="truncate text-xs text-gray-400"
                          title={transaction.description}
                        >
                          {transaction.description}
                        </p>
                      )}
                    </td>
                    <td className="truncate px-3 py-3 text-xs text-gray-600 dark:text-gray-300">
                      {transaction.client.clientName}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatIsoDate(transaction.saleDate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-gray-700 dark:text-gray-200">
                      {formatMoney(transaction.currency, transaction.saleAmount)}
                    </td>
                    <td className="whitespace-nowrap py-3 pl-3 text-right text-sm font-medium text-gray-800 dark:text-gray-100">
                      {transaction.commissionAmount !== null &&
                      transaction.commissionCurrency
                        ? formatMoney(
                            transaction.commissionCurrency,
                            transaction.commissionAmount
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 p-4 text-right dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
