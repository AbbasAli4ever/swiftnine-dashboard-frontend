export type AccountingClient = {
  id: string;
  name: string;
  totalRevenue: number;
  currency: string;
  payments: number;
  latestPayment: string;
};

const referenceClients: Omit<AccountingClient, "id">[] = [
  { name: "Victoria Partners", totalRevenue: 32400, currency: "USD", payments: 18, latestPayment: "2026-07-28" },
  { name: "Anton Enne", totalRevenue: 24100, currency: "USD", payments: 12, latestPayment: "2026-07-28" },
  { name: "Phase Shop", totalRevenue: 18600, currency: "USD", payments: 9, latestPayment: "2026-07-25" },
  { name: "ABD LTD", totalRevenue: 11200, currency: "USD", payments: 8, latestPayment: "2026-07-24" },
];

const firstNames = ["Avery", "Blake", "Cameron", "Drew", "Emerson", "Finley", "Harper", "Jordan", "Kai", "Logan", "Morgan", "Parker"];
const companyWords = ["Commerce", "Labs", "Partners", "Digital", "Studio", "Ventures", "Media", "Collective", "Systems", "Works"];

export function createAccountingClients(): AccountingClient[] {
  const clients: AccountingClient[] = referenceClients.map((client, index) => ({
    ...client,
    id: `CL-${String(index + 1).padStart(4, "0")}`,
  }));

  for (let index = clients.length; index < 120; index += 1) {
    const date = new Date(Date.UTC(2026, 6, 23));
    date.setUTCDate(date.getUTCDate() - index);
    clients.push({
      id: `CL-${String(index + 1).padStart(4, "0")}`,
      name: `${firstNames[index % firstNames.length]} ${companyWords[(index * 3) % companyWords.length]}`,
      totalRevenue: 4800 + ((index * 1729) % 84000),
      currency: "USD",
      payments: 3 + ((index * 7) % 42),
      latestPayment: date.toISOString().slice(0, 10),
    });
  }

  return clients;
}
