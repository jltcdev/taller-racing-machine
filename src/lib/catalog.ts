import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OrderCatalogType = "inspection" | "accessory";
export type InventoryItemKind = "part" | "service";
export type InventoryCondition =
  "new_original" | "new_generic" | "repaired" | "aftermarket";
export type InventoryConditionPrices = {
  price_original: number;
  price_generic: number;
  price_repaired: number;
  price_aftermarket: number;
};
export type InventoryCategory = "mechanical" | "electrical" | "luxury";

export type OrderCatalogItem = {
  id: string;
  catalog_type: OrderCatalogType;
  name: string;
  sort_order: number;
  active: boolean;
};

export type InventoryCatalogItem = {
  id: string;
  item_kind: InventoryItemKind;
  code: string | null;
  name: string;
  brand: string | null;
  condition: InventoryCondition | null;
  category: InventoryCategory | null;
  fitment: string | null;
  suggested_price: number;
  price_original: number;
  price_generic: number;
  price_repaired: number;
  price_aftermarket: number;
  active: boolean;
};

export type InventoryCatalogWithStock = InventoryCatalogItem & {
  stock_quantity: number;
  stock_physical?: number;
  stock_reserved?: number;
  unit_cost?: number;
};

export type InventoryStockAvailability = {
  catalog_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
};

export class InventoryCatalogSearchError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly status: number,
  ) {
    super(message);
    this.name = "InventoryCatalogSearchError";
  }
}

