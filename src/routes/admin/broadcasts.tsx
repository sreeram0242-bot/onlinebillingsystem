import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";

const getBroadcasts = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("../../db");
    const { requireAuth } = await import("../../auth");
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    
    return await db.broadcast.findMany({
      orderBy: { createdAt: "desc" }
    });
  });

const addBroadcast = createServerFn({ method: "POST" })
  .validator((data: { message: string }) => data)
  .handler(async ({ data }) => {
    const { db } = await import("../../db");
    const { requireAuth } = await import("../../auth");
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    
    await db.broadcast.create({
      data: { message: data.message }
    });
    return { success: true };
  });

const toggleBroadcast = createServerFn({ method: "POST" })
  .validator((data: { id: string, isActive: boolean }) => data)
  .handler(async ({ data }) => {
    const { db } = await import("../../db");
    const { requireAuth } = await import("../../auth");
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    
    await db.broadcast.update({
      where: { id: data.id },
      data: { isActive: data.isActive }
    });
    return { success: true };
  });

const deleteBroadcast = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { db } = await import("../../db");
    const { requireAuth } = await import("../../auth");
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    
    await db.broadcast.delete({
      where: { id: data.id }
    });
    return { success: true };
  });

export const Route = createFileRoute("/admin/broadcasts")({
  component: AdminBroadcasts,
  loader: async () => await getBroadcasts(),
});

function AdminBroadcasts() {
  const broadcasts = Route.useLoaderData();
  const router = useRouter();
  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setIsSubmitting(true);
    try {
      await addBroadcast({ data: { message: newMessage.trim() } });
      toast.success("Broadcast published!");
      setNewMessage("");
      router.invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed to publish broadcast");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await toggleBroadcast({ data: { id, isActive: !isActive } });
      toast.success(isActive ? "Broadcast hidden" : "Broadcast shown");
      router.invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed to toggle broadcast");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this broadcast?")) return;
    try {
      await deleteBroadcast({ data: { id } });
      toast.success("Broadcast deleted");
      router.invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete broadcast");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">Platform Broadcasts</h1>
        <p className="text-sm text-muted-foreground">Send announcements to all hotel owners</p>
      </div>

      <form onSubmit={handleAdd} className="card-elevated p-5 space-y-3">
        <label className="block text-sm font-bold uppercase tracking-wider text-muted-foreground">
          New Announcement
        </label>
        <textarea
          className="input-field w-full min-h-[100px]"
          placeholder="Type your message here..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          required
        />
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          Publish to all Dashboards
        </button>
      </form>

      <div className="card-menu p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="pb-3 pr-3">Message</th>
              <th className="pb-3 pr-3">Date</th>
              <th className="pb-3 pr-3">Status</th>
              <th className="pb-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground">
                  No broadcasts created yet.
                </td>
              </tr>
            ) : broadcasts.map((b) => (
              <tr key={b.id} className={`border-b border-border last:border-0 hover:bg-secondary/50 ${!b.isActive ? "opacity-60" : ""}`}>
                <td className="py-4 pr-3 max-w-[400px]">
                  <p className="line-clamp-2">{b.message}</p>
                </td>
                <td className="py-4 pr-3 text-muted-foreground">{format(new Date(b.createdAt), "MMM d, yyyy h:mm a")}</td>
                <td className="py-4 pr-3">
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                    b.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                  }`}>
                    {b.isActive ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className="py-4 text-right space-x-2">
                  <button onClick={() => handleToggle(b.id, b.isActive)} className="btn-ghost py-1 px-2 text-xs">
                    {b.isActive ? "Hide" : "Show"}
                  </button>
                  <button onClick={() => handleDelete(b.id)} className="btn-ghost py-1 px-2 text-xs text-destructive hover:bg-destructive/10 ml-2">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
