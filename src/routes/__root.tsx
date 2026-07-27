import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-primary">404</h1>
        <h2 className="mt-4 text-xl font-medium text-foreground">Page not found</h2>
        <Link to="/" className="btn-primary mt-6">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="btn-primary"
          >Try again</button>
          <a href="/" className="btn-ghost">Go home</a>
        </div>
      </div>
    </div>
  );
}

import { getSessionAction, logoutAction } from "../actions";
import { createServerFn } from "@tanstack/react-start";

const getHotelNameAction = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getUserFromSession } = await import("../auth");
    const user = getUserFromSession();
    if (!user || !user.hotelId) return "Ram Mess";
    const { db } = await import("../db");
    const hotel = await db.hotel.findUnique({ where: { id: user.hotelId } });
    return hotel?.name || "Ram Mess";
  });

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/login" || location.pathname === "/register") {
      return {};
    }
    const user = await getSessionAction();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    if (user.role === "SUPER_ADMIN" && !location.pathname.startsWith("/admin")) {
      throw redirect({ to: "/admin" });
    }
    if (user.role === "HOTEL_OWNER" && location.pathname.startsWith("/admin")) {
      throw redirect({ to: "/" });
    }
    return { user };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
      { title: "Ram Mess — Billing & Loyalty" },
      { name: "description", content: "Restaurant billing, loyalty streaks, revenue & expense tracking." },
      { property: "og:title", content: "Ram Mess — Billing & Loyalty" },
      { property: "og:description", content: "Bills, customers, menu, revenue & expenses in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Fira+Sans:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  loader: async ({ context }) => {
    try {
      const hotelName = await getHotelNameAction();
      return { hotelName: hotelName || "Ram Mess" };
    } catch {
      return { hotelName: "Ram Mess" };
    }
  },
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
        <script dangerouslySetInnerHTML={{
          __html: `
            const removeBadge = () => {
              document.querySelectorAll('#lovable-badge-root, .lovable-badge, [data-lovable-badge], a[href*="lovable.dev"]').forEach(el => el.remove());
            };
            const observer = new MutationObserver(() => removeBadge());
            observer.observe(document.body, { childList: true, subtree: true });
            window.addEventListener('load', removeBadge);
            setTimeout(removeBadge, 1000);
            setTimeout(removeBadge, 3000);
          `
        }} />
      </body>
    </html>
  );
}

const NAV_ITEMS_HOTEL = [
  { to: "/", label: "Dashboard", icon: "◐" },
  { to: "/revenue", label: "Revenue", icon: "₹" },
  { to: "/new-bill", label: "New Bill", icon: "＋" },
  { to: "/customers", label: "Customers", icon: "◇" },
  { to: "/menu", label: "Menu", icon: "☰" },
] as const;

const NAV_ITEMS_ADMIN = [
  { to: "/admin", label: "Dashboard", icon: "◐" },
  { to: "/admin/broadcasts", label: "Broadcasts", icon: "📢" },
  { to: "/admin/hotels", label: "Hotels", icon: "🏢" },
  { to: "/admin/users", label: "Users", icon: "👥" },
  { to: "/admin/settings", label: "Settings", icon: "⚙" },
] as const;

function useHotelName() {
  try {
    const { hotelName } = Route.useLoaderData() as { hotelName: string };
    return hotelName || "Engineers Kitchen";
  } catch {
    return "Engineers Kitchen";
  }
}

function Sidebar({ onNavigate, hotelName, isAdmin }: { onNavigate?: () => void; hotelName: string; isAdmin: boolean }) {
  const items = isAdmin ? NAV_ITEMS_ADMIN : NAV_ITEMS_HOTEL;
  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-6 py-5">
        <div className="font-display text-xl leading-tight text-primary">{hotelName}</div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.15em] text-accent">
          Billing & Loyalty
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
            activeOptions={{ exact: item.to === "/" || item.to === "/admin" }}
          >
            <span className="text-base opacity-70">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-border px-6 py-4 text-[11px] leading-relaxed text-muted-foreground">
        <button
          onClick={async () => {
            await logoutAction();
            window.location.href = "/login";
          }}
          className="btn-ghost w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive mb-4"
        >
          <span className="text-base opacity-70">⎋</span>
          Sign Out
        </button>
        <div className="font-medium text-foreground">Help</div>
        <div className="mt-2 space-y-1">
          <div>Sreeram (Developer)</div>
          <div className="flex items-center gap-1.5"><span className="text-sm">📞</span> <a href="tel:9629661668" className="hover:underline font-bold text-foreground">9629661668</a></div>
        </div>
        <div className="mt-4 space-y-0.5">
          <div>Made by Clouddine</div>
          <a href="https://www.clouddine.store" target="_blank" rel="noopener noreferrer" className="inline-block text-primary hover:underline font-bold">www.clouddine.store</a>
        </div>
      </div>
    </aside>
  );
}

function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const items = isAdmin ? NAV_ITEMS_ADMIN : NAV_ITEMS_HOTEL;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card md:hidden">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex flex-col items-center justify-center gap-0.5 pt-3 pb-2 text-[10px] font-medium text-muted-foreground"
          activeProps={{ className: "text-primary" }}
          activeOptions={{ exact: item.to === "/" || item.to === "/admin" }}
        >
          <span className="text-lg">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function useDarkMode() {
  useEffect(() => {
    const saved = localStorage.getItem("ek-theme") === "dark";
    document.documentElement.classList.toggle("dark", saved);
  }, []);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const isAdmin = location.pathname.startsWith("/admin");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(!isAuthPage);
  const hotelName = useHotelName();
  useDarkMode();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen bg-background">
        {desktopOpen && !isAuthPage && (
          <div className="hidden md:block">
            <Sidebar onNavigate={() => setDesktopOpen(false)} hotelName={hotelName} isAdmin={isAdmin} />
          </div>
        )}

        {mobileOpen && !isAuthPage && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0">
              <Sidebar onNavigate={() => setMobileOpen(false)} hotelName={hotelName} isAdmin={isAdmin} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card px-4 py-3">
            {isAuthPage ? (
              <div className="w-8" />
            ) : (
              <button
                onClick={() => { setMobileOpen((v) => !v); setDesktopOpen((v) => !v); }}
                className="btn-ghost !py-1.5"
                aria-label="Toggle sidebar"
              ><span aria-hidden>☰</span></button>
            )}
            <div className="font-display text-lg text-primary">{hotelName}</div>
            <div className="w-8" />
          </header>

          <main
            className="min-w-0 flex-1 overflow-x-hidden px-2 py-3 pb-[70px] sm:px-4 sm:py-6 sm:pb-[70px] md:px-8 md:py-8 md:pb-8"
            onPointerDown={() => { setMobileOpen(false); setDesktopOpen(false); }}
          >
            <div className="mx-auto w-full min-w-0 max-w-6xl"><Outlet /></div>
          </main>

        </div>
        {!isAuthPage && <BottomNav isAdmin={isAdmin} />}
      </div>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