export type InventoryImportDraft = {
  id: string;
  source_file: string;
  source_sheet: string;
  source_row: number;
  raw_code: string | null;
  raw_name: string;
  raw_quantity: string | null;
  raw_order_quantity: string | null;
  suggested_brand: string | null;
  suggested_condition: InventoryCondition | null;
  status: "pending" | "reviewed" | "ignored";
  inventory_catalog_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type InventoryStockMovement = {
  id: string;
  catalog_id: string;
  recorded_by: string;
  direction: "in" | "out";
  movement_type:
    | "opening"
    | "purchase"
    | "manual_adjustment"
    | "consumption"
    | "return"
    | "other";
  quantity: number;
  note: string;
  created_at: string;
};

export type OrderAudioRecording = {
  id: string;
  user_id: string;
  order_number: string;
  storage_path: string;
  transcript: string;
  mime_type: string;
  duration_seconds: number | null;
  consent_given: boolean;
  consented_by: string;
  consented_at: string;
  created_at: string;
};

type CatalogTables = {
  order_catalog: {
    Row: OrderCatalogItem & {
      created_by: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      catalog_type: OrderCatalogType;
      name: string;
      sort_order?: number;
      active?: boolean;
      created_by?: string | null;
    };
    Update: { name?: string; sort_order?: number; active?: boolean };
    Relationships: [];
  };
  inventory_catalog: {
    Row: InventoryCatalogItem & {
      created_by: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      item_kind: InventoryItemKind;
      code?: string | null;
      name: string;
      brand?: string | null;
      condition?: InventoryCondition | null;
      category?: InventoryCategory | null;
      fitment?: string | null;
      suggested_price?: number;
      price_original?: number;
      price_generic?: number;
      price_repaired?: number;
      price_aftermarket?: number;
      active?: boolean;
      created_by?: string | null;
    };
    Update: {
      code?: string | null;
      name?: string;
      brand?: string | null;
      condition?: InventoryCondition | null;
      category?: InventoryCategory | null;
      fitment?: string | null;
      suggested_price?: number;
      price_original?: number;
      price_generic?: number;
      price_repaired?: number;
      price_aftermarket?: number;
      active?: boolean;
    };
    Relationships: [
      {
        foreignKeyName: "inventory_stock_catalog_id_fkey";
        columns: ["id"];
        isOneToOne: true;
        referencedRelation: "inventory_stock";
        referencedColumns: ["catalog_id"];
      },
    ];
  };
  inventory_costs: {
    Row: { catalog_id: string; unit_cost: number; updated_at: string };
    Insert: { catalog_id: string; unit_cost?: number; updated_at?: string };
    Update: { unit_cost?: number; updated_at?: string };
    Relationships: [];
  };
  inventory_stock: {
    Row: {
      catalog_id: string;
      quantity_on_hand: number;
      updated_at: string;
    };
    Insert: {
      catalog_id: string;
      quantity_on_hand?: number;
      updated_at?: string;
    };
    Update: { quantity_on_hand?: number; updated_at?: string };
    Relationships: [];
  };
  inventory_stock_movements: {
    Row: InventoryStockMovement;
    Insert: {
      catalog_id: string;
      direction: "in" | "out";
      movement_type: InventoryStockMovement["movement_type"];
      quantity: number;
      note?: string;
      recorded_by?: string;
    };
    Update: never;
    Relationships: [];
  };
  inventory_import_drafts: {
    Row: InventoryImportDraft;
    Insert: {
      source_file: string;
      source_sheet: string;
      source_row: number;
      raw_code?: string | null;
      raw_name: string;
      raw_quantity?: string | null;
      raw_order_quantity?: string | null;
      suggested_brand?: string | null;
      suggested_condition?: InventoryCondition | null;
    };
    Update: {
      status?: InventoryImportDraft["status"];
      inventory_catalog_id?: string | null;
      reviewed_by?: string | null;
      reviewed_at?: string | null;
    };
    Relationships: [];
  };
  order_audio_recordings: {
    Row: OrderAudioRecording;
    Insert: {
      user_id?: string;
      order_number: string;
      storage_path: string;
      transcript?: string;
      mime_type: string;
      duration_seconds?: number | null;
      consent_given: true;
      consented_by?: string;
    };
    Update: { transcript?: string };
    Relationships: [];
  };
};

type CatalogDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & CatalogTables;
    Functions: Database["public"]["Functions"] & {
      create_inventory_catalog_item: {
        Args: {
          p_item_kind: InventoryItemKind;
          p_code: string | null;
          p_name: string;
          p_brand: string | null;
          p_condition: InventoryCondition | null;
          p_category: InventoryCategory | null;
          p_unit_cost: number;
          p_suggested_price: number;
          p_price_original?: number;
          p_price_generic?: number;
          p_price_repaired?: number;
          p_price_aftermarket?: number;
        };
        Returns: CatalogTables["inventory_catalog"]["Row"];
      };
      create_inventory_import_product: {
        Args: {
          p_draft_id: string;
          p_item_kind: InventoryItemKind;
          p_code: string | null;
          p_name: string;
          p_brand: string | null;
          p_condition: InventoryCondition | null;
          p_category: InventoryCategory | null;
          p_unit_cost: number;
          p_suggested_price: number;
        };
        Returns: CatalogTables["inventory_catalog"]["Row"];
      };
      record_inventory_movement: {
        Args: {
          p_catalog_id: string;
          p_direction: "in" | "out";
          p_movement_type: InventoryStockMovement["movement_type"];
          p_quantity: number;
          p_note?: string;
        };
        Returns: CatalogTables["inventory_stock"]["Row"];
      };
      bulk_review_inventory_drafts: {
        Args: {
          p_items: {
            id: string;
            name: string;
            code: string;
            brand: string;
            condition: InventoryCondition | "";
            category: InventoryCategory | "";
            fitment: string;
            unit_cost: string;
            suggested_price: string;
          }[];
        };
        Returns: number;
      };
      update_inventory_catalog_item: {
        Args: {
          p_catalog_id: string;
          p_code: string | null;
          p_name: string;
          p_brand: string | null;
          p_condition: InventoryCondition | null;
          p_category: InventoryCategory | null;
          p_fitment: string | null;
          p_unit_cost: number;
          p_suggested_price: number;
          p_active: boolean;
          p_price_original: number;
          p_price_generic: number;
          p_price_repaired: number;
          p_price_aftermarket: number;
        };
        Returns: CatalogTables["inventory_catalog"]["Row"];
      };
      create_inventory_catalog_item_with_fitment: {
        Args: {
          p_draft_id: string | null;
          p_item_kind: InventoryItemKind;
          p_code: string | null;
          p_name: string;
          p_brand: string | null;
          p_condition: InventoryCondition | null;
          p_category: InventoryCategory | null;
          p_fitment: string | null;
          p_unit_cost: number;
          p_suggested_price: number;
          p_price_original?: number;
          p_price_generic?: number;
          p_price_repaired?: number;
          p_price_aftermarket?: number;
        };
        Returns: CatalogTables["inventory_catalog"]["Row"];
      };
      set_inventory_stock_quantity: {
        Args: { p_catalog_id: string; p_quantity: number };
        Returns: CatalogTables["inventory_stock"]["Row"];
      };
      get_inventory_stock_availability: {
        Args: {
          p_catalog_ids: string[];
          p_exclude_order_number?: string | null;
        };
        Returns: InventoryStockAvailability[];
      };
    };
  };
};

