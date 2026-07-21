// LocalStorage-backed data layer for Engineers Kitchen loyalty tracker.

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category?: string;
  costPrice?: number;
};

export const DEFAULT_CATEGORIES = [
  "Sandwiches",
  "Burgers",
  "Fries",
  "Manchurian",
  "Noodles",
  "Rice",
  "Momos",
  "Mojito",
];

const CATEGORIES_KEY = "ek_categories_v1";
const MENU_KEY = "ek_menu_v1";
const BILLS_KEY = "ek_bills_v1";
const DELETED_BILLS_KEY = "ek_deleted_bills_v1";
const EXPENSES_KEY = "ek_expenses_v1";
const SETTINGS_KEY = "ek_settings_v1";

export const STREAK_TARGET = 6;

export type AppSettings = {
  hotelName: string;
  requireCustomerDetails: boolean;
  streakOfferEnabled: boolean;
  tablesEnabled: boolean;
  tableNames: string[];
  gstPercentage: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  hotelName: "Engineers Kitchen",
  requireCustomerDetails: true,
  streakOfferEnabled: true,
  tablesEnabled: false,
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
};

export type DeletedBill = Bill & { deletedAt: string };

function isBrowser() {
  return typeof window !== "undefined";
}

export function categoryFromId(id: string): string {
  if (id.startsWith("mo")) return "Momos";
  if (id.startsWith("mj")) return "Mojito";
  if (id.startsWith("s")) return "Sandwiches";
  if (id.startsWith("b")) return "Burgers";
  if (id.startsWith("f")) return "Fries";
  if (id.startsWith("m")) return "Manchurian";
  if (id.startsWith("n")) return "Noodles";
  if (id.startsWith("r")) return "Rice";
  return "Other";
}
export function getCategoryOf(item: MenuItem): string {
  if (item.category && item.category.trim()) return item.category.trim();
  // Only apply legacy ID-based categorization to original seed data (e.g., s1, b2, mo3)
  if (/^[a-z]+[0-9]+$/.test(item.id)) return categoryFromId(item.id);
  return "Other";
}

export function loadCategories(): string[] {
  if (!isBrowser()) return DEFAULT_CATEGORIES;
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}
export function saveCategories(cats: string[]) {
  if (!isBrowser()) return;
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
}

export const DEFAULT_MENU: MenuItem[] = [
  { id: "s1", name: "Veg sandwich", price: 39 },
  { id: "s2", name: "Club sandwich", price: 39 },
  { id: "s3", name: "Veg korean toasty sandwich", price: 59 },
  { id: "s4", name: "Veg loaded sandwich / Paneer", price: 59 },
  { id: "s5", name: "Chicken sandwich", price: 69 },
  { id: "s6", name: "Chicken loaded sandwich", price: 89 },
  { id: "s7", name: "Egg stuffed sandwich", price: 69 },
  { id: "s8", name: "Chicken Korean toasty sandwich", price: 79 },
  { id: "s9", name: "Chocolate sandwich", price: 59 },
  { id: "s10", name: "Bread omelette", price: 39 },
  { id: "b1", name: "Veg Burger", price: 59 },
  { id: "b2", name: "Veg Gochujang burger", price: 69 },
  { id: "b3", name: "Chicken burger", price: 79 },
  { id: "b4", name: "Ramali chicken burger", price: 99 },
  { id: "b5", name: "Chicken gochujang burger", price: 99 },
  { id: "b6", name: "Fried chicken burger", price: 89 },
  { id: "b7", name: "Chicken smashed burger", price: 110 },
  { id: "b8", name: "Double decker burger", price: 139 },
  { id: "f1", name: "Classical french fries", price: 39 },
  { id: "f2", name: "Peri peri french fries", price: 59 },
  { id: "f3", name: "Veg loaded fries", price: 79 },
  { id: "f4", name: "Chicken loaded fries", price: 139 },
  { id: "f5", name: "Korean hot toasty fries", price: 59 },
  { id: "f6", name: "Chilli potato pops", price: 59 },
  { id: "f7", name: "Fried chicken wings (3pcs)", price: 79 },
  { id: "f8", name: "Lays chicken", price: 79 },
  { id: "f9", name: "Fried chicken lollipop (3pcs)", price: 79 },
  { id: "f10", name: "Korean Toasty popcorn", price: 139 },
  { id: "f11", name: "Korean toasty wings", price: 139 },
  { id: "f12", name: "Korean Toasty lollipop", price: 139 },
  { id: "f13", name: "Chicken pop corn", price: 99 },
  { id: "m1", name: "Veg manchurian", price: 59 },
  { id: "m2", name: "Paneer spicy manchurian", price: 69 },
  { id: "m3", name: "Chicken spicy manchurian", price: 69 },
  { id: "m4", name: "Crispy chicken manchurian", price: 79 },
  { id: "n1", name: "Veg noodles", price: 59 },
  { id: "n2", name: "Egg noodles", price: 69 },
  { id: "n3", name: "Chicken noodles", price: 79 },
  { id: "n4", name: "Crispy chicken noodles", price: 110 },
  { id: "n5", name: "Korean special veg noodles", price: 69 },
  { id: "n6", name: "Korean special egg noodles", price: 79 },
  { id: "n7", name: "Korean special chicken noodles", price: 99 },
  { id: "n8", name: "Schezwan veg noodles", price: 69 },
  { id: "n9", name: "Schezwan egg noodles", price: 79 },
  { id: "n10", name: "Schezwan chicken noodles", price: 99 },
  { id: "r1", name: "Veg rice", price: 59 },
  { id: "r2", name: "Egg rice", price: 69 },
  { id: "r3", name: "Chicken rice", price: 79 },
  { id: "r4", name: "Crispy chicken rice", price: 110 },
  { id: "r5", name: "Korean special veg rice", price: 69 },
  { id: "r6", name: "Korean special egg rice", price: 79 },
  { id: "r7", name: "Korean special chicken rice", price: 99 },
  { id: "r8", name: "Schezwan veg rice", price: 69 },
  { id: "r9", name: "Schezwan egg rice", price: 79 },
  { id: "r10", name: "Schezwan chicken rice", price: 89 },
  { id: "mo1", name: "Veg momos", price: 59 },
  { id: "mo2", name: "Paneer momos", price: 69 },
  { id: "mo3", name: "Chicken momos", price: 79 },
  { id: "mj1", name: "Deep blue sky mojito", price: 69 },
  { id: "mj2", name: "Lemon and mint mojito", price: 69 },
  { id: "mj3", name: "Green apple mojito", price: 69 },
  { id: "mj4", name: "Triple sip extra vibe mojito", price: 79 },
  { id: "mj5", name: "Peach mojito", price: 79 },
  { id: "mj6", name: "Lemon soda", price: 49 },
];

