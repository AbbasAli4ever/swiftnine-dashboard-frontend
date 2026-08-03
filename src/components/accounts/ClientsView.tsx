"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuSearch, LuUsers, LuX } from "react-icons/lu";
import { createAccountingClients } from "./clientData";

const ROW_HEIGHT = 48;
const TABLE_HEADER_HEIGHT = 40;
const AVATAR_COLORS = ["#e2e7ff", "#dcfce7", "#fef3c7", "#fce7f3", "#dbeafe", "#ede9fe"];
const AVATAR_TEXT = ["#4f46e5", "#15803d", "#b45309", "#be185d", "#1d4ed8", "#7e22ce"];

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function avatarIndex(name: string) {
  return name.split("").reduce((total, letter) => total + letter.charCodeAt(0), 0) % AVATAR_COLORS.length;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function formatRevenue(currency: string, amount: number) {
  return `${currency} ${new Intl.NumberFormat("en-US").format(amount)}`;
}

export default function ClientsView() {
  const clients = useMemo(() => createAccountingClients(), []);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rowHeight, setRowHeight] = useState(ROW_HEIGHT);
  const tableViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = tableViewportRef.current;
    if (!viewport) return;

    const updatePageSize = () => {
      const availableHeight = viewport.clientHeight - TABLE_HEADER_HEIGHT;
      const nextSize = Math.max(1, Math.floor(availableHeight / ROW_HEIGHT));
      const nextRowHeight = availableHeight / nextSize;
      setPageSize((current) => current === nextSize ? current : nextSize);
      setRowHeight((current) => Math.abs(current - nextRowHeight) < 0.1 ? current : nextRowHeight);
      setPage(1);
    };

    const observer = new ResizeObserver(updatePageSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return clients;
    return clients.filter((client) => client.name.toLocaleLowerCase().includes(normalizedQuery));
  }, [clients, query]);

  const pageCount = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleClients = filteredClients.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = filteredClients.length ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(currentPage * pageSize, filteredClients.length);

  const updateQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#fafaff] px-4 py-3 dark:bg-gray-907 sm:px-6">
      <div className="mb-3 flex shrink-0 justify-end">
        <div className="relative w-full sm:w-[262px]">
          <LuUsers aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-700 dark:text-gray-300" />
          <input
            type="search"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Filter client..."
            aria-label="Filter clients"
            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-9 text-sm text-gray-800 shadow-sm outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-901 dark:text-gray-100"
          />
          {query && (
            <button type="button" onClick={() => updateQuery("")} aria-label="Clear client filter" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905 dark:hover:text-gray-200">
              <LuX className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-901">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-gray-200 px-5 dark:border-gray-800">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Clients</h1>
          <span className="text-xs text-gray-400">{filteredClients.length.toLocaleString()} clients</span>
        </div>

        <div ref={tableViewportRef} className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[760px] table-fixed text-left">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--color-gray-200)] dark:bg-gray-901 dark:shadow-[0_1px_0_0_var(--color-gray-800)]">
              <tr className="h-10 text-xs text-gray-400">
                <th className="w-[52%] px-5 font-normal">Client</th>
                <th className="w-[20%] px-5 text-right font-normal">Total Revenue</th>
                <th className="w-[12%] px-5 text-right font-normal">Payments</th>
                <th className="w-[16%] px-5 text-right font-normal">Latest Payment</th>
              </tr>
            </thead>
            <tbody>
              {visibleClients.map((client) => {
                const colorIndex = avatarIndex(client.name);
                return (
                  <tr key={client.id} style={{ height: rowHeight }} className="text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-905/70">
                    <td className="px-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" style={{ backgroundColor: AVATAR_COLORS[colorIndex], color: AVATAR_TEXT[colorIndex] }}>{initials(client.name)}</span>
                        <span className="truncate font-medium text-gray-800 dark:text-gray-200">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-5 text-right font-medium whitespace-nowrap">{formatRevenue(client.currency, client.totalRevenue)}</td>
                    <td className="px-5 text-right">{client.payments}</td>
                    <td className="px-5 text-right text-xs text-gray-500 whitespace-nowrap dark:text-gray-400">{formatDate(client.latestPayment)}</td>
                  </tr>
                );
              })}
              {visibleClients.length === 0 && (
                <tr><td colSpan={4} className="h-64 px-6 text-center"><LuSearch className="mx-auto mb-3 h-9 w-9 text-gray-300" /><p className="font-medium text-gray-700 dark:text-gray-300">No clients found</p><p className="mt-1 text-sm text-gray-400">Try a different client name.</p><button type="button" onClick={() => updateQuery("")} className="mt-4 text-sm font-medium text-brand-500 hover:text-brand-600">Clear filter</button></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex shrink-0 items-center justify-between gap-3 pt-2 text-sm text-gray-600 dark:text-gray-400">
        <span>{rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {filteredClients.length.toLocaleString()}</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-901 dark:hover:bg-gray-905"><LuChevronLeft /></button>
          <button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-901 dark:hover:bg-gray-905"><LuChevronRight /></button>
        </div>
      </div>
    </div>
  );
}
