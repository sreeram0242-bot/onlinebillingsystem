import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  computeLoyalty,
  getCategoryOf,
  newId,
  todayISO,
  nextOrderNumberForDate,
  type BillItem,
  type MenuItem,
  type AppSettings,
} from "@/lib/loyalty";
import { getMenuAction, getBillsAction, getSettingsAction, addBillAction, updateBillAction } from "../data";
import { isPrinterConnected, printBill } from "@/lib/thermalPrint";

export const Route = createFileRoute("/new-bill")({
  validateSearch: (search: Record<string, unknown>): { editId?: string } => {
    return { editId: search.editId as string | undefined };
  },
  head: () => ({ meta: [{ title: "New Bill — Engineers Kitchen" }] }),
  component: NewBill,
  loader: async () => {
    const [menu, bills, settings] = await Promise.all([
      getMenuAction(),
      getBillsAction(),
      getSettingsAction()
    ]);
    const categories = settings.categoryNames.length > 0
      ? settings.categoryNames
      : ["Sandwiches", "Burgers", "Fries", "Manchurian", "Noodles", "Rice", "Momos", "Mojito"];
    return { 
      menu: menu.map(m => ({ ...m, category: m.category ?? undefined, costPrice: m.costPrice ?? undefined })) as MenuItem[],
      bills: bills.map(b => ({ ...b, items: b.items.map(i => ({ ...i, costPrice: i.costPrice ?? undefined })) })) as any,
      settings, 
      categories 
    };
  }
});

function NewBill() {
  const { menu, bills: allBills, settings, categories: allCategories } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const searchParams = Route.useSearch();
  const editId = searchParams.editId;
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
  const [originalFreeItem, setOriginalFreeItem] = useState<{ name: string; price: number; costPrice?: number | null } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "GPAY" | "SPLIT">("CASH");
  const [splitCash, setSplitCash] = useState<string>("");
  const [splitGpay, setSplitGpay] = useState<string>("");


  useEffect(() => {
    if (editId) {
      const existingBill = (allBills as any[]).find((b: any) => b.id === editId);
      if (existingBill) {
        setName(existingBill.name);
        setPhone(existingBill.phone);
        setDate(existingBill.date);
        setOriginalDate(existingBill.date);
        setItems(existingBill.items);
        setSavedGstPct(existingBill.gstPercentage ?? 0);
        
        const freeNames = existingBill.items.filter((i: any) => i.isFree).map((i: any) => i.name);
        setFreeMode(new Set(menu.filter(m => freeNames.includes(m.name)).map(m => m.id)));

        if (existingBill.tableName) setTableName(existingBill.tableName);
        if (existingBill.orderNo) setOrderNo(existingBill.orderNo);
        if (existingBill.freeItemName) {
          setOriginalFreeItem({ 
            name: existingBill.freeItemName, 
            price: existingBill.freeItemPrice ?? 0, 
            costPrice: existingBill.freeItemCost 
          });
          const m = menu.find(x => x.name === existingBill.freeItemName);
          if (m) setFreeItemId(m.id);
        }
      }
    } else {
      if (settings.tablesEnabled && settings.tableNames.length > 0) setTableName(settings.tableNames[0]);
      setOrderNo(nextOrderNumberForDate(allBills as any, todayISO()));
    }
  }, [editId, allBills, menu, settings]);

  useEffect(() => {
    if (editId && date === originalDate) {
      const b = (allBills as any[]).find((x: any) => x.id === editId);
      if (b) setOrderNo(b.orderNo ?? nextOrderNumberForDate(allBills as any, date));
    } else {
      setOrderNo(nextOrderNumberForDate(allBills as any, date));
    }
  }, [date, editId, originalDate, allBills]);

  useEffect(() => {
    if (phone.length >= 4) {
      const existing = (allBills as any[]).find((b: any) => b.phone === phone);
      if (existing && !name) setName(existing.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const loyalty = useMemo(() => {
    if (!phone) return null;
    return computeLoyalty(allBills as any, phone);
  }, [phone, allBills]);

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
    ...allCategories.filter((c: string) => usedCategories.includes(c)),
    ...usedCategories.filter((c: string) => !allCategories.includes(c)),
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


  async function save() {
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
      paymentMethod,
      splitCash: paymentMethod === "SPLIT" ? (parseFloat(splitCash) || 0) : undefined,
      splitGpay: paymentMethod === "SPLIT" ? (parseFloat(splitGpay) || 0) : undefined,
    };

    try {
      if (editId) {
        await updateBillAction({ data: billData });
        toast.success(`Bill #${orderNo} updated`);
      } else {
        await addBillAction({ data: billData });
        toast.success(`Bill #${orderNo} saved · ₹${total}`);
      }

      // Auto-print if enabled and printer connected
      if ((settings as any).printEnabled && isPrinterConnected()) {
        try {
          await printBill({
            hotelName: (settings as any).hotelName || "Hotel",
            orderNo,
            date,
            tableName: settings.tablesEnabled ? tableName : undefined,
            customerName: name.trim() || undefined,
            customerPhone: phone.trim() || undefined,
            items,
            subtotal,
            gstPct,
            gstAmount,
            total,
            paymentMethod,
            splitCash: paymentMethod === "SPLIT" ? (parseFloat(splitCash) || 0) : undefined,
            splitGpay: paymentMethod === "SPLIT" ? (parseFloat(splitGpay) || 0) : undefined,
            freeItemName: freeItem?.name,
          });
        } catch (pe: any) {
          toast.error("Print failed: " + (pe.message || "Printer error"));
        }
      }
      
      router.invalidate();
      if (phone.trim()) navigate({ to: "/customer/$phone", params: { phone: phone.trim() } });
      else navigate({ to: "/bills" });
    } catch (e: any) {
      toast.error(e.message || "Failed to save bill");
    }
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
            {settings.requireCustomerDetails && (
              <>
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
              </>
            )}
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
                  {(settings.tableNames as string[]).map((t: string) => (
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

          {items.length > 0 && (
            <div className="mt-3 space-y-3 rounded-lg border-2 border-primary/20 bg-secondary/50 p-3">
              <div className="text-sm font-bold text-primary">Payment Method</div>
              <div className="flex flex-wrap gap-2">
                {(["CASH", "GPAY", "SPLIT"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                      paymentMethod === m ? "bg-accent text-accent-foreground" : "bg-card text-foreground hover:bg-primary/10"
                    }`}
                  >{m}</button>
                ))}
              </div>
              {paymentMethod === "SPLIT" && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <label className="block text-xs font-bold text-muted-foreground">
                    Cash (₹)
                    <input type="number" className="input-field mt-1 w-full" value={splitCash} onChange={e => setSplitCash(e.target.value)} placeholder="0" />
                  </label>
                  <label className="block text-xs font-bold text-muted-foreground">
                    GPay (₹)
                    <input type="number" className="input-field mt-1 w-full" value={splitGpay} onChange={e => setSplitGpay(e.target.value)} placeholder="0" />
                  </label>
                </div>
              )}
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
                {settings.freeItemsEnabled && (
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
                )}
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
