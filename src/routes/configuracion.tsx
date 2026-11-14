import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — Racing Machine" },
      { name: "description", content: "Configuración del taller Racing Machine." },
      { property: "og:title", content: "Configuración — Racing Machine" },
      { property: "og:description", content: "Configuración del taller Racing Machine." },
    ],
  }),
  component: () => <ComingSoon title="Configuración" />,
});
