import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { InventoryManager } from "@/components/inventory/InventoryManager";

export const Route = createFileRoute("/inventario")({
  head: () => ({
    meta: [
      { title: "Inventario & Repuestos — Racing Machine" },
      {
        name: "description",
        content: "Inventario & Repuestos del taller Racing Machine.",
      },
      {
        property: "og:title",
        content: "Inventario & Repuestos — Racing Machine",
      },
      {
        property: "og:description",
        content: "Inventario & Repuestos del taller Racing Machine.",
      },
    ],
  }),
  component: () => (
    <AppShell title="Inventario y repuestos">
      <InventoryManager />
    </AppShell>
  ),
});
