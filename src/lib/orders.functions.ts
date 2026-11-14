import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { orderDataSchema } from "./order-schema";
import type { WorkOrder } from "./orders";
import type { Json } from "@/integrations/supabase/types";

type SaveOrderInput = {
  number?: string | undefined;
  version?: number | undefined;
  order: z.infer<typeof orderDataSchema>;
};

type WorkOrderRow = {
  data: Json;
  number: string;
  version: number;
};

export function mapWorkOrderRow(row: WorkOrderRow): WorkOrder {
  return {
    ...orderDataSchema.parse(row.data),
    number: row.number,
    version: row.version,
  } as WorkOrder;
}

export function createSaveWorkOrderRpcArgs(data: SaveOrderInput): {
  p_data: Json;
  p_number?: string;
  p_version?: number;
} {
  return {
    p_data: data.order as Json,
    ...(data.number === undefined ? {} : { p_number: data.number }),
    ...(data.version === undefined ? {} : { p_version: data.version }),
  };
}

export function getSaveOrderErrorMessage(error: {
  code?: string;
  message: string;
}): string {
  if (error.message.toLowerCase().includes("otro dispositivo"))
    return error.message;
  if (
    error.code === "42501" ||
    /permission denied|row.level security|unauthorized|inicia sesión|jwt/.test(
      error.message.toLowerCase(),
    )
  ) {
    return "Tu sesión expiró o no tienes permiso para guardar la orden. Inicia sesión e inténtalo de nuevo.";
  }
  if (
    /reservada temporalmente|stock suficiente|existencias suficientes/.test(
      error.message.toLowerCase(),
    )
  )
    return error.message;
  if (
    /failed to fetch|network|timeout|fetch failed/.test(
      error.message.toLowerCase(),
    )
  )
    return "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  return "No se pudo guardar la orden. Intenta nuevamente.";
}

export const loadOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("work_orders")
      .select("number,data,version")
      .order("updated_at", { ascending: false });
    if (error) throw new Error("No se pudieron cargar las órdenes.");
    return (data ?? []).map(mapWorkOrderRow);
  });

export const loadWorkOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().min(1))
  .handler(async ({ data: number, context }) => {
    const { data, error } = await context.supabase
      .from("work_orders")
      .select("number,data,version")
      .eq("number", number)
      .maybeSingle();

    if (error) throw new Error("No se pudo cargar la orden solicitada.");
    return data ? mapWorkOrderRow(data) : null;
  });

export const saveOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      number: z.string().optional(),
      version: z.number().optional(),
      order: orderDataSchema,
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("save_work_order", {
      ...createSaveWorkOrderRpcArgs(data),
    });
    if (error) throw new Error(getSaveOrderErrorMessage(error));
    return {
      ...orderDataSchema.parse(row.data),
      number: row.number,
      version: row.version,
    } as WorkOrder;
  });

export const saveOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      number: z.string().min(1),
      status: z.enum([
        "diagnostico",
        "reparacion",
        "lista",
        "entregada",
        "finalizada",
        "cancelada",
      ]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc(
      "set_work_order_status",
      {
        p_number: data.number,
        p_status: data.status,
      },
    );
    if (error) throw new Error(getSaveOrderErrorMessage(error));
    return {
      ...orderDataSchema.parse(row.data),
      number: row.number,
      version: row.version,
    } as WorkOrder;
  });

export const loadHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string())
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("order_history")
      .select("id,action,details,created_at")
      .eq("order_number", data)
      .order("created_at", { ascending: false });
    if (error) throw new Error("No se pudo cargar el historial.");
    return rows ?? [];
  });
export const recordPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string())
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("record_order_pdf", {
      p_number: data,
    });
    if (error)
      throw new Error(
        "El PDF se descargó, pero no se pudo registrar en el historial.",
      );
  });
