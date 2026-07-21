import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";

const getUsers = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("../../db");
    const { requireAuth } = await import("../../auth");
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    return await db.user.findMany({
      include: { hotel: true },
      orderBy: { createdAt: "desc" }
    });
  });

const updateUserStatus = createServerFn({ method: "POST" })
  .validator((data: { userId: string; status: "ACTIVE" | "PAUSED" | "PENDING" }) => data)
  .handler(async ({ data }) => {
    const { db } = await import("../../db");
    const { requireAuth } = await import("../../auth");
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    await db.user.update({
      where: { id: data.userId },
      data: { status: data.status }
    });
    return { success: true };
  });

const deleteUserAction = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { db } = await import("../../db");
    const { requireAuth } = await import("../../auth");
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    
    // Check if the user is a super admin
    const target = await db.user.findUnique({ where: { id: data.userId } });
    if (!target) throw new Error("User not found");
    if (target.role === "SUPER_ADMIN") throw new Error("Cannot delete super admin");

    await db.user.delete({
      where: { id: data.userId }
    });
    return { success: true };
  });

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
  loader: async () => await getUsers(),
});

function AdminUsers() {
  const users = Route.useLoaderData();
  const router = useRouter();

  async function handleStatusChange(userId: string, status: "ACTIVE" | "PAUSED" | "PENDING") {
    try {
      await updateUserStatus({ data: { userId, status } });
      toast.success("Status updated");
      router.invalidate();
    } catch (e: any) {
      toast.error("Failed to update status");
    }
  }

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`Are you sure you want to permanently delete user ${name}? This action cannot be undone.`)) return;
    try {
      await deleteUserAction({ data: { userId } });
      toast.success("User deleted");
      router.invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete user");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">Manage Users & Subscriptions</h1>
      </div>

      <div className="card-menu p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="pb-3 pr-3">Name</th>
              <th className="pb-3 pr-3">Hotel</th>
              <th className="pb-3 pr-3">Email</th>
              <th className="pb-3 pr-3">Status</th>
              <th className="pb-3 pr-3">Role</th>
              <th className="pb-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="py-4 pr-3 font-medium">{u.name}</td>
                <td className="py-4 pr-3">{u.hotel?.name || "-"}</td>
                <td className="py-4 pr-3 text-muted-foreground">{u.email}</td>
                <td className="py-4 pr-3">
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                    u.status === "ACTIVE" ? "bg-success/10 text-success" :
                    u.status === "PENDING" ? "bg-accent/10 text-accent" :
                    "bg-destructive/10 text-destructive"
                  }`}>
                    {u.status}
                  </span>
                </td>
                <td className="py-4 pr-3 text-xs">{u.role}</td>
                <td className="py-4 text-right space-x-2">
                  {u.role !== "SUPER_ADMIN" && (
                    <>
                      {u.status === "PENDING" && (
                        <button onClick={() => handleStatusChange(u.id, "ACTIVE")} className="btn-primary py-1 px-2 text-xs">Approve</button>
                      )}
                      {u.status === "ACTIVE" && (
                        <button onClick={() => handleStatusChange(u.id, "PAUSED")} className="btn-ghost py-1 px-2 text-xs text-accent hover:bg-accent/10">Pause</button>
                      )}
                      {u.status === "PAUSED" && (
                        <button onClick={() => handleStatusChange(u.id, "ACTIVE")} className="btn-primary py-1 px-2 text-xs">Resume</button>
                      )}
                      <button onClick={() => handleDelete(u.id, u.name)} className="btn-ghost py-1 px-2 text-xs text-destructive hover:bg-destructive/10 ml-2">Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