const catalogClient = supabase as SupabaseClient<CatalogDatabase>;

export async function loadOrderCatalog(
  type: OrderCatalogType,
): Promise<OrderCatalogItem[]> {
  const { data, error } = await catalogClient
    .from("order_catalog")
    .select("id,catalog_type,name,sort_order,active")
    .eq("catalog_type", type)
    .eq("active", true)
    .order("sort_order")
    .order("name");

  if (error) throw new Error("No se pudo cargar el catálogo de ingreso.");
  return data;
}

export async function addOrderCatalogItem(
  type: OrderCatalogType,
  name: string,
  userId: string,
): Promise<OrderCatalogItem> {
  const { data, error } = await catalogClient
    .from("order_catalog")
    .insert({ catalog_type: type, name: name.trim(), created_by: userId })
    .select("id,catalog_type,name,sort_order,active")
    .single();

  if (error)
    throw new Error(
      error.code === "23505"
        ? "Ese valor ya existe en el catálogo."
        : "No se pudo guardar el nuevo valor.",
    );
  return data;
}

export async function searchInventoryCatalog(
  query: string,
  excludeOrderNumber?: string,
): Promise<InventoryCatalogWithStock[]> {
  const term = query.trim();
  if (term.length === 1) return [];
  const select =
    "id,item_kind,code,name,brand,condition,category,fitment,suggested_price,price_original,price_generic,price_repaired,price_aftermarket,active,created_at,inventory_stock(quantity_on_hand)";
  if (!term) {
    const { data, error } = await catalogClient
      .from("inventory_catalog")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) throw new Error("No se pudieron cargar las sugerencias.");
    return attachAvailableStock(
      data.map(({ inventory_stock: _stock, ...item }) => item),
      excludeOrderNumber,
    );
  }

  if (term.length < 2) return [];
  const escapeLike = (value: string) => value.replace(/[%_\\]/g, "\\$&");
  const pattern = `%${escapeLike(term)}%`;
  const accentInsensitivePattern = `%${[...term]
    .map((character) =>
      /[aeiounáéíóúüñ]/i.test(character) ? "_" : escapeLike(character),
    )
    .join("")}%`;
  const fields = ["name", "code", "brand", "fitment"] as const;
  const results = await Promise.all([
    ...fields.map((field) =>
      catalogClient
        .from("inventory_catalog")
        .select(select)
        .ilike(field, pattern)
        .order("name")
        .limit(20),
    ),
    ...fields.map((field) =>
      catalogClient
        .from("inventory_catalog")
        .select(select)
        .ilike(field, accentInsensitivePattern)
        .order("name")
        .limit(100),
    ),
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw new InventoryCatalogSearchError(
      failed.error.message || "No se pudo buscar en el catálogo de repuestos.",
      failed.error.code || null,
      failed.status,
    );
  }

  const normalizedTerm = term
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
  type InventoryCatalogSearchRow = NonNullable<
    (typeof results)[number]["data"]
  >[number];
  const unique = new Map<string, InventoryCatalogSearchRow>();
  for (const result of results) {
    for (const item of result.data ?? []) {
      const matchesNormalizedTerm = [
        item.name,
        item.code,
        item.brand,
        item.fitment,
      ]
        .filter(Boolean)
        .some((value) =>
          value
            ?.normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLocaleLowerCase()
            .includes(normalizedTerm),
        );
      if (matchesNormalizedTerm) unique.set(item.id, item);
    }
  }
  return attachAvailableStock(
    [...unique.values()]
      .slice(0, 20)
      .map(({ inventory_stock: _stock, ...item }) => item),
    excludeOrderNumber,
  );
}