export function loadMenu(): MenuItem[] {
  if (!isBrowser()) return DEFAULT_MENU;
  try {
    const raw = localStorage.getItem(MENU_KEY);
    if (!raw) {
      localStorage.setItem(MENU_KEY, JSON.stringify(DEFAULT_MENU));
      return DEFAULT_MENU;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_MENU;
  } catch {
    return DEFAULT_MENU;
  }
}
export function saveMenu(items: MenuItem[]) {
  if (!isBrowser()) return;
  localStorage.setItem(MENU_KEY, JSON.stringify(items));
}

export function loadBills(): Bill[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(BILLS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export function saveBills(bills: Bill[]) {
  if (!isBrowser()) return;
  localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
}
export function addBill(bill: Bill) {
  const all = loadBills();
  all.push(bill);
  saveBills(all);
}

export function updateBill(id: string, updated: Bill) {
  const all = loadBills();
  const idx = all.findIndex((b) => b.id === id);
  if (idx !== -1) {
    all[idx] = updated;
    saveBills(all);
  }
}

export function loadDeletedBills(): DeletedBill[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(DELETED_BILLS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearDeletedBills() {
  if (!isBrowser()) return;
  localStorage.removeItem(DELETED_BILLS_KEY);
}

export function deleteBill(id: string) {
  const all = loadBills();
  const billToDelete = all.find((b) => b.id === id);
  if (billToDelete) {
    const deletedList = loadDeletedBills();
    deletedList.push({ ...billToDelete, deletedAt: new Date().toISOString() });
    localStorage.setItem(DELETED_BILLS_KEY, JSON.stringify(deletedList));
  }
  saveBills(all.filter((b) => b.id !== id));
}

export function loadExpenses(): Expense[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export function saveExpenses(exps: Expense[]) {
  if (!isBrowser()) return;
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(exps));
}
export function addExpense(e: Expense) {
  const all = loadExpenses();
  all.push(e);
  saveExpenses(all);
}
export function deleteExpense(id: string) {
  saveExpenses(loadExpenses().filter((e) => e.id !== id));
}

export function loadSettings(): AppSettings {
  if (!isBrowser()) return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? { ...DEFAULT_SETTINGS, ...parsed } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export function saveSettings(s: AppSettings) {
  if (!isBrowser()) return;
  // enforce dependency: streak requires customer details
  const normalized: AppSettings = {
    ...s,
    streakOfferEnabled: s.requireCustomerDetails ? s.streakOfferEnabled : false,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("ek-settings-change"));
}

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

// Backup / restore
const BACKUP_KEYS = [
  CATEGORIES_KEY,
  MENU_KEY,
  BILLS_KEY,
  DELETED_BILLS_KEY,
  EXPENSES_KEY,
  SETTINGS_KEY,
] as const;

export function exportBackup(): string {
  const data: Record<string, unknown> = {};
  for (const k of BACKUP_KEYS) {
    const raw = localStorage.getItem(k);
    if (raw) data[k] = JSON.parse(raw);
  }
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

export function importBackup(json: string) {
  const parsed = JSON.parse(json);
  const data = parsed?.data ?? parsed;
  for (const k of BACKUP_KEYS) {
    if (data[k] !== undefined) {
      localStorage.setItem(k, JSON.stringify(data[k]));
    }
  }
  window.dispatchEvent(new CustomEvent("ek-settings-change"));
}
