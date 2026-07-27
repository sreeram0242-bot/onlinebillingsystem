// LocalStorage-backed data layer for Engineers Kitchen loyalty tracker.

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category?: string;
  costPrice?: number;
};

export const DEFAULT_CATEGORIES = [
  "Tiffins",
  "Rice Specials",
  "Starters & Specials",
  "Biryani",
  "Beverages & Desserts",
];

export const STREAK_TARGET = 6;

export type AppSettings = {
  hotelName: string;
  requireCustomerDetails: boolean;
  streakOfferEnabled: boolean;
  freeItemsEnabled: boolean;
  tablesEnabled: boolean;
  printEnabled: boolean;
  tableNames: string[];
  gstPercentage: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  hotelName: "Ram Mess",
  requireCustomerDetails: true,
  streakOfferEnabled: false,
  freeItemsEnabled: false,
  tablesEnabled: false,
  printEnabled: false,
  tableNames: ["T1", "T2", "T3", "T4"],
  gstPercentage: 5,
};

export type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
};

export type BillItem = { name: string; price: number; qty: number; costPrice?: number; isFree?: boolean };
export type Bill = {
  id: string;
  phone: string;
  name: string;
  date: string; // YYYY-MM-DD
  items: BillItem[];
  subtotal?: number;
  gstAmount?: number;
  gstPercentage?: number;
  total: number;
  freeItem?: { name: string; price: number; costPrice?: number } | null;
  tableName?: string;
  orderNo?: number;
  paymentMethod?: string; // CASH | GPAY | SPLIT
  splitCash?: number;
  splitGpay?: number;
};

export type DeletedBill = Bill & { deletedAt: string };

export function categoryFromId(id: string): string {
  if (id.startsWith("t")) return "Tiffins";
  if (id.startsWith("rs")) return "Rice Specials";
  if (id.startsWith("st")) return "Starters & Specials";
  if (id.startsWith("b")) return "Biryani";
  if (id.startsWith("bv")) return "Beverages & Desserts";
  return "Other";
}
export function getCategoryOf(item: MenuItem): string {
  if (item.category && item.category.trim()) return item.category.trim();
  if (/^[a-z]+[0-9]+$/.test(item.id)) return categoryFromId(item.id);
  return "Other";
}

