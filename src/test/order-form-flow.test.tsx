import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OrderForm } from "@/components/orders/OrderForm";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  saveOrder: vi.fn(),
  searchInventoryCatalog: vi.fn(),
  loadOrderCatalog: vi.fn(),
  loadInventoryStockQuantities: vi.fn(),
  loadInventoryConditionPrices: vi.fn(),
  loadOrderAudio: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/lib/catalog", () => ({
  InventoryCatalogSearchError: class InventoryCatalogSearchError extends Error {},
  addInventoryCatalogItem: vi.fn(),
  addOrderCatalogItem: vi.fn(),
  deleteOrderAudio: vi.fn(),
  loadOrderAudio: mocks.loadOrderAudio,
  loadOrderCatalog: mocks.loadOrderCatalog,
  loadInventoryConditionPrices: mocks.loadInventoryConditionPrices,
  loadInventoryStockQuantities: mocks.loadInventoryStockQuantities,
  saveOrderAudioMetadata: vi.fn(),
  searchInventoryCatalog: mocks.searchInventoryCatalog,
  updateOrderAudioTranscript: vi.fn(),
}));

vi.mock("@/lib/orders.functions", () => ({
  saveOrder: mocks.saveOrder,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    storage: { from: vi.fn() },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    warning: mocks.toastWarning,
    info: vi.fn(),
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

const catalogItems = [
  {
    id: "part-out",
    item_kind: "part" as const,
    code: "OEM-0",
    name: "Filtro sin stock",
    brand: "KTM",
    condition: "new_original" as const,
    category: "mechanical" as const,
    fitment: null,
    suggested_price: 20000,
    price_original: 20000,
    price_generic: 18000,
    price_repaired: 12000,
    price_aftermarket: 25000,
    active: true,
    stock_quantity: 0,
  },
  {
    id: "part-stock",
    item_kind: "part" as const,
    code: "OEM-1",
    name: "Filtro con stock",
    brand: "KTM",
    condition: "new_original" as const,
    category: "mechanical" as const,
    fitment: null,
    suggested_price: 25000,
    price_original: 25000,
    price_generic: 18000,
    price_repaired: 12000,
    price_aftermarket: 35000,
    active: true,
    stock_quantity: 2,
  },
  {
    id: "service-1",
    item_kind: "service" as const,
    code: null,
    name: "Mano de obra",
    brand: null,
    condition: null,
    category: null,
    fitment: null,
    suggested_price: 50000,
    price_original: 0,
    price_generic: 0,
    price_repaired: 0,
    price_aftermarket: 0,
    active: true,
    stock_quantity: 0,
  },
  {
    id: "part-null-values",
    item_kind: "part" as const,
    code: null,
    name: "Pieza sin precio",
    brand: null,
    condition: null,
    category: null,
    fitment: null,
    suggested_price: null,
    price_original: 0,
    price_generic: 0,
    price_repaired: 0,
    price_aftermarket: 0,
    active: true,
    stock_quantity: 1,
  },
];

const renderForm = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OrderForm />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { queryClient, invalidateQueries };
};

const fillRequiredCustomerAndBikeFields = () => {
  fireEvent.change(screen.getByLabelText("Nombre completo"), {
    target: { value: "Ana Taller" },
  });
  fireEvent.change(screen.getByLabelText("Número de documento"), {
    target: { value: "12345678" },
  });
  fireEvent.change(screen.getByLabelText("Teléfono de contacto"), {
    target: { value: "3001234567" },
  });
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "ana@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Placa"), {
    target: { value: "ABC123" },
  });
  fireEvent.change(screen.getByLabelText("Marca"), {
    target: { value: "KTM" },
  });
  fireEvent.change(screen.getByLabelText("Referencia o modelo"), {
    target: { value: "Duke 390" },
  });
  fireEvent.change(screen.getByLabelText("Kilometraje"), {
    target: { value: "18000" },
  });
};

