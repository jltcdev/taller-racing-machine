import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Racing Machine" },
      { name: "description", content: "Dashboard del taller Racing Machine." },
      { property: "og:title", content: "Dashboard — Racing Machine" },
      { property: "og:description", content: "Dashboard del taller Racing Machine." },
    ],
  }),
  component: () => <ComingSoon title="Dashboard" />,
});