export const DEFAULT_MENU: MenuItem[] = [
  // Tiffins
  { id: "t1", name: "Plain Dosa", price: 50, category: "Tiffins" },
  { id: "t2", name: "Masala Dosa", price: 70, category: "Tiffins" },
  { id: "t3", name: "Ghee Roast Dosa", price: 90, category: "Tiffins" },
  { id: "t4", name: "Mysore Masala Dosa", price: 85, category: "Tiffins" },
  { id: "t5", name: "Onion Rava Dosa", price: 80, category: "Tiffins" },
  { id: "t6", name: "Steamed Idli (2 pcs)", price: 40, category: "Tiffins" },
  { id: "t7", name: "Medu Vada (2 pcs)", price: 45, category: "Tiffins" },
  { id: "t8", name: "Onion Uttapam", price: 75, category: "Tiffins" },
  { id: "t9", name: "Ven Pongal", price: 60, category: "Tiffins" },
  { id: "t10", name: "Puri Bhaji (3 pcs)", price: 65, category: "Tiffins" },
  // Rice Specials
  { id: "rs1", name: "South Indian Meals / Thali", price: 120, category: "Rice Specials" },
  { id: "rs2", name: "Sambar Rice", price: 70, category: "Rice Specials" },
  { id: "rs3", name: "Curd Rice", price: 60, category: "Rice Specials" },
  { id: "rs4", name: "Lemon Rice", price: 65, category: "Rice Specials" },
  { id: "rs5", name: "Tamarind Rice (Pulihora)", price: 65, category: "Rice Specials" },
  { id: "rs6", name: "Bisi Bele Bath", price: 80, category: "Rice Specials" },
  { id: "rs7", name: "Tomato Rice", price: 70, category: "Rice Specials" },
  { id: "rs8", name: "Ghee Sambar Vada", price: 55, category: "Rice Specials" },
  // Starters & Specials
  { id: "st1", name: "Chicken 65", price: 130, category: "Starters & Specials" },
  { id: "st2", name: "Gobi 65", price: 90, category: "Starters & Specials" },
  { id: "st3", name: "Paneer 65", price: 110, category: "Starters & Specials" },
  { id: "st4", name: "Chicken Chukka", price: 140, category: "Starters & Specials" },
  { id: "st5", name: "Egg Poriyal / Burji", price: 60, category: "Starters & Specials" },
  { id: "st6", name: "Mutton Chukka", price: 180, category: "Starters & Specials" },
  { id: "st7", name: "Fish Fry (Seer / Nethili)", price: 160, category: "Starters & Specials" },
  // Biryani
  { id: "b1", name: "Hyderabadi Veg Dum Biryani", price: 120, category: "Biryani" },
  { id: "b2", name: "Ambur Chicken Biryani", price: 160, category: "Biryani" },
  { id: "b3", name: "Mutton Biryani", price: 220, category: "Biryani" },
  // Beverages & Desserts
  { id: "bv1", name: "South Indian Filter Coffee", price: 30, category: "Beverages & Desserts" },
  { id: "bv2", name: "Rava Kesari", price: 45, category: "Beverages & Desserts" },
  { id: "bv3", name: "Paal Payasam", price: 50, category: "Beverages & Desserts" },
  { id: "bv4", name: "Badam Milk", price: 40, category: "Beverages & Desserts" },
];

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function computeLoyalty(bills: Bill[], phone: string) {
  const custBills = bills.filter((b) => b.phone === phone);
  const dates = Array.from(new Set(custBills.map((b) => b.date))).sort();
  if (dates.length === 0) {
    return { streak: 0, lastVisit: null as string | null, eligibleToday: false, visitDates: [] as string[] };
  }
  const lastVisit = dates[dates.length - 1];
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    const d = dates[i];
    if (i < dates.length - 1) {
      if (d !== addDaysISO(dates[i + 1], -1)) break;
    }
    streak++;
    const claimedFree = custBills.some((b) => b.date === d && !!b.freeItem);
    if (claimedFree) break;
  }
  const today = todayISO();
  let eligibleToday = false;
  if (lastVisit === addDaysISO(today, -1) && streak >= STREAK_TARGET) {
    eligibleToday = true;
  } else if (lastVisit === today && streak >= STREAK_TARGET) {
    const todayBill = custBills.find((b) => b.date === today);
    if (!todayBill?.freeItem) eligibleToday = true;
  }
  return { streak, lastVisit, eligibleToday, visitDates: dates };
}

export type CustomerSummary = {
  phone: string;
  name: string;
  totalVisits: number;
  totalSpent: number;
  lastVisit: string | null;
  streak: number;
  eligibleToday: boolean;
};

export function getCustomers(bills: Bill[]): CustomerSummary[] {
  const byPhone = new Map<string, Bill[]>();
  for (const b of bills) {
    if (!b.phone) continue;
    const arr = byPhone.get(b.phone);
    if (arr) arr.push(b);
    else byPhone.set(b.phone, [b]);
  }
  const out: CustomerSummary[] = [];
  for (const [phone, custBills] of byPhone) {
    const dates = Array.from(new Set(custBills.map((x) => x.date))).sort();
    const lastVisit = dates[dates.length - 1] ?? null;
    let streak = 0;
    if (dates.length > 0) {
      for (let i = dates.length - 1; i >= 0; i--) {
        const d = dates[i];
        if (i < dates.length - 1) {
          if (d !== addDaysISO(dates[i + 1], -1)) break;
        }
        streak++;
        const claimedFree = custBills.some((b) => b.date === d && !!b.freeItem);
        if (claimedFree) break;
      }
    }

    const today = todayISO();
    let eligibleToday = false;
    if (lastVisit === addDaysISO(today, -1) && streak >= STREAK_TARGET) eligibleToday = true;
    else if (lastVisit === today && streak >= STREAK_TARGET) {
      const todayBill = custBills.find((b) => b.date === today);
      if (!todayBill?.freeItem) eligibleToday = true;
    }
    const lastName = [...custBills].sort((a, b) => b.date.localeCompare(a.date))[0]?.name ?? "";
    out.push({
      phone,
      name: lastName,
      totalVisits: dates.length,
      totalSpent: custBills.reduce((s, b) => s + b.total, 0),
      lastVisit,
      streak,
      eligibleToday,
    });
  }
  return out.sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? ""));
}

export function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function nextOrderNumberForDate(bills: Bill[], date: string): number {
  const dayBills = bills.filter((b) => b.date === date);
  if (dayBills.length === 0) return 1;
  return Math.max(...dayBills.map((b) => b.orderNo || 0)) + 1;
}