describe("order creation flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1", app_metadata: { role: "admin" } },
        },
      },
      error: null,
    });
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mocks.loadOrderCatalog.mockImplementation(async (type: string) =>
      type === "inspection"
        ? [{ id: "inspection-1", name: "Rayones / raspones", sort_order: 0 }]
        : [{ id: "accessory-1", name: "Casco", sort_order: 0 }],
    );
    mocks.loadInventoryStockQuantities.mockResolvedValue({});
    mocks.loadInventoryConditionPrices.mockResolvedValue({});
    mocks.loadOrderAudio.mockResolvedValue([]);
    mocks.searchInventoryCatalog.mockResolvedValue(catalogItems);
    mocks.saveOrder.mockImplementation(
      async ({ data }: { data: { order: Record<string, unknown> } }) => ({
        ...data.order,
        number: "1001",
        version: 1,
      }),
    );

    const recognitions: Array<{
      onresult:
        | ((event: {
            results: ArrayLike<{ 0?: { transcript: string } }>;
          }) => void)
        | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    }> = [];
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: class {
        continuous = false;
        interimResults = false;
        lang = "";
        onresult: (typeof recognitions)[number]["onresult"] = null;
        onerror: (typeof recognitions)[number]["onerror"] = null;
        onend: (typeof recognitions)[number]["onend"] = null;
        start = vi.fn();
        stop = vi.fn(() => this.onend?.());

        constructor() {
          recognitions.push(this);
        }
      },
    });
    Object.defineProperty(window, "__orderTestRecognitions", {
      configurable: true,
      value: recognitions,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("blocks step one with an invalid optional email and validates required inputs", () => {
    renderForm();
    const next = screen.getByRole("button", { name: /Siguiente/ });
    expect(next).toBeDisabled();
    expect(
      screen.getByText("Escribe al menos dos caracteres."),
    ).toBeInTheDocument();

    fillRequiredCustomerAndBikeFields();
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "correo-invalido" },
    });
    expect(
      screen.getByText("Revisa el formato del correo electrónico."),
    ).toBeInTheDocument();
    expect(next).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "ana@example.com" },
    });
    expect(next).toBeEnabled();
  });

  it("retains voice report and boolean flags across steps, enforces stock, totals, and saves the RPC payload", async () => {
    const { invalidateQueries } = renderForm();
    fillRequiredCustomerAndBikeFields();
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(
      await screen.findByRole("heading", { name: "Reporte y novedades" }),
    ).toBeInTheDocument();

    const report = screen.getByLabelText("Reporte del cliente");
    fireEvent.change(report, { target: { value: "Ruido inicial" } });
    const dictateButton = screen.getByRole("button", {
      name: "Dictar por voz",
    });
    await waitFor(() => expect(dictateButton).toBeEnabled());
    fireEvent.click(dictateButton);
    const recognitions = Object.getOwnPropertyDescriptor(
      window,
      "__orderTestRecognitions",
    )?.value as Array<{
      onresult:
        | ((event: {
            results: ArrayLike<{ 0?: { transcript: string } }>;
          }) => void)
        | null;
    }>;
    expect(recognitions).toHaveLength(1);
    act(() => {
      recognitions[0]?.onresult?.({
        results: [{ 0: { transcript: "ruido en la cadena" } }],
      });
    });
    expect(report).toHaveValue("Ruido inicial ruido en la cadena");
    fireEvent.click(screen.getByRole("button", { name: "Limpiar texto" }));
    expect(report).toHaveValue("");
    fireEvent.change(report, { target: { value: "Diagnóstico final" } });

    const inspectionChip = screen.getByRole("button", {
      name: /Rayones \/ raspones/,
    });
    fireEvent.click(inspectionChip);
    expect(inspectionChip).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));

    const accessoryChip = await screen.findByRole("button", { name: /Casco/ });
    fireEvent.click(accessoryChip);
    expect(accessoryChip).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(
      screen.getByRole("button", { name: /Rayones \/ raspones/ }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(screen.getByRole("button", { name: /Casco/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(
      await screen.findByRole("heading", { name: "Repuestos y servicios" }),
    ).toBeInTheDocument();

    const search = screen.getByRole("textbox", {
      name: "Buscar repuesto por código, nombre o marca",
    });
    fireEvent.change(search, { target: { value: "filtro" } });
    const outOfStockButton = await screen.findByRole("button", {
      name: /Filtro sin stock/,
    });
    fireEvent.click(outOfStockButton);
    expect(
      screen.getByText(
        "No se puede seleccionar 'Filtro sin stock' porque no cuenta con existencias en stock (0 disponibles).",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Filtro sin stock" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Filtro con stock/ }));
    expect(
      await screen.findByRole("heading", { name: "Filtro con stock" }),
    ).toBeInTheDocument();
    expect(search).toHaveValue("");
    expect(screen.queryByText("2 unidades")).not.toBeInTheDocument();
    const quantity = screen.getByRole("spinbutton", {
      name: "Cantidad de Filtro con stock",
    });
    fireEvent.change(quantity, { target: { value: "2" } });
    expect(quantity).toHaveValue(2);
    fireEvent.change(quantity, { target: { value: "3" } });
    expect(quantity).toHaveValue(2);
    expect(
      screen.getByText(
        "No se puede seleccionar 'Filtro con stock' porque supera las existencias en stock (2 disponibles).",
      ),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Estado / tipo de Filtro con stock",
      }),
      { target: { value: "Nueva Genérica" } },
    );
    expect(
      screen.getByRole("spinbutton", {
        name: "Valor unitario de Filtro con stock",
      }),
    ).toHaveValue(18000);
    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: "Valor unitario de Filtro con stock",
      }),
      { target: { value: "30000" } },
    );
    fireEvent.change(search, { target: { value: "mano de obra" } });
    fireEvent.click(
      await screen.findByRole("button", { name: /Mano de obra/ }),
    );
    expect(search).toHaveValue("");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Agregar Mano de Obra / Servicio",
      }),
    );
    const manualServicePrice = screen.getByRole("spinbutton", {
      name: "Valor unitario de Servicio + Diagnóstico Mantenimiento",
    });
    expect(manualServicePrice).toHaveValue(0);
    fireEvent.change(manualServicePrice, { target: { value: "10000" } });
    fireEvent.change(search, { target: { value: "pieza sin precio" } });
    fireEvent.click(
      await screen.findByRole("button", { name: /Pieza sin precio/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Pieza sin precio" }),
    ).toBeInTheDocument();
    expect(screen.getByText("$0")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Pieza sin precio" }),
    );
    await waitFor(() =>
      expect(
        screen.getByText("Total de la cotización").parentElement,
      ).toHaveTextContent("120.000"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Crear orden" }));
    await waitFor(() => expect(mocks.saveOrder).toHaveBeenCalledTimes(1));
    const saveCall = mocks.saveOrder.mock.calls[0]?.[0] as {
      data: { order: Record<string, unknown> };
    };
    expect(saveCall.data.order).toMatchObject({
      report: "Diagnóstico final",
      inspection: { "Rayones / raspones": true },
      accessories: { Casco: true },
      items: [
        expect.objectContaining({
          catalogId: "part-stock",
          qty: 2,
          unitPrice: 30000,
          condition: "Nueva Genérica",
          conditionPrices: expect.objectContaining({
            "Nueva Original": 25000,
            "Nueva Genérica": 18000,
            Reparada: 12000,
            "Aftermarket / Lujo": 35000,
          }),
        }),
        expect.objectContaining({
          catalogId: "service-1",
          qty: 1,
          unitPrice: 50000,
        }),
        expect.objectContaining({
          kind: "service",
          description: "Servicio + Diagnóstico Mantenimiento",
          qty: 1,
          unitPrice: 10000,
        }),
      ],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["saved-orders"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["history", "1001"],
    });
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/orders/$orderId",
      params: { orderId: "1001" },
    });
  }, 15_000);
});
