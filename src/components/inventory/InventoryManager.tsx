import { useEffect, useState, type ReactNode } from "react";
import { Check, Package, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SaveAccess } from "@/components/orders/SaveAccess";
import { supabase } from "@/integrations/supabase/client";
import { formatCOP } from "@/lib/orders";
import {
  addInventoryCatalogItem,
  loadInventoryCatalog,
  setInventoryStockQuantity,
  updateInventoryCatalogItem,
  type InventoryCatalogWithStock,
  type InventoryCategory,
  type InventoryCondition,
} from "@/lib/catalog";

type CatalogRowEdit = {
  name: string;
  code: string;
  brand: string;
  condition: InventoryCondition | "";
  category: InventoryCategory | "";
  fitment: string;
  unit_cost: string;
  stock_quantity: string;
  suggested_price: string;
  price_original: string;
  price_generic: string;
  price_repaired: string;
  price_aftermarket: string;
  active: boolean;
};

const rowInputClass =
  "h-9 w-full min-w-28 rounded-md border border-input bg-muted/40 px-2 text-center text-sm transition-colors hover:bg-muted/60 focus-visible:border-ring focus-visible:bg-background disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:opacity-100";
const rowSelectClass =
  "h-9 w-full min-w-28 justify-between border border-input bg-muted/40 px-2 text-left transition-colors hover:bg-muted/60 focus-visible:bg-background disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-left disabled:text-foreground disabled:opacity-100 disabled:[&>svg]:hidden";
const rowNumericInputClass = `${rowInputClass} text-right tabular-nums`;
const mobileInputClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-muted/40 px-3 text-sm transition-colors hover:bg-muted/60 focus-visible:border-ring focus-visible:bg-background disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:opacity-100";
const PENDING_SELECT_VALUE = "__pending";

const conditionLabels: Record<InventoryCondition, string> = {
  new_original: "Nueva original",
  new_generic: "Nueva genérica",
  repaired: "Reparada",
  aftermarket: "Aftermarket / Lujo",
};
const conditionPriceFields = [
  ["price_original", "Precio Nueva Original"],
  ["price_generic", "Precio Nueva Genérica"],
  ["price_repaired", "Precio Reparada"],
  ["price_aftermarket", "Precio Aftermarket / Lujo"],
] as const;

function priceString(value: number, fallback: number) {
  const price = Number(value);
  return String(Number.isFinite(price) && price > 0 ? price : fallback);
}

function catalogRowEditFromItem(
  item: InventoryCatalogWithStock,
): CatalogRowEdit {
  return {
    name: item.name,
    code: item.code ?? "",
    brand: item.brand ?? "",
    condition: item.condition ?? "",
    category: item.category ?? "",
    fitment: item.fitment ?? "",
    unit_cost: String(item.unit_cost ?? 0),
    stock_quantity: String(item.stock_quantity),
    suggested_price: String(item.suggested_price),
    price_original: priceString(item.price_original, item.suggested_price),
    price_generic: priceString(item.price_generic, item.suggested_price),
    price_repaired: priceString(item.price_repaired, item.suggested_price),
    price_aftermarket: priceString(
      item.price_aftermarket,
      item.suggested_price,
    ),
    active: item.active,
  };
}

