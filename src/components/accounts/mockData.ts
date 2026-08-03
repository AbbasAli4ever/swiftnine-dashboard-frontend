export const balanceSummary = {
  pakistanBalance: 8165000,
  pakistanBalanceCurrency: "PKR",
  pakistanAccountsCount: 10,
  internationalBalance: 102500,
  internationalBalanceCurrency: "USD",
  internationalAccountsCount: 11,
  totalBalance: 131893,
  totalBalanceCurrency: "USD",
  conversionNote: "PKR converted at 278/USD",
};

export type KpiCard = {
  label: string;
  value: number;
  valuePrefix?: string;
  delta: string;
  deltaPositive: boolean;
  color: string;
  sparkline: number[];
  sparklineBaseline: number;
};

// Each sparkline oscillates above/below `sparklineBaseline` — a small dip
// followed by a taller peak — to match the reference mini-chart (dashed
// midline with a low mountain then a high mountain either side of it).
export const kpiCards: KpiCard[] = [
  {
    label: "Today's Revenue",
    value: 7400,
    valuePrefix: "$",
    delta: "+18% vs yesterday",
    deltaPositive: true,
    color: "#8b5cf6",
    sparkline: [4, 8, 2, -6, -14, -4, 6, 16, 10, 2],
    sparklineBaseline: 0,
  },
  {
    label: "This Month's Revenue",
    value: 93100,
    valuePrefix: "$",
    delta: "+60% vs June",
    deltaPositive: true,
    color: "#22c55e",
    sparkline: [-2, 4, -3, -10, -4, 8, 18, 12, 4, -2],
    sparklineBaseline: 0,
  },
  {
    label: "This Year's Revenue",
    value: 363100,
    valuePrefix: "$",
    delta: "-5% 2026 YTD",
    deltaPositive: false,
    color: "#ef4444",
    sparkline: [6, 2, -4, -12, -6, 4, 12, 6, -2, -8],
    sparklineBaseline: 0,
  },
  {
    label: "Total Sales",
    value: 84,
    delta: "-15% this month",
    deltaPositive: false,
    color: "#f59e0b",
    sparkline: [3, -2, -8, -14, -6, 2, 10, 4, -4, -10],
    sparklineBaseline: 0,
  },
];

export const revenueOverviewByPeriod: Record<"Daily" | "Weekly" | "Monthly" | "Yearly", { categories: string[]; values: number[] }> = {
  Daily: {
    categories: ["21 Jul", "22 Jul", "23 Jul", "24 Jul", "25 Jul", "26 Jul", "27 Jul"],
    values: [4200, 4800, 3100, 5400, 4300, 6200, 7400],
  },
  Weekly: {
    categories: ["Week 1", "Week 2", "Week 3", "Week 4"],
    values: [21000, 24500, 19800, 27800],
  },
  Monthly: {
    categories: ["Feb", "Mar", "Apr", "May", "Jun", "Jul"],
    values: [58000, 62000, 71000, 68000, 58000, 93100],
  },
  Yearly: {
    categories: ["2022", "2023", "2024", "2025", "2026"],
    values: [210000, 268000, 312000, 382000, 363100],
  },
};

export type PaymentPlatformRevenue = {
  name: string;
  value: number;
};

export const revenueByPaymentPlatform: PaymentPlatformRevenue[] = [
  { name: "Whop", value: 28400 },
  { name: "Airwallex", value: 18600 },
  { name: "Slash", value: 14200 },
  { name: "Payoneer", value: 9400 },
  { name: "Fanbasis", value: 8100 },
  { name: "Wio Bank", value: 6800 },
  { name: "Mamo", value: 4200 },
  { name: "Kraken", value: 3800 },
  { name: "Other", value: 2100 },
];

export type CurrencyRevenue = {
  code: string;
  percent: number;
  color: string;
};

export const revenueByCurrency: CurrencyRevenue[] = [
  { code: "USD", percent: 42, color: "#6366f1" },
  { code: "EUR", percent: 24, color: "#22d3c9" },
  { code: "GBP", percent: 14, color: "#22c55e" },
  { code: "HKD", percent: 9, color: "#f59e0b" },
  { code: "Kraken", percent: 4, color: "#a855f7" },
  { code: "PKR", percent: 7, color: "#ec4899" },
];

export type AccountRow = {
  name: string;
  balance: string;
  color: string;
  initials: string;
  logo?: string;
};

export const pakistanAccounts: AccountRow[] = [
  { name: "HBL", balance: "PKR 1,250,000", color: "#0f9d58", initials: "H", logo: "/images/accounts/Ellipse 74.svg" },
  { name: "MCB", balance: "PKR 2,100,000", color: "#16a34a", initials: "M", logo: "/images/accounts/Ellipse 75.svg" },
  { name: "UBL", balance: "PKR 850,000", color: "#1d4ed8", initials: "U", logo: "/images/accounts/Ellipse 74 (1).svg" },
];

export const internationalAccounts: AccountRow[] = [
  { name: "Whop", balance: "USD 18,500", color: "#f97316", initials: "W", logo: "/images/accounts/image 1.svg" },
  { name: "Slash - 9Figures", balance: "USD 24,000", color: "#ef4444", initials: "S" },
  { name: "Payoneer", balance: "USD 9,400", color: "#ef4444", initials: "P", logo: "/images/accounts/image 2.svg" },
];

export type ClientRevenue = {
  name: string;
  totalRevenue: string;
};

export const clientRevenueSummary: ClientRevenue[] = [
  { name: "Victoria Partners", totalRevenue: "$32,400" },
  { name: "Anton Enne", totalRevenue: "$24,100" },
  { name: "Phase Shop", totalRevenue: "$18,600" },
  { name: "ABD LTD", totalRevenue: "$11,200" },
];
