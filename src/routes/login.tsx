import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { loginAction } from "../actions";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { email: "", password: "" }
  });

  async function onSubmit(data: any) {
    try {
      const res = await loginAction({ data });
      if (res.success) {
        toast.success("Logged in successfully");
        navigate({ to: res.role === "SUPER_ADMIN" ? "/admin" : "/" });
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to log in");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card-elevated w-full max-w-sm p-6 space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl text-primary">Sign In</h1>
          <p className="text-sm text-muted-foreground mt-1">Engineers Kitchen Billing</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Email</label>
            <input type="email" {...register("email", { required: true })} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Password</label>
            <input type="password" {...register("password", { required: true })} className="input-field" />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div className="text-center text-sm text-muted-foreground">
          Don't have an account? <Link to="/register" className="text-primary hover:underline">Register</Link>
        </div>
      </div>
    </div>
  );
}
