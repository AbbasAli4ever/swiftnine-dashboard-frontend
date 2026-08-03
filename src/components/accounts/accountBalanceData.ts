export type BalanceAccount = {
  id: string;
  name: string;
  currency: "PKR" | "USD";
  balance: number;
  updatedAt: string;
  logo?: string;
  color: string;
  initials: string;
};

export const pakistanBalanceAccounts: BalanceAccount[] = [
  { id: "pk-1", name: "HBL", currency: "PKR", balance: 1250000, updatedAt: "28 Jul 2026, 4:30 PM", logo: "/images/accounts/Ellipse 74.svg", color: "#078a73", initials: "HBL" },
  { id: "pk-2", name: "UBL", currency: "PKR", balance: 850000, updatedAt: "28 Jul 2026, 2:15 PM", logo: "/images/accounts/Ellipse 74 (1).svg", color: "#0788ca", initials: "UBL" },
  { id: "pk-3", name: "Alfalah", currency: "PKR", balance: 2100000, updatedAt: "27 Jul 2026, 5:45 PM", logo: "/images/accounts/Ellipse 75.svg", color: "#e11d2e", initials: "A" },
  { id: "pk-4", name: "BOP Trio Bev", currency: "PKR", balance: 420000, updatedAt: "27 Jul 2026, 3:00 PM", logo: "/images/accounts/Ellipse 75 (1).svg", color: "#fa5a1b", initials: "BOP" },
  { id: "pk-5", name: "Alfalah Trio Cafe", currency: "PKR", balance: 950000, updatedAt: "26 Jul 2026, 4:10 PM", logo: "/images/accounts/Ellipse 75.svg", color: "#e11d2e", initials: "A" },
  { id: "pk-6", name: "BOP SwiftNine", currency: "PKR", balance: 680000, updatedAt: "26 Jul 2026, 6:20 PM", logo: "/images/accounts/Ellipse 75 (1).svg", color: "#fa5a1b", initials: "BOP" },
  { id: "pk-7", name: "Faysal", currency: "PKR", balance: 340000, updatedAt: "25 Jul 2026, 5:30 PM", logo: "/images/accounts/Ellipse 75 (2).svg", color: "#f97316", initials: "F" },
  { id: "pk-8", name: "UBL Trio Cafe", currency: "PKR", balance: 275000, updatedAt: "25 Jul 2026, 2:45 PM", logo: "/images/accounts/Ellipse 74 (1).svg", color: "#0788ca", initials: "UBL" },
  { id: "pk-9", name: "Alfalah Trio Cafe", currency: "PKR", balance: 190000, updatedAt: "24 Jul 2026, 4:00 PM", logo: "/images/accounts/Ellipse 75.svg", color: "#e11d2e", initials: "A" },
  { id: "pk-10", name: "HBL Trio Cafe", currency: "PKR", balance: 310000, updatedAt: "24 Jul 2026, 3:15 PM", logo: "/images/accounts/Ellipse 75 (3).svg", color: "#087d78", initials: "HBL" },
];

export const internationalBalanceAccounts: BalanceAccount[] = [
  { id: "int-1", name: "Whop", currency: "USD", balance: 18500, updatedAt: "28 Jul 2026, 4:30 PM", logo: "/images/accounts/image 1.svg", color: "#ff4f23", initials: "W" },
  { id: "int-2", name: "Slash - 9Figures", currency: "USD", balance: 24000, updatedAt: "28 Jul 2026, 3:40 PM", color: "#241f1b", initials: "S" },
  { id: "int-3", name: "Payoneer", currency: "USD", balance: 9400, updatedAt: "28 Jul 2026, 1:20 PM", logo: "/images/accounts/image 2.svg", color: "#ffffff", initials: "P" },
  { id: "int-4", name: "Airwallex Global", currency: "USD", balance: 12800, updatedAt: "27 Jul 2026, 6:10 PM", color: "#111111", initials: "AW" },
  { id: "int-5", name: "Wio Business", currency: "USD", balance: 6800, updatedAt: "27 Jul 2026, 4:05 PM", color: "#6614f4", initials: "WIO" },
  { id: "int-6", name: "Mamo Business", currency: "USD", balance: 4200, updatedAt: "26 Jul 2026, 5:50 PM", color: "#3538ff", initials: "M" },
  { id: "int-7", name: "Kraken Treasury", currency: "USD", balance: 3800, updatedAt: "26 Jul 2026, 2:25 PM", color: "#5743d9", initials: "K" },
  { id: "int-8", name: "Fanbasis", currency: "USD", balance: 8100, updatedAt: "25 Jul 2026, 3:35 PM", color: "#ec4899", initials: "F" },
  { id: "int-9", name: "Whop Reserve", currency: "USD", balance: 7200, updatedAt: "25 Jul 2026, 12:15 PM", logo: "/images/accounts/image 1.svg", color: "#ff4f23", initials: "W" },
  { id: "int-10", name: "Payoneer GBP", currency: "USD", balance: 4300, updatedAt: "24 Jul 2026, 5:00 PM", logo: "/images/accounts/image 2.svg", color: "#ffffff", initials: "P" },
  { id: "int-11", name: "Airwallex EU", currency: "USD", balance: 3400, updatedAt: "24 Jul 2026, 11:45 AM", color: "#111111", initials: "AW" },
];
