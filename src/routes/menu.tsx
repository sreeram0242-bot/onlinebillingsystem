import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  loadMenu,
  saveMenu,
  newId,
  loadCategories,
  saveCategories,
  getCategoryOf,
  type MenuItem,
} from "@/lib/loyalty";

export const Route = createFileRoute("/menu")({
  head: () => ({ meta: [{ title: "Menu — Engineers Kitchen" }] }),
  component: MenuPage,
});

function MenuPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [itemCat, setItemCat] = useState<string>("");
  const [search, setSearch] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [filterCat, setFilterCat] = useState<string>("All");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setMenu(loadMenu());
    const cats = loadCategories();
    setCategories(cats);
    setItemCat(cats[0] ?? "");
  }, []);

  function persist(next: MenuItem[]) { setMenu(next); saveMenu(next); }
  function persistCats(next: string[]) { setCategories(next); saveCategories(next); }

  function resetForm() {
    setName(""); setPrice(""); setCostPrice("");
    setItemCat(categories[0] ?? ""); setEditingId(null);
  }

  function submitItem(e: React.FormEvent) {
    e.preventDefault();
    const p = parseFloat(price);
    const cp = costPrice.trim() ? parseFloat(costPrice) : undefined;
    const n = name.trim();
    if (!n || !Number.isFinite(p) || p <= 0) { toast.error("Enter name and price"); return; }
    if (menu.some(m => m.name.toLowerCase() === n.toLowerCase() && m.id !== editingId)) {
      toast.error("An item with this name already exists");
      return;
    }
    if (editingId) {
      persist(menu.map((m) => m.id === editingId ? { ...m, name: name.trim(), price: p, costPrice: cp, category: itemCat || undefined } : m));
      toast.success("Item updated");
    } else {
      persist([...menu, { id: newId(), name: name.trim(), price: p, costPrice: cp, category: itemCat || undefined }]);
      toast.success("Item added");
    }
    resetForm();
  }

  function editItem(m: MenuItem) {
    setEditingId(m.id);
    setName(m.name);
    setPrice(String(m.price));
    setCostPrice(m.costPrice ? String(m.costPrice) : "");
    setItemCat(getCategoryOf(m));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeItem(id: string) {
    if (!confirm("Remove this item?")) return;
    persist(menu.filter((m) => m.id !== id));
    if (editingId === id) resetForm();
  }

  function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const c = newCategory.trim();
    if (!c) return;
    if (categories.includes(c)) { toast.error("Category exists"); return; }
    persistCats([...categories, c]);
    setNewCategory("");
  }
  function deleteCategory(name: string) {
    if (!confirm(`Delete category "${name}"?`)) return;
    persistCats(categories.filter((c) => c !== name));
    persist(menu.map((m) => (m.category === name ? { ...m, category: "" } : m)));
  }

  const filtered = useMemo(
    () => menu.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) && (filterCat === "All" || getCategoryOf(m) === filterCat)),
    [menu, search, filterCat],
  );

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-primary">Menu Items</h1>

      {/* Categories */}
      <div className="card-menu space-y-3 p-5">
        <h2 className="font-display text-xl text-primary">Categories</h2>
        <form onSubmit={addCategory} className="flex gap-2">
          <input className="input-field flex-1" placeholder="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} maxLength={30} />
          <button type="submit" className="btn-accent">+ Add</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <div key={c} className="flex items-center gap-2 rounded-full border-2 border-primary/20 bg-secondary px-3 py-1 text-sm">
              <span className="font-bold text-primary">{c}</span>
              <button onClick={() => deleteCategory(c)} className="text-xs text-destructive hover:underline">✕</button>
            </div>
          ))}
          {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
        </div>
      </div>

      {/* Add/edit item */}
      <form onSubmit={submitItem} className="card-menu grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_140px_140px_140px_auto]">
        <input className="input-field sm:col-span-2 lg:col-span-1" placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <select className="input-field" value={itemCat} onChange={(e) => setItemCat(e.target.value)}>
          <option value="">Uncategorized</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="input-field" placeholder="Cost ₹ (opt)" inputMode="decimal" value={costPrice} onChange={(e) => setCostPrice(e.target.value.replace(/[^\d.]/g, ""))} />
        <input className="input-field" placeholder="Price ₹" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className="btn-accent flex-1 lg:flex-none">{editingId ? "Update" : "+ Add"}</button>
          {editingId && <button type="button" onClick={resetForm} className="btn-ghost">Cancel</button>}
        </div>
      </form>


      <div className="flex flex-wrap gap-3">
        <input className="input-field min-w-[200px] flex-1" placeholder="Search menu…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input-field w-full sm:w-48" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="All">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Mobile: card list */}
      <div className="grid gap-2 sm:hidden">
        {filtered.map((m) => (
          <div key={m.id} className="card-soft p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-bold">{m.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{getCategoryOf(m)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-lg leading-none text-accent">₹{m.price}</div>
                {m.costPrice ? <div className="mt-1 text-[11px] text-muted-foreground">cost ₹{m.costPrice}</div> : null}
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-3 text-sm">
              <button onClick={() => editItem(m)} className="text-primary hover:underline">Edit</button>
              <button onClick={() => removeItem(m.id)} className="text-destructive hover:underline">Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card-soft p-6 text-center text-sm text-muted-foreground">No items.</div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto card-soft sm:block">
        <table className="w-full text-sm [&_td]:p-3 [&_th]:p-3">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="font-medium">{m.name}</td>
                <td className="text-muted-foreground">{getCategoryOf(m)}</td>
                <td className="text-right whitespace-nowrap">{m.costPrice ? `₹${m.costPrice}` : "—"}</td>
                <td className="text-right whitespace-nowrap font-bold text-accent">₹{m.price}</td>
                <td className="whitespace-nowrap text-right">
                  <button onClick={() => editItem(m)} className="mr-3 text-primary hover:underline">Edit</button>
                  <button onClick={() => removeItem(m.id)} className="text-destructive hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No items.</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