async function attachAvailableStock(
  items: InventoryCatalogItem[],
  excludeOrderNumber?: string,
): Promise<InventoryCatalogWithStock[]> {
  const availability = await loadInventoryStockAvailability(
    items.map((item) => item.id),
    excludeOrderNumber,
  );
  return items.map((item) => {
    const stock = availability[item.id];
    return {
      ...item,
      stock_quantity: stock?.quantity_available ?? 0,
      stock_physical: stock?.quantity_on_hand ?? 0,
      stock_reserved: stock?.quantity_reserved ?? 0,
    };
  });
}

export async function loadInventoryStockAvailability(
  catalogIds: string[],
  excludeOrderNumber?: string,
): Promise<Record<string, InventoryStockAvailability>> {
  if (catalogIds.length === 0) return {};
  const { data, error } = await catalogClient.rpc(
    "get_inventory_stock_availability",
    {
      p_catalog_ids: catalogIds,
      p_exclude_order_number: excludeOrderNumber ?? null,
    },
  );

  if (error) {
    throw new InventoryCatalogSearchError(
      error.message || "No se pudo calcular el stock disponible.",
      error.code || null,
      0,
    );
  }
  return Object.fromEntries(data.map((item) => [item.catalog_id, item]));
}

export async function loadInventoryStockQuantities(
  catalogIds: string[],
  excludeOrderNumber?: string,
): Promise<Record<string, number>> {
  const availability = await loadInventoryStockAvailability(
    catalogIds,
    excludeOrderNumber,
  );
  return Object.fromEntries(
    catalogIds.map((id) => [id, availability[id]?.quantity_available ?? 0]),
  );
}

export async function loadInventoryConditionPrices(
  catalogIds: string[],
): Promise<
  Record<string, InventoryConditionPrices & { suggested_price: number }>
> {
  if (catalogIds.length === 0) return {};
  const { data, error } = await catalogClient
    .from("inventory_catalog")
    .select(
      "id,suggested_price,price_original,price_generic,price_repaired,price_aftermarket",
    )
    .in("id", catalogIds);

  if (error)
    throw new Error("No se pudieron cargar los precios por condición.");
  return Object.fromEntries(
    data.map((item) => [
      item.id,
      {
        suggested_price: item.suggested_price,
        price_original: item.price_original,
        price_generic: item.price_generic,
        price_repaired: item.price_repaired,
        price_aftermarket: item.price_aftermarket,
      },
    ]),
  );
}

export async function loadInventoryCatalog(
  query = "",
  includeCost = false,
  includeInactive = false,
): Promise<InventoryCatalogWithStock[]> {
  const term = query.trim();
  if (term.length === 1 && !includeInactive) return [];
  if (term.length >= 2 && !includeInactive) {
    const results = await searchInventoryCatalog(term);
    return includeCost ? attachCosts(results) : results;
  }

  let catalogQuery = catalogClient
    .from("inventory_catalog")
    .select(
      "id,item_kind,code,name,brand,condition,category,fitment,suggested_price,price_original,price_generic,price_repaired,price_aftermarket,active",
    );
  if (!includeInactive) catalogQuery = catalogQuery.eq("active", true);
  const { data, error } = await catalogQuery.order("name").limit(500);

  if (error) throw new Error("No se pudo cargar el inventario del taller.");
  const matchingItems =
    includeInactive && term
      ? data.filter((item) =>
          [item.name, item.code, item.brand, item.fitment]
            .filter(Boolean)
            .some((value) =>
              value?.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
            ),
        )
      : data;
  const withStock = await attachStock(matchingItems);
  return includeCost ? attachCosts(withStock) : withStock;
}

async function attachStock(
  items: InventoryCatalogItem[],
): Promise<InventoryCatalogWithStock[]> {
  if (items.length === 0) return [];

  const availability = await loadInventoryStockAvailability(
    items.map((item) => item.id),
  );
  return items.map((item) => {
    const stock = availability[item.id];
    return {
      ...item,
      stock_quantity: stock?.quantity_on_hand ?? 0,
      stock_physical: stock?.quantity_on_hand ?? 0,
      stock_reserved: stock?.quantity_reserved ?? 0,
    };
  });
}

