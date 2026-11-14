import { Construction } from "lucide-react";
import { AppShell, NewOrderButton } from "@/components/layout/AppShell";

export function ComingSoon({ title }: { title: string }) {
  return (
    <AppShell title={title} action={<NewOrderButton />}>
      <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card bg-stripe text-center">
        <Construction className="size-10 text-primary" />
        <h2 className="mt-3 text-2xl font-bold uppercase italic">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Este módulo estará disponible próximamente.</p>
      </div>
    </AppShell>
  );
}
