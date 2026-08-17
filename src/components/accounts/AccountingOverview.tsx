"use client";

import NumberFlow from "@number-flow/react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Sector,
  XAxis,
  YAxis,
} from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useAccountingOverview } from "@/hooks/useAccounting";
import type {
  BankAccount,
  Currency,
  OverviewPeriod,
  OverviewResponse,
} from "@/services/accounting.service";
import { avatarColors, initials as nameInitials } from "@/components/accounts/avatar";
import { formatMoney } from "@/components/accounts/platformMeta";
import BankAvatar from "@/components/accounts/BankAvatar";

const revenueChartConfig = {
  revenue: { label: "Revenue", color: "#6366f1" },
} satisfies ChartConfig;

/**
 * Fixed colour per currency so the donut and its legend always agree. Covers
 * all seven `Currency` values — without an entry a slice falls back to grey,
 * and several grey slices at once are indistinguishable from each other.
 */
const CURRENCY_COLORS: Record<string, string> = {
  USD: "#6366f1",
  HKD: "#22c55e",
  PKR: "#f59e0b",
  AED: "#06b6d4",
  EUR: "#ec4899",
  GBP: "#8b5cf6",
  CRYPTO: "#64748b",
};

function currencyColor(code: string) {
  return CURRENCY_COLORS[code] ?? "#94a3b8";
}

const CARD_CLASS =
  "rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-901";

// Flips to true once, the first time the returned ref's element scrolls into
// view — used to gate one-shot "animate in on scroll" effects (chart entrance
// animations, bar-width transitions) so they play on first visibility rather
// than immediately on mount regardless of scroll position.
/** Walks up to the element that actually scrolls, so the observer uses it as
 *  root. This page scrolls inside its own `overflow-y-auto` container and every
 *  ancestor is `overflow-hidden`, so a viewport-rooted observer never fires. */
function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll") return current;
    current = current.parentElement;
  }
  return null;
}

// 0.25 = a quarter of the card must be inside the scroll container before the
// animation plays, so it triggers on arriving at the section rather than the
// moment its top edge peeks into view.
function useInView<T extends HTMLElement>(threshold = 0.25) {
  // Callback ref rather than useRef: these cards render only after the overview
  // data arrives (the component returns a skeleton before that), so a plain ref
  // would still be null when the effect first ran and — since assigning a ref
  // doesn't re-render — the effect would never retry and no observer would ever
  // be created. Storing the node in state re-runs the effect the moment it mounts.
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView || !node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      // `root: null` would watch the viewport, but this page scrolls inside its
      // own overflow-y-auto container, so the viewport never intersects.
      // IntersectionObserver fires once on observe() with the current state, so
      // a card that starts on screen still reveals without needing a scroll —
      // no manual geometry check required.
      { threshold, root: findScrollParent(node) }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, inView, threshold]);

  return [setNode, inView] as const;
}

/** Initials avatar for clients, which have no logo field. */
function NameAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const { background, color } = avatarColors(name);
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={{ width: size, height: size, backgroundColor: background, color }}
    >
      {nameInitials(name)}
    </span>
  );
}

const PERIODS: { label: string; value: OverviewPeriod }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

/**
 * `revenueOverview.points[].label` granularity varies by period: `YYYY-MM-DD`
 * for daily/weekly, `YYYY-MM` for monthly, and a bare year for yearly.
 */
