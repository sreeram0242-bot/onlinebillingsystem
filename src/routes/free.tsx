import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { loadBills, loadMenu, formatDate, todayISO, type Bill } from "@/lib/loyalty";

type Period = "today" | "weekly" | "custom";

export const Route = createFileRoute("/free")({
  head: () => ({ meta: [{ title: "Free Items Given — Engineers Kitchen" }] }),
  component: FreePage,
});

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function FreePage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  useEffect(() => { setBills(loadBills()); }, []);

  const range = useMemo<[string, string]>(() => {
    const today = todayISO();
    if (period === "today") return [today, today];
    if (period === "weekly") return [daysAgo(6), today];
    return [from || today, to || today];
  }, [period, from, to]);

  const menuPriceMap = useMemo(() => new Map(loadMenu().map((m) => [m.name, m.price])), []);

  const rows = useMemo(() => {
    const list: { date: string; name?: string; phone?: string; item: string; qty: number; value: number }[] = [];
    for (const b of bills) {
      if (b.date < range[0] || b.date > range[1]) continue;
      if (b.freeItem) list.push({ date: b.date, name: b.name, phone: b.phone, item: b.freeItem.name, qty: 1, value: b.freeItem.price });
      for (const it of b.items) {
        if (it.isFree) {
          const unit = menuPriceMap.get(it.name) ?? it.price ?? 0;
          list.push({ date: b.date, name: b.name, phone: b.phone, item: it.name, qty: it.qty, value: unit * it.qty });
        }
      }
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [bills, range, menuPriceMap]);

  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);

  // Aggregate by item
  const byItem = new Map<string, { qty: number; value: number }>();
  for (const r of rows) {
    const s = byItem.get(r.item) ?? { qty: 0, value: 0 };
    s.qty += r.qty; s.value += r.value;
    byItem.set(r.item, s);
  }
  const itemAgg = Array.from(byItem.entries())
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl text-primary sm:text-3xl">🎁 Free Items Given</h1>
        <Link to="/revenue" className="btn-ghost text-sm">← Revenue</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["today", "weekly", "custom"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full border-2 px-4 py-1 text-xs font-bold uppercase tracking-wider ${
              period === p ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >{p}</button>
        ))}
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="input-field w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-muted-foreground">→</span>
            <input type="date" className="input-field w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-elevated p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Total Value</div>
          <div className="mt-2 font-display text-3xl text-accent">₹{totalValue.toLocaleString("en-IN")}</div>
        </div>
        <div className="card-elevated p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Items Given</div>
          <div className="mt-2 font-display text-3xl text-foreground">{totalQty}</div>
        </div>
      </div>

      {itemAgg.length > 0 && (
        <section className="card-menu p-3 sm:p-5">
          <h2 className="font-display text-lg text-primary sm:text-xl">By Item</h2>
          <div className="mt-3 space-y-1 text-sm">
            {itemAgg.map((it) => (
              <div key={it.name} className="flex items-center justify-between gap-2 border-t border-border py-2 first:border-t-0 first:pt-0">
                <span className="min-w-0 truncate"><span className="font-medium">{it.name}</span> <span className="text-muted-foreground">× {it.qty}</span></span>
                <span className="shrink-0 font-bold text-accent tabular-nums">₹{it.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card-menu p-3 sm:p-5">
        <h2 className="font-display text-lg text-primary sm:text-xl">All Free Items</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No free items given in this period.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border-t border-border pt-2 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{formatDate(r.date)}</div>
                  <div className="truncate font-medium">{r.item} <span className="text-muted-foreground">× {r.qty}</span></div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.phone ? <>{r.name || "—"} · {r.phone}</> : "Walk-in"}
                  </div>
                </div>
                <div className="shrink-0 font-bold text-accent tabular-nums">₹{r.value}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
