import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";

const getHotels = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("../../db");
    const { requireAuth } = await import("../../auth");
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    
    const hotels = await db.hotel.findMany({
      include: {
        _count: {
          select: { users: true, bills: { where: { isDeleted: false } } }
        },
        bills: {
          where: { isDeleted: false },
          select: { total: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return hotels.map(h => ({
      id: h.id,
      name: h.name,
      createdAt: h.createdAt.toISOString(),
      userCount: h._count.users,
      billCount: h._count.bills,
      totalRevenue: h.bills.reduce((sum, bill) => sum + bill.total, 0)
    }));
  });

export const Route = createFileRoute("/admin/hotels")({
  component: AdminHotels,
  loader: async () => await getHotels(),
});

function AdminHotels() {
  const hotels = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">Global Hotel Directory</h1>
        <p className="text-sm text-muted-foreground">Manage all tenants on the platform</p>
      </div>

      <div className="card-menu p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="pb-3 pr-3">Hotel Name</th>
              <th className="pb-3 pr-3">Registered On</th>
              <th className="pb-3 pr-3 text-right">Users</th>
              <th className="pb-3 pr-3 text-right">Total Bills</th>
              <th className="pb-3 text-right">Lifetime Revenue</th>
            </tr>
          </thead>
          <tbody>
            {hotels.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  No hotels registered yet.
                </td>
              </tr>
            ) : hotels.map((h) => (
              <tr 
                key={h.id} 
                className="border-b border-border last:border-0 hover:bg-secondary/50 cursor-pointer transition-colors"
                onClick={() => window.location.href = `/admin/hotels/${h.id}`}
              >
                <td className="py-4 pr-3 font-medium text-primary">{h.name}</td>
                <td className="py-4 pr-3 text-muted-foreground">{format(new Date(h.createdAt), "MMM d, yyyy")}</td>
                <td className="py-4 pr-3 text-right">{h.userCount}</td>
                <td className="py-4 pr-3 text-right">{h.billCount}</td>
                <td className="py-4 text-right font-medium text-accent">
                  ₹{h.totalRevenue.toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
