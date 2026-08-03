export type Transaction = {
  id: string;
  date: string;
  client: string;
  platform: string;
  account: string;
  currency: string;
  amount: number;
  logo?: string;
};

export const PLATFORM_META: Record<string, { color: string; initials: string; logo?: string }> = {
  Whop: { color: "#ff4f23", initials: "W", logo: "/images/accounts/image 1.svg" },
  Airwallex: { color: "#111111", initials: "AW" },
  Slash: { color: "#2a241f", initials: "S" },
  Payoneer: { color: "#ffffff", initials: "P", logo: "/images/accounts/image 2.svg" },
  "Wio Bank": { color: "#6614f4", initials: "WIO" },
  Mamo: { color: "#3538ff", initials: "M" },
  Kraken: { color: "#5743d9", initials: "K" },
  Fanbasis: { color: "#ec4899", initials: "F" },
};

const clients = ["Victoria Partners", "Anton Enne", "Phase Shop", "ABD LTD", "Northstar Labs", "Nova Commerce"];
const platforms = ["Whop", "Airwallex", "Slash", "Payoneer", "Wio Bank", "Mamo", "Kraken", "Fanbasis"];
const currencies = ["USD", "EUR", "USD", "GBP", "USD", "USD", "HKD"];
const accounts: Record<string, string[]> = {
  Whop: ["Whop Main", "Whop Reserve"],
  Airwallex: ["Airwallex Global", "Airwallex EU"],
  Slash: ["Slash - 9Figures"],
  Payoneer: ["Payoneer Main", "Payoneer GBP"],
  "Wio Bank": ["Wio Business"],
  Mamo: ["Mamo Business"],
  Kraken: ["Kraken Treasury"],
  Fanbasis: ["Fanbasis Main"],
};

const referenceRows: Omit<Transaction, "id" | "logo">[] = [
  { date: "2026-07-28", client: "Victoria Partners", platform: "Whop", account: "Whop Main", currency: "USD", amount: 2400 },
  { date: "2026-07-28", client: "Anton Enne", platform: "Airwallex", account: "Airwallex EU", currency: "EUR", amount: 1800 },
  { date: "2026-07-27", client: "Phase Shop", platform: "Slash", account: "Slash - 9Figures", currency: "USD", amount: 950 },
  { date: "2026-07-27", client: "ABD LTD", platform: "Payoneer", account: "Payoneer GBP", currency: "GBP", amount: 1200 },
  { date: "2026-07-26", client: "Victoria Partners", platform: "Whop", account: "Whop Main", currency: "USD", amount: 3100 },
  { date: "2026-07-26", client: "Anton Enne", platform: "Payoneer", account: "Payoneer Main", currency: "USD", amount: 750 },
  { date: "2026-07-25", client: "Phase Shop", platform: "Wio Bank", account: "Wio Business", currency: "HKD", amount: 8400 },
  { date: "2026-07-25", client: "ABD LTD", platform: "Mamo", account: "Mamo Business", currency: "USD", amount: 620 },
  { date: "2026-07-24", client: "Victoria Partners", platform: "Whop", account: "Whop Reserve", currency: "USD", amount: 2800 },
  { date: "2026-07-23", client: "Anton Enne", platform: "Kraken", account: "Kraken Treasury", currency: "USD", amount: 1100 },
];

export function createTransactions(): Transaction[] {
  const rows: Transaction[] = referenceRows.map((row, index) => ({
    ...row,
    id: `TX-${String(index + 1).padStart(4, "0")}`,
    logo: PLATFORM_META[row.platform]?.logo,
  }));

  for (let index = rows.length; index < 460; index += 1) {
    const platform = platforms[index % platforms.length];
    const date = new Date(Date.UTC(2026, 6, 22));
    date.setUTCDate(date.getUTCDate() - Math.floor((index - rows.length) / 3));
    const currency = currencies[(index * 3 + 1) % currencies.length];
    rows.push({
      id: `TX-${String(index + 1).padStart(4, "0")}`,
      date: date.toISOString().slice(0, 10),
      client: clients[(index * 5 + 2) % clients.length],
      platform,
      account: accounts[platform][index % accounts[platform].length],
      currency,
      amount: 420 + ((index * 137) % 9100),
      logo: PLATFORM_META[platform]?.logo,
    });
  }

  return rows;
}
