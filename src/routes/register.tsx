import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { registerAction } from "../actions";

const getGlobalSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("../db");
    const s = await db.globalSettings.findUnique({ where: { id: "global" } });
    return s ? s.allowRegistrations : true;
  });

export const Route = createFileRoute("/register")({
  component: RegisterPage,
  loader: async () => await getGlobalSettings(),
});

function RegisterPage() {
  const allowRegistrations = Route.useLoaderData();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { name: "", email: "", password: "", hotelName: "" }
  });

  async function onSubmit(data: any) {
    try {
      const res = await registerAction({ data });
      if (res.success) {
        toast.success("Registered successfully! Awaiting admin approval.");
        navigate({ to: "/login" });
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to register");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card-elevated w-full max-w-sm p-6 space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl text-primary">Register</h1>
          <p className="text-sm text-muted-foreground mt-1">Create a new hotel account</p>
        </div>
        {!allowRegistrations ? (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-lg text-center">
            New registrations are currently paused. Please contact support or try again later.
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Your Name</label>
              <input type="text" {...register("name", { required: true })} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Hotel Name</label>
              <input type="text" {...register("hotelName", { required: true })} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Email</label>
              <input type="email" {...register("email", { required: true })} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Password</label>
              <input type="password" {...register("password", { required: true, minLength: 6 })} className="input-field" />
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? "Registering..." : "Register"}
            </button>
          </form>
        )}
        <div className="text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
