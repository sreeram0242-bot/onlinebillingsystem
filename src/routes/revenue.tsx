import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  loadBills,
  loadExpenses,
  addExpense,
  deleteExpense,
  loadSettings,
  loadMenu,
  formatDate,
  newId,
  todayISO,
  loadDeletedBills,
  clearDeletedBills,
  type Bill,
  type Expense,
  type AppSettings,
  type DeletedBill,
} from "@/lib/loyalty";

type Period = "daily" | "monthly" | "yearly" | "custom";

export const Route = createFileRoute("/revenue")({
  head: () => ({ meta: [{ title: "Revenue — Engineers Kitchen" }] }),
  component: RevenuePage,
});

function periodRange(p: Period, customFrom: string, customTo: string): [string, string] {
  const today = todayISO();
  if (p === "daily") return [today, today];
  if (p === "monthly") return [today.slice(0, 7) + "-01", today];
  if (p === "yearly") return [today.slice(0, 4) + "-01-01", today];
  return [customFrom || today, customTo || today];
}

function inRange(iso: string, [from, to]: [string, string]) {
  return iso >= from && iso <= to;
}

function RevenuePage() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [customFrom, setCustomFrom] = useState(todayISO());
  const [customTo, setCustomTo] = useState(todayISO());
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [deletedBills, setDeletedBills] = useState<DeletedBill[]>([]);

  const [expDate, setExpDate] = useState(todayISO());
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");

  function refresh() {
    setBills(loadBills());
    setExpenses(loadExpenses());
    setSettings(loadSettings());
    setDeletedBills(loadDeletedBills());
  }
  useEffect(() => { refresh(); }, []);

  const range = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo]);
  const filteredBills = bills.filter((b) => inRange(b.date, range));
  const filteredExpenses = expenses.filter((e) => inRange(e.date, range));

  const revenue = filteredBills.reduce((s, b) => s + b.total, 0);
  const menuCostMap = new Map(loadMenu().map((m) => [m.name, m.costPrice ?? 0]));

  const totalCogs = filteredBills.reduce(
    (s, b) => {
      let cogs = b.items.reduce((x, it) => x + (it.costPrice ?? 0) * it.qty, 0);
      if (b.freeItem) {
        cogs += b.freeItem.costPrice ?? menuCostMap.get(b.freeItem.name) ?? 0;
      }
      return s + cogs;
    },
    0,
  );
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = revenue - totalCogs - totalExpenses;

  // Top 10 items
  const itemQty = new Map<string, number>();
  for (const b of filteredBills) {
    for (const it of b.items) itemQty.set(it.name, (itemQty.get(it.name) ?? 0) + it.qty);
    if (b.freeItem) itemQty.set(b.freeItem.name, (itemQty.get(b.freeItem.name) ?? 0) + 1);
  }
  const top10 = Array.from(itemQty.entries())
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Table-wise
  const tableStats = new Map<string, { bills: number; revenue: number }>();
  for (const b of filteredBills) {
    if (!b.tableName) continue;
    const s = tableStats.get(b.tableName) ?? { bills: 0, revenue: 0 };
    s.bills++;
    s.revenue += b.total;
    tableStats.set(b.tableName, s);
  }

  // Free items log (loyalty free + any item marked isFree). Value = original menu price.
  const menuPriceMap = new Map(loadMenu().map((m) => [m.name, m.price]));
  const freeItemsLog: { date: string; name?: string; phone?: string; item: string; qty: number; value: number }[] = [];
  for (const b of filteredBills) {
    if (b.freeItem) freeItemsLog.push({ date: b.date, name: b.name, phone: b.phone, item: b.freeItem.name, qty: 1, value: b.freeItem.price });
    for (const it of b.items) {
      if (it.isFree) {
        const unit = menuPriceMap.get(it.name) ?? it.price ?? 0;
        freeItemsLog.push({ date: b.date, name: b.name, phone: b.phone, item: it.name, qty: it.qty, value: unit * it.qty });
      }
    }
  }
  freeItemsLog.sort((a, b) => b.date.localeCompare(a.date));
  const freeCount = freeItemsLog.reduce((s, f) => s + f.qty, 0);
  const freeTotalValue = freeItemsLog.reduce((s, f) => s + (f.value || 0), 0);

  function addExp(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    if (!expDesc.trim() || !Number.isFinite(amt) || amt <= 0) { toast.error("Enter description and amount"); return; }
    addExpense({ id: newId(), date: expDate, description: expDesc.trim(), amount: amt });
    setExpDesc(""); setExpAmount("");
    refresh();
    toast.success("Expense added");
  }
  function removeExp(id: string) {
    if (!confirm("Delete this expense?")) return;
    deleteExpense(id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">Revenue & Analytics</h1>
        <Link to="/bills" className="btn-ghost text-sm">All bills →</Link>
      </div>

      {/* Period toggle */}
      <div className="flex flex-wrap gap-2">
        {(["daily", "monthly", "yearly", "custom"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full border-2 px-4 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
              period === p ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >{p === "daily" ? "Today" : p}</button>
        ))}
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="input-field w-auto" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-muted-foreground">→</span>
            <input type="date" className="input-field w-auto" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Revenue" value={`₹${revenue.toLocaleString("en-IN")}`} hint={settings?.gstPercentage ? "incl. GST" : undefined} />
        <Metric label="Net Profit" value={`₹${netProfit.toLocaleString("en-IN")}`} tone={netProfit >= 0 ? "good" : "bad"} />
        <Link to="/bills" className="card-elevated p-4 hover:border-primary">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Total Bills</div>
          <div className="mt-2 font-display text-3xl text-foreground">{filteredBills.length}</div>
        </Link>
        <Link to="/free" className="card-elevated p-4 hover:border-accent">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">🎁 Free Given</div>
          <div className="mt-2 font-display text-3xl text-accent">₹{freeTotalValue.toLocaleString("en-IN")}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">{freeCount} item{freeCount !== 1 ? "s" : ""} · tap for details</div>
        </Link>
      </div>


      {/* Expenses */}
      <section className="card-menu p-5">
        <h2 className="font-display text-xl text-primary">Expenses</h2>
        <form onSubmit={addExp} className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-[160px_1fr_140px_auto]">
          <input type="date" className="input-field" value={expDate} onChange={(e) => setExpDate(e.target.value)} />
          <input className="input-field sm:col-span-2 md:col-span-1" placeholder="Description" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} />
          <input className="input-field" placeholder="Amount ₹" inputMode="decimal" value={expAmount} onChange={(e) => setExpAmount(e.target.value.replace(/[^\d.]/g, ""))} />
          <button type="submit" className="btn-accent">+ Add</button>
        </form>

        {filteredExpenses.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No expenses in this period.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-1">Date</th><th>Description</th><th className="text-right">Amount</th><th></th></tr>
              </thead>
              <tbody>
                {filteredExpenses.sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="py-2">{formatDate(e.date)}</td>
                    <td>{e.description}</td>
                    <td className="text-right font-bold">₹{e.amount}</td>
                    <td className="text-right">
                      <button onClick={() => removeExp(e.id)} className="text-destructive hover:underline">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Top 10 chart */}
      <section className="card-menu p-5">
        <h2 className="font-display text-xl text-primary">Top 10 Selling Items</h2>
        {top10.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No sales in this period.</p>
        ) : (
          <div className="mt-3 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qty" fill="#064e3b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Tables */}
      {settings?.tablesEnabled && tableStats.size > 0 && (
        <section className="card-menu p-5">
          <h2 className="font-display text-xl text-primary">Table-wise Sales</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-1 pr-3">Table</th><th className="pr-3 text-right">Bills</th><th className="text-right">Revenue</th></tr>
              </thead>
              <tbody>
                {Array.from(tableStats.entries()).sort((a, b) => b[1].revenue - a[1].revenue).map(([t, s]) => (
                  <tr key={t} className="border-t border-border">
                    <td className="py-2 pr-3 font-bold whitespace-nowrap">{t}</td>
                    <td className="pr-3 text-right">{s.bills}</td>
                    <td className="text-right font-bold whitespace-nowrap">₹{s.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </section>
      )}

      {/* Free items */}
      {freeItemsLog.length > 0 && (
        <section className="card-menu p-5">
          <h2 className="font-display text-xl text-primary">🎁 Free Items Given</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-1 pr-3">Date</th><th className="pr-3">Customer</th><th className="pr-3">Item</th><th className="text-right">Value</th></tr>
              </thead>
              <tbody>
                {freeItemsLog.map((f, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(f.date)}</td>
                    <td className="pr-3">{f.name} <span className="text-muted-foreground">· {f.phone}</span></td>
                    <td className="pr-3">{f.item}</td>
                    <td className="text-right font-bold whitespace-nowrap text-accent">₹{f.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </section>
      )}

      {/* Security: Deleted Bills Log */}
      <section className="card-menu p-5 border-destructive/20 mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-destructive flex items-center gap-2">
            <span>🛡️</span> Security: Deleted Bills Log
          </h2>
          {deletedBills.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear the deleted bills log permanently?")) {
                  clearDeletedBills();
                  refresh();
                  toast.success("Log cleared");
                }
              }}
              className="text-xs text-muted-foreground hover:text-destructive hover:underline"
            >
              Clear Log
            </button>
          )}
        </div>
        
        {deletedBills.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No bills have been deleted.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deletedBills.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)).map(b => (
              <div key={b.id} className="card-soft p-4 border-destructive/30">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-destructive">
                      Deleted: {new Date(b.deletedAt).toLocaleString()}
                    </div>
                    <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                      Original Date: {formatDate(b.date)} • Order #{b.orderNo || "?"}
                    </div>
                  </div>
                  <div className="font-display text-lg text-primary">₹{b.total}</div>
                </div>
                {b.name && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Customer: {b.name} ({b.phone})
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground pt-2 border-t border-border space-y-1">
                  {b.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{it.qty}x {it.name}</span>
                      <span>₹{it.price * it.qty}</span>
                    </div>
                  ))}
                  {b.freeItem && (
                    <div className="flex justify-between text-accent">
                      <span>1x {b.freeItem.name}</span>
                      <span>Free</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-primary" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="card-elevated p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl leading-none ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
