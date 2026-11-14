import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Wrench,
  Package,
  Users,
  Settings,
  MapPin,
  Moon,
  Sun,
  Menu,
  X,
} from "lucide-react";
import logo from "@/assets/racing-machine-logo.png";
import { Button } from "@/components/ui/button";
import { isInventoryReservationActive, useOrders } from "@/lib/orders";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/", label: "Órdenes de Trabajo", icon: Wrench, badge: true },
  { to: "/inventario", label: "Inventario & Repuestos", icon: Package },
  { to: "/clientes", label: "Clientes & Motos", icon: Users },
  { to: "/configuracion", label: "Configuración", icon: Settings },
] as const;

function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setDark((d) => !d)}
      aria-label="Cambiar tema"
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

export function AppShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = useOrders().filter((o) =>
    isInventoryReservationActive(o.status),
  ).length;
  const [open, setOpen] = useState(false);
  const isActive = (to: string) =>
    to === "/"
      ? path === "/" || path.startsWith("/orders")
      : path.startsWith(to);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 print:hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="border-b border-sidebar-border px-5 py-5">
          <img
            src={logo}
            alt="Racing Machine"
            className="h-14 w-auto rounded bg-card/95 p-1"
          />
          <p className="mt-3 font-display text-[11px] font-bold uppercase italic tracking-[0.2em] text-sidebar-primary">
            Servicio técnico especializado
          </p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(item.to)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--sidebar-primary)]"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "size-4",
                  isActive(item.to) && "text-sidebar-primary",
                )}
              />
              <span className="flex-1">{item.label}</span>
              {"badge" in item && (
                <span className="rounded bg-sidebar-primary px-1.5 py-0.5 font-mono text-[10px] font-bold text-sidebar-primary-foreground">
                  {active}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="m-3 rounded-md border border-sidebar-border bg-sidebar-accent/50 p-3 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <MapPin className="size-3.5 text-sidebar-primary" /> Sede Central
            Bogotá
          </div>
          <div className="mt-1 flex items-center gap-2 text-sidebar-foreground/60">
            <span className="size-2 animate-pulse rounded-full bg-status-ready" />{" "}
            Activo
          </div>
        </div>
      </aside>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-background/70 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="dashboard-header print:hidden sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menú"
          >
            {open ? <X /> : <Menu />}
          </Button>
          <h1 className="flex-1 truncate font-sans text-xl font-semibold tracking-tight md:text-2xl">
            {title}
          </h1>
          <ThemeToggle />
          {action}
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function NewOrderButton() {
  return (
    <Button variant="race" asChild>
      <Link to="/orders/new">+ Nueva Orden</Link>
    </Button>
  );
}

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const tone: Record<string, string> = {
    diagnostico: "bg-status-diag/15 text-status-diag border-status-diag/40",
    reparacion:
      "bg-status-repair/15 text-status-repair border-status-repair/40",
    lista: "bg-status-ready/15 text-status-ready border-status-ready/40",
    entregada: "bg-status-done/15 text-status-done border-status-done/40",
    finalizada: "bg-status-done/15 text-status-done border-status-done/40",
    cancelada: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold",
        tone[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
