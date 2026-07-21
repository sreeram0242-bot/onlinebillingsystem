import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCustomers, loadBills, formatDate, type CustomerSummary } from "@/lib/loyalty";
import { StreakDots } from "./index";

export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [{ title: "Customers — Engineers Kitchen" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setCustomers(getCustomers(loadBills()));
  }, []);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.phone.includes(query),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">All Customers</h1>
        <Link to="/new-bill" className="btn-accent">+ New Bill</Link>
      </div>

      <input
        className="input-field"
        placeholder="Search by name or phone…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="card-soft p-8 text-center text-muted-foreground">
          {customers.length === 0 ? "No customers yet." : "No match."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((c) => (
            <Link
              key={c.phone}
              to="/customer/$phone"
              params={{ phone: c.phone }}
              className="card-soft block p-4 transition-transform hover:-translate-y-0.5 hover:border-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-lg text-primary">{c.name}</div>
                  <div className="text-sm font-semibold text-muted-foreground">
                    📞 {c.phone}
                  </div>
                </div>
                {c.eligibleToday && (
                  <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-black uppercase tracking-wider text-accent-foreground">
                    🎁 Free item
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold">
                <StreakDots streak={c.streak} />
                <span className="text-muted-foreground">
                  {c.totalVisits} visits · ₹{c.totalSpent}
                </span>
              </div>
              {c.lastVisit && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Last: {formatDate(c.lastVisit)}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
