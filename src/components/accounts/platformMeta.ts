import type { Currency, PaymentPlatform } from "@/services/accounting.service";

type PlatformStyle = { label: string; color: string; initials: string; logo?: string };

/**
 * Display metadata for the seven `PaymentPlatform` enum values
 * (schema.prisma:111-119). Keyed by a normalized form of the value: the wire
 * format is SCREAMING_CASE, but keying this way means an unrecognized or
 * differently-cased value still resolves instead of falling through to a
 * generated placeholder.
 */
const PLATFORM_STYLES: Record<string, PlatformStyle> = {
  whop: { label: "Whop", color: "#ff4f23", initials: "W", logo: "/images/accounts/image 1.svg" },
  airwallex: { label: "Airwallex", color: "#111111", initials: "AW" },
  slash: { label: "Slash", color: "#2a241f", initials: "S" },
  payoneer: { label: "Payoneer", color: "#ffffff", initials: "P", logo: "/images/accounts/image 2.svg" },
  wiobank: { label: "Wio Bank", color: "#6614f4", initials: "WIO" },
  mamo: { label: "Mamo", color: "#3538ff", initials: "M" },
  kraken: { label: "Kraken", color: "#5743d9", initials: "K" },
};

/** Strips case, underscores, spaces and hyphens so `WIO_BANK` === `Wio Bank`. */
function normalizeKey(platform: PaymentPlatform): string {
  return platform.toLowerCase().replace(/[\s_-]/g, "");
}

/** Human-readable platform name — falls back to title-casing the raw enum value. */
export function formatPlatform(platform: PaymentPlatform): string {
  const known = PLATFORM_STYLES[normalizeKey(platform)];
  if (known) return known.label;
  return platform
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Colour/initials/logo for a platform, generated deterministically if unknown. */
export function getPlatformStyle(platform: PaymentPlatform): PlatformStyle {
  const known = PLATFORM_STYLES[normalizeKey(platform)];
  if (known) return known;

  const label = formatPlatform(platform);
  return {
    label,
    color: colorFromString(platform),
    initials: label.slice(0, 2).toUpperCase(),
  };
}

const FALLBACK_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

/** Stable colour per string so the same platform/bank always renders alike. */
export function colorFromString(value: string): string {
  const sum = value
    .split("")
    .reduce((total, letter) => total + letter.charCodeAt(0), 0);
  return FALLBACK_COLORS[sum % FALLBACK_COLORS.length];
}

/** `USD 1,234.56` — money formatting shared across the accounting screens. */
export function formatMoney(currency: Currency | string, amount: number): string {
  return `${currency} ${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

/**
 * Formats an ISO timestamp as `04 Aug 2026`, in UTC — matches how the API
 * interprets whole-day values, so a sale date never renders off by one.
 */
export function formatIsoDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * `YYYY-MM-DD` for an `<input type="date">`, read in UTC.
 *
 * `saleDate` is a whole-day value semantically, and the API expands a bare
 * `YYYY-MM-DD` to UTC day boundaries — so reading it back in UTC keeps a sale
 * dated the 4th from displaying as the 3rd for users behind UTC.
 */
export function toDateInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Today as `YYYY-MM-DD` in UTC, to pair with `toDateInputValue`. */
export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * `YYYY-MM-DD` from a date input → midday-UTC ISO datetime. Midday rather than
 * midnight so the calendar date survives a timezone shift in either direction.
 */
export function fromDateInputValue(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Formats an ISO timestamp as `04 Aug 2026, 14:30`. */
export function formatIsoDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
