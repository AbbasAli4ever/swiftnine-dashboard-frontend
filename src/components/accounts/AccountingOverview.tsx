"use client";

import Image from "next/image";
import NumberFlow from "@number-flow/react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
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
import {
  balanceSummary,
  kpiCards,
  revenueOverviewByPeriod,
  revenueByPaymentPlatform,
  revenueByCurrency,
  pakistanAccounts,
  internationalAccounts,
  clientRevenueSummary,
  type AccountRow,
} from "@/components/accounts/mockData";

const revenueChartConfig = {
  revenue: { label: "Revenue", color: "#6366f1" },
} satisfies ChartConfig;

const currencyChartConfig = revenueByCurrency.reduce((acc, c) => {
  acc[c.code] = { label: c.code, color: c.color };
  return acc;
}, {} as ChartConfig);

const CARD_CLASS =
  "rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-901";

// Flips to true once, the first time the returned ref's element scrolls into
// view — used to gate one-shot "animate in on scroll" effects (chart entrance
// animations, bar-width transitions) so they play on first visibility rather
// than immediately on mount regardless of scroll position.
function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, threshold]);

  return [ref, inView] as const;
}

const CLIENT_AVATAR_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#0ea5e9", "#a855f7"];

function getNameInitials(name: string) {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function clientAvatarColor(name: string) {
  const hash = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return CLIENT_AVATAR_COLORS[hash % CLIENT_AVATAR_COLORS.length];
}

function AccountAvatar({ account }: { account: AccountRow }) {
  if (account.logo) {
    return (
      <Image
        src={account.logo}
        alt={account.name}
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: account.color }}
    >
      {account.initials}
    </span>
  );
}

