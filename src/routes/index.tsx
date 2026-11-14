import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Stethoscope,
  Wrench,
  PackageCheck,
  Search,
  FileText,
  Pencil,
  X,
} from "lucide-react";
import {
  AppShell,
  NewOrderButton,
  StatusBadge,
} from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { saveOrderStatus } from "@/lib/orders.functions";
import {
  STATUS_LABEL,
  formatCOP,
  isInventoryReservationActive,
  orderTotal,
  ordersStore,
  useOrders,
  useOrdersLoadStatus,
  type OrderStatus,
} from "@/lib/orders";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Órdenes de Trabajo — Racing Machine" },
      {
        name: "description",
        content:
          "Listado y seguimiento de órdenes de trabajo del taller Racing Machine.",
      },
      { property: "og:title", content: "Órdenes de Trabajo — Racing Machine" },
      {
        property: "og:description",
        content:
          "Listado y seguimiento de órdenes de trabajo del taller Racing Machine.",
      },
    ],
  }),
  component: OrdersPage,
});

const TABS: { key: "all" | OrderStatus; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "diagnostico", label: "En Diagnóstico" },
  { key: "reparacion", label: "En Reparación" },
  { key: "lista", label: "Lista para Entrega" },
  { key: "entregada", label: "Entregadas" },
  { key: "finalizada", label: "Finalizadas" },
  { key: "cancelada", label: "Canceladas" },
];

function OrdersPage() {
  const orders = useOrders();
  const ordersLoadStatus = useOrdersLoadStatus();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
  const changeOrderStatus = async (number: string, status: OrderStatus) => {
    setUpdatingStatus(number);
    try {
      const saved = await saveOrderStatus({ data: { number, status } });
      ordersStore.update(saved);
      await queryClient.invalidateQueries({ queryKey: ["saved-orders"] });
      toast.success(`Orden #${number}: ${STATUS_LABEL[status].toLowerCase()}.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el estado de la orden.",
      );
    } finally {
      setUpdatingStatus(null);
    }
  };
  const metrics = [
    {
      label: "Total Activas",
      value: orders.filter((o) => isInventoryReservationActive(o.status))
        .length,
      icon: Activity,
      tone: "text-primary",
    },
    {
      label: "En Diagnóstico",
      value: count("diagnostico"),
      icon: Stethoscope,
      tone: "text-status-diag",
    },
    {
      label: "En Reparación",
      value: count("reparacion"),
      icon: Wrench,
      tone: "text-status-repair",
    },
    {
      label: "Listas para Entrega",
      value: count("lista"),
      icon: PackageCheck,
      tone: "text-status-ready",
    },
  ];

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (tab === "all" || o.status === tab) &&
        (!term ||
          [o.number, o.owner.name, o.bike.plate].some((v) =>
            v.toLowerCase().includes(term),
          )),
    );
  }, [orders, q, tab]);

  return (
    <AppShell title="Órdenes de Trabajo" action={<NewOrderButton />}>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="relative overflow-hidden rounded-lg border border-border bg-card p-5"
          >
            <div className="absolute inset-y-0 right-0 w-24 bg-stripe opacity-60" />
            <m.icon className={cn("size-5", m.tone)} />
            <div className="mt-3 font-display text-4xl font-extrabold italic">
              {m.value}
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {m.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-96">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por placa, cliente o # de orden"
            className={cn("pl-9", q.length > 0 && "pr-12")}
          />
          {q.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Limpiar búsqueda de órdenes"
              onClick={() => setQ("")}
              className="absolute right-1 top-1/2 size-11 -translate-y-1/2"
            >
              <X />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {(q.trim().length > 0 || tab !== "all") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setTab("all");
            }}
            className="self-start text-muted-foreground md:self-auto"
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {rows.length === 0 && ordersLoadStatus === "loading" ? (
        <div
          role="status"
          className="mt-4 flex min-h-64 items-center justify-center rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground"
        >
          Cargando órdenes de trabajo…
        </div>
      ) : rows.length === 0 && ordersLoadStatus === "error" ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-destructive/40 bg-card px-6 py-12 text-center text-sm text-destructive"
        >
          No se pudieron cargar las órdenes. Actualiza la página para
          reintentar.
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText className="size-6" />
          </div>
          <h2 className="font-display text-xl font-bold uppercase">
            No hay órdenes de trabajo registradas
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {orders.length === 0
              ? "Crea una nueva orden para comenzar el seguimiento del taller."
              : "No se encontraron órdenes con los filtros aplicados. Ajusta la búsqueda o crea una nueva orden."}
          </p>
          <Button variant="race" asChild className="mt-5">
            <Link to="/orders/new">+ Nueva orden</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                {[
                  "N° Orden",
                  "Fecha",
                  "Cliente",
                  "Vehículo",
                  "Técnico Asignado",
                  "Estado",
                  "Valor Total",
                  "Acciones",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr
                  key={o.number}
                  className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3 font-mono font-bold text-primary">
                    #{o.number}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {o.date}
                  </td>
                  <td className="px-4 py-3 font-medium">{o.owner.name}</td>
                  <td className="px-4 py-3">
                    <span className="mr-2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-bold">
                      {o.bike.plate}
                    </span>
                    <span className="text-muted-foreground">
                      {o.bike.model}
                    </span>
                  </td>
                  <td className="px-4 py-3">{o.technician}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={o.status}
                      disabled={
                        updatingStatus === o.number ||
                        !isInventoryReservationActive(o.status)
                      }
                      onValueChange={(value) =>
                        void changeOrderStatus(o.number, value as OrderStatus)
                      }
                    >
                      <SelectTrigger
                        aria-label={`Estado de la orden ${o.number}`}
                        className="h-9 min-w-44 text-xs"
                      >
                        <SelectValue>
                          <StatusBadge
                            status={o.status}
                            label={STATUS_LABEL[o.status]}
                          />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          [
                            "diagnostico",
                            "reparacion",
                            "lista",
                            "entregada",
                            "finalizada",
                            "cancelada",
                          ] as const
                        ).map((status) => (
                          <SelectItem key={status} value={status}>
                            {STATUS_LABEL[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">
                    {formatCOP(orderTotal(o))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label="Ver PDF"
                      >
                        <Link
                          to="/orders/$orderId"
                          params={{ orderId: o.number }}
                        >
                          <FileText />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label="Editar"
                      >
                        <Link
                          to="/orders/$orderId"
                          params={{ orderId: o.number }}
                        >
                          <Pencil />
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
