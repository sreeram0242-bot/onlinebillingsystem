import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getUserFromSession } from "../../auth";

const getAdminStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("../../db");
    const user = getUserFromSession();
    if (user?.role !== "SUPER_ADMIN") throw new Error("Unauthorized");

    const totalHotels = await db.hotel.count();
    const totalUsers = await db.user.count();
    const pendingUsers = await db.user.count({ where: { status: "PENDING" } });
    const totalRevenueResult = await db.bill.aggregate({
      _sum: { total: true },
      where: { isDeleted: false }
    });

    const recentBills = await db.bill.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { hotel: true },
      where: { isDeleted: false }
    });

    const dailyRevenueMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyRevenueMap.set(key, 0);
    }
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRevenueBills = await db.bill.findMany({
      where: { 
        isDeleted: false,
        createdAt: { gte: sevenDaysAgo }
      },
      select: { date: true, total: true }
    });
    for (const b of recentRevenueBills) {
      if (dailyRevenueMap.has(b.date)) {
        dailyRevenueMap.set(b.date, dailyRevenueMap.get(b.date)! + b.total);
      }
    }
    const chartData = Array.from(dailyRevenueMap.entries()).map(([dateStr, total]) => {
      const d = new Date(dateStr);
      return {
        label: d.toLocaleDateString("en-US", { weekday: 'short' }),
        value: total
      };
    });

    const recentHotels = await db.hotel.findMany({
      take: 5,
      orderBy: { createdAt: "desc" }
    });

    return {
      totalHotels,
      totalUsers,
      pendingUsers,
      totalRevenue: totalRevenueResult._sum.total || 0,
      recentBills: recentBills.map(b => ({ id: b.id, amount: b.total, hotelName: b.hotel.name, date: b.createdAt.toISOString() })),
      recentHotels: recentHotels.map(h => ({ id: h.id, name: h.name, date: h.createdAt.toISOString() })),
      chartData
    };
  });

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
  loader: async () => await getAdminStats(),
});

function AdminDashboard() {
  const stats = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">Super Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card-elevated p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Total Hotels</div>
          <div className="mt-2 font-display text-3xl text-foreground">{stats.totalHotels}</div>
        </div>
        <div className="card-elevated p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Total Revenue</div>
          <div className="mt-2 font-display text-3xl text-primary">₹{stats.totalRevenue.toLocaleString("en-IN")}</div>
        </div>
        <div className="card-elevated p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Active Users</div>
          <div className="mt-2 font-display text-3xl text-foreground">{stats.totalUsers}</div>
        </div>
        <Link to="/admin/users" className="card-elevated p-4 hover:border-accent">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Pending Approvals</div>
          <div className="mt-2 font-display text-3xl text-accent">{stats.pendingUsers}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">Tap to manage</div>
        </Link>
      </div>

      <div className="mt-8 flex gap-4">
        <Link to="/admin/hotels" className="btn-primary">View All Hotels</Link>
        <Link to="/admin/users" className="btn-ghost">Manage Users</Link>
      </div>

      <div className="mt-8 card-elevated p-5">
        <h2 className="font-display text-xl text-primary mb-6">7-Day Revenue Trend</h2>
        <div className="flex h-48 items-end gap-2 sm:gap-4">
          {stats.chartData.map((d, i) => {
            const maxVal = Math.max(...stats.chartData.map(c => c.value), 1);
            const heightPct = (d.value / maxVal) * 100;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-2 group">
                <div className="text-[10px] font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  ₹{d.value}
                </div>
                <div className="w-full bg-primary/20 rounded-t-sm relative h-full flex items-end">
                  <div 
                    className="w-full bg-accent rounded-t-sm transition-all duration-500" 
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{d.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="card-elevated p-5">
          <h2 className="font-display text-xl text-primary mb-4">Live Activity (Recent Bills)</h2>
          {stats.recentBills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bills generated yet.</p>
          ) : (
            <ul className="space-y-4 text-sm">
              {stats.recentBills.map(bill => (
                <li key={bill.id} className="flex justify-between border-b border-border pb-2 last:border-0">
                  <div>
                    <div className="font-medium">{bill.hotelName}</div>
                    <div className="text-xs text-muted-foreground">{new Date(bill.date).toLocaleString()}</div>
                  </div>
                  <div className="font-bold text-accent">₹{bill.amount.toLocaleString("en-IN")}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-elevated p-5">
          <h2 className="font-display text-xl text-primary mb-4">Newest Hotels</h2>
          {stats.recentHotels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hotels registered yet.</p>
          ) : (
            <ul className="space-y-4 text-sm">
              {stats.recentHotels.map(hotel => (
                <li key={hotel.id} className="flex justify-between border-b border-border pb-2 last:border-0">
                  <div className="font-medium">{hotel.name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(hotel.date).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