export async function addInventoryCatalogItem(
  item: CatalogTables["inventory_catalog"]["Insert"] & { unit_cost: number },
  importDraftId?: string,
): Promise<InventoryCatalogItem> {
  const { data, error } = await catalogClient.rpc(
    "create_inventory_catalog_item_with_fitment",
    {
      p_draft_id: importDraftId ?? null,
      p_item_kind: item.item_kind,
      p_code: item.code ?? null,
      p_name: item.name,
      p_brand: item.brand ?? null,
      p_condition: item.condition ?? null,
      p_category: item.category ?? null,
      p_fitment: item.fitment ?? null,
      p_unit_cost: item.unit_cost,
      p_suggested_price: item.suggested_price ?? 0,
      p_price_original: item.price_original ?? item.suggested_price ?? 0,
      p_price_generic: item.price_generic ?? item.suggested_price ?? 0,
      p_price_repaired: item.price_repaired ?? item.suggested_price ?? 0,
      p_price_aftermarket: item.price_aftermarket ?? item.suggested_price ?? 0,
    },
  );

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Ese código ya existe en el catálogo."
        : "No se pudo guardar el repuesto o servicio.",
    );
  }
  return data;
}

export async function bulkReviewInventoryDrafts(
  items: {
    id: string;
    name: string;
    code: string;
    brand: string;
    condition: InventoryCondition | "";
    category: InventoryCategory | "";
    fitment: string;
    unit_cost: string;
    suggested_price: string;
  }[],
): Promise<number> {
  const { data, error } = await catalogClient.rpc(
    "bulk_review_inventory_drafts",
    { p_items: items },
  );
  if (error)
    throw new Error(
      error.message || "No se pudieron importar las filas seleccionadas.",
    );
  return data;
}

export async function updateInventoryCatalogItem(input: {
  id: string;
  code: string;
  name: string;
  brand: string;
  condition: InventoryCondition | "";
  category: InventoryCategory | "";
  fitment: string;
  unitCost: number;
  suggestedPrice: number;
  priceOriginal: number;
  priceGeneric: number;
  priceRepaired: number;
  priceAftermarket: number;
  active: boolean;
}): Promise<InventoryCatalogItem> {
  const { data, error } = await catalogClient.rpc(
    "update_inventory_catalog_item",
    {
      p_catalog_id: input.id,
      p_code: input.code.trim() || null,
      p_name: input.name.trim(),
      p_brand: input.brand.trim() || null,
      p_condition: input.condition || null,
      p_category: input.category || null,
      p_fitment: input.fitment.trim() || null,
      p_unit_cost: input.unitCost,
      p_suggested_price: input.suggestedPrice,
      p_active: input.active,
      p_price_original: input.priceOriginal,
      p_price_generic: input.priceGeneric,
      p_price_repaired: input.priceRepaired,
      p_price_aftermarket: input.priceAftermarket,
    },
  );
  if (error)
    throw new Error(
      error.message || "No se pudieron guardar los cambios del producto.",
    );
  return data;
}

export async function setInventoryStockQuantity(
  catalogId: string,
  quantity: number,
): Promise<void> {
  const { error } = await catalogClient.rpc("set_inventory_stock_quantity", {
    p_catalog_id: catalogId,
    p_quantity: quantity,
  });
  if (error)
    throw new Error(
      error.message || "No se pudo actualizar la existencia del producto.",
    );
}

async function attachCosts(
  items: InventoryCatalogWithStock[],
): Promise<InventoryCatalogWithStock[]> {
  if (items.length === 0) return [];

  const { data, error } = await catalogClient
    .from("inventory_costs")
    .select("catalog_id,unit_cost")
    .in(
      "catalog_id",
      items.map((item) => item.id),
    );

  if (error) throw new Error("No se pudieron cargar los costos internos.");
  const costs = new Map(data.map((row) => [row.catalog_id, row.unit_cost]));
  return items.map((item) => ({
    ...item,
    unit_cost: costs.get(item.id) ?? 0,
  }));
}

