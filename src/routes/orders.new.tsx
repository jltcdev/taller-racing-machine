import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/AppShell';
import { OrderForm } from '@/components/orders/OrderForm';
export const Route = createFileRoute('/orders/new')({
  head: () => ({ meta: [
    { title: 'Nueva orden de trabajo — Racing Machine' },
    { name: 'description', content: 'Registro de cliente, motocicleta y repuestos del taller.' },
    { property: 'og:title', content: 'Nueva orden de trabajo — Racing Machine' },
    { property: 'og:description', content: 'Registro de ingreso y cotización de motocicletas.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }), component: () => <AppShell title="Nueva orden de trabajo"><OrderForm /></AppShell>,
});
