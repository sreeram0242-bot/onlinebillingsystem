import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getCustomers,
  loadBills,
  formatDate,
  loadSettings,
  saveSettings,
  exportBackup,
  importBackup,
  type CustomerSummary,
  type AppSettings,
} from "@/lib/loyalty";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [totalBills, setTotalBills] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  function refresh() {
    const bills = loadBills();
    setCustomers(getCustomers(bills));
    setTotalBills(bills.length);
    setTotalRevenue(bills.reduce((s, b) => s + b.total, 0));
    setSettings(loadSettings());
  }

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("ek-settings-change", h);
    return () => window.removeEventListener("ek-settings-change", h);
  }, []);

  const filtered = customers.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query),
  );
  const totalCustomers = customers.length;
  const eligibleCount = customers.filter((c) => c.eligibleToday).length;
  const streakOn = settings?.streakOfferEnabled ?? true;

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
          <button onClick={() => setSettingsOpen(true)} className="btn-ghost" aria-label="Settings">⚙</button>
          <Link to="/new-bill" className="btn-primary">+ New Bill</Link>
        </div>
      </header>

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
          initial={settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={refresh}
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
  const fileRef = useRef<HTMLInputElement>(null);

  function persist(next: AppSettings) {
    setS(next);
    saveSettings(next);
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

  function download() {
    const json = exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `engineers-kitchen-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  function restore(file: File) {
    file.text().then((text) => {
      try {
        importBackup(text);
        toast.success("Backup restored");
        onSaved();
      } catch {
        toast.error("Invalid backup file");
      }
    });
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
            label="Custom tables"
            hint="Assign a table per bill"
            value={s.tablesEnabled}
            onChange={(v) => persist({ ...s, tablesEnabled: v })}
          />

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

          <div className="rounded-lg border border-border bg-secondary/50 p-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Data</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={download} className="btn-ghost">⬇️ Export Backup</button>
              <button onClick={() => fileRef.current?.click()} className="btn-ghost">⬆️ Restore Backup</button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) restore(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
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
