import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadOrders } from "@/lib/orders.functions";
import { ordersStore } from "@/lib/orders";

export function OrdersSync() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        ordersStore.setLoadStatus("error");
        return;
      }
      const sessionUserId = data.session?.user.id ?? null;
      setUserId(sessionUserId);
      if (!sessionUserId) ordersStore.replace([]);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        const sessionUserId = session?.user.id ?? null;
        setUserId(sessionUserId);
        ordersStore.replace([]);
        if (sessionUserId) ordersStore.setLoadStatus("loading");
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const query = useQuery({
    queryKey: ["saved-orders", userId],
    queryFn: () => loadOrders(),
    enabled: !!userId,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (query.data) ordersStore.replace(query.data);
  }, [query.data]);

  useEffect(() => {
    if (query.isError) ordersStore.setLoadStatus("error");
  }, [query.isError]);

  return query.isError ? (
    <p
      role="alert"
      className="border-b border-destructive p-3 text-sm text-destructive"
    >
      No se pudieron cargar tus órdenes guardadas. Actualiza la página para
      reintentar.
    </p>
  ) : null;
}
