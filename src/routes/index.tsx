import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  getCustomers,
  formatDate,
  type CustomerSummary,
  type AppSettings,
} from "@/lib/loyalty";
import { getBillsAction, getSettingsAction, saveSettingsAction } from "../data";
import { connectPrinter, disconnectPrinter, isPrinterConnected } from "@/lib/thermalPrint";

import { createServerFn } from "@tanstack/react-start";

const getActiveBroadcasts = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("../db");
    return await db.broadcast.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" }
    });
  });

export const Route = createFileRoute("/")({
  component: Dashboard,
  loader: async () => {
    const [broadcasts, bills, settings] = await Promise.all([
      getActiveBroadcasts(),
      getBillsAction(),
      getSettingsAction()
    ]);
    return { broadcasts, bills, settings };
  },
});

function Dashboard() {
  const { broadcasts, bills, settings } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("dismissedBroadcasts") || "[]"); } 
    catch { return []; }
  });
  const router = useRouter();

  const customers = getCustomers(bills as any);
  const totalBills = bills.length;
  const totalRevenue = bills.reduce((s, b) => s + b.total, 0);

  const filtered = customers.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query),
  );
  const totalCustomers = customers.length;
  const eligibleCount = customers.filter((c) => c.eligibleToday).length;
  const streakOn = settings?.streakOfferEnabled ?? true;

  const visibleBroadcasts = broadcasts.filter(b => !dismissed.includes(b.id));

  function dismissBroadcast(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem("dismissedBroadcasts", JSON.stringify(next));
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {streakOn ? "6 consecutive visits · Free item on day 7" : "Billing & customer tracking"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/bills" className="btn-ghost">Recent Bills</Link>
          <button onClick={() => setSettingsOpen(true)} className="btn-ghost" aria-label="Settings">⚙ Settings</button>
          <Link to="/new-bill" className="btn-primary">+ New Bill</Link>
        </div>
      </header>

      {visibleBroadcasts.length > 0 && (
        <div className="flex flex-col gap-2">
          {visibleBroadcasts.map((b) => (
            <div key={b.id} className="rounded-lg bg-accent/10 border border-accent/20 p-4 flex gap-3 items-start">
              <span className="text-xl">📢</span>
              <div className="flex-1 text-sm font-medium text-accent mt-0.5">
                {b.message}
              </div>
              <button onClick={() => dismissBroadcast(b.id)} className="text-accent hover:text-accent-foreground p-1 text-lg leading-none" aria-label="Dismiss">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <section className={`grid grid-cols-2 gap-3 ${streakOn ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <StatCard label="Customers" value={totalCustomers} />
        <StatCard label="Total Bills" value={totalBills} />
        <StatCard label="Revenue" value={`₹${totalRevenue.toLocaleString("en-IN")}`} />
        {streakOn && (
          <StatCard label="Eligible Today" value={eligibleCount} accent={eligibleCount > 0} />
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-foreground">Customers</h2>
          <Link to="/customers" className="text-sm font-medium text-primary hover:underline">View all →</Link>
        </div>
        <input
          className="input-field mb-4"
          placeholder="Search by name or phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filtered.length === 0 ? (
          <div className="card-soft p-8 text-center text-sm text-muted-foreground">
            {customers.length === 0 ? "No bills yet. Add your first bill to get started." : "No matches."}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.slice(0, 8).map((c) => (
              <CustomerCard key={c.phone} c={c} streakOn={streakOn} />
            ))}
          </div>
        )}
      </section>

      {settingsOpen && settings && (
        <SettingsModal
          initial={settings as any}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => router.invalidate()}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`card-elevated p-4 ${accent ? "border-accent" : ""}`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl leading-none ${accent ? "text-accent" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function CustomerCard({ c, streakOn }: { c: CustomerSummary; streakOn: boolean }) {
  return (
    <Link
      to="/customer/$phone"
      params={{ phone: c.phone }}
      className="card-elevated block p-4 transition-colors hover:border-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-lg leading-tight text-foreground">{c.name || "—"}</div>
          <div className="mt-0.5 text-sm text-muted-foreground">{c.phone}</div>
        </div>
        {streakOn && c.eligibleToday && (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
            Free item
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        {streakOn ? <StreakDots streak={c.streak} /> : <span />}
        <span className="text-muted-foreground">{c.totalVisits} visits · ₹{c.totalSpent}</span>
      </div>
      {c.lastVisit && (
        <div className="mt-1 text-[11px] text-muted-foreground">Last visit · {formatDate(c.lastVisit)}</div>
      )}
    </Link>
  );
}

export function StreakDots({ streak }: { streak: number }) {
  const capped = Math.min(streak, 6);
  return (
    <span className="flex items-center gap-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className={`h-1.5 w-4 rounded-full ${i < capped ? "bg-primary" : "bg-border"}`} />
      ))}
      <span className="ml-1.5 font-medium text-muted-foreground">{capped}/6</span>
    </span>
  );
}

function SettingsModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: AppSettings;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [s, setS] = useState<AppSettings>(initial);
  const [newTable, setNewTable] = useState("");
  const [printerStatus, setPrinterStatus] = useState(isPrinterConnected());

  async function handleConnectPrinter() {
    try {
      if (printerStatus) {
        await disconnectPrinter();
        setPrinterStatus(false);
        toast.info("Printer disconnected");
      } else {
        const success = await connectPrinter();
        if (success) {
          setPrinterStatus(true);
          toast.success("Printer connected successfully");
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to connect to printer");
    }
  }

  async function persist(next: AppSettings) {
    setS(next);
    await saveSettingsAction({ data: next });
    onSaved();
  }

  function addTable() {
    const t = newTable.trim();
    if (!t) return;
    if (s.tableNames.includes(t)) { toast.error("Table exists"); return; }
    persist({ ...s, tableNames: [...s.tableNames, t] });
    setNewTable("");
  }

  function removeTable(t: string) {
    persist({ ...s, tableNames: s.tableNames.filter((x) => x !== t) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-primary">Settings</h2>
          <button onClick={onClose} className="btn-ghost !py-1">✕</button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Hotel name
            <input
              className="input-field mt-1"
              value={s.hotelName}
              onChange={(e) => persist({ ...s, hotelName: e.target.value })}
              maxLength={60}
            />
          </label>

          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            GST %
            <input
              className="input-field mt-1"
              type="number"
              min={0}
              max={30}
              value={s.gstPercentage}
              onChange={(e) => persist({ ...s, gstPercentage: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>

          <Toggle
            label="Enable customer details"
            hint="Show name & phone fields (optional)"
            value={s.requireCustomerDetails}
            onChange={(v) => persist({ ...s, requireCustomerDetails: v })}
          />
          <Toggle
            label="6-day streak offer"
            hint={s.requireCustomerDetails ? "7th day free item" : "Enable customer details first"}
            value={s.streakOfferEnabled}
            disabled={!s.requireCustomerDetails}
            onChange={(v) => persist({ ...s, streakOfferEnabled: v })}
          />
          <Toggle
            label="Free items button"
            hint="Allow marking items as free while billing"
            value={s.freeItemsEnabled}
            onChange={(v) => persist({ ...s, freeItemsEnabled: v })}
          />
          <Toggle
            label="Custom tables"
            hint="Assign a table per bill"
            value={s.tablesEnabled}
            onChange={(v) => persist({ ...s, tablesEnabled: v })}
          />
          <div className="space-y-2">
            <Toggle
              label="Auto-Print Bills"
              hint="Requires USB thermal printer (ESC/POS)"
              value={s.printEnabled}
              onChange={(v) => persist({ ...s, printEnabled: v })}
            />
            {s.printEnabled && (
              <div className="flex items-center gap-3 pl-[52px]">
                <button
                  onClick={handleConnectPrinter}
                  className={`btn-ghost border-2 text-xs py-1 px-3 ${printerStatus ? 'border-success text-success bg-success/10' : 'border-primary/20 hover:border-primary'}`}
                >
                  {printerStatus ? "✓ Printer Connected" : "🔌 Connect Printer"}
                </button>
              </div>
            )}
          </div>

          {s.tablesEnabled && (
            <div className="rounded-lg border border-border bg-secondary/50 p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tables</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {s.tableNames.map((t) => (
                  <span key={t} className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-3 py-1 text-sm">
                    {t}
                    <button onClick={() => removeTable(t)} className="text-destructive">✕</button>
                  </span>
                ))}
                {s.tableNames.length === 0 && <p className="text-xs text-muted-foreground">No tables yet.</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Table name (e.g. T5)"
                  value={newTable}
                  onChange={(e) => setNewTable(e.target.value)}
                />
                <button onClick={addTable} className="btn-accent">Add</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start justify-between gap-3 rounded-lg border border-border p-3 ${disabled ? "opacity-60" : ""}`}>
      <div>
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 accent-primary"
        checked={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
