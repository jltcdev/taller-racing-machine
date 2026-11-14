import { describe, expect, it } from "vitest";

import { orderDataSchema } from "@/lib/order-schema";
import { formatCOP, orderTotal, type WorkOrder } from "@/lib/orders";

const validOrder = {
  date: "2026/11/13",
  owner: {
    name: " Ana Taller ",
    cc: "12345",
    phone: "3001234567",
    documentType: "CC" as const,
    email: "ana@example.com",
  },
  bike: {
    plate: " abc123 ",
    brand: " KTM ",
    model: " Duke 390 ",
    km: 0,
  },
  technician: "Técnico",
  status: "diagnostico" as const,
  report: "Revisión general",
  inspection: { Rayones: true, Fuga: false },
  accessories: { Casco: true, Herramienta: false },
  items: [
    {
      id: "part-1",
      catalogId: "catalog-1",
      kind: "part" as const,
      description: "Filtro de aceite",
      brand: "KTM",
      condition: "Nueva Original" as const,
      category: "Mecánica" as const,
      qty: 2,
      unitPrice: 25000,
    },
    {
      id: "service-1",
      kind: "service" as const,
      description: "Mano de obra",
      qty: 1,
      unitPrice: 50000,
    },
  ],
};

describe("work order payload validation", () => {
  it("accepts and normalizes a complete order with zero mileage and boolean flags", () => {
    const parsed = orderDataSchema.parse(validOrder);

    expect(parsed.owner.name).toBe("Ana Taller");
    expect(parsed.bike.plate).toBe("abc123");
    expect(parsed.bike.km).toBe(0);
    expect(parsed.inspection).toEqual({ Rayones: true, Fuga: false });
    expect(parsed.accessories).toEqual({ Casco: true, Herramienta: false });
  });

  it.each([
    [
      "invalid email",
      { ...validOrder, owner: { ...validOrder.owner, email: "bad" } },
    ],
    [
      "negative mileage",
      { ...validOrder, bike: { ...validOrder.bike, km: -1 } },
    ],
    [
      "short plate",
      { ...validOrder, bike: { ...validOrder.bike, plate: "AB" } },
    ],
    [
      "part without required details",
      {
        ...validOrder,
        items: [{ ...validOrder.items[0], brand: "", condition: undefined }],
      },
    ],
  ])("rejects %s", (_description, payload) => {
    expect(orderDataSchema.safeParse(payload).success).toBe(false);
  });

  it("calculates subtotals and the quote total from validated line items", () => {
    const parsed = orderDataSchema.parse(validOrder);
    const order = { ...parsed, number: "1001" } as WorkOrder;

    expect(orderTotal(order)).toBe(100000);
    expect(formatCOP(orderTotal(order))).toContain("100.000");
  });
});