function formatPointLabel(label: string, period: OverviewPeriod): string {
  if (period === "yearly") return label;
  const parts = label.split("-");
  if (period === "monthly" && parts.length >= 2) {
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return Number.isNaN(date.getTime())
      ? label
      : new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" }).format(date);
  }
  const date = new Date(`${label}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? label
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
}

/** `+12.4% vs yesterday` — `changePercent` is already a percentage. */
function formatChange(changePercent: number, comparison: string): string {
  const sign = changePercent > 0 ? "+" : "";
  return `${sign}${changePercent.toFixed(1)}% ${comparison}`;
}

/** Renders a per-currency total list as `PKR 8,165,000 · USD 1,200`. */
function formatCurrencyTotals(totals: { currency: Currency; total: number }[]): string {
  if (totals.length === 0) return "—";
  return totals.map((entry) => formatMoney(entry.currency, entry.total)).join(" · ");
}

/**
 * A balance figure that switches between the currencies present, instead of
 * listing them all side by side. The trigger is styled to match the plain
 * figure next to it — the chevron only appears on hover/focus — so the panel
 * reads identically until the user goes looking for it.
 *
 * Falls back to plain text when there's nothing to switch between (zero or one
 * currency), so a single-currency panel never shows an inert control.
 */
function CurrencyBalanceSelect({
  totals,
}: {
  totals: { currency: Currency; total: number }[];
}) {
  // Default to USD when present — it's the reporting currency — else the first.
  const [selected, setSelected] = useState<Currency | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const active =
    totals.find((entry) => entry.currency === selected) ??
    totals.find((entry) => entry.currency === "USD") ??
    totals[0] ??
    null;

  // Close on outside click / Escape — the dropdown is not a modal, so it
  // shouldn't trap focus, but it must not linger once attention moves away.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!active) {
    return <span className="mt-1 block text-2xl font-semibold text-gray-900 dark:text-gray-100">—</span>;
  }

  const figure = formatMoney(active.currency, active.total);

  if (totals.length < 2) {
    return (
      <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{figure}</p>
    );
  }

  return (
    <div ref={wrapRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`International balance in ${active.currency}. Change currency`}
        className="group flex items-center gap-1.5 text-2xl font-semibold text-gray-900 dark:text-gray-100"
      >
        {figure}
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-gray-400 transition-opacity ${
            open ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-20 mt-1 min-w-40 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          {totals.map((entry) => (
            <li key={entry.currency}>
              <button
                type="button"
                role="option"
                aria-selected={entry.currency === active.currency}
                onClick={() => {
                  setSelected(entry.currency);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  entry.currency === active.currency
                    ? "font-semibold text-gray-900 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-300"
                }`}
              >
                <span>{entry.currency}</span>
                <span>{formatMoney(entry.currency, entry.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function findByAccountType(
  overview: OverviewResponse | null,
  accountType: "LOCAL" | "INTERNATIONAL"
) {
  return overview?.balances.byAccountType.find((entry) => entry.accountType === accountType) ?? null;
}

function AccountRowItem({ account }: { account: BankAccount }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <BankAvatar bankName={account.bankName} logoUrl={account.logoUrl} size={28} />
        <span className="text-sm text-gray-800 dark:text-gray-100">{account.bankName}</span>
      </div>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
        {formatMoney(account.currencyType, account.amount)}
      </span>
    </div>
  );
}

/** Inline pulse blocks — the repo has no shared skeleton component. */
function OverviewSkeleton() {
  return (
    <div className="flex h-full flex-1 flex-col gap-4 overflow-y-auto bg-[#FAFAFF] p-6 dark:bg-gray-907">
      <div className="h-[188px] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
      <div className="h-[340px] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-[300px] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-[300px] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  );
}

const ACTIVE_SECTOR_GROW = 8;
const ACTIVE_SECTOR_DURATION = 550;

// Shares the hovered slice's code with AnimatedSector instances without
// recreating Pie's `shape` render function on every render (see note below).
const ActiveCurrencyContext = createContext<string | undefined>(undefined);

// Recharts has no built-in tween for a Pie slice's outerRadius on hover, and
// `activeShape` unmounts on mouse-leave (so it can only grow, never shrink
// back smoothly). Rendering every slice through this `shape`, always
// mounted, and ramping outerRadius with rAF based on whether its code is the
// hovered one gives a symmetric grow/shrink transition.
//
// Must stay a stable, named component reference (not an inline arrow
// function passed to Pie's `shape` prop) — an inline function is a new
// component type on every render, which would remount this on every parent
// re-render and reset the animation instead of tweening from where it left off.
// Reads the active code from context (rather than a prop) so the `shape`
// callback itself never needs to change identity when hover state updates.
function AnimatedSector(props: PieSectorDataItem) {
  const activeCode = useContext(ActiveCurrencyContext);
  const code = (props.payload as { code?: string } | undefined)?.code;
  const isActive = code !== undefined && code === activeCode;
  const baseOuterRadius = Number(props.outerRadius) || 90;
  const target = isActive ? baseOuterRadius + ACTIVE_SECTOR_GROW : baseOuterRadius;
  const [radius, setRadius] = useState(baseOuterRadius);
  const radiusRef = useRef(radius);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = radiusRef.current;
    const to = target;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = Math.min((now - start) / ACTIVE_SECTOR_DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      radiusRef.current = next;
      setRadius(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return <Sector {...props} outerRadius={radius} />;
}

export default function AccountingOverview() {
  const [period, setPeriod] = useState<OverviewPeriod>("daily");
  const { overview, isLoading, isFetching, error } = useAccountingOverview(period);
  // The chart still shows the previous period's points until the new response
  // lands, so signal that rather than letting the toggle look unresponsive.
  const isSwitchingPeriod =
    isFetching && overview?.revenueOverview.period !== period;

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const local = findByAccountType(overview, "LOCAL");
  const international = findByAccountType(overview, "INTERNATIONAL");

  const bankRows = overview?.revenueByBankAccount ?? [];
  const currencyRows = overview?.revenueByCurrency ?? [];
  // Bar widths key off the USD figure — `totalRevenue` is nullable when an
  // account holds more than one currency, `totalRevenueUsd` never is.
  const maxBankValue = Math.max(1, ...bankRows.map((row) => row.totalRevenueUsd));

  const revenueChartData = useMemo(
    () =>
      (overview?.revenueOverview.points ?? []).map((point) => ({
        label: formatPointLabel(point.label, overview?.revenueOverview.period ?? period),
        revenue: point.totalUsd,
      })),
    [overview, period]
  );

  const currencyChartData = useMemo(
    () =>
      (overview?.revenueByCurrency ?? []).map((entry) => ({
        code: entry.currency,
        percent: entry.percent,
        fill: currencyColor(entry.currency),
      })),
    [overview]
  );

  const currencyChartConfig = useMemo(
    () =>
      (overview?.revenueByCurrency ?? []).reduce((config, entry) => {
        config[entry.currency] = {
          label: entry.currency,
          color: currencyColor(entry.currency),
        };
        return config;
      }, {} as ChartConfig),
    [overview]
  );

  const [activeCurrencyCode, setActiveCurrencyCode] = useState<string | undefined>(undefined);

  // NumberFlow only animates the transition between two values it has
  // rendered — it can't sweep from 0 on its very first paint since it has no
  // prior value to diff against. Rendering 0 first, then flipping to the
  // real numbers a tick after mount, gives it that transition to animate.
  const [numbersRevealed, setNumbersRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setNumbersRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const [donutCardRef, donutInView] = useInView<HTMLDivElement>();
  const [platformCardRef, platformInView] = useInView<HTMLDivElement>();

  // Only block on the very first load — period switches refetch in place so the
  // chart doesn't collapse to a skeleton on every toggle.
  if (isLoading && !overview) return <OverviewSkeleton />;

  if (!overview) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-[#FAFAFF] p-6 dark:bg-gray-907">
        <div className="text-center">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            Couldn&apos;t load the accounting overview
          </p>
          <p className="mt-1 text-sm text-gray-400">{error ?? "Please try again."}</p>
        </div>
      </div>
    );
  }

  const { revenueSummary, balances } = overview;

  const kpiCards = [
    {
      label: "Today's Revenue",
      value: revenueSummary.today.totalUsd,
      valuePrefix: "USD ",
      changePercent: revenueSummary.today.changePercent,
      comparison: "vs yesterday",
    },
    {
      label: "This Month's Revenue",
      value: revenueSummary.thisMonth.totalUsd,
      valuePrefix: "USD ",
      changePercent: revenueSummary.thisMonth.changePercent,
      comparison: "vs last month",
    },
    {
      label: "This Year's Revenue",
      value: revenueSummary.thisYear.totalUsd,
      valuePrefix: "USD ",
      changePercent: revenueSummary.thisYear.changePercent,
      comparison: "vs last year",
    },
    {
      label: "Total Sales",
      value: revenueSummary.totalSales.count,
      valuePrefix: "",
      changePercent: revenueSummary.totalSales.changePercent,
      comparison: "vs last month",
    },
  ];

  // The rates are a hardcoded table on the backend, not a live FX feed — say so
  // rather than implying the conversion is current. Only the currencies this
  // workspace actually holds are listed: the table always carries all seven,
  // and printing rates for currencies with no accounts pushed this to three
  // lines while telling the reader nothing about their own balances.
  const heldCurrencies = new Set(
    balances.byAccountType.flatMap((group) => group.totals.map((entry) => entry.currency))
  );
  const nonUsdRates = Object.entries(balances.exchangeRatesToUsd).filter(
    ([code]) => code !== "USD" && heldCurrencies.has(code as Currency)
  );
  const conversionNote = nonUsdRates.length
    ? `Converted at ${nonUsdRates
        .map(([code, rate]) => `${code} ${rate}/USD`)
        .join(", ")}`
    : "Converted to USD";

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-[#FAFAFF] p-6 dark:bg-gray-907">
      {/* Balance summary and KPI metrics */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-[#FFFFFF] p-4 dark:border-gray-800 dark:bg-gray-901">
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-8 md:col-span-2">
          <div>
            <p className="text-sm text-gray-400">Local Balance</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrencyTotals(local?.totals ?? [])}
            </p>
            <p className="mt-1 text-xs text-gray-400">{local?.accountCount ?? 0} accounts</p>
          </div>
          <div className="h-14 w-px shrink-0 bg-gray-200 dark:bg-gray-800" />
          <div>
            <p className="text-sm text-gray-400">International Balance</p>
            <CurrencyBalanceSelect totals={international?.totals ?? []} />
            <p className="mt-1 text-xs text-gray-400">
              {international?.accountCount ?? 0} accounts
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-[#000000] p-4 text-white">
          <p className="text-sm text-gray-300">Total Balance</p>
          <p className="mt-1 text-2xl font-semibold">
            <NumberFlow value={numbersRevealed ? balances.totalBalanceUsd : 0} prefix="USD " />
          </p>
          {/* Hard-clamped to two lines — the rate list scales with how many
              currencies the workspace holds, and this card sits in a fixed-height
              row alongside the balance panels. */}
          <p className="mt-1 line-clamp-2 text-xs text-gray-400" title={conversionNote}>
            {conversionNote}
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className={CARD_CLASS}>
            <p className="text-sm text-gray-400">{kpi.label}</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                <NumberFlow
                  value={numbersRevealed ? kpi.value : 0}
                  prefix={kpi.valuePrefix}
                  format={{ notation: "standard" }}
                />
              </p>
            </div>
            <p
              className={`mt-1 text-xs ${
                kpi.changePercent >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {formatChange(kpi.changePercent, kpi.comparison)}
            </p>
          </div>
        ))}
      </div>
      </div>

      {/* Revenue Overview */}
      <div className={`mb-4 ${CARD_CLASS}`}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-normal text-gray-800 dark:text-white">Revenue Overview</h3>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-905">
            {PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  period === option.value
                    ? "bg-white text-brand-500 shadow-sm dark:bg-gray-800 dark:text-brand-400"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <ChartContainer
          config={revenueChartConfig}
          className={`h-[280px] w-full transition-opacity duration-200 ${
            isSwitchingPeriod ? "opacity-40" : "opacity-100"
          }`}
        >
          <AreaChart data={revenueChartData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical horizontal strokeDasharray="4 4" strokeOpacity={0.8} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12, fill: "#9ca3af" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              tickFormatter={(val: number) => `$${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => `$${Number(value).toLocaleString()}`}
                />
              }
            />
            <Area
              dataKey="revenue"
              type="monotone"
              stroke="var(--color-revenue)"
              strokeWidth={2.5}
              fill="url(#revenueFill)"
            />
          </AreaChart>
        </ChartContainer>
      </div>

      {/* Bank account bar list + currency donut */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD_CLASS} ref={platformCardRef}>
          <h3 className="mb-4 text-base font-normal text-gray-800 dark:text-white">Revenue by Bank Account</h3>
          {/* Fixed height with internal scroll — the account list is uncapped
              (every account renders, including zero-sale ones), so without this
              the card grows past its neighbour as accounts are added. */}
          <div className="no-scrollbar h-[300px] space-y-3 overflow-y-auto pr-1">
            {bankRows.map((row, i) => (
              <div key={row.id} className="group flex items-center gap-3">
                <BankAvatar bankName={row.bankName} size={24} />
                <span className="w-20 shrink-0 truncate text-sm text-gray-600 dark:text-gray-300">
                  {row.bankName}
                </span>
                <div className="flex h-2 flex-1 items-center overflow-visible rounded-full bg-brand-100 dark:bg-gray-905">
                  <div
                    className="h-full origin-left rounded-full bg-brand-500 transition-[width,transform] ease-out group-hover:scale-y-150"
                    style={{
                      width: platformInView
                        ? `${(row.totalRevenueUsd / maxBankValue) * 100}%`
                        : "0%",
                      transitionDuration: platformInView ? "700ms, 150ms" : "150ms",
                      transitionDelay: platformInView ? `${i * 60}ms` : "0ms",
                    }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-sm text-gray-800 dark:text-gray-100">
                  ${row.totalRevenueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
            {bankRows.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">No bank accounts yet.</p>
            )}
          </div>
        </div>

        <div className={CARD_CLASS} ref={donutCardRef}>
          <h3 className="mb-4 text-base font-normal text-gray-800 dark:text-white">Revenue by Currency</h3>
          {/* Matches the bank list's fixed height so the two cards stay level.
              Centred so the donut + legend pair sits as a unit rather than
              hugging the left edge of a much wider card. */}
          <div className="flex h-[300px] items-center justify-center gap-6">
            <ActiveCurrencyContext.Provider value={activeCurrencyCode}>
              {donutInView && currencyChartData.length > 0 ? (
                <ChartContainer config={currencyChartConfig} className="aspect-square h-[220px] w-[220px] shrink-0">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="code" formatter={(value) => `${value}%`} hideLabel />} />
                    <Pie
                      data={currencyChartData}
                      dataKey="percent"
                      nameKey="code"
                      innerRadius={55}
                      outerRadius={90}
                      cornerRadius={5}
                      strokeWidth={2}
                      isAnimationActive
                      animationBegin={0}
                      animationDuration={1500}
                      animationEasing="ease-out"
                      shape={AnimatedSector}
                      onMouseEnter={(data: PieSectorDataItem) =>
                        setActiveCurrencyCode((data.payload as { code?: string } | undefined)?.code)
                      }
                      onMouseLeave={() => setActiveCurrencyCode(undefined)}
                    >
                      {currencyChartData.map((entry) => (
                        <Cell key={entry.code} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              ) : currencyChartData.length === 0 ? (
                /* Empty state: a grey ring standing in for the donut, so the
                   card shows what kind of visual appears once sales exist
                   rather than reading as a broken/blank panel. */
                <div
                  aria-hidden="true"
                  className="flex h-[220px] w-[220px] shrink-0 items-center justify-center"
                >
                  <div className="h-[180px] w-[180px] rounded-full border-25 border-gray-100 dark:border-gray-800" />
                </div>
              ) : (
                /* Pre-scroll spacer — data exists but the card isn't in view
                   yet, so the donut holds its layout until the animation runs. */
                <div aria-hidden="true" className="h-[220px] w-[220px] shrink-0" />
              )}
            </ActiveCurrencyContext.Provider>
            {/* Shrink-to-fit rather than `flex-1` — the percentages are
                right-aligned so they line up as a column, which with a wide
                legend strands the number at the far edge of the card. */}
            <div className="no-scrollbar max-h-full min-w-0 space-y-2.5 overflow-y-auto pr-1">
              {currencyRows.map((entry) => (
                <div key={entry.currency} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: currencyColor(entry.currency) }}
                  />
                  <span className="w-12 text-sm text-gray-600 dark:text-gray-300">
                    {entry.currency}
                  </span>
                  {/* Fixed width + right-align keeps percentages in a tidy column
                      across rows without stretching the legend to fill the card. */}
                  <span className="w-14 text-right text-sm font-medium text-gray-800 dark:text-gray-100">
                    {entry.percent.toFixed(1)}%
                  </span>
                </div>
              ))}
              {currencyRows.length === 0 && (
                <p className="text-sm text-gray-400">No sales recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account lists */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD_CLASS}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-normal text-gray-800 dark:text-white">Local Accounts</h3>
              <p className="text-xs text-gray-400">{formatCurrencyTotals(local?.totals ?? [])}</p>
            </div>
            <a href="/accounts/balances" className="text-sm font-medium text-brand-500 hover:text-brand-600">
              View all &rarr;
            </a>
          </div>
          <div className="space-y-3">
            {overview.bankAccounts.local.map((account) => (
              <AccountRowItem key={account.id} account={account} />
            ))}
            {overview.bankAccounts.local.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">No local accounts yet.</p>
            )}
          </div>
        </div>

        <div className={CARD_CLASS}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-normal text-gray-800 dark:text-white">International Accounts</h3>
              <p className="text-xs text-gray-400">
                {formatCurrencyTotals(international?.totals ?? [])}
              </p>
            </div>
            <a href="/accounts/balances" className="text-sm font-medium text-brand-500 hover:text-brand-600">
              View all &rarr;
            </a>
          </div>
          <div className="space-y-3">
            {overview.bankAccounts.international.map((account) => (
              <AccountRowItem key={account.id} account={account} />
            ))}
            {overview.bankAccounts.international.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">
                No international accounts yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Client revenue summary */}
      <div className={CARD_CLASS}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-normal text-gray-800 dark:text-white">Client Revenue Summary</h3>
          <a href="/accounts/clients" className="text-sm font-medium text-brand-500 hover:text-brand-600">
            View all clients &rarr;
          </a>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
              <th className="pb-2 font-normal">Client</th>
              <th className="pb-2 text-right font-normal">Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            {overview.topClients.map((client) => (
              <tr
                key={client.id}
                className="border-b border-gray-50 last:border-0 dark:border-gray-800/60"
              >
                <td className="py-3">
                  <div className="flex items-center gap-2.5">
                    <NameAvatar name={client.clientName} />
                    <span className="text-sm text-gray-800 dark:text-gray-100">
                      {client.clientName}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-right text-sm font-medium text-gray-800 dark:text-gray-100">
                  {formatMoney(client.currencyType ?? "USD", client.totalRevenue)}
                </td>
              </tr>
            ))}
            {overview.topClients.length === 0 && (
              <tr>
                <td colSpan={2} className="py-6 text-center text-sm text-gray-400">
                  No clients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
