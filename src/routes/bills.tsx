import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDate, todayISO } from "@/lib/loyalty";
import { getBillsAction, deleteBillAction } from "../data";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Range = "all" | "today" | "week" | "custom";

export const Route = createFileRoute("/bills")({
  head: () => ({ meta: [{ title: "Recent Bills — Engineers Kitchen" }] }),
  component: BillsPage,
  loader: async () => await getBillsAction(),
});

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function BillsPage() {
  const bills = Route.useLoaderData();
  const router = useRouter();
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggle(id: string) { setExpanded((p) => ({ ...p, [id]: !p[id] })); }

  const filtered = useMemo(() => {
    let list = bills;
    if (range === "today") list = list.filter((b) => b.date === todayISO());
    else if (range === "week") {
      const start = daysAgo(6);
      list = list.filter((b) => b.date >= start && b.date <= todayISO());
    } else if (range === "custom") {
      list = list.filter((b) => b.date >= from && b.date <= to);
    }
    return [...list].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (b.orderNo ?? 0) - (a.orderNo ?? 0);
    });
  }, [bills, range, from, to]);

  async function onDelete(id: string) {
    if (!confirm("Delete this bill?")) return;
    try {
      await deleteBillAction({ data: { id } });
      router.invalidate();
      toast.success("Bill deleted");
    } catch (e) {
      toast.error("Failed to delete bill");
    }
  }

  function generatePDF() {
    if (filtered.length === 0) {
      toast.error("No bills to export");
      return;
    }
    const doc = new jsPDF();
    const title = `Bills Report (${range === "custom" ? `${from} to ${to}` : range})`;
    doc.text(title, 14, 15);

    let totalCash = 0;
    let totalUPI = 0;
    let totalAmt = 0;

    const tableData = filtered.map((b) => {
      let cash = 0, upi = 0;
      if (b.paymentMethod === "CASH") cash = b.total;
      else if (b.paymentMethod === "GPAY") upi = b.total;
      else if (b.paymentMethod === "SPLIT") {
        cash = b.splitCash || 0;
        upi = b.splitGpay || 0;
      } else cash = b.total;

      totalCash += cash;
      totalUPI += upi;
      totalAmt += b.total;

      const itemsStr = b.items.map((i: any) => `${i.name}x${i.qty}`).join(", ");
      const customer = b.name || "Walk-in";

      return [
        b.orderNo ?? "—",
        b.date,
        customer,
        itemsStr,
        b.paymentMethod || "CASH",
        `Rs. ${b.total}`,
      ];
    });

    autoTable(doc, {
      startY: 20,
      head: [["Order", "Date", "Customer", "Items", "Payment", "Total"]],
      body: tableData,
    });

    const finalY = (doc as any).lastAutoTable.finalY || 20;
    doc.text(`Total Cash: Rs. ${totalCash}`, 14, finalY + 10);
    doc.text(`Total UPI: Rs. ${totalUPI}`, 14, finalY + 18);
    doc.text(`Grand Total: Rs. ${totalAmt}`, 14, finalY + 26);

    doc.save(`Bills_Report_${todayISO()}.pdf`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">Recent Bills</h1>
        <div className="flex items-center gap-2">
          <button onClick={generatePDF} className="btn-ghost border-2 border-primary/20 bg-card">⬇ Download PDF</button>
          <Link to="/new-bill" className="btn-accent">+ New Bill</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "today", "week", "custom"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full border-2 px-4 py-1 text-xs font-bold uppercase tracking-wider ${
              range === r ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >{r === "week" ? "This Week" : r}</button>
        ))}
        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="input-field w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-muted-foreground">→</span>
            <input type="date" className="input-field w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card-soft p-8 text-center text-muted-foreground">No bills in this range.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-2 sm:hidden">
            {filtered.map((b) => (
              <div key={b.id} className="card-soft p-3">
                <button onClick={() => toggle(b.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-left">
                  <div className="min-w-0">
                    <div className="font-bold">#{b.orderNo ?? "—"} · <span className="text-xs font-normal text-muted-foreground">{formatDate(b.date)}</span></div>
                    <div className="mt-1 truncate text-sm">
                      {b.phone ? (
                        <span><span className="font-medium">{b.name || "—"}</span><span className="ml-1 text-xs text-muted-foreground">{b.phone}</span></span>
                      ) : <span className="text-muted-foreground">Walk-in</span>}
                    </div>
                    {b.tableName && <div className="mt-0.5 text-xs text-muted-foreground">Table: {b.tableName}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-lg leading-none text-accent">₹{b.total}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{expanded[b.id] ? "▲" : "▼"} {b.items.length} item{b.items.length !== 1 ? "s" : ""}</div>
                  </div>
                </button>
                {expanded[b.id] && (
                  <div className="mt-2 space-y-1 border-t border-border pt-2 text-sm">
                    {b.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          {it.name} <span className="text-muted-foreground">× {it.qty}</span>
                          {it.isFree && <span className="ml-1 rounded bg-accent/20 px-1 text-[10px] font-bold text-accent">FREE</span>}
                        </span>
                        <span className="shrink-0 tabular-nums">₹{it.price * it.qty}</span>
                      </div>
                    ))}
                    {b.phone && (
                      <Link to="/customer/$phone" params={{ phone: b.phone }} className="mt-1 block text-xs text-primary hover:underline">View customer →</Link>
                    )}
                    <div className="mt-1 flex items-center gap-4">
                      <Link to="/new-bill" search={{ editId: b.id }} className="text-xs text-primary hover:underline">✏️ Edit bill</Link>
                      <button onClick={() => onDelete(b.id)} className="text-xs text-destructive hover:underline">🗑 Delete bill</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>


          {/* Desktop table */}
          <div className="hidden overflow-x-auto card-soft sm:block">
            <table className="w-full text-sm [&_td]:p-3 [&_th]:p-3">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Table</th>
                  <th className="text-right">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <>
                    <tr key={b.id} className="border-t border-border cursor-pointer hover:bg-muted/40" onClick={() => toggle(b.id)}>
                      <td className="font-bold whitespace-nowrap">{expanded[b.id] ? "▲" : "▼"} #{b.orderNo ?? "—"}</td>
                      <td className="whitespace-nowrap">{formatDate(b.date)}</td>
                      <td>
                        {b.phone ? (
                          <span><span className="font-medium">{b.name || "—"}</span><span className="ml-1 text-xs text-muted-foreground">{b.phone}</span></span>
                        ) : <span className="text-muted-foreground">Walk-in</span>}
                      </td>
                      <td className="whitespace-nowrap">{b.tableName ?? "—"}</td>
                      <td className="text-right whitespace-nowrap font-bold text-accent">₹{b.total}</td>
                      <td className="text-right flex items-center justify-end gap-3 h-full pt-[14px]">
                        <Link to="/new-bill" search={{ editId: b.id }} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline" aria-label="Edit">✏️</Link>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(b.id); }} className="text-destructive hover:underline" aria-label="Delete">🗑</button>
                      </td>
                    </tr>
                    {expanded[b.id] && (
                      <tr key={b.id + "-items"} className="border-t border-border bg-muted/20">
                        <td colSpan={6}>
                          <div className="space-y-1 text-sm">
                            {b.items.map((it, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate">
                                  {it.name} <span className="text-muted-foreground">× {it.qty}</span>
                                  {it.isFree && <span className="ml-1 rounded bg-accent/20 px-1 text-[10px] font-bold text-accent">FREE</span>}
                                </span>
                                <span className="shrink-0 tabular-nums">₹{it.price * it.qty}</span>
                              </div>
                            ))}
                            {(b as any).freeItemName && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate">
                                  {(b as any).freeItemName} <span className="text-muted-foreground">× 1</span>
                                  <span className="ml-1 rounded bg-accent/20 px-1 text-[10px] font-bold text-accent">STREAK FREE</span>
                                </span>
                                <span className="shrink-0 tabular-nums line-through opacity-50">₹{(b as any).freeItemPrice}</span>
                              </div>
                            )}
                            {b.phone && (
                              <Link to="/customer/$phone" params={{ phone: b.phone }} className="mt-1 inline-block text-xs text-primary hover:underline">View customer →</Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}

              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  );
}
