import { useSyncExternalStore } from "react";

export type OrderStatus =
  | "diagnostico"
  | "reparacion"
  | "lista"
  | "entregada"
  | "finalizada"
  | "cancelada";
export type PartCondition =
  | "Nueva Original"
  | "Nueva Genérica"
  | "Aftermarket / Lujo"
  | "Reparada"
  | "Repuesto de Lujo";
export type PartCategory = "Mecánica" | "Eléctrica" | "Lujo";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  diagnostico: "En Diagnóstico",
  reparacion: "En Reparación",
  lista: "Lista para Entrega",
  entregada: "Entregada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export const isInventoryReservationActive = (status: OrderStatus) =>
  status !== "entregada" && status !== "finalizada" && status !== "cancelada";

export const INSPECTION_ITEMS = [
  "Rayones / raspones",
  "Abolladura / deformación",
  "Fisura / rotura",
  "Pieza faltante",
  "Desgaste de pintura",
  "Corrosión / óxido",
  "Fuga de fluidos",
  "Daño eléctrico / luces",
  "Daño en asiento / tapicería",
  "Daño en neumáticos / ruedas",
  "Daño en manillar / mandos",
  "Testigo encendido en tablero",
] as const;
export const ACCESSORY_ITEMS = [
  "Llaves",
  "Casco",
  "Herramienta",
  "Tarjeta de propiedad",
  "SOAT",
  "Espejos",
  "Maletero / baúl",
  "Maletas laterales",
  "Protector de motor",
  "Cargador / toma auxiliar",
  "Otro accesorio",
] as const;
export const TECHNICIANS = [
  "Jordan Galindo",
  "Camilo Rojas",
  "Andrés Peña",
  "Felipe Moreno",
];

export const PART_CONDITIONS = [
  "Nueva Original",
  "Nueva Genérica",
  "Aftermarket / Lujo",
  "Reparada",
] as const;
export const PART_CATEGORIES = ["Mecánica", "Eléctrica", "Lujo"] as const;
export type PartType = "Pieza de Repuesto" | "Pieza de Lujo";

export interface QuoteItem {
  id: string;
  catalogId?: string;
  kind?: "part" | "service";
  code?: string;
  description: string;
  brand?: string;
  condition?: PartCondition;
  conditionPrices?: Partial<Record<PartCondition, number>>;
  category?: PartCategory;
  partType?: PartType;
  qty: number;
  unitPrice: number;
}

export interface WorkOrderOwner {
  name: string;
  cc: string;
  phone: string;
  documentType?: "CC" | "CE" | "NIT" | "Pasaporte" | "Otro";
  email?: string;
}

export interface WorkOrderBike {
  plate: string;
  model: string;
  km: number;
  brand?: string;
  year?: number;
  vin?: string;
  engineNumber?: string;
}

export interface WorkOrder {
  number: string;
  version?: number;
  date: string;
  owner: WorkOrderOwner;
  bike: WorkOrderBike;
  technician: string;
  status: OrderStatus;
  report: string;
  inspection: Record<string, boolean>;
  accessories: Record<string, boolean>;
  items: QuoteItem[];
}

export type OrdersLoadStatus = "loading" | "ready" | "error";

export const orderTotal = (o: Pick<WorkOrder, "items">) =>
  o.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);

/** Colombian peso format with periods as thousand separators. */
export function formatCOP(value: number): string {
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))}`;
}

export function formatCOPInput(value: string | number): string {
  const rawValue =
    typeof value === "number" ? String(Math.round(value)) : value;
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(Number(digits));
}

export function parseCOPInput(value: string): string {
  return value.replace(/\D/g, "");
}

let orders: WorkOrder[] = [];
let loadStatus: OrdersLoadStatus = "loading";
const listeners = new Set<() => void>();
const get = () => orders;
const notify = () => listeners.forEach((listener) => listener());

export const ordersStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getAll: get,
  getLoadStatus: () => loadStatus,
  setLoadStatus(status: OrdersLoadStatus) {
    loadStatus = status;
    notify();
  },
  find: (number: string) => get().find((order) => order.number === number),
  nextNumber: () => {
    const highestNumber = get().reduce(
      (highest, order) => Math.max(highest, Number(order.number) || 0),
      0,
    );
    return String(highestNumber + 1).padStart(4, "0");
  },
  replace(saved: WorkOrder[]) {
    orders = [...saved].sort((a, b) => Number(b.number) - Number(a.number));
    loadStatus = "ready";
    notify();
  },
  update(order: WorkOrder) {
    orders = get().map((existing) =>
      existing.number === order.number ? order : existing,
    );
    notify();
  },
  add(order: WorkOrder) {
    orders = [order, ...get()];
    notify();
  },
  upsert(order: WorkOrder) {
    orders = [
      order,
      ...get().filter((existing) => existing.number !== order.number),
    ];
    notify();
  },
};

export const useOrders = () =>
  useSyncExternalStore(ordersStore.subscribe, get, get);

export const useOrdersLoadStatus = () =>
  useSyncExternalStore(
    ordersStore.subscribe,
    ordersStore.getLoadStatus,
    ordersStore.getLoadStatus,
  );
