import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/AppShell';
import { OrderForm } from '@/components/orders/OrderForm';
import { useOrders } from '@/lib/orders';
export const Route = createFileRoute('/orders/$orderId/edit')({
  head: ({ params }) => ({ meta: [
    { title: `Editar orden #${params.orderId} — Racing Machine` },
    { name: 'description', content: 'Actualización de los datos y repuestos de la orden de trabajo.' },
    { property: 'og:title', content: `Editar orden #${params.orderId} — Racing Machine` },
    { property: 'og:description', content: 'Edición de cliente, moto e inventario de ingreso.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }), component: EditOrder,
});
function EditOrder() { const { orderId } = Route.useParams(); const order = useOrders().find(o => o.number === orderId); return <AppShell title={`Editar orden #${orderId}`}>{order ? <OrderForm key={`${order.number}-${order.version}`} initial={order} /> : <p>Cargando orden…</p>}</AppShell>; }
