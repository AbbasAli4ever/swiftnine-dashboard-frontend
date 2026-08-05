"use client";

import { useEffect, useRef, useState } from "react";
import { LuChevronDown, LuPlus, LuX } from "react-icons/lu";
import { useClientSearch } from "@/hooks/useAccounting";
import type { ClientSearchResult } from "@/services/accounting.service";

/**
 * Search-backed client combobox. `POST /transactions` requires a resolved
 * `clientId` — the API dropped the old find-or-create-by-name behavior — so this
 * is the only way to attach a sale to a client.
 *
 * `onCreateRequest`, when provided, surfaces a "Create <term>" row so an
 * accountant entering a sale for a first-time client isn't stuck.
 */
export default function ClientPicker({
  value,
  onChange,
  onCreateRequest,
  label = "Client",
  placeholder = "Search clients...",
  autoFocus = false,
  error,
}: {
  value: ClientSearchResult | null;
  onChange: (client: ClientSearchResult | null) => void;
  onCreateRequest?: (clientName: string) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  error?: string;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { results, isLoading } = useClientSearch(term);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const select = (client: ClientSearchResult) => {
    onChange(client);
    setTerm("");
    setOpen(false);
  };

  const trimmed = term.trim();
  const showCreate =
    onCreateRequest &&
    trimmed.length > 0 &&
    !isLoading &&
    !results.some((r) => r.clientName.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
      {label}
      <div ref={containerRef} className="relative mt-1.5">
        {value ? (
          // Once resolved, show the selection as a chip — the id is what matters
          // downstream, so free-typing over it would be misleading.
          <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800">
            <span className="flex-1 truncate text-sm text-gray-800 dark:text-gray-100">
              {value.clientName}
            </span>
            <button
              type="button"
              aria-label="Clear selected client"
              onClick={() => {
                onChange(null);
                setOpen(true);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905"
            >
              <LuX className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              autoFocus={autoFocus}
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              aria-label={label}
              className={`h-10 w-full rounded-lg border bg-white px-3 pr-9 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:bg-gray-800 dark:text-gray-100 ${
                error
                  ? "border-red-400"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            />
            <LuChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        )}

        {open && !value && (
          <div className="absolute left-0 right-0 z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {trimmed.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">
                Start typing to search clients.
              </p>
            )}
            {trimmed.length > 0 && isLoading && (
              <p className="px-3 py-2 text-xs text-gray-400">Searching...</p>
            )}
            {results.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => select(client)}
                className="block w-full truncate rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"
              >
                {client.clientName}
              </button>
            ))}
            {trimmed.length > 0 && !isLoading && results.length === 0 && !showCreate && (
              <p className="px-3 py-2 text-xs text-gray-400">No clients found.</p>
            )}
            {showCreate && (
              <button
                type="button"
                onClick={() => {
                  onCreateRequest(trimmed);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-brand-500 hover:bg-brand-500/10"
              >
                <LuPlus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Create &ldquo;{trimmed}&rdquo;</span>
              </button>
            )}
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
