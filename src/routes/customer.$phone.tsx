import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  computeLoyalty,
  deleteBill,
  formatDate,
  loadBills,
  STREAK_TARGET,
  type Bill,
} from "@/lib/loyalty";
import { StreakDots } from "./index";

export const Route = createFileRoute("/customer/$phone")({
  head: () => ({ meta: [{ title: "Customer — Engineers Kitchen" }] }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { phone } = Route.useParams();
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [dateFilter, setDateFilter] = useState("");

  function refresh() { setBills(loadBills().filter((b) => b.phone === phone)); }
  useEffect(() => { refresh(); }, [phone]);

  const customerName = bills[0]?.name ?? "Unknown";
  const loyalty = useMemo(() => computeLoyalty(loadBills(), phone), [bills, phone]);
  const totalSpent = bills.reduce((s, b) => s + b.total, 0);
  const filteredBills = [...bills]
    .filter((b) => (dateFilter ? b.date === dateFilter : true))
    .sort((a, b) => b.date.localeCompare(a.date));

  function onDelete(id: string) {
    if (!confirm("Delete this bill?")) return;
    deleteBill(id);
    refresh();
  }

  if (bills.length === 0) {
    return (
      <div className="card-soft p-8 text-center">
        <p className="text-muted-foreground">No bills found for {phone}.</p>
        <Link to="/" className="btn-ghost mt-4">← Back</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={() => navigate({ to: "/customers" })} className="text-sm font-bold text-primary hover:underline">
        ← All customers
      </button>

      <div className="card-menu p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-primary">{customerName}</h1>
            <div className="mt-1 text-sm font-semibold text-muted-foreground">📞 {phone}</div>
          </div>
          {loyalty.eligibleToday && (
            <div className="rounded-lg border-2 border-accent bg-accent/10 px-3 py-2 text-center">
              <div className="font-display text-accent">🎁 FREE ITEM</div>
              <div className="text-[11px] font-bold text-muted-foreground">Eligible today for free item!</div>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Mini label="Visits" value={loyalty.visitDates.length} />
          <Mini label="Total Spent" value={`₹${totalSpent}`} />
          <Mini label="Streak" value={`${Math.min(loyalty.streak, STREAK_TARGET)}/${STREAK_TARGET}`} />
          <Mini label="Last Visit" value={loyalty.lastVisit ? formatDate(loyalty.lastVisit) : "—"} />
        </div>

        <div className="mt-5">
          <StreakDots streak={loyalty.streak} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-primary">Bill History</h2>
        <div className="flex items-center gap-2">
          <input type="date" className="input-field w-auto" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          {dateFilter && <button onClick={() => setDateFilter("")} className="btn-ghost text-xs">Clear</button>}
        </div>
      </div>

      {filteredBills.length === 0 ? (
        <div className="card-soft p-6 text-center text-muted-foreground">No bills on this date.</div>
      ) : (
        <div className="overflow-x-auto card-soft">
          <table className="w-full text-sm [&_td]:p-3 [&_th]:p-3">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th className="text-right">Total</th>
                <th>Free Item</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((b) => (
                <tr key={b.id} className="border-t border-border align-top">
                  <td className="font-bold whitespace-nowrap">#{b.orderNo ?? "—"}</td>
                  <td>
                    <div className="whitespace-nowrap">{formatDate(b.date)}</div>
                    <ul className="mt-1 text-xs text-muted-foreground">
                      {b.items.map((it, i) => (
                        <li key={i}>{it.name} × {it.qty}{it.isFree && <span className="ml-1 rounded bg-accent px-1 py-0.5 text-[9px] font-bold uppercase text-accent-foreground">Free</span>}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="text-right whitespace-nowrap font-bold text-accent">₹{b.total}</td>
                  <td>{b.freeItem ? <span className="text-accent">🎁 {b.freeItem.name}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-right whitespace-nowrap">
                    <button onClick={() => onDelete(b.id)} className="text-destructive hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border-2 border-primary/20 bg-secondary p-3">
      <div className="font-display text-xl leading-none text-primary">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
