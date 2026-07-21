import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  addBill,
  updateBill,
  computeLoyalty,
  loadBills,
  loadMenu,
  loadCategories,
  loadSettings,
  getCategoryOf,
  newId,
  todayISO,
  nextOrderNumberForDate,
  type BillItem,
  type MenuItem,
  type AppSettings,
} from "@/lib/loyalty";

export const Route = createFileRoute("/new-bill")({
  validateSearch: (search: Record<string, unknown>): { editId?: string } => {
    return { editId: search.editId as string | undefined };
  },
  head: () => ({ meta: [{ title: "New Bill — Engineers Kitchen" }] }),
  component: NewBill,
});

function NewBill() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const editId = searchParams.editId;
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(todayISO());
  const [items, setItems] = useState<BillItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [freeItemId, setFreeItemId] = useState<string>("");
  const [tableName, setTableName] = useState<string>("");
  const [orderNo, setOrderNo] = useState<number>(1);
  const [freeMode, setFreeMode] = useState<Set<string>>(new Set());
  const [savedGstPct, setSavedGstPct] = useState<number | null>(null);
  const [originalDate, setOriginalDate] = useState<string | null>(null);
  const [originalFreeItem, setOriginalFreeItem] = useState<{ name: string; price: number; costPrice?: number } | null>(null);


  useEffect(() => {
    setMenu(loadMenu());
    setAllCategories(loadCategories());
    const s = loadSettings();
    setSettings(s);
    
    if (editId) {
      const existingBill = loadBills().find(b => b.id === editId);
      if (existingBill) {
        setName(existingBill.name);
        setPhone(existingBill.phone);
        setDate(existingBill.date);
        setOriginalDate(existingBill.date);
        setItems(existingBill.items);
        setSavedGstPct(existingBill.gstPercentage ?? 0);
        
        const mList = loadMenu();
        const freeNames = existingBill.items.filter(i => i.isFree).map(i => i.name);
        setFreeMode(new Set(mList.filter(m => freeNames.includes(m.name)).map(m => m.id)));

        if (existingBill.tableName) setTableName(existingBill.tableName);
        if (existingBill.orderNo) setOrderNo(existingBill.orderNo);
        if (existingBill.freeItem) {
          setOriginalFreeItem(existingBill.freeItem);
          const m = mList.find(x => x.name === existingBill.freeItem?.name);
          if (m) setFreeItemId(m.id);
        }
      }
    } else {
      if (s.tablesEnabled && s.tableNames.length > 0) setTableName(s.tableNames[0]);
      setOrderNo(nextOrderNumberForDate(loadBills(), todayISO()));
    }
  }, [editId]);

  useEffect(() => {
    if (editId && date === originalDate) {
      const b = loadBills().find(x => x.id === editId);
      if (b) setOrderNo(b.orderNo ?? nextOrderNumberForDate(loadBills(), date));
    } else {
      setOrderNo(nextOrderNumberForDate(loadBills(), date));
    }
  }, [date, editId, originalDate]);

  useEffect(() => {
    if (phone.length >= 4) {
      const existing = loadBills().find((b) => b.phone === phone);
      if (existing && !name) setName(existing.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const loyalty = useMemo(() => {
    if (!phone) return null;
    return computeLoyalty(loadBills(), phone);
  }, [phone]);

  const streakOn = settings?.streakOfferEnabled ?? false;
  const eligibleForFree = (streakOn && loyalty?.eligibleToday && date === todayISO()) || !!originalFreeItem;
  const freeItemOptionsGrouped = useMemo(() => {
    const groups = new Map<string, MenuItem[]>();
    for (const m of menu) {
      const c = getCategoryOf(m);
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c)!.push(m);
    }
    // Sort categories alphabetically or just use the insertion order
    return Array.from(groups.entries());
  }, [menu]);

  const filteredMenu = menu.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) &&
      (category === "All" || getCategoryOf(m) === category),
  );

  const usedCategories = Array.from(new Set(menu.map((m) => getCategoryOf(m))));
  const orderedCats = [
    ...allCategories.filter((c) => usedCategories.includes(c)),
    ...usedCategories.filter((c) => !allCategories.includes(c)),
  ];
  const categories = ["All", ...orderedCats];

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const gstPct = savedGstPct !== null ? savedGstPct : (settings?.gstPercentage ?? 0);
  const gstAmount = Math.round(subtotal * (gstPct / 100));
  const total = subtotal + gstAmount;

  const keyOf = (it: { name: string; isFree?: boolean }) => (it.isFree ? `${it.name}::free` : it.name);

  function toggleFreeMode(id: string) {
    setFreeMode((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function addItem(m: MenuItem) {
    const isFree = freeMode.has(m.id);
    const k = isFree ? `${m.name}::free` : m.name;
    setItems((prev) => {
      const existing = prev.find((p) => keyOf(p) === k);
      if (existing) return prev.map((p) => (keyOf(p) === k ? { ...p, qty: p.qty + 1 } : p));
      return [...prev, { name: m.name, price: isFree ? 0 : m.price, qty: 1, costPrice: m.costPrice, isFree }];
    });
  }
  function updateQty(k: string, qty: number) {
    if (qty <= 0) setItems((prev) => prev.filter((p) => keyOf(p) !== k));
    else setItems((prev) => prev.map((p) => (keyOf(p) === k ? { ...p, qty } : p)));
  }


  function save() {
    if (!settings) return;
    if (items.length === 0) { toast.error("Add at least one item."); return; }
    // Customer details are now ALWAYS optional to respect privacy.
    // If they do provide a phone number to claim the streak, ensure it's valid.
    if (phone.trim() && phone.trim().length !== 10) {
      toast.error("Phone number must be exactly 10 digits if provided.");
      return;
    }
    if (settings.tablesEnabled && settings.tableNames.length > 0 && !tableName) {
      toast.error("Select a table.");
      return;
    }
    const freeItem =
      eligibleForFree && freeItemId
        ? (() => {
            const m = menu.find((x) => x.id === freeItemId);
            return m ? { name: m.name, price: m.price, costPrice: m.costPrice } : null;
          })()
        : null;

    const billData = {
      id: editId || newId(),
      phone: phone.trim(),
      name: name.trim(),
      date,
      items,
      subtotal,
      gstAmount,
      gstPercentage: gstPct,
      total,
      freeItem,
      tableName: settings.tablesEnabled ? tableName : undefined,
      orderNo,
    };

    if (editId) {
      updateBill(editId, billData);
      toast.success(`Bill #${orderNo} updated`);
    } else {
      addBill(billData);
      toast.success(`Bill #${orderNo} saved · ₹${total}`);
    }

    if (phone.trim()) navigate({ to: "/customer/$phone", params: { phone: phone.trim() } });
    else navigate({ to: "/bills" });
  }

  if (!settings) return null;

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:gap-4 md:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Left */}
      <div className="min-w-0 space-y-2 sm:space-y-3 md:space-y-4">
        <div className="card-menu min-w-0 p-2 sm:p-3 md:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="font-display text-lg text-primary sm:text-xl md:text-2xl">
              {editId ? `Edit Order #${orderNo}` : `Order #${orderNo}`}
            </h2>
            <div className="text-xs text-muted-foreground">{date}</div>
          </div>

          <div className="mt-2 grid gap-2 sm:mt-3 sm:gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Phone <span className="text-muted-foreground/50 lowercase tracking-normal font-normal">(optional)</span>
              <input
                className="input-field mt-1"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit phone"
                inputMode="numeric"
                maxLength={15}
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Name <span className="text-muted-foreground/50 lowercase tracking-normal font-normal">(optional)</span>
              <input
                className="input-field mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer name"
                maxLength={60}
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Bill Date
              <input
                type="date"
                className="input-field mt-1"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={todayISO()}
              />
            </label>
            {settings.tablesEnabled && (
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Table
                <select
                  className="input-field mt-1"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                >
                  <option value="">— select —</option>
                  {settings.tableNames.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {streakOn && loyalty && loyalty.visitDates.length > 0 && (
            <div className="mt-3 rounded-lg border-2 border-primary/20 bg-secondary p-2 text-xs sm:mt-4 sm:p-3 sm:text-sm">
              <div className="font-bold text-primary">
                Streak: {loyalty.streak} day{loyalty.streak !== 1 ? "s" : ""}
              </div>
              {eligibleForFree ? (
                <div className="mt-1 font-bold text-accent">🎁 FREE item!</div>
              ) : (
                <div className="mt-1 text-muted-foreground">
                  {6 - Math.min(loyalty.streak, 6)} more consecutive day
                  {6 - Math.min(loyalty.streak, 6) !== 1 ? "s" : ""} to unlock a free item.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card-menu min-w-0 p-2 sm:p-3 md:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="font-display text-lg text-primary sm:text-xl md:text-2xl">Cart</h2>
            <div className="font-display text-lg text-accent sm:text-xl md:text-2xl">₹{total}</div>
          </div>

          {items.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Add items from the menu →</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((it) => {
                const k = keyOf(it);
                return (
                  <li key={k} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded-md border border-primary/20 bg-secondary p-1.5 sm:gap-2 sm:p-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate font-bold">
                        <span className="truncate">{it.name}</span>
                        {it.isFree && <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase text-accent-foreground">Free</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{it.isFree ? "🎁 complimentary" : `₹${it.price} each`}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => updateQty(k, it.qty - 1)} className="h-6 w-6 rounded-full bg-primary text-sm text-primary-foreground sm:h-7 sm:w-7">−</button>
                      <span className="w-5 text-center text-sm font-bold sm:w-6 sm:text-base">{it.qty}</span>
                      <button onClick={() => updateQty(k, it.qty + 1)} className="h-6 w-6 rounded-full bg-primary text-sm text-primary-foreground sm:h-7 sm:w-7">+</button>
                    </div>
                    <div className="w-11 shrink-0 text-right text-xs font-bold sm:w-14 sm:text-sm md:w-16 md:text-base">{it.isFree ? <span className="text-accent">FREE</span> : `₹${it.price * it.qty}`}</div>
                  </li>
                );
              })}
            </ul>

          )}

          {items.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <Row label="Subtotal" value={`₹${subtotal}`} />
              {gstPct > 0 && <Row label={`GST (${gstPct}%)`} value={`₹${gstAmount}`} />}
              <Row label="Grand Total" value={`₹${total}`} bold />
            </div>
          )}

          {eligibleForFree && (
            <div className="mt-3 rounded-lg border-2 border-dashed border-accent bg-accent/10 p-2 sm:mt-4 sm:p-3">
              <div className="font-display text-lg text-accent">🎁 Free item</div>
              <select
                className="input-field mt-2"
                value={freeItemId}
                onChange={(e) => setFreeItemId(e.target.value)}
              >
                <option value="">-- Skip / choose later --</option>
                {freeItemOptionsGrouped.map(([cat, items]) => (
                  <optgroup key={cat} label={cat}>
                    {items.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} (₹{m.price})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          <button onClick={save} className="btn-accent mt-3 w-full text-sm sm:mt-5 sm:text-base md:text-lg">
            {editId ? `💾 Update Bill · ₹${total}` : `💾 Save Bill · ₹${total}`}
          </button>
        </div>
      </div>

      {/* Right: menu */}
      <div className="card-menu min-w-0 p-2 sm:p-3 md:p-5">
        <h2 className="font-display text-lg text-primary sm:text-xl md:text-2xl">Menu</h2>

        <input
          className="input-field mt-2 sm:mt-3"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-2 flex max-w-full gap-1.5 overflow-x-auto pb-1 sm:mt-3 sm:gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`whitespace-nowrap rounded-full border-2 px-2 py-0.5 text-[11px] font-bold transition-colors sm:px-3 sm:py-1 sm:text-xs ${
                category === c
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-primary/30 bg-card text-primary hover:border-primary"
              }`}
            >{c}</button>
          ))}
        </div>
        <div className="mt-2 grid max-h-[60vh] min-w-0 gap-1.5 overflow-y-auto pr-0.5 sm:mt-3 sm:max-h-[65vh] sm:gap-2 sm:pr-1">
          {filteredMenu.map((m) => {
            const isFree = freeMode.has(m.id);
            const cartKey = isFree ? `${m.name}::free` : m.name;
            const inCart = items.find((p) => keyOf(p) === cartKey);
            const qty = inCart?.qty ?? 0;
            const active = qty > 0;
            return (
              <div
                key={m.id}
                className={`flex items-stretch overflow-hidden rounded-md border-2 transition-all hover:-translate-y-0.5 ${
                  active
                    ? "border-accent bg-accent/10 ring-2 ring-accent/40"
                    : isFree
                      ? "border-accent bg-card"
                      : "border-primary/20 bg-card hover:border-accent"
                }`}
              >
                <button
                  onClick={() => addItem(m)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-1.5 px-2 py-1.5 text-left sm:gap-2 sm:px-3 sm:py-2"
                >
                  <span className="truncate text-sm font-bold sm:text-base">{m.name}</span>
                  <span className={`ml-1 shrink-0 font-display text-base sm:ml-2 sm:text-lg ${isFree ? "text-muted-foreground line-through" : "text-accent"}`}>₹{m.price}</span>
                </button>
                {active && (
                  <div className="flex shrink-0 items-center gap-0.5 border-l-2 border-accent/40 bg-accent/10 px-1 sm:gap-1 sm:px-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); updateQty(cartKey, qty - 1); }}
                      className="h-6 w-6 rounded-full bg-primary text-sm text-primary-foreground sm:h-7 sm:w-7"
                      aria-label="Decrease"
                    >−</button>
                    <span className="w-4 text-center text-xs font-bold sm:w-5 sm:text-sm">{qty}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); updateQty(cartKey, qty + 1); }}
                      className="h-6 w-6 rounded-full bg-primary text-sm text-primary-foreground sm:h-7 sm:w-7"
                      aria-label="Increase"
                    >+</button>
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFreeMode(m.id); }}
                  aria-pressed={isFree}
                  title={isFree ? "Free ON — tap item to add as complimentary" : "Tap to mark this item free for the next add"}
                  className={`shrink-0 border-l-2 px-1.5 text-[9px] font-black uppercase transition-colors sm:px-2 sm:text-[10px] sm:tracking-wider ${
                    isFree
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-primary/20 text-muted-foreground hover:text-accent"
                  }`}
                >
                  Free
                </button>
              </div>
            );
          })}


          {filteredMenu.length === 0 && <p className="text-sm text-muted-foreground">No items match.</p>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-foreground" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