export async function updateInventoryCost(
  catalogId: string,
  unitCost: number,
): Promise<void> {
  const { error } = await catalogClient
    .from("inventory_costs")
    .update({ unit_cost: unitCost, updated_at: new Date().toISOString() })
    .eq("catalog_id", catalogId);

  if (error) throw new Error("No se pudo actualizar el costo interno.");
}

export async function recordInventoryMovement(input: {
  catalogId: string;
  direction: "in" | "out";
  movementType: InventoryStockMovement["movement_type"];
  quantity: number;
  note: string;
}): Promise<{
  catalog_id: string;
  quantity_on_hand: number;
  updated_at: string;
}> {
  const { data, error } = await catalogClient.rpc("record_inventory_movement", {
    p_catalog_id: input.catalogId,
    p_direction: input.direction,
    p_movement_type: input.movementType,
    p_quantity: input.quantity,
    p_note: input.note,
  });

  if (error)
    throw new Error(error.message || "No se pudo registrar el movimiento.");
  return data;
}

export async function loadInventoryImportDrafts(): Promise<
  InventoryImportDraft[]
> {
  const { data, error } = await catalogClient
    .from("inventory_import_drafts")
    .select(
      "id,source_file,source_sheet,source_row,raw_code,raw_name,raw_quantity,raw_order_quantity,suggested_brand,suggested_condition,status,inventory_catalog_id,reviewed_by,reviewed_at,created_at",
    )
    .eq("status", "pending")
    .order("source_sheet")
    .order("source_row");

  if (error)
    throw new Error("No se pudieron cargar las filas pendientes del Excel.");
  return data;
}

export async function ignoreInventoryImportDraft(
  draftId: string,
  userId: string,
): Promise<void> {
  const { error } = await catalogClient
    .from("inventory_import_drafts")
    .update({
      status: "ignored",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .eq("status", "pending");

  if (error) throw new Error("No se pudo descartar la fila importada.");
}

export async function loadInventoryMovementHistory(
  catalogId: string,
): Promise<InventoryStockMovement[]> {
  const { data, error } = await catalogClient
    .from("inventory_stock_movements")
    .select(
      "id,catalog_id,recorded_by,direction,movement_type,quantity,note,created_at",
    )
    .eq("catalog_id", catalogId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error("No se pudo cargar el historial de movimientos.");
  return data;
}

export async function loadOrderAudio(
  orderNumber: string,
): Promise<OrderAudioRecording[]> {
  const { data, error } = await catalogClient
    .from("order_audio_recordings")
    .select(
      "id,user_id,order_number,storage_path,transcript,mime_type,duration_seconds,consent_given,consented_by,consented_at,created_at",
    )
    .eq("order_number", orderNumber)
    .order("created_at", { ascending: false });

  if (error)
    throw new Error("No se pudieron cargar las grabaciones de la orden.");
  return data;
}

export async function saveOrderAudioMetadata(
  recording: CatalogTables["order_audio_recordings"]["Insert"],
): Promise<OrderAudioRecording> {
  const { data, error } = await catalogClient
    .from("order_audio_recordings")
    .insert(recording)
    .select(
      "id,user_id,order_number,storage_path,transcript,mime_type,duration_seconds,consent_given,consented_by,consented_at,created_at",
    )
    .single();

  if (error)
    throw new Error(
      "El audio se cargó, pero no se pudo registrar su consentimiento y transcripción.",
    );
  return data;
}

export async function updateOrderAudioTranscript(
  id: string,
  transcript: string,
): Promise<void> {
  const { error } = await catalogClient
    .from("order_audio_recordings")
    .update({ transcript })
    .eq("id", id);

  if (error) throw new Error("No se pudo guardar la transcripción.");
}

export async function deleteOrderAudio(
  id: string,
): Promise<OrderAudioRecording> {
  const { data, error } = await catalogClient
    .from("order_audio_recordings")
    .delete()
    .eq("id", id)
    .select(
      "id,user_id,order_number,storage_path,transcript,mime_type,duration_seconds,consent_given,consented_by,consented_at,created_at",
    )
    .single();

  if (error) throw new Error("No se pudo eliminar el registro del audio.");
  return data;
}