type Period = "Daily" | "Weekly" | "Monthly" | "Yearly";
const PERIODS: Period[] = ["Daily", "Weekly", "Monthly", "Yearly"];

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
  const [period, setPeriod] = useState<Period>("Daily");

  const revenue = revenueOverviewByPeriod[period];
  const maxPlatformValue = Math.max(...revenueByPaymentPlatform.map((p) => p.value));

  const revenueChartData = useMemo(
    () => revenue.categories.map((label, i) => ({ label, revenue: revenue.values[i] })),
    [revenue]
  );

  const currencyChartData = useMemo(
    () => revenueByCurrency.map((c) => ({ code: c.code, percent: c.percent, fill: c.color })),
    []
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

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-[#FAFAFF] p-6 dark:bg-gray-907">
      {/* Balance summary and KPI metrics */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-[#FFFFFF] p-4 dark:border-gray-800 dark:bg-gray-901">
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-8 md:col-span-2">
          <div>
            <p className="text-sm text-gray-400">Pakistan Balance</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              <NumberFlow value={numbersRevealed ? balanceSummary.pakistanBalance : 0} prefix={`${balanceSummary.pakistanBalanceCurrency} `} />
            </p>
            <p className="mt-1 text-xs text-gray-400">{balanceSummary.pakistanAccountsCount} accounts</p>
          </div>
          <div className="h-14 w-px shrink-0 bg-gray-200 dark:bg-gray-800" />
          <div>
            <p className="text-sm text-gray-400">International Balance</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              <NumberFlow value={numbersRevealed ? balanceSummary.internationalBalance : 0} prefix={`${balanceSummary.internationalBalanceCurrency} `} />
            </p>
            <p className="mt-1 text-xs text-gray-400">{balanceSummary.internationalAccountsCount} accounts</p>
          </div>
        </div>
        <div className="rounded-xl bg-[#000000] p-4 text-white">
          <p className="text-sm text-gray-300">Total Balance</p>
          <p className="mt-1 text-2xl font-semibold">
            <NumberFlow value={numbersRevealed ? balanceSummary.totalBalance : 0} prefix={`${balanceSummary.totalBalanceCurrency} `} />
          </p>
          <p className="mt-1 text-xs text-gray-400">{balanceSummary.conversionNote}</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className={CARD_CLASS}>
            <p className="text-sm text-gray-400">{kpi.label}</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                <NumberFlow value={numbersRevealed ? kpi.value : 0} prefix={kpi.valuePrefix} format={{ notation: "standard" }} />
              </p>
              <div className="h-8 w-20">
                <ChartContainer
                  config={{ value: { label: kpi.label, color: kpi.color } }}
                  className="h-8 w-20 aspect-auto"
                >
                  <LineChart data={kpi.sparkline.map((v) => ({ value: v }))}>
                    <ReferenceLine
                      y={kpi.sparklineBaseline}
                      stroke="var(--color-value)"
                      strokeOpacity={0.4}
                      strokeDasharray="3 3"
                      strokeWidth={1}
                    />
                    <Line
                      dataKey="value"
                      type="monotone"
                      stroke="var(--color-value)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </div>
            <p className={`mt-1 text-xs ${kpi.deltaPositive ? "text-green-500" : "text-red-500"}`}>{kpi.delta}</p>
          </div>
        ))}
      </div>
      </div>

      {/* Revenue Overview */}
      <div className={`mb-4 ${CARD_CLASS}`}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-normal text-gray-800 dark:text-white">Revenue Overview</h3>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-905">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-white text-brand-500 shadow-sm dark:bg-gray-800 dark:text-brand-400"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <ChartContainer config={revenueChartConfig} className="h-[280px] w-full">
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
            {revenueByPaymentPlatform.map((p, i) => (
              <div key={p.name} className="group flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-gray-600 dark:text-gray-300">{p.name}</span>
                <div className="flex h-2 flex-1 items-center overflow-visible rounded-full bg-brand-100 dark:bg-gray-905">
                  <div
                    className="h-full origin-left rounded-full bg-brand-500 transition-[width,transform] ease-out group-hover:scale-y-150"
                    style={{
                      width: platformInView ? `${(p.value / maxPlatformValue) * 100}%` : "0%",
                      transitionDuration: platformInView ? "700ms, 150ms" : "150ms",
                      transitionDelay: platformInView ? `${i * 60}ms` : "0ms",
                    }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-sm text-gray-800 dark:text-gray-100">
                  ${p.value.toLocaleString()}
                </span>
              </div>
            ))}
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
            <div className="space-y-2.5">
              {revenueByCurrency.map((c) => (
                <div key={c.code} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{c.code}</span>
                  <span className="ml-auto text-sm font-medium text-gray-800 dark:text-gray-100">{c.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Account lists */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD_CLASS}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-normal text-gray-800 dark:text-white">Pakistan Accounts</h3>
              <p className="text-xs text-gray-400">
                {balanceSummary.pakistanBalanceCurrency} {balanceSummary.pakistanBalance.toLocaleString()}
              </p>
            </div>
            <a href="/accounts/balances" className="text-sm font-medium text-brand-500 hover:text-brand-600">
              View all &rarr;
            </a>
          </div>
          <div className="space-y-3">
            {pakistanAccounts.map((a) => (
              <div key={a.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AccountAvatar account={a} />
                  <span className="text-sm text-gray-800 dark:text-gray-100">{a.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{a.balance}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={CARD_CLASS}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-normal text-gray-800 dark:text-white">International Accounts</h3>
              <p className="text-xs text-gray-400">
                {balanceSummary.internationalBalanceCurrency} {balanceSummary.internationalBalance.toLocaleString()}
              </p>
            </div>
            <a href="/accounts/balances" className="text-sm font-medium text-brand-500 hover:text-brand-600">
              View all &rarr;
            </a>
          </div>
          <div className="space-y-3">
            {internationalAccounts.map((a) => (
              <div key={a.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AccountAvatar account={a} />
                  <span className="text-sm text-gray-800 dark:text-gray-100">{a.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{a.balance}</span>
              </div>
            ))}
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
            {clientRevenueSummary.map((c) => (
              <tr key={c.name} className="border-b border-gray-50 last:border-0 dark:border-gray-800/60">
                <td className="py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: clientAvatarColor(c.name) }}
                    >
                      {getNameInitials(c.name)}
                    </span>
                    <span className="text-sm text-gray-800 dark:text-gray-100">{c.name}</span>
                  </div>
                </td>
                <td className="py-3 text-right text-sm font-medium text-gray-800 dark:text-gray-100">
                  {c.totalRevenue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
