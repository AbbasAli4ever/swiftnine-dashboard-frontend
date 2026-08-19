"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { LuCalendarDays, LuChevronDown } from "react-icons/lu";

// Shared filter controls for the accounting screens. Extracted from
// TransactionsView so the Reports screen uses the same implementation rather
// than a copy that drifts — both drive the identical `GET /transactions`
// query params.

export type DatePreset = "all" | "7" | "30" | "custom";

export const DATE_LABELS: Record<DatePreset, string> = {
  all: "Date Range",
  "7": "Last 7 days",
  "30": "Last 30 days",
  custom: "Custom range",
};

/**
 * Date-range filter. Unlike the mock version this drives the server-side
 * `dateFrom`/`dateTo` params, which filter on `saleDate` — so a preset now
 * narrows the whole result set rather than just the current page.
 */
export function DateDropdown({
  preset,
  from,
  to,
  onChange,
  align = "right",
}: {
  preset: DatePreset;
  from: string;
  to: string;
  onChange: (preset: DatePreset, from?: string, to?: string) => void;
  /** Which edge the panel hangs from. The panel is wider than its button, so
   *  a left-positioned control needs `left` or the panel runs off-screen —
   *  and vice versa for a right-aligned filter bar. */
  align?: "left" | "right";
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-10 min-w-[170px] items-center gap-2 rounded-xl border bg-white px-3 text-sm shadow-sm dark:bg-gray-901 ${
          preset !== "all"
            ? "border-brand-500 text-gray-900 dark:text-gray-100"
            : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300"
        }`}
      >
        <LuCalendarDays className="h-5 w-5" />
        <span className="flex-1 text-left">{DATE_LABELS[preset]}</span>
        <LuChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className={`absolute ${align === "left" ? "left-0" : "right-0"} z-30 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-901`}
        >
          {(["all", "7", "30"] as DatePreset[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                onChange(value);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                preset === value
                  ? "bg-brand-500/10 text-brand-500"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"
              }`}
            >
              {DATE_LABELS[value]}
            </button>
          ))}
          <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
          <p className="mb-2 px-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            Custom range
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              From
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => onChange("custom", event.target.value, to)}
                className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              To
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => onChange("custom", from, event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Multi-select checkbox dropdown; selections are sent comma-separated. Generic
 * over the option type so enum unions survive instead of widening to `string`.
 */
export function FilterDropdown<T extends string>({
  label,
  icon,
  values,
  selected,
  onChange,
  formatValue = (value: T) => value,
  align = "right",
}: {
  label: string;
  icon: ReactNode;
  values: readonly T[];
  selected: T[];
  onChange: (values: T[]) => void;
  formatValue?: (value: T) => string;
  /** See `DateDropdown` — the panel is wider than its button. */
  align?: "left" | "right";
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

  const buttonLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? formatValue(selected[0])
        : `${label} (${selected.length})`;

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-10 min-w-[165px] max-w-[230px] items-center gap-2 rounded-xl border bg-white px-3 text-sm shadow-sm transition-colors dark:bg-gray-901 ${
          selected.length
            ? "border-brand-500 text-gray-900 dark:text-gray-100"
            : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300"
        }`}
      >
        <span className="text-lg">{icon}</span>
        <span className="flex-1 truncate text-left">{buttonLabel}</span>
        <LuChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className={`absolute ${align === "left" ? "left-0" : "right-0"} z-30 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-901`}
        >
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {label}
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-brand-500 hover:text-brand-600"
              >
                Clear
              </button>
            )}
          </div>
          <div role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto">
            {values.map((value) => {
              const checked = selected.includes(value);
              return (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange(
                        checked
                          ? selected.filter((item) => item !== value)
                          : [...selected, value]
                      )
                    }
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="truncate">{formatValue(value)}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

