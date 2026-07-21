import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";

const getGlobalSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("../../db");
    const { requireAuth } = await import("../../auth");
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    
    // Ensure the global settings row exists
    let s = await db.globalSettings.findUnique({ where: { id: "global" } });
    if (!s) {
      s = await db.globalSettings.create({ data: { id: "global" } });
    }
    return s;
  });

const updateGlobalSettings = createServerFn({ method: "POST" })
  .validator((data: { allowRegistrations: boolean, defaultGst: number }) => data)
  .handler(async ({ data }) => {
    const { db } = await import("../../db");
    const { requireAuth } = await import("../../auth");
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    
    await db.globalSettings.upsert({
      where: { id: "global" },
      create: { id: "global", ...data },
      update: data
    });
    return { success: true };
  });

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
  loader: async () => await getGlobalSettings(),
});

function AdminSettings() {
  const settings = Route.useLoaderData();
  const router = useRouter();

  async function handleToggleRegistrations(v: boolean) {
    try {
      await updateGlobalSettings({ data: { ...settings, allowRegistrations: v } });
      toast.success(v ? "New signups enabled" : "New signups blocked");
      router.invalidate();
    } catch (e: any) {
      toast.error("Failed to update settings");
    }
  }

  async function handleUpdateGst(v: string) {
    const gst = Math.max(0, Number(v) || 0);
    try {
      await updateGlobalSettings({ data: { ...settings, defaultGst: gst } });
      toast.success("Global GST default updated");
      router.invalidate();
    } catch (e: any) {
      toast.error("Failed to update settings");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">Master controls for the billing SaaS</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="card-elevated p-5 space-y-4">
          <h2 className="font-display text-xl text-primary border-b border-border pb-2">Access Control</h2>
          
          <label className={`flex items-start justify-between gap-3 rounded-lg border border-border p-4 bg-secondary/30`}>
            <div>
              <div className="text-sm font-semibold text-foreground">Allow New Registrations</div>
              <div className="mt-1 text-xs text-muted-foreground">If disabled, the /register page will block all new signups. Use this during maintenance or invite-only periods.</div>
            </div>
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-primary"
              checked={settings.allowRegistrations}
              onChange={(e) => handleToggleRegistrations(e.target.checked)}
            />
          </label>
        </div>

        <div className="card-elevated p-5 space-y-4">
          <h2 className="font-display text-xl text-primary border-b border-border pb-2">Default Tenant Settings</h2>
          
          <label className="block">
            <div className="text-sm font-semibold text-foreground">Default GST %</div>
            <div className="mt-1 text-xs text-muted-foreground">This GST percentage will be applied automatically to all new hotels when they register.</div>
            <input
              type="number"
              min={0}
              max={50}
              step="0.1"
              className="input-field mt-3 max-w-[200px]"
              defaultValue={settings.defaultGst}
              onBlur={(e) => handleUpdateGst(e.target.value)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
