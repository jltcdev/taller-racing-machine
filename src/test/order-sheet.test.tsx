import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderSheet } from "@/components/orders/OrderSheet";
import type { WorkOrder } from "@/lib/orders";

const order: WorkOrder = {
  number: "RM-1024",
  date: "2025-03-08",
  owner: {
    name: "Ana Pérez",
    cc: "123456789",
    phone: "3001234567",
  },
  bike: {
    plate: "ABC12D",
    model: "Duke 390",
    brand: "KTM",
    km: 12500,
  },
  technician: "Camilo Rojas",
  status: "reparacion",
  report: "Revisar sistema de frenos",
  inspection: { "Rayones / raspones": true },
  accessories: { Llaves: true },
  items: [
    {
      id: "part-1",
      code: "OEM-390",
      description: "Pastillas de freno",
      brand: "KTM",
      condition: "Nueva Original",
      qty: 2,
      unitPrice: 125000,
    },
    {
      id: "service-1",
      kind: "service",
      description: "Mano de obra",
      qty: 1,
      unitPrice: 0,
    },
    {
      id: "part-2",
      description: "Escape deportivo",
      condition: "Aftermarket / Lujo",
      qty: 1,
      unitPrice: 30000,
    },
  ],
};

describe("OrderSheet", () => {
  it("renders order data, selected part condition, and safe currency totals", () => {
    render(<OrderSheet order={order} />);

    expect(screen.getByTestId("order-sheet")).toHaveAttribute(
      "aria-label",
      "Orden de trabajo RM-1024",
    );
    expect(screen.getAllByText("Ana Pérez")).toHaveLength(2);
    expect(screen.getByText("ABC12D")).toBeInTheDocument();
    expect(screen.getByText("Revisar sistema de frenos")).toBeInTheDocument();
    expect(screen.getByText("NUEVO ORIGINAL")).toBeInTheDocument();
    expect(screen.getByText("MANO DE OBRA")).toBeInTheDocument();
    expect(screen.getByText("AFTERMARKET / LUJO")).toBeInTheDocument();
    expect(screen.getByText("Pastillas de freno")).toBeInTheDocument();
    expect(screen.getByText("$250.000")).toBeInTheDocument();
    expect(
      screen.getByText("$280.000", { selector: ".print-total strong" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("VALOR TOTAL DE LA REPARACIÓN"),
    ).toBeInTheDocument();
    expect(screen.getByText(/INFORME DE BODEGAJE:/)).toBeInTheDocument();
    expect(screen.getByText("TÉCNICO ENCARGADO")).toBeInTheDocument();
    expect(screen.getByText("ACEPTACIÓN DEL CLIENTE")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Orden de Trabajo #RM-1024 - Racing Machine Taller Especializado",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("MANO DE OBRA").closest("tr")).toHaveClass(
      "print-labor-row",
      "bg-orange-100",
      "font-bold",
    );
    expect(screen.getByText("AFTERMARKET / LUJO").closest("tr")).toHaveClass(
      "print-aftermarket-row",
      "text-orange-600",
    );
  });
});
