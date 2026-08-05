import { api } from "@/lib/api";

// ── Envelopes ─────────────────────────────────────────────────────────────────
// The accounting modules use the app's standard response envelope. Unlike most
// of the API these endpoints are NOT workspace-scoped — they ignore the
// `x-workspace-id` header the axios interceptor attaches unconditionally.

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface AccountingMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface PaginatedApiWrapper<T> extends ApiWrapper<T> {
  meta: AccountingMeta;
}

export interface Paginated<T> {
  items: T[];
  meta: AccountingMeta;
}

// ── Shared enums ──────────────────────────────────────────────────────────────

/** Backend `Currency` enum — the only three values the API accepts. */
export const CURRENCIES = ["USD", "HKD", "PKR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Backend `AccountType` enum for bank accounts. */
export const ACCOUNT_TYPES = ["LOCAL", "INTERNATIONAL"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * Backend `PaymentPlatform` enum, verified against schema.prisma:111-119. No
 * `@map` on the enum or its values, so these SCREAMING_CASE literals are exactly
 * what goes over the wire. Use `formatPlatform` for display.
 */
export const PAYMENT_PLATFORMS = [
  "WHOP",
  "AIRWALLEX",
  "SLASH",
  "PAYONEER",
  "WIO_BANK",
  "MAMO",
  "KRAKEN",
] as const;

export type PaymentPlatform = (typeof PAYMENT_PLATFORMS)[number];

export type SortOrder = "asc" | "desc";

// ── Entities ──────────────────────────────────────────────────────────────────

/** Per-currency sale total, as returned in `Clients.totalSaleAmount`. */
export interface CurrencyTotal {
  currency: Currency;
  total: number;
}

export interface AccountingClient {
  id: string;
  clientName: string;
  totalRevenue: number;
  currencyType: Currency | null;
  /** Summed from this client's transactions, grouped by currency. */
  totalSaleAmount: CurrencyTotal[];
  _count: { transactions: number };
  createdAt: string;
  updatedAt: string;
}

/** A client's nested transaction, as returned by `GET /clients/:clientId`. */
export interface ClientTransaction {
  id: string;
  saleAmount: number;
  paymentPlatform: PaymentPlatform;
  currency: Currency;
  refId: string;
  description: string | null;
  saleDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingClientDetail extends AccountingClient {
  transactions: ClientTransaction[];
}

/** Minimal shape returned by `GET /clients/search`. */
export interface ClientSearchResult {
  id: string;
  clientName: string;
}

export interface AccountingTransaction {
  id: string;
  clientId: string;
  /** Denormalized snapshot of the client's name at creation time. */
  clientName: string;
  paymentPlatform: PaymentPlatform;
  currency: Currency;
  saleAmount: number;
  refId: string;
  description: string | null;
  /** When the sale actually happened — distinct from `createdAt` (row insert). */
  saleDate: string;
  createdAt: string;
  updatedAt: string;
  /** Only present on `GET /transactions/:transactionId`. */
  client?: { id: string; clientName: string };
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountType: AccountType;
  currencyType: Currency;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Payloads ──────────────────────────────────────────────────────────────────

export interface CreateClientPayload {
  clientName: string;
  totalRevenue: number;
  currencyType?: Currency;
}

/** `PATCH /clients/:clientId` accepts `clientName` only — revenue and currency
 *  are create-only on the backend today. */
export interface UpdateClientPayload {
  clientName: string;
}

export interface CreateTransactionPayload {
  /** Must resolve to an existing client — the API no longer accepts a bare name. */
  clientId: string;
  refId: string;
  saleAmount: number;
  currency: Currency;
  paymentPlatform: PaymentPlatform;
  /** ISO datetime. Omit to default to now; set it to backdate a late entry. */
  saleDate?: string;
  description?: string;
}

export interface UpdateTransactionPayload {
  clientId?: string;
  /** Send alongside `clientId` on a reassignment — the backend does not refresh
   *  the denormalized name on its own. */
  clientName?: string;
  paymentPlatform?: PaymentPlatform;
  saleAmount?: number;
  currency?: Currency;
  saleDate?: string;
  description?: string;
}

export interface CreateBankAccountPayload {
  bankName: string;
  accountType: AccountType;
  currencyType: Currency;
  amount: number;
}

export type UpdateBankAccountPayload = Partial<CreateBankAccountPayload>;

// ── List params ───────────────────────────────────────────────────────────────

interface BaseListParams {
  q?: string;
  page?: number;
  limit?: number;
  sortOrder?: SortOrder;
}

export interface ClientListParams extends BaseListParams {
  sortBy?: "clientName" | "createdAt" | "updatedAt";
}

export interface TransactionListParams extends BaseListParams {
  clientId?: string;
  /** Serialized comma-separated. */
  paymentPlatform?: PaymentPlatform[];
  currency?: Currency[];
  /**
   * Filter on `saleDate` (not `createdAt`). A bare `YYYY-MM-DD` is expanded
   * server-side to the start/end of that UTC day.
   */
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "createdAt" | "updatedAt" | "clientName" | "saleAmount" | "saleDate";
}

export interface BankAccountListParams extends BaseListParams {
  accountType?: AccountType;
  currencyType?: Currency;
  sortBy?:
    | "createdAt"
    | "updatedAt"
    | "bankName"
    | "accountType"
    | "currencyType"
    | "amount";
}

/**
 * Drops empty values and joins arrays with commas, matching
 * `serializeTaskSearchParams` in task.service.ts. The API accepts
 * comma-separated values for `paymentPlatform` and `currency`.
 */
function serializeParams(
  params?: object
): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;

  const query: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      query[key] = value.join(",");
      continue;
    }
    query[key] = value as string | number | boolean;
  }
  return query;
}

// ── Dashboard overview ────────────────────────────────────────────────────────

export type OverviewPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface RevenueStat {
  totalUsd: number;
  changePercent: number;
}

export interface OverviewResponse {
  balances: {
    byAccountType: {
      accountType: AccountType;
      totals: CurrencyTotal[];
      accountCount: number;
    }[];
    totalBalanceUsd: number;
    exchangeRatesToUsd: Record<string, number>;
  };
  revenueSummary: {
    today: RevenueStat;
    thisMonth: RevenueStat;
    thisYear: RevenueStat;
    totalSales: { count: number; changePercent: number };
  };
  revenueOverview: {
    period: OverviewPeriod;
    /** `label` is YYYY-MM-DD (daily/weekly), YYYY-MM (monthly), or a year. */
    points: { label: string; totalUsd: number }[];
  };
  revenueByPaymentPlatform: {
    paymentPlatform: PaymentPlatform;
    totalUsd: number;
  }[];
  revenueByCurrency: {
    currency: Currency;
    total: number;
    totalUsd: number;
    percent: number;
  }[];
  bankAccounts: {
    local: BankAccount[];
    international: BankAccount[];
  };
  topClients: {
    id: string;
    clientName: string;
    totalRevenue: number;
    currencyType: Currency | null;
  }[];
}

// ── Services ──────────────────────────────────────────────────────────────────

export const clientService = {
  list: (params?: ClientListParams) =>
    api
      .get<PaginatedApiWrapper<AccountingClient[]>>("/clients", {
        params: serializeParams(params),
      })
      .then((r) => ({ items: r.data.data, meta: r.data.meta })),

  /** Word-order-independent name search. Returns a plain array, not paginated. */
  search: (q: string) =>
    api
      .get<ApiWrapper<ClientSearchResult[]>>("/clients/search", {
        params: { q },
      })
      .then((r) => r.data.data),

  get: (clientId: string) =>
    api
      .get<ApiWrapper<AccountingClientDetail>>(`/clients/${clientId}`)
      .then((r) => r.data.data),

  create: (payload: CreateClientPayload) =>
    api
      .post<ApiWrapper<AccountingClient>>("/clients", payload)
      .then((r) => r.data.data),

  update: (clientId: string, payload: UpdateClientPayload) =>
    api
      .patch<ApiWrapper<AccountingClient>>(`/clients/${clientId}`, payload)
      .then((r) => r.data.data),

  /** Rejects with 409 if the client still has transactions. */
  delete: (clientId: string) => api.delete(`/clients/${clientId}`),
};

export const transactionService = {
  list: (params?: TransactionListParams) =>
    api
      .get<PaginatedApiWrapper<AccountingTransaction[]>>("/transactions", {
        params: serializeParams(params),
      })
      .then((r) => ({ items: r.data.data, meta: r.data.meta })),

  get: (transactionId: string) =>
    api
      .get<ApiWrapper<AccountingTransaction>>(`/transactions/${transactionId}`)
      .then((r) => r.data.data),

  /** 404 if `clientId` doesn't exist, 409 if `refId` is already taken. */
  create: (payload: CreateTransactionPayload) =>
    api
      .post<ApiWrapper<AccountingTransaction>>("/transactions", payload)
      .then((r) => r.data.data),

  update: (transactionId: string, payload: UpdateTransactionPayload) =>
    api
      .patch<ApiWrapper<AccountingTransaction>>(
        `/transactions/${transactionId}`,
        payload
      )
      .then((r) => r.data.data),

  delete: (transactionId: string) => api.delete(`/transactions/${transactionId}`),
};

export const bankAccountService = {
  list: (params?: BankAccountListParams) =>
    api
      .get<PaginatedApiWrapper<BankAccount[]>>("/bank-accounts", {
        params: serializeParams(params),
      })
      .then((r) => ({ items: r.data.data, meta: r.data.meta })),

  get: (bankAccountId: string) =>
    api
      .get<ApiWrapper<BankAccount>>(`/bank-accounts/${bankAccountId}`)
      .then((r) => r.data.data),

  create: (payload: CreateBankAccountPayload) =>
    api
      .post<ApiWrapper<BankAccount>>("/bank-accounts", payload)
      .then((r) => r.data.data),

  update: (bankAccountId: string, payload: UpdateBankAccountPayload) =>
    api
      .patch<ApiWrapper<BankAccount>>(
        `/bank-accounts/${bankAccountId}`,
        payload
      )
      .then((r) => r.data.data),

  delete: (bankAccountId: string) =>
    api.delete(`/bank-accounts/${bankAccountId}`),
};

export const accountingDashboardService = {
  /** One call backs the entire overview screen. */
  overview: (period: OverviewPeriod = "daily") =>
    api
      .get<ApiWrapper<OverviewResponse>>("/accounting-dashboard/overview", {
        params: { period },
      })
      .then((r) => r.data.data),
};
