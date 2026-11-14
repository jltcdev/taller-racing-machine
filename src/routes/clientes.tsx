import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes & Motos — Racing Machine" },
      { name: "description", content: "Clientes & Motos del taller Racing Machine." },
      { property: "og:title", content: "Clientes & Motos — Racing Machine" },
      { property: "og:description", content: "Clientes & Motos del taller Racing Machine." },
    ],
  }),
  component: () => <ComingSoon title="Clientes & Motos" />,
});
