import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";

const getHotelDetails = createServerFn({ method: "GET" })
  .validator((hotelId: string) => hotelId)
  .handler(async ({ data: hotelId }) => {
    const { db } = await import("../../../db");
    const { requireAuth } = await import("../../../auth");
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    
    const hotel = await db.hotel.findUnique({
      where: { id: hotelId },
      include: {
        users: { select: { id: true, name: true, email: true, status: true, role: true } },
        bills: { 
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { items: true }
        }
      }
    });
    
    if (!hotel) throw new Error("Hotel not found");

    // Calculate all-time revenue (could be optimized, but ok for now)
    const allBills = await db.bill.findMany({
      where: { hotelId, isDeleted: false },
      select: { total: true }
    });
    const lifetimeRevenue = allBills.reduce((sum, b) => sum + b.total, 0);
    const lifetimeBills = allBills.length;

    // Get top 5 selling items
    const allBillItems = await db.billItem.findMany({
      where: { bill: { hotelId, isDeleted: false } },
    });
    const itemMap = new Map<string, { qty: number, rev: number }>();
    for (const item of allBillItems) {
      const existing = itemMap.get(item.name) || { qty: 0, rev: 0 };
      itemMap.set(item.name, { 
        qty: existing.qty + item.qty, 
        rev: existing.rev + (item.price * item.qty) 
      });
    }
    const topItems = Array.from(itemMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      hotel: {
        ...hotel,
        createdAt: hotel.createdAt.toISOString()
      },
      lifetimeRevenue,
      lifetimeBills,
      topItems,
      recentBills: hotel.bills.map(b => ({
        ...b,
        createdAt: b.createdAt.toISOString()
      }))
    };
  });

const suspendHotelUsers = createServerFn({ method: "POST" })
  .validator((hotelId: string) => hotelId)
  .handler(async ({ data: hotelId }) => {
    const { db } = await import("../../../db");
    const { requireAuth } = await import("../../../auth");
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    
    await db.user.updateMany({
      where: { hotelId, role: { not: "SUPER_ADMIN" } },
      data: { status: "PAUSED" }
    });
    
    return { success: true };
  });

export const Route = createFileRoute("/admin/hotels/$hotelId")({
  component: HotelDetails,
  loader: async ({ params }) => await getHotelDetails({ data: params.hotelId }),
});

function HotelDetails() {
  const { hotel, lifetimeRevenue, lifetimeBills, topItems, recentBills } = Route.useLoaderData();
  const router = useRouter();

  async function handleSuspend() {
    if (!confirm("Are you sure you want to suspend all users associated with this hotel? They will instantly lose access.")) return;
    try {
      await suspendHotelUsers({ data: hotel.id });
      toast.success("All users suspended");
      router.invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed to suspend users");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/hotels" className="btn-ghost !px-2">← Back</Link>
      </div>
      
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">{hotel.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Registered on {format(new Date(hotel.createdAt), "MMMM d, yyyy")}</p>
        </div>
        <button onClick={handleSuspend} className="btn-ghost text-destructive border-destructive hover:bg-destructive/10">
          Suspend All Access
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card-elevated p-4 border-accent">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Lifetime Revenue</div>
          <div className="mt-2 font-display text-3xl text-accent">₹{lifetimeRevenue.toLocaleString("en-IN")}</div>
        </div>
        <div className="card-elevated p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Total Bills</div>
          <div className="mt-2 font-display text-3xl text-foreground">{lifetimeBills}</div>
        </div>
        <div className="card-elevated p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Active Users</div>
          <div className="mt-2 font-display text-3xl text-foreground">
            {hotel.users.filter(u => u.status === "ACTIVE").length} / {hotel.users.length}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="card-menu p-5">
          <h2 className="font-display text-xl text-primary mb-4">Top Selling Items</h2>
          {topItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items sold yet.</p>
          ) : (
            <ul className="space-y-3">
              {topItems.map((item, idx) => (
                <li key={idx} className="flex justify-between items-center border-b border-border pb-2 last:border-0">
                  <div className="font-medium text-foreground">{item.name}</div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-accent">{item.qty} sold</div>
                    <div className="text-xs text-muted-foreground">₹{item.rev.toLocaleString("en-IN")}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-menu p-5">
          <h2 className="font-display text-xl text-primary mb-4">Associated Users</h2>
          <ul className="space-y-3">
            {hotel.users.map(u => (
              <li key={u.id} className="flex justify-between items-center border-b border-border pb-2 last:border-0">
                <div>
                  <div className="font-medium text-foreground">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                  u.status === "ACTIVE" ? "bg-success/10 text-success" :
                  u.status === "PENDING" ? "bg-accent/10 text-accent" :
                  "bg-destructive/10 text-destructive"
                }`}>
                  {u.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card-menu p-5 overflow-x-auto mt-6">
        <h2 className="font-display text-xl text-primary mb-4">Recent Bills</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="pb-3 pr-3">Date</th>
              <th className="pb-3 pr-3">Customer</th>
              <th className="pb-3 pr-3">Items</th>
              <th className="pb-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {recentBills.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground">
                  No bills generated yet.
                </td>
              </tr>
            ) : recentBills.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="py-4 pr-3 text-muted-foreground">{format(new Date(b.createdAt), "MMM d, yyyy h:mm a")}</td>
                <td className="py-4 pr-3">{b.name || "Guest"} <span className="text-xs opacity-70">({b.phone || "-"})</span></td>
                <td className="py-4 pr-3 text-xs text-muted-foreground truncate max-w-[200px]">
                  {b.items.map(i => `${i.qty}x ${i.name}`).join(", ")}
                </td>
                <td className="py-4 text-right font-medium text-accent">
                  ₹{b.total.toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
