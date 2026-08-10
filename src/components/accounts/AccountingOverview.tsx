"use client";

import Image from "next/image";
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
import { formatMoney, formatPlatform } from "@/components/accounts/platformMeta";

const revenueChartConfig = {
  revenue: { label: "Revenue", color: "#6366f1" },
} satisfies ChartConfig;

/** Fixed colour per currency so the donut and its legend always agree. */
const CURRENCY_COLORS: Record<string, string> = {
  USD: "#6366f1",
  HKD: "#22c55e",
  PKR: "#f59e0b",
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

/** Initials avatar — the API has no logo field for clients or bank accounts. */
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
        {account.logoUrl ? (
          <Image
            src={account.logoUrl}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded-full bg-white object-contain"
            unoptimized
          />
        ) : (
          <NameAvatar name={account.bankName} />
        )}
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

  const platformRows = overview?.revenueByPaymentPlatform ?? [];
  const maxPlatformValue = Math.max(1, ...platformRows.map((p) => p.totalUsd));

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
  // rather than implying the conversion is current.
  const nonUsdRates = Object.entries(balances.exchangeRatesToUsd).filter(
    ([code]) => code !== "USD"
  );
  const conversionNote = nonUsdRates.length
    ? `Converted at ${nonUsdRates
        .map(([code, rate]) => `${code} ${(1 / rate).toFixed(0)}/USD`)
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
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrencyTotals(international?.totals ?? [])}
            </p>
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
          <p className="mt-1 text-xs text-gray-400">{conversionNote}</p>
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

      {/* Platform bar list + currency donut */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD_CLASS} ref={platformCardRef}>
          <h3 className="mb-4 text-base font-normal text-gray-800 dark:text-white">Revenue by Payment Platform</h3>
          <div className="space-y-3">
            {platformRows.map((platform, i) => (
              <div key={platform.paymentPlatform} className="group flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-sm text-gray-600 dark:text-gray-300">
                  {formatPlatform(platform.paymentPlatform)}
                </span>
                <div className="flex h-2 flex-1 items-center overflow-visible rounded-full bg-brand-100 dark:bg-gray-905">
                  <div
                    className="h-full origin-left rounded-full bg-brand-500 transition-[width,transform] ease-out group-hover:scale-y-150"
                    style={{
                      width: platformInView
                        ? `${(platform.totalUsd / maxPlatformValue) * 100}%`
                        : "0%",
                      transitionDuration: platformInView ? "700ms, 150ms" : "150ms",
                      transitionDelay: platformInView ? `${i * 60}ms` : "0ms",
                    }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-sm text-gray-800 dark:text-gray-100">
                  ${platform.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
            {platformRows.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">No platform revenue yet.</p>
            )}
          </div>
        </div>

        <div className={CARD_CLASS} ref={donutCardRef}>
          <h3 className="mb-4 text-base font-normal text-gray-800 dark:text-white">Revenue by Currency</h3>
          <div className="flex items-center gap-6">
            <ActiveCurrencyContext.Provider value={activeCurrencyCode}>
              {donutInView ? (
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
              ) : (
                <div aria-hidden="true" className="h-[220px] w-[220px] shrink-0" />
              )}
            </ActiveCurrencyContext.Provider>
            <div className="min-w-0 flex-1 space-y-2.5">
              {overview.revenueByCurrency.map((entry) => (
                <div key={entry.currency} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: currencyColor(entry.currency) }}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {entry.currency}
                  </span>
                  <span className="ml-auto text-sm font-medium text-gray-800 dark:text-gray-100">
                    {entry.percent.toFixed(1)}%
                  </span>
                </div>
              ))}
              {overview.revenueByCurrency.length === 0 && (
                <p className="text-sm text-gray-400">No revenue recorded yet.</p>
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
