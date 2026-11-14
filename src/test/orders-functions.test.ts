import { describe, expect, it } from "vitest";

import {
  createSaveWorkOrderRpcArgs,
  getSaveOrderErrorMessage,
  mapWorkOrderRow,
} from "@/lib/orders.functions";
import { orderDataSchema } from "@/lib/order-schema";
import { isInventoryReservationActive } from "@/lib/orders";

const order = orderDataSchema.parse({
  date: "2026/11/13",
  owner: {
    name: "Ana Taller",
    cc: "12345",
    phone: "3001234567",
    documentType: "CC",
    email: "",
  },
  bike: { plate: "ABC123", brand: "KTM", model: "Duke 390", km: 0 },
  technician: "Jordan Galindo",
  status: "diagnostico",
  report: "Revisión",
  inspection: { Rayones: true },
  accessories: { Casco: false },
  items: [
    {
      id: "part-1",
      catalogId: "catalog-1",
      kind: "part",
      description: "Filtro",
      brand: "KTM",
      condition: "Nueva Original",
      category: "Mecánica",
      qty: 2,
      unitPrice: 25000,
    },
  ],
});

describe("save_work_order RPC contract", () => {
  it("maps a Supabase work_orders row into the printable order model", () => {
    expect(
      mapWorkOrderRow({ number: "1001", version: 4, data: order }),
    ).toMatchObject({
      number: "1001",
      version: 4,
      owner: { name: "Ana Taller" },
      items: [{ description: "Filtro", qty: 2 }],
    });
  });

  it("sends the order JSON as p_data and omits create-only optional arguments", () => {
    expect(createSaveWorkOrderRpcArgs({ order })).toEqual({ p_data: order });
  });

  it("adds the order number and optimistic version only when updating", () => {
    expect(
      createSaveWorkOrderRpcArgs({ order, number: "1001", version: 3 }),
    ).toEqual({ p_data: order, p_number: "1001", p_version: 3 });
  });

  it.each([
    [
      { code: "42501", message: "permission denied for table work_orders" },
      "Tu sesión expiró o no tienes permiso",
    ],
    [
      { message: "TypeError: Failed to fetch" },
      "No se pudo conectar con el servidor",
    ],
    [
      { message: "La orden cambió en otro dispositivo." },
      "La orden cambió en otro dispositivo.",
    ],
    [
      {
        message:
          "Pieza reservada temporalmente en otra orden de trabajo activa (0 disponibles)",
      },
      "Pieza reservada temporalmente en otra orden",
    ],
  ])("returns an actionable error for %s", (error, expected) => {
    expect(getSaveOrderErrorMessage(error)).toContain(expected);
  });

  it.each([
    ["diagnostico", true],
    ["reparacion", true],
    ["lista", true],
    ["entregada", false],
    ["finalizada", false],
    ["cancelada", false],
  ] as const)("identifies inventory-reserving status %s", (status, active) => {
    expect(isInventoryReservationActive(status)).toBe(active);
  });
});
