import { afterEach, describe, expect, it } from "vitest";
import { ordersStore, type WorkOrder } from "@/lib/orders";

const order: WorkOrder = {
  number: "0042",
  date: "2026/11/13",
  owner: { name: "Cliente de prueba", cc: "123", phone: "3000000000" },
  bike: { plate: "ABC12D", model: "Duke", km: 1000 },
  technician: "Técnico",
  status: "diagnostico",
  report: "",
  inspection: {},
  accessories: {},
  items: [],
};

afterEach(() => ordersStore.replace([]));

describe("ordersStore", () => {
  it("starts and remains empty when Supabase returns no orders", () => {
    ordersStore.replace([]);

    expect(ordersStore.getAll()).toEqual([]);
    expect(ordersStore.find("0988")).toBeUndefined();
    expect(ordersStore.nextNumber()).toBe("0001");
  });

  it("replaces orders without appending static examples", () => {
    ordersStore.replace([order]);

    expect(ordersStore.getAll()).toEqual([order]);
    expect(ordersStore.nextNumber()).toBe("0043");
  });
});