const categoryLabels: Record<InventoryCategory, string> = {
  mechanical: "Mecánica",
  electrical: "Eléctrica",
  luxury: "Lujo",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function InventoryManager() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<InventoryCatalogWithStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [catalogFormOpen, setCatalogFormOpen] = useState(false);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(
    null,
  );
  const [catalogRowEdit, setCatalogRowEdit] = useState<CatalogRowEdit | null>(
    null,
  );
  const [savingCatalogRow, setSavingCatalogRow] = useState(false);
  const [newItem, setNewItem] = useState({
    item_kind: "part" as "part" | "service",
    code: "",
    name: "",
    brand: "",
    condition: "" as InventoryCondition | "",
    category: "" as InventoryCategory | "",
    fitment: "",
    unit_cost: "",
    suggested_price: "",
    price_original: "",
    price_generic: "",
    price_repaired: "",
    price_aftermarket: "",
    active: true,
  });

  useEffect(() => {
    let active = true;
    const syncSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError) {
        setError("No se pudo verificar la sesión. Vuelve a iniciar sesión.");
        setSessionReady(true);
        return;
      }
      setUserId(data.session?.user.id ?? null);
      setIsAdmin(data.session?.user.app_metadata["role"] === "admin");
      setSessionReady(true);
    };
    void syncSession();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUserId(session?.user.id ?? null);
      setIsAdmin(session?.user.app_metadata["role"] === "admin");
      setSessionReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      void loadInventoryCatalog(query, isAdmin, isAdmin)
        .then((result) => {
          if (active) setItems(result);
        })
        .catch((loadError: unknown) => {
          if (active)
            setError(
              getErrorMessage(loadError, "No se pudo cargar el inventario."),
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isAdmin, query, userId]);

  const resetNewItem = () => {
    setNewItem({
      item_kind: "part",
      code: "",
      name: "",
      brand: "",
      condition: "",
      category: "",
      fitment: "",
      unit_cost: "",
      suggested_price: "",
      price_original: "",
      price_generic: "",
      price_repaired: "",
      price_aftermarket: "",
      active: true,
    });
  };

  const saveCatalogItem = async () => {
    if (!userId || !isAdmin) {
      toast.error("Solo un administrador puede crear elementos del catálogo.");
      return;
    }
    const prices = {
      price_original: Number(newItem.price_original),
      price_generic: Number(newItem.price_generic),
      price_repaired: Number(newItem.price_repaired),
      price_aftermarket: Number(newItem.price_aftermarket),
    };
    const price =
      newItem.item_kind === "part"
        ? prices.price_original
        : Number(newItem.suggested_price);
    const cost = Number(newItem.unit_cost);
    const isPart = newItem.item_kind === "part";
    const validPrices = isPart
      ? Object.values(prices).every(
          (value) => Number.isFinite(value) && value >= 0,
        )
      : true;
    const activePricesValid =
      !isPart || Object.values(prices).every((value) => value > 0);
    const hasValidDetails =
      !isPart ||
      (!!newItem.brand.trim() && !!newItem.condition && !!newItem.category);
    if (
      !newItem.name.trim() ||
      !Number.isFinite(price) ||
      price < 0 ||
      !validPrices ||
      (isPart && !newItem.price_original.trim()) ||
      (!isPart && !newItem.suggested_price.trim()) ||
      (isPart &&
        (!newItem.unit_cost.trim() || !Number.isFinite(cost) || cost < 0)) ||
      (newItem.active && (!hasValidDetails || price <= 0 || !activePricesValid))
    ) {
      toast.error(
        newItem.active
          ? "Para activar el producto, completa nombre, costo, marca, condición, categoría y precios mayores que cero para cada condición."
          : "Completa un nombre y valores numéricos válidos de costo y precio.",
      );
      return;
    }

    setSavingCatalog(true);
    try {
      await addInventoryCatalogItem({
        item_kind: newItem.item_kind,
        code: newItem.code.trim() || null,
        name: newItem.name.trim(),
        brand: isPart ? newItem.brand.trim() : null,
        condition: isPart && newItem.condition ? newItem.condition : null,
        category: isPart && newItem.category ? newItem.category : null,
        fitment: newItem.fitment.trim() || null,
        unit_cost: isPart ? cost : 0,
        suggested_price: price,
        ...prices,
        created_by: userId,
      });
      setCatalogFormOpen(false);
      resetNewItem();
      toast.success("Elemento agregado al catálogo.");
      const refreshed = await loadInventoryCatalog(query, isAdmin, isAdmin);
      setItems(refreshed);
    } catch (saveError) {
      toast.error(
        getErrorMessage(saveError, "No se pudo guardar el elemento."),
      );
    } finally {
      setSavingCatalog(false);
    }
  };

  const toggleCatalogRowSelection = (item: InventoryCatalogWithStock) => {
    if (selectedCatalogId === item.id) {
      setSelectedCatalogId(null);
      setCatalogRowEdit(null);
      return;
    }
    setSelectedCatalogId(item.id);
    setCatalogRowEdit(catalogRowEditFromItem(item));
  };

  const updateCatalogRowEdit = (values: Partial<CatalogRowEdit>) => {
    setCatalogRowEdit((current) =>
      current ? { ...current, ...values } : null,
    );
  };

  const saveCatalogRow = async (item: InventoryCatalogWithStock) => {
    if (!isAdmin || selectedCatalogId !== item.id || !catalogRowEdit) return;

    const isPart = item.item_kind === "part";
    const prices = {
      price_original: Number(catalogRowEdit.price_original),
      price_generic: Number(catalogRowEdit.price_generic),
      price_repaired: Number(catalogRowEdit.price_repaired),
      price_aftermarket: Number(catalogRowEdit.price_aftermarket),
    };
    const price = isPart
      ? prices.price_original
      : Number(catalogRowEdit.suggested_price);
    const cost = Number(catalogRowEdit.unit_cost);
    const quantity = Number(catalogRowEdit.stock_quantity);
    if (
      !catalogRowEdit.name.trim() ||
      !Number.isFinite(price) ||
      price < 0 ||
      (isPart &&
        Object.values(prices).some(
          (value) => !Number.isFinite(value) || value < 0,
        )) ||
      (isPart && (!Number.isFinite(cost) || cost < 0)) ||
      (catalogRowEdit.active &&
        (price <= 0 ||
          (isPart &&
            (Object.values(prices).some((value) => value <= 0) ||
              !catalogRowEdit.brand.trim() ||
              !catalogRowEdit.condition ||
              !catalogRowEdit.category)))) ||
      (isPart &&
        catalogRowEdit.active &&
        (!Number.isInteger(quantity) || quantity < 0))
    ) {
      toast.error(
        catalogRowEdit.active
          ? "Para activar el producto, completa nombre, precio mayor que cero, marca, condición y categoría. La existencia debe ser un entero no negativo."
          : "Verifica el nombre, costo y precio. La existencia debe ser un entero no negativo.",
      );
      return;
    }

    setSavingCatalogRow(true);
    try {
      let catalogSaved = false;
      try {
        await updateInventoryCatalogItem({
          id: item.id,
          code: catalogRowEdit.code,
          name: catalogRowEdit.name,
          brand: isPart ? catalogRowEdit.brand : "",
          condition: isPart ? catalogRowEdit.condition : "",
          category: isPart ? catalogRowEdit.category : "",
          fitment: catalogRowEdit.fitment,
          unitCost: isPart ? cost : 0,
          suggestedPrice: price,
          priceOriginal: prices.price_original,
          priceGeneric: prices.price_generic,
          priceRepaired: prices.price_repaired,
          priceAftermarket: prices.price_aftermarket,
          active: catalogRowEdit.active,
        });
        catalogSaved = true;
        if (
          isPart &&
          catalogRowEdit.active &&
          quantity !== item.stock_quantity
        ) {
          await setInventoryStockQuantity(item.id, quantity);
        }
      } catch (saveError) {
        toast.error(
          catalogSaved
            ? `Datos del producto guardados, pero no se pudo actualizar el stock: ${getErrorMessage(saveError, "error desconocido")}`
            : getErrorMessage(saveError, "No se pudo guardar el producto."),
        );
        return;
      }

      try {
        setItems(await loadInventoryCatalog(query, isAdmin, isAdmin));
      } catch (loadError) {
        setError(
          `Los cambios se guardaron, pero no se pudo actualizar la tabla: ${getErrorMessage(loadError, "error desconocido")}`,
        );
        toast.error("Cambios guardados, pero no se pudo refrescar la tabla.");
        return;
      }

      setSelectedCatalogId(null);
      setCatalogRowEdit(null);
      toast.success("Cambios del producto guardados.");
    } finally {
      setSavingCatalogRow(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-6">
      <SaveAccess open={accessOpen} onOpenChange={setAccessOpen} />
      <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Package className="size-5 text-primary" />
              <h2 className="font-sans text-xl font-semibold tracking-tight">
                Catálogo y existencias
              </h2>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Administra repuestos, compatibilidad, precios y cantidades
              contadas. Agregar una pieza a una cotización no modifica las
              existencias.
            </p>
          </div>
          {isAdmin && (
            <Button
              type="button"
              onClick={() => {
                resetNewItem();
                setCatalogFormOpen((open) => !open);
              }}
            >
              {catalogFormOpen ? <X /> : <Plus />}
              {catalogFormOpen ? "Cerrar" : "Nuevo producto"}
            </Button>
          )}
        </div>

        {!sessionReady ? (
          <p role="status" className="mt-5 text-sm text-muted-foreground">
            Verificando acceso…
          </p>
        ) : !userId ? (
          <div className="mt-5 rounded-md border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              Inicia sesión para consultar y actualizar el inventario.
            </p>
            <Button className="mt-3" onClick={() => setAccessOpen(true)}>
              Iniciar sesión
            </Button>
          </div>
        ) : null}

        {error && userId && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {userId && isAdmin && catalogFormOpen && (
          <div className="mt-5 space-y-4 rounded-lg border border-border bg-muted/20 p-4">
            <div>
              <h3 className="font-sans font-semibold">Agregar al catálogo</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="w-full max-w-52">
                <Field label="Tipo">
                  <Select
                    value={newItem.item_kind}
                    onValueChange={(value) =>
                      setNewItem({
                        ...newItem,
                        item_kind: value as "part" | "service",
                      })
                    }
                  >
                    <SelectTrigger aria-label="Tipo de elemento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="part">Repuesto</SelectItem>
                      <SelectItem value="service">Servicio</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="min-w-56 flex-1">
                <Field label="Nombre *">
                  <Input
                    aria-label="Nombre del elemento"
                    maxLength={160}
                    value={newItem.name}
                    onChange={(event) =>
                      setNewItem({ ...newItem, name: event.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="w-full max-w-56">
                <Field label="Código">
                  <Input
                    aria-label="Código del elemento"
                    maxLength={80}
                    value={newItem.code}
                    onChange={(event) =>
                      setNewItem({ ...newItem, code: event.target.value })
                    }
                  />
                </Field>
              </div>
            </div>
            {newItem.item_kind === "part" && (
              <div className="flex flex-wrap gap-3">
                <div className="w-full max-w-52">
                  <Field label="Marca *">
                    <Input
                      aria-label="Marca del repuesto"
                      maxLength={100}
                      value={newItem.brand}
                      onChange={(event) =>
                        setNewItem({ ...newItem, brand: event.target.value })
                      }
                    />
                  </Field>
                </div>
                <div className="w-full max-w-56">
                  <Field
                    label={`Costo unitario interno (COP)${newItem.active ? " *" : ""}`}
                  >
                    <CurrencyInput
                      aria-label="Costo unitario interno"
                      value={newItem.unit_cost}
                      onValueChange={(unit_cost) =>
                        setNewItem({
                          ...newItem,
                          unit_cost,
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="w-full max-w-52">
                  <Field label="Condición *">
                    <Select
                      value={newItem.condition}
                      onValueChange={(value) =>
                        setNewItem({
                          ...newItem,
                          condition: value as InventoryCondition,
                        })
                      }
                    >
                      <SelectTrigger aria-label="Condición del repuesto">
                        <SelectValue placeholder="Selecciona condición" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new_original">
                          Nueva original
                        </SelectItem>
                        <SelectItem value="new_generic">
                          Nueva genérica
                        </SelectItem>
                        <SelectItem value="repaired">Reparada</SelectItem>
                        <SelectItem value="aftermarket">
                          Aftermarket / Lujo
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="w-full max-w-52">
                  <Field label="Categoría *">
                    <Select
                      value={newItem.category}
                      onValueChange={(value) =>
                        setNewItem({
                          ...newItem,
                          category: value as typeof newItem.category,
                        })
                      }
                    >
                      <SelectTrigger aria-label="Categoría del repuesto">
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mechanical">Mecánica</SelectItem>
                        <SelectItem value="electrical">Eléctrica</SelectItem>
                        <SelectItem value="luxury">Lujo</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="min-w-60 flex-1">
                  <Field label="Aplicación (motos compatibles)">
                    <Input
                      aria-label="Motos compatibles"
                      maxLength={240}
                      value={newItem.fitment}
                      onChange={(event) =>
                        setNewItem({ ...newItem, fitment: event.target.value })
                      }
                      placeholder="Ej. Boxer CT100, Platino 100 o Universal"
                    />
                  </Field>
                </div>
              </div>
            )}
            <div className="space-y-4">
              {newItem.item_kind === "part" ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {conditionPriceFields.map(([key, label]) => (
                    <Field key={key} label={`${label} (COP) *`}>
                      <CurrencyInput
                        aria-label={label}
                        value={newItem[key]}
                        onValueChange={(value) =>
                          setNewItem((current) => ({
                            ...current,
                            [key]: value,
                          }))
                        }
                      />
                    </Field>
                  ))}
                </div>
              ) : (
                <div className="w-full max-w-56">
                  <Field label="Precio sugerido (COP) *">
                    <CurrencyInput
                      aria-label="Precio sugerido"
                      value={newItem.suggested_price}
                      onValueChange={(suggested_price) =>
                        setNewItem({
                          ...newItem,
                          suggested_price,
                        })
                      }
                    />
                  </Field>
                </div>
              )}
              <Button
                type="button"
                disabled={savingCatalog}
                onClick={() => void saveCatalogItem()}
              >
                <Check />
                {savingCatalog ? "Guardando…" : "Guardar elemento"}
              </Button>
            </div>
          </div>
        )}

        {userId && (
          <div className="mt-6">
            <Field label="Buscar por nombre, código o marca">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <div className="rounded-md border border-input bg-muted/40 transition-colors hover:border-ring focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
                  <Input
                    aria-label="Buscar inventario"
                    className="border-0 bg-transparent pl-9 pr-12 shadow-none focus-visible:ring-0"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSelectedCatalogId(null);
                      setCatalogRowEdit(null);
                    }}
                    placeholder="Ej. filtro de aceite, código OEM, Bajaj"
                  />
                </div>
                {query.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Limpiar búsqueda de inventario"
                    onClick={() => {
                      setQuery("");
                      setSelectedCatalogId(null);
                      setCatalogRowEdit(null);
                    }}
                    className="absolute right-1 top-1/2 size-11 -translate-y-1/2"
                  >
                    <X />
                  </Button>
                )}
              </div>
            </Field>
            {query.trim().length > 0 && (
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setSelectedCatalogId(null);
                    setCatalogRowEdit(null);
                  }}
                  className="text-muted-foreground"
                >
                  Limpiar filtros
                </Button>
              </div>
            )}
            {query.trim().length === 1 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Escribe al menos dos caracteres para buscar.
              </p>
            )}
            {loading && (
              <p role="status" className="mt-3 text-sm text-muted-foreground">
                Cargando catálogo y existencias…
              </p>
            )}
            {!loading && !error && items.length === 0 && (
              <p className="mt-4 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay productos que coincidan. Un administrador puede
                agregarlos al catálogo.
              </p>
            )}
            {items.length > 0 && (
              <>
                <ul className="mt-3 grid gap-3 md:hidden">
                  {items.map((item) => {
                    const selected = selectedCatalogId === item.id;
                    const edit =
                      selected && catalogRowEdit
                        ? catalogRowEdit
                        : catalogRowEditFromItem(item);
                    const editable = isAdmin && selected;
                    const isPart = item.item_kind === "part";
                    return (
                      <li
                        key={item.id}
                        className={`rounded-lg border p-4 transition-colors ${selected ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                      >
                        <div className="flex items-start gap-3">
                          {isAdmin && (
                            <input
                              type="checkbox"
                              className="mt-1 size-5 shrink-0 accent-primary"
                              aria-label={`${selected ? "Dejar de editar" : "Editar"} ${item.name}`}
                              checked={selected}
                              onChange={() => toggleCatalogRowSelection(item)}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            {editable ? (
                              <Input
                                aria-label={`Nombre de ${item.name}`}
                                className={`${mobileInputClass} font-semibold text-foreground`}
                                maxLength={160}
                                value={edit.name}
                                onChange={(event) =>
                                  updateCatalogRowEdit({
                                    name: event.target.value,
                                  })
                                }
                              />
                            ) : (
                              <p className="break-words font-semibold text-foreground">
                                {item.name}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                                {isPart
                                  ? item.brand || "Sin marca"
                                  : "Servicio"}
                              </span>
                              {isPart && (
                                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                                  {item.condition
                                    ? conditionLabels[item.condition]
                                    : "Sin condición"}
                                </span>
                              )}
                              {isPart && item.category && (
                                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                                  {categoryLabels[item.category]}
                                </span>
                              )}
                              <Badge
                                variant={item.active ? "secondary" : "outline"}
                                className={
                                  item.active
                                    ? "border-transparent bg-status-ready/10 text-status-ready hover:bg-status-ready/10"
                                    : "text-muted-foreground"
                                }
                              >
                                {item.active ? "Disponible" : "Inactivo"}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                          {editable ? (
                            <>
                              <div className="col-span-2">
                                <Field label="Código">
                                  <Input
                                    aria-label={`Código de ${item.name}`}
                                    className={mobileInputClass}
                                    maxLength={80}
                                    value={edit.code}
                                    onChange={(event) =>
                                      updateCatalogRowEdit({
                                        code: event.target.value,
                                      })
                                    }
                                  />
                                </Field>
                              </div>
                              {isPart && (
                                <>
                                  <Field label="Marca">
                                    <Input
                                      aria-label={`Marca de ${item.name}`}
                                      className={mobileInputClass}
                                      maxLength={100}
                                      value={edit.brand}
                                      onChange={(event) =>
                                        updateCatalogRowEdit({
                                          brand: event.target.value,
                                        })
                                      }
                                    />
                                  </Field>
                                  <Field label="Condición">
                                    <Select
                                      value={
                                        edit.condition || PENDING_SELECT_VALUE
                                      }
                                      onValueChange={(value) =>
                                        updateCatalogRowEdit({
                                          condition:
                                            value === PENDING_SELECT_VALUE
                                              ? ""
                                              : (value as InventoryCondition),
                                        })
                                      }
                                    >
                                      <SelectTrigger
                                        aria-label={`Condición de ${item.name}`}
                                        className={mobileInputClass}
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem
                                          value={PENDING_SELECT_VALUE}
                                        >
                                          Pendiente
                                        </SelectItem>
                                        <SelectItem value="new_original">
                                          Nueva original
                                        </SelectItem>
                                        <SelectItem value="new_generic">
                                          Nueva genérica
                                        </SelectItem>
                                        <SelectItem value="repaired">
                                          Reparada
                                        </SelectItem>
                                        <SelectItem value="aftermarket">
                                          Aftermarket / Lujo
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </Field>
                                  <Field label="Categoría">
                                    <Select
                                      value={
                                        edit.category || PENDING_SELECT_VALUE
                                      }
                                      onValueChange={(value) =>
                                        updateCatalogRowEdit({
                                          category:
                                            value === PENDING_SELECT_VALUE
                                              ? ""
                                              : (value as InventoryCategory),
                                        })
                                      }
                                    >
                                      <SelectTrigger
                                        aria-label={`Categoría de ${item.name}`}
                                        className={mobileInputClass}
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem
                                          value={PENDING_SELECT_VALUE}
                                        >
                                          Pendiente
                                        </SelectItem>
                                        <SelectItem value="mechanical">
                                          Mecánica
                                        </SelectItem>
                                        <SelectItem value="electrical">
                                          Eléctrica
                                        </SelectItem>
                                        <SelectItem value="luxury">
                                          Lujo
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </Field>
                                  <Field label="Moto compatible / Universal">
                                    <Input
                                      aria-label={`Motos compatibles de ${item.name}`}
                                      className={mobileInputClass}
                                      maxLength={240}
                                      value={edit.fitment}
                                      onChange={(event) =>
                                        updateCatalogRowEdit({
                                          fitment: event.target.value,
                                        })
                                      }
                                    />
                                  </Field>
                                  <Field label="Costo interno (COP)">
                                    <CurrencyInput
                                      aria-label={`Costo interno de ${item.name}`}
                                      className={mobileInputClass}
                                      value={edit.unit_cost}
                                      onValueChange={(unit_cost) =>
                                        updateCatalogRowEdit({ unit_cost })
                                      }
                                    />
                                  </Field>
                                  <Field label="Existencias">
                                    <Input
                                      aria-label={`Existencias de ${item.name}`}
                                      className={`${mobileInputClass} text-right font-mono tabular-nums`}
                                      type="number"
                                      min={0}
                                      step={1}
                                      disabled={!edit.active}
                                      value={edit.stock_quantity}
                                      onChange={(event) =>
                                        updateCatalogRowEdit({
                                          stock_quantity: event.target.value,
                                        })
                                      }
                                    />
                                  </Field>
                                </>
                              )}
                              {isPart ? (
                                conditionPriceFields.map(([key, label]) => (
                                  <Field key={key} label={`${label} (COP)`}>
                                    <CurrencyInput
                                      aria-label={`${label} de ${item.name}`}
                                      className={`${mobileInputClass} text-right font-mono font-bold text-primary tabular-nums`}
                                      value={edit[key]}
                                      onValueChange={(value) =>
                                        updateCatalogRowEdit({ [key]: value })
                                      }
                                    />
                                  </Field>
                                ))
                              ) : (
                                <Field label="Precio sugerido (COP)">
                                  <CurrencyInput
                                    aria-label={`Precio sugerido de ${item.name}`}
                                    className={`${mobileInputClass} text-right font-mono font-bold text-primary tabular-nums`}
                                    value={edit.suggested_price}
                                    onValueChange={(suggested_price) =>
                                      updateCatalogRowEdit({ suggested_price })
                                    }
                                  />
                                </Field>
                              )}
                              <div className="col-span-2">
                                <label className="flex min-h-11 items-center gap-3 text-sm">
                                  <input
                                    type="checkbox"
                                    className="size-5 accent-primary"
                                    aria-label={`${edit.active ? "Desactivar" : "Activar"} ${item.name}`}
                                    checked={edit.active}
                                    onChange={(event) =>
                                      updateCatalogRowEdit({
                                        active: event.target.checked,
                                      })
                                    }
                                  />
                                  {edit.active ? "Disponible" : "Inactivo"}
                                </label>
                              </div>
                            </>
                          ) : (
                            <>
                              {item.code && (
                                <div className="col-span-2">
                                  <span className="text-xs text-muted-foreground">
                                    Código
                                  </span>
                                  <p className="font-mono text-sm">
                                    {item.code}
                                  </p>
                                </div>
                              )}
                              {isPart && (
                                <div className="col-span-2">
                                  <span className="text-xs text-muted-foreground">
                                    Moto compatible / Universal
                                  </span>
                                  <p className="text-sm text-foreground">
                                    {item.fitment || "No especificada"}
                                  </p>
                                </div>
                              )}
                              {isAdmin && (
                                <div>
                                  <span className="text-xs text-muted-foreground">
                                    Costo interno
                                  </span>
                                  <p className="font-mono text-sm tabular-nums">
                                    {formatCOP(item.unit_cost ?? 0)}
                                  </p>
                                </div>
                              )}
                              <div>
                                <span className="text-xs text-muted-foreground">
                                  Existencias
                                </span>
                                <p className="font-mono font-semibold tabular-nums text-foreground">
                                  {isPart ? item.stock_quantity : "—"}
                                </p>
                              </div>
                              {isPart ? (
                                conditionPriceFields.map(([key, label]) => (
                                  <div key={key}>
                                    <span className="text-xs text-muted-foreground">
                                      {label}
                                    </span>
                                    <p className="font-mono font-bold tabular-nums text-primary">
                                      {formatCOP(
                                        Number(item[key]) ||
                                          item.suggested_price,
                                      )}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <div className="col-span-2 border-t border-border pt-3">
                                  <span className="text-xs text-muted-foreground">
                                    Precio sugerido
                                  </span>
                                  <p className="font-mono text-lg font-bold tabular-nums text-primary">
                                    {formatCOP(item.suggested_price)}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {isAdmin && (
                          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                            {selected ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="min-h-11"
                                  disabled={savingCatalogRow}
                                  onClick={() => void saveCatalogRow(item)}
                                >
                                  <Check />
                                  {savingCatalogRow ? "Guardando…" : "Guardar"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-11"
                                  disabled={savingCatalogRow}
                                  onClick={() => {
                                    setSelectedCatalogId(null);
                                    setCatalogRowEdit(null);
                                  }}
                                >
                                  Cancelar
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                className="min-h-11"
                                onClick={() => toggleCatalogRowSelection(item)}
                              >
                                Editar producto
                              </Button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <Table
                  containerClassName="mt-3 hidden max-h-[34rem] rounded-lg border border-border md:block"
                  className="w-full min-w-[1500px] border-collapse text-sm"
                >
                  <TableHeader className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <span className="sr-only">
                          Seleccionar fila para editar
                        </span>
                      </TableHead>
                      <TableHead className="min-w-56">Nombre</TableHead>
                      <TableHead className="min-w-32">Código</TableHead>
                      <TableHead className="min-w-36">Marca</TableHead>
                      <TableHead className="min-w-40">Condición</TableHead>
                      <TableHead className="min-w-36">Categoría</TableHead>
                      <TableHead className="min-w-56">
                        Motos compatibles / Universal
                      </TableHead>
                      {isAdmin && (
                        <TableHead className="min-w-36 text-right">
                          Costo interno (COP)
                        </TableHead>
                      )}
                      <TableHead className="min-w-28 text-right">
                        Existencias
                      </TableHead>
                      <TableHead className="min-w-[30rem] text-center">
                        Precios por condición (COP)
                      </TableHead>
                      <TableHead className="min-w-36 text-center">
                        Estado
                      </TableHead>
                      {isAdmin && (
                        <TableHead className="min-w-40 text-center">
                          Acciones
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {items.map((item) => {
                      const selected = selectedCatalogId === item.id;
                      const edit =
                        selected && catalogRowEdit
                          ? catalogRowEdit
                          : catalogRowEditFromItem(item);
                      const editable = isAdmin && selected;
                      return (
                        <TableRow
                          key={item.id}
                          className={`align-middle [&>td]:px-4 [&>td]:py-3 ${selected ? "border-l-2 border-l-primary bg-primary/10 hover:bg-primary/10" : "hover:bg-muted/40"}`}
                        >
                          <TableCell className="text-center">
                            {isAdmin && (
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                aria-label={`${selected ? "Dejar de editar" : "Editar"} ${item.name}`}
                                checked={selected}
                                onChange={() => toggleCatalogRowSelection(item)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="min-w-56">
                            <Input
                              aria-label={`Nombre de ${item.name}`}
                              className={`${rowInputClass} text-left font-semibold text-foreground`}
                              maxLength={160}
                              disabled={!editable}
                              value={edit.name}
                              onChange={(event) =>
                                updateCatalogRowEdit({
                                  name: event.target.value,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              aria-label={`Código de ${item.name}`}
                              className={`${rowInputClass} text-left`}
                              maxLength={80}
                              disabled={!editable}
                              value={edit.code}
                              onChange={(event) =>
                                updateCatalogRowEdit({
                                  code: event.target.value,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {editable && item.item_kind === "part" ? (
                              <Input
                                aria-label={`Marca de ${item.name}`}
                                className={`${rowInputClass} text-left`}
                                maxLength={100}
                                value={edit.brand}
                                onChange={(event) =>
                                  updateCatalogRowEdit({
                                    brand: event.target.value,
                                  })
                                }
                              />
                            ) : (
                              <span className="inline-flex rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                                {item.item_kind === "part"
                                  ? item.brand || "Sin marca"
                                  : "Servicio"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editable && item.item_kind === "part" ? (
                              <Select
                                value={edit.condition || PENDING_SELECT_VALUE}
                                onValueChange={(value) =>
                                  updateCatalogRowEdit({
                                    condition:
                                      value === PENDING_SELECT_VALUE
                                        ? ""
                                        : (value as InventoryCondition),
                                  })
                                }
                              >
                                <SelectTrigger
                                  aria-label={`Condición de ${item.name}`}
                                  className={rowSelectClass}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={PENDING_SELECT_VALUE}>
                                    Pendiente
                                  </SelectItem>
                                  <SelectItem value="new_original">
                                    Nueva original
                                  </SelectItem>
                                  <SelectItem value="new_generic">
                                    Nueva genérica
                                  </SelectItem>
                                  <SelectItem value="repaired">
                                    Reparada
                                  </SelectItem>
                                  <SelectItem value="aftermarket">
                                    Aftermarket / Lujo
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            ) : item.item_kind === "part" ? (
                              <span className="inline-flex rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                                {item.condition
                                  ? conditionLabels[item.condition]
                                  : "Sin condición"}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={edit.category || PENDING_SELECT_VALUE}
                              onValueChange={(value) =>
                                updateCatalogRowEdit({
                                  category:
                                    value === PENDING_SELECT_VALUE
                                      ? ""
                                      : (value as InventoryCategory),
                                })
                              }
                              disabled={
                                !editable || item.item_kind === "service"
                              }
                            >
                              <SelectTrigger
                                aria-label={`Categoría de ${item.name}`}
                                className={rowSelectClass}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={PENDING_SELECT_VALUE}>
                                  Pendiente
                                </SelectItem>
                                <SelectItem value="mechanical">
                                  Mecánica
                                </SelectItem>
                                <SelectItem value="electrical">
                                  Eléctrica
                                </SelectItem>
                                <SelectItem value="luxury">Lujo</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="min-w-56">
                            <Input
                              aria-label={`Motos compatibles de ${item.name}`}
                              className={rowInputClass}
                              maxLength={240}
                              disabled={
                                !editable || item.item_kind === "service"
                              }
                              value={edit.fitment}
                              onChange={(event) =>
                                updateCatalogRowEdit({
                                  fitment: event.target.value,
                                })
                              }
                            />
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <CurrencyInput
                                aria-label={`Costo interno de ${item.name}`}
                                className={`${rowNumericInputClass} font-mono`}
                                disabled={
                                  !editable || item.item_kind === "service"
                                }
                                value={edit.unit_cost}
                                onValueChange={(unit_cost) =>
                                  updateCatalogRowEdit({
                                    unit_cost,
                                  })
                                }
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <Input
                              aria-label={`Existencias de ${item.name}`}
                              className={`${rowNumericInputClass} font-mono`}
                              type="number"
                              min={0}
                              step={1}
                              disabled={
                                !editable ||
                                item.item_kind === "service" ||
                                !edit.active
                              }
                              value={edit.stock_quantity}
                              onChange={(event) =>
                                updateCatalogRowEdit({
                                  stock_quantity: event.target.value,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {item.item_kind === "part" ? (
                              <div className="grid min-w-[28rem] grid-cols-4 gap-2">
                                {conditionPriceFields.map(([key, label]) => (
                                  <div key={key} className="space-y-1">
                                    <span className="block text-center text-[10px] leading-tight text-muted-foreground">
                                      {label.replace("Precio ", "")}
                                    </span>
                                    <CurrencyInput
                                      aria-label={`${label} de ${item.name}`}
                                      className={`${rowNumericInputClass} font-mono font-bold text-primary`}
                                      disabled={!editable}
                                      value={edit[key]}
                                      onValueChange={(value) =>
                                        updateCatalogRowEdit({ [key]: value })
                                      }
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <CurrencyInput
                                aria-label={`Precio sugerido de ${item.name}`}
                                className={`${rowNumericInputClass} font-mono font-bold text-primary`}
                                disabled={!editable}
                                value={edit.suggested_price}
                                onValueChange={(suggested_price) =>
                                  updateCatalogRowEdit({ suggested_price })
                                }
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {editable ? (
                              <label className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs">
                                <input
                                  type="checkbox"
                                  className="size-4 accent-primary"
                                  aria-label={`${item.active ? "Desactivar" : "Activar"} ${item.name}`}
                                  disabled={!editable}
                                  checked={edit.active}
                                  onChange={(event) =>
                                    updateCatalogRowEdit({
                                      active: event.target.checked,
                                    })
                                  }
                                />
                                {edit.active ? "Disponible" : "Inactivo"}
                              </label>
                            ) : (
                              <Badge
                                variant={item.active ? "secondary" : "outline"}
                                className={
                                  item.active
                                    ? "border-transparent bg-status-ready/10 text-status-ready hover:bg-status-ready/10"
                                    : "text-muted-foreground"
                                }
                              >
                                {item.active ? "Disponible" : "Inactivo"}
                              </Badge>
                            )}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-center">
                              {selected ? (
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={savingCatalogRow}
                                    onClick={() => void saveCatalogRow(item)}
                                  >
                                    <Check />
                                    {savingCatalogRow
                                      ? "Guardando…"
                                      : "Guardar"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={savingCatalogRow}
                                    onClick={() => {
                                      setSelectedCatalogId(null);
                                      setCatalogRowEdit(null);
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Selecciona la fila para editar
                                </span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
