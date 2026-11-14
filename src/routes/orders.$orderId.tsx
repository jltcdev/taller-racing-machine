import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderSheet } from "@/components/orders/OrderSheet";
import { AppShell } from "@/components/layout/AppShell";
import { loadWorkOrder } from "@/lib/orders.functions";
import { ordersStore, useOrders } from "@/lib/orders";

export const Route = createFileRoute("/orders/$orderId")({
  head: ({ params }) => ({
    meta: [
      { title: `Orden #${params.orderId} — Racing Machine` },
      {
        name: "description",
        content:
          "Vista previa de la orden de trabajo para imprimir o guardar en PDF.",
      },
      {
        property: "og:title",
        content: `Orden #${params.orderId} — Racing Machine`,
      },
      {
        property: "og:description",
        content: "Vista previa de la orden de trabajo.",
      },
    ],
  }),
  ssr: false,
  loader: async ({ params }) => {
    const order = await loadWorkOrder({ data: params.orderId });
    if (!order) throw notFound();
    ordersStore.upsert(order);
  },
  component: OrderPreview,
});

function OrderPreview() {
  const { orderId } = Route.useParams();
  const order = useOrders().find((item) => item.number === orderId);
  if (!order) {
    return (
      <AppShell title={`Orden de trabajo #${orderId}`}>
        <p role="status">Cargando orden de trabajo…</p>
      </AppShell>
    );
  }
  return (
    <AppShell title={`Orden de trabajo #${order.number}`}>
      <div className="order-preview-page">
        <div className="order-preview-actions no-print">
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft /> Volver a órdenes
            </Link>
          </Button>
          <Button variant="race" onClick={() => window.print()}>
            <Printer /> Imprimir / PDF
          </Button>
        </div>
        <OrderSheet order={order} />
      </div>
    </AppShell>
  );
}
