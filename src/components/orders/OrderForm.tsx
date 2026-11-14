import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AudioLines,
  Bike,
  Check,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Mic,
  Plus,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Help, Hint } from "@/components/ui/Help";
import { SaveAccess } from "./SaveAccess";
import { supabase } from "@/integrations/supabase/client";
import { saveOrder } from "@/lib/orders.functions";
import {
  addInventoryCatalogItem,
  addOrderCatalogItem,
  deleteOrderAudio,
  InventoryCatalogSearchError,
  type InventoryCatalogWithStock,
  loadOrderAudio,
  loadOrderCatalog,
  loadInventoryConditionPrices,
  loadInventoryStockQuantities,
  saveOrderAudioMetadata,
  searchInventoryCatalog,
  updateOrderAudioTranscript,
  type InventoryCategory,
  type InventoryCondition,
  type OrderAudioRecording,
  type OrderCatalogItem,
  type OrderCatalogType,
} from "@/lib/catalog";
import {
  ACCESSORY_ITEMS,
  INSPECTION_ITEMS,
  PART_CATEGORIES,
  PART_CONDITIONS,
  TECHNICIANS,
  formatCOP,
  orderTotal,
  ordersStore,
  type PartCategory,
  type PartCondition,
  type QuoteItem,
  type WorkOrder,
  type WorkOrderBike,
  type WorkOrderOwner,
} from "@/lib/orders";
import { orderDataSchema } from "@/lib/order-schema";
import { cn } from "@/lib/utils";

const STEPS = [
  "Cliente y motocicleta",
  "Reporte y novedades",
  "Inventario al recibir",
  "Repuestos y servicios",
];
const DOCUMENT_TYPES = ["CC", "CE", "NIT", "Pasaporte", "Otro"] as const;
const CATEGORY_LABELS: Record<InventoryCategory, PartCategory> = {
  mechanical: "Mecánica",
  electrical: "Eléctrica",
  luxury: "Lujo",
};
const CONDITION_LABELS: Record<InventoryCondition, PartCondition> = {
  new_original: "Nueva Original",
  new_generic: "Nueva Genérica",
  repaired: "Reparada",
  aftermarket: "Aftermarket / Lujo",
};
const CATEGORY_VALUES: Record<PartCategory, InventoryCategory> = {
  Mecánica: "mechanical",
  Eléctrica: "electrical",
  Lujo: "luxury",
};
const CONDITION_VALUES: Record<PartCondition, InventoryCondition> = {
  "Nueva Original": "new_original",
  "Nueva Genérica": "new_generic",
  Reparada: "repaired",
  "Aftermarket / Lujo": "aftermarket",
  "Repuesto de Lujo": "aftermarket",
};
const CONDITION_PRICE_INPUTS = [
  ["price_original", "Precio Nueva Original"],
  ["price_generic", "Precio Nueva Genérica"],
  ["price_repaired", "Precio Reparada"],
  ["price_aftermarket", "Precio Aftermarket / Lujo"],
] as const;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const toFiniteNumber = (value: unknown, fallback = 0) => {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
};
type SpeechRecognitionResultLike = {
  0?: { transcript: string };
};
type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
const initialFlags = (keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, false]));

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label.replace(/\s*\*$/, "")}
          {label.trimEnd().endsWith("*") && (
            <span className="ml-1 font-bold text-orange-500">*</span>
          )}
        </Label>
        <Help label={label} text={help} />
      </div>
      {children}
    </div>
  );
}

function ToggleList({
  items,
  value,
  onChange,
}: {
  items: readonly string[];
  value: Record<string, boolean>;
  onChange: (value: Record<string, boolean>) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        No hay elementos activos en este catálogo.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {items.map((item) => (
        <Button
          key={item}
          type="button"
          variant="ghost"
          aria-pressed={!!value[item]}
          onClick={() => onChange({ ...value, [item]: !value[item] })}
          className={cn(
            "h-12 w-full justify-start gap-2 rounded-md border px-3 text-left whitespace-normal transition-colors",
            value[item]
              ? "border-orange-500 bg-orange-500/10 text-orange-500 hover:bg-orange-500/15"
              : "border-border bg-card text-foreground hover:border-muted-foreground/50 hover:bg-muted/50",
          )}
        >
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border text-xs",
              value[item]
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-muted-foreground/40 text-transparent",
            )}
          >
            <Check aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">{item}</span>
          <span
            className={cn(
              "shrink-0 text-xs font-semibold",
              value[item] ? "text-orange-500" : "text-muted-foreground",
            )}
          >
            {value[item] ? "Sí" : "No"}
          </span>
        </Button>
      ))}
    </div>
  );
}

function getRecordingMimeType() {
  const choices = [
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
    "audio/mpeg",
    "audio/wav",
  ];
  return choices.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function OrderForm({ initial }: { initial?: WorkOrder }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [inspectionCatalog, setInspectionCatalog] = useState<
    OrderCatalogItem[]
  >([]);
  const [accessoryCatalog, setAccessoryCatalog] = useState<OrderCatalogItem[]>(
    [],
  );
  const [catalogName, setCatalogName] = useState("");
  const [addingCatalogType, setAddingCatalogType] =
    useState<OrderCatalogType | null>(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryResults, setInventoryResults] = useState<
    InventoryCatalogWithStock[]
  >([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryLoginRequired, setInventoryLoginRequired] = useState(false);
  const [inventorySelectionNotice, setInventorySelectionNotice] = useState("");
  const [inventoryFocused, setInventoryFocused] = useState(false);
  const [inventoryStockById, setInventoryStockById] = useState<
    Record<string, number>
  >({});
  const [showNewInventory, setShowNewInventory] = useState(false);
  const [newInventory, setNewInventory] = useState({
    item_kind: "part" as "part" | "service",
    code: "",
    name: "",
    brand: "",
    condition: "new_original" as InventoryCondition,
    category: "mechanical" as InventoryCategory,
    fitment: "",
    unit_cost: "",
    suggested_price: "",
    price_original: "",
    price_generic: "",
    price_repaired: "",
    price_aftermarket: "",
  });
  const [activeOrder, setActiveOrder] = useState(initial);
  const [owner, setOwner] = useState<WorkOrderOwner>(() => ({
    name: initial?.owner.name ?? "",
    cc: initial?.owner.cc ?? "",
    phone: initial?.owner.phone ?? "",
    documentType: initial?.owner.documentType ?? "CC",
    email: initial?.owner.email ?? "",
  }));
  const [bike, setBike] = useState({
    plate: initial?.bike.plate ?? "",
    brand: initial?.bike.brand ?? "",
    model: initial?.bike.model ?? "",
    year: initial?.bike.year?.toString() ?? "",
    vin: initial?.bike.vin ?? "",
    engineNumber: initial?.bike.engineNumber ?? "",
    km: initial?.bike.km.toString() ?? "",
  });
  const [technician, setTechnician] = useState(
    initial?.technician ?? TECHNICIANS[0] ?? "",
  );
  const [report, setReport] = useState(initial?.report ?? "");
  const reportRef = useRef(initial?.report ?? "");
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [speechListening, setSpeechListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const baseReportRef = useRef("");
  const [inspection, setInspection] = useState<Record<string, boolean>>(
    initial?.inspection ?? initialFlags(INSPECTION_ITEMS),
  );
  const [accessories, setAccessories] = useState<Record<string, boolean>>(
    initial?.accessories ?? initialFlags(ACCESSORY_ITEMS),
  );
  const [items, setItems] = useState<QuoteItem[]>(
    () =>
      initial?.items.map((item) => ({
        ...item,
        kind: item.kind ?? "part",
        condition:
          item.condition === "Repuesto de Lujo"
            ? "Aftermarket / Lujo"
            : (item.condition ?? "Nueva Original"),
        category:
          item.category ??
          (item.condition === "Repuesto de Lujo" ? "Lujo" : "Mecánica"),
        brand: item.brand || "",
        description: item.description || "",
        ...(item.conditionPrices
          ? { conditionPrices: item.conditionPrices }
          : {}),
        qty: toFiniteNumber(item.qty, 1),
        unitPrice: toFiniteNumber(item.unitPrice),
      })) ?? [],
  );
  const [audioConsent, setAudioConsent] = useState(false);
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "ready"
  >("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pendingAudio, setPendingAudio] = useState<Blob | null>(null);
  const [audioTranscript, setAudioTranscript] = useState("");
  const [audioError, setAudioError] = useState("");
  const [recordings, setRecordings] = useState<OrderAudioRecording[]>([]);
  const [recordingUrls, setRecordingUrls] = useState<Record<string, string>>(
    {},
  );
  const [recordingTranscripts, setRecordingTranscripts] = useState<
    Record<string, string>
  >({});
  const [savingTranscriptId, setSavingTranscriptId] = useState<string | null>(
    null,
  );
  const [deletingRecordingId, setDeletingRecordingId] = useState<string | null>(
    null,
  );
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioBlobUrl = useMemo(
    () => (pendingAudio ? URL.createObjectURL(pendingAudio) : ""),
    [pendingAudio],
  );

  useEffect(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    setSpeechAvailable(
      !!(
        speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
      ),
    );

    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
        recognition.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (step !== 1) recognitionRef.current?.stop();
  }, [step]);

  useEffect(() => {
    let active = true;
    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setCatalogError(
          "No se pudo verificar tu sesión. Cierra sesión y vuelve a entrar.",
        );
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
    if (!userId) return;
    let active = true;
    setCatalogLoading(true);
    setCatalogError("");
    Promise.all([loadOrderCatalog("inspection"), loadOrderCatalog("accessory")])
      .then(([inspections, accessoriesList]) => {
        if (!active) return;
        setInspectionCatalog(inspections);
        setAccessoryCatalog(accessoriesList);
        setInspection((current) => ({
          ...initialFlags(inspections.map((item) => item.name)),
          ...current,
        }));
        setAccessories((current) => ({
          ...initialFlags(accessoriesList.map((item) => item.name)),
          ...current,
        }));
      })
      .catch((error: unknown) => {
        if (active)
          setCatalogError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los catálogos.",
          );
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    const query = inventorySearch.trim();
    setInventoryError("");
    setInventoryLoginRequired(false);
    if (query.length === 1 || (!query && !inventoryFocused)) {
      setInventoryResults([]);
      setInventoryLoading(false);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setInventoryLoading(true);
      void searchInventoryCatalog(query, initial?.number)
        .then((results) => {
          if (active) {
            setInventoryResults(results);
            setInventoryStockById((current) => ({
              ...current,
              ...Object.fromEntries(
                results.map((entry) => [entry.id, entry.stock_quantity]),
              ),
            }));
          }
        })
        .catch((error: unknown) => {
          if (active) {
            const searchError =
              error instanceof InventoryCatalogSearchError ? error : null;
            const message =
              error instanceof Error ? error.message.toLowerCase() : "";
            const requiresLogin =
              searchError?.status === 401 ||
              searchError?.status === 403 ||
              ["42501", "28000", "28P01", "PGRST301", "PGRST302"].includes(
                searchError?.code ?? "",
              ) ||
              /permission denied|row.level security|not authorized|unauthorized|jwt|auth required|session missing/.test(
                message,
              );
            setInventoryLoginRequired(requiresLogin);
            setInventoryError(
              requiresLogin
                ? ""
                : error instanceof Error
                  ? error.message
                  : "No se pudo buscar el catálogo.",
            );
          }
        })
        .finally(() => {
          if (active) setInventoryLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [initial?.number, inventoryFocused, inventorySearch]);

  useEffect(() => {
    const catalogIds = [
      ...new Set(
        (initial?.items ?? [])
          .filter((item) => item.catalogId && item.kind !== "service")
          .map((item) => item.catalogId as string),
      ),
    ];
    let active = true;
    void loadInventoryStockQuantities(catalogIds, initial?.number)
      .then((quantities) => {
        if (active)
          setInventoryStockById((current) => ({ ...current, ...quantities }));
      })
      .catch((error: unknown) => {
        if (active)
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las existencias.",
          );
      });
    void loadInventoryConditionPrices(catalogIds)
      .then((catalogPrices) => {
        if (active) {
          setItems((current) =>
            current.map((item) => {
              const catalogPrice = item.catalogId
                ? catalogPrices[item.catalogId]
                : undefined;
              if (!catalogPrice || item.conditionPrices) return item;
              return {
                ...item,
                conditionPrices: {
                  "Nueva Original":
                    catalogPrice.price_original || catalogPrice.suggested_price,
                  "Nueva Genérica":
                    catalogPrice.price_generic || catalogPrice.suggested_price,
                  Reparada:
                    catalogPrice.price_repaired || catalogPrice.suggested_price,
                  "Aftermarket / Lujo":
                    catalogPrice.price_aftermarket ||
                    catalogPrice.suggested_price,
                },
              };
            }),
          );
        }
      })
      .catch((error: unknown) => {
        if (active)
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los precios del catálogo.",
          );
      });
    return () => {
      active = false;
    };
  }, [initial]);

  useEffect(() => {
    if (!activeOrder?.number || !userId) {
      setRecordings([]);
      setRecordingUrls({});
      setRecordingTranscripts({});
      return;
    }
    let active = true;
    loadOrderAudio(activeOrder.number)
      .then(async (rows) => {
        if (!active) return;
        setRecordings(rows);
        setRecordingTranscripts(
          Object.fromEntries(rows.map((row) => [row.id, row.transcript])),
        );
        const urlEntries = await Promise.all(
          rows.map(async (row) => {
            const { data, error } = await supabase.storage
              .from("order-audio")
              .createSignedUrl(row.storage_path, 60 * 60);
            if (error)
              throw new Error(
                "No se pudo preparar la reproducción privada de una grabación.",
              );
            return [row.id, data.signedUrl] as const;
          }),
        );
        if (active) setRecordingUrls(Object.fromEntries(urlEntries));
      })
      .catch((error: unknown) => {
        if (active)
          setAudioError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las grabaciones.",
          );
      });
    return () => {
      active = false;
    };
  }, [activeOrder?.number, userId]);

  useEffect(
    () => () => {
      if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
    },
    [audioBlobUrl],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const inspectionNames = inspectionCatalog.length
    ? inspectionCatalog.map((item) => item.name)
    : userId
      ? []
      : [...INSPECTION_ITEMS];
  const accessoryNames = accessoryCatalog.length
    ? accessoryCatalog.map((item) => item.name)
    : userId
      ? []
      : [...ACCESSORY_ITEMS];

  const ownerValid = orderDataSchema.shape.owner.safeParse(owner).success;
  const phoneValid = owner.phone.trim().length >= 7;
  const plateValid = orderDataSchema.shape.bike.shape.plate.safeParse(
    bike.plate,
  ).success;
  const bikeBrandValid =
    !!bike.brand.trim() &&
    orderDataSchema.shape.bike.shape.brand.safeParse(bike.brand).success;
  const bikeModelValid = orderDataSchema.shape.bike.shape.model.safeParse(
    bike.model,
  ).success;
  const mileageValid =
    bike.km.trim() !== "" &&
    orderDataSchema.shape.bike.shape.km.safeParse(Number(bike.km)).success;
  const technicianValid = technician.trim().length > 0;
  const numericBike = {
    plate: bike.plate.trim().toUpperCase(),
    brand: bike.brand.trim(),
    model: bike.model.trim(),
    ...(bike.year.trim() ? { year: Number(bike.year) } : {}),
    ...(bike.vin.trim() ? { vin: bike.vin.trim().toUpperCase() } : {}),
    ...(bike.engineNumber.trim()
      ? { engineNumber: bike.engineNumber.trim().toUpperCase() }
      : {}),
    km: Number(bike.km),
  } satisfies WorkOrderBike;
  const bikeValid =
    plateValid &&
    bikeBrandValid &&
    bikeModelValid &&
    mileageValid &&
    orderDataSchema.shape.bike.safeParse(numericBike).success;
  const stepValid = [
    ownerValid && phoneValid && bikeValid && technicianValid,
    true,
    true,
    true,
  ];
  const formValid = stepValid[0];
  const quoteValid = items.every(
    (item) =>
      typeof item.description === "string" &&
      item.description.trim().length > 0 &&
      Number.isInteger(toFiniteNumber(item.qty)) &&
      toFiniteNumber(item.qty) > 0 &&
      toFiniteNumber(item.unitPrice) >= 0 &&
      (item.kind === "service" ||
        (!!item.condition &&
          !!item.category &&
          !!(typeof item.brand === "string" && item.brand.trim()))),
  );

  const updateItem = (id: string, patch: Partial<QuoteItem>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

  const notifyInventorySelectionBlocked = (
    name: string,
    availableStock: number,
    reservedElsewhere = false,
  ) => {
    const message = reservedElsewhere
      ? "Pieza reservada temporalmente en otra orden de trabajo activa (0 disponibles)"
      : availableStock <= 0
        ? `No se puede seleccionar '${name}' porque no cuenta con existencias en stock (0 disponibles).`
        : `No se puede seleccionar '${name}' porque supera las existencias en stock (${availableStock} disponibles).`;
    setInventorySelectionNotice(message);
    toast.warning(message);
  };

  const updateItemQuantity = (item: QuoteItem, quantity: number) => {
    const availableStock = item.catalogId
      ? inventoryStockById[item.catalogId]
      : undefined;
    if (
      item.kind !== "service" &&
      availableStock !== undefined &&
      quantity > toFiniteNumber(availableStock)
    ) {
      notifyInventorySelectionBlocked(
        item.description || "este repuesto",
        toFiniteNumber(availableStock),
      );
      return;
    }
    setInventorySelectionNotice("");
    updateItem(item.id, { qty: quantity });
  };

  const addManualService = () => {
    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        kind: "service",
        description: "Servicio + Diagnóstico Mantenimiento",
        qty: 1,
        unitPrice: 0,
      },
    ]);
    setInventorySearch("");
    setInventoryFocused(false);
    setInventoryResults([]);
    setInventorySelectionNotice("");
    toast.success(
      "Mano de obra agregada. Edita el valor unitario en la cotización.",
    );
  };

  const handleAddCatalogItem = (
    entry: InventoryCatalogWithStock & {
      unitPrice?: number | null;
      quantity_on_hand?: number | null;
      stock?: number | null;
    },
  ): boolean => {
    try {
      const availableStock = toFiniteNumber(
        entry.quantity_on_hand ?? entry.stock ?? entry.stock_quantity ?? 0,
      );
      const suggestedPrice = toFiniteNumber(
        entry.suggested_price ?? entry.unitPrice ?? 0,
      );
      const kind = entry.item_kind === "service" ? "service" : "part";
      const condition =
        (entry.condition && CONDITION_LABELS[entry.condition]) ||
        "Nueva Original";
      const conditionPrices: Partial<Record<PartCondition, number>> = {
        "Nueva Original":
          toFiniteNumber(entry.price_original) || suggestedPrice,
        "Nueva Genérica": toFiniteNumber(entry.price_generic) || suggestedPrice,
        Reparada: toFiniteNumber(entry.price_repaired) || suggestedPrice,
        "Aftermarket / Lujo":
          toFiniteNumber(entry.price_aftermarket) || suggestedPrice,
      };
      const unitPrice =
        kind === "service"
          ? suggestedPrice
          : (conditionPrices[condition] ?? suggestedPrice);
      const category =
        (entry.category && CATEGORY_LABELS[entry.category]) || "Mecánica";
      const name = typeof entry.name === "string" ? entry.name : "";
      const brand = entry.brand || "";

      if (kind !== "service" && availableStock <= 0) {
        notifyInventorySelectionBlocked(
          name || "este repuesto",
          0,
          toFiniteNumber(entry.stock_physical) > 0 &&
            toFiniteNumber(entry.stock_reserved) > 0,
        );
        return false;
      }

      const existing = items.find(
        (item) => item.catalogId === entry.id && item.kind !== "service",
      );
      if (
        kind !== "service" &&
        existing &&
        toFiniteNumber(existing.qty, 1) + 1 > availableStock
      ) {
        notifyInventorySelectionBlocked(
          name || "este repuesto",
          availableStock,
        );
        return false;
      }
      if (existing && toFiniteNumber(existing.qty, 1) >= 1000) {
        toast.warning("La cantidad máxima por ítem es 1000.");
        return false;
      }

      setInventorySelectionNotice("");
      setInventoryStockById((current) => ({
        ...current,
        [entry.id]: availableStock,
      }));

      setItems((current) => {
        const currentExisting = current.find(
          (item) => item.catalogId === entry.id && item.kind !== "service",
        );
        if (currentExisting) {
          return current.map((item) =>
            item.id === currentExisting.id
              ? { ...item, qty: toFiniteNumber(item.qty, 1) + 1 }
              : item,
          );
        }
        return [
          ...current,
          {
            id: crypto.randomUUID(),
            catalogId: entry.id,
            kind,
            ...(entry.code ? { code: entry.code } : {}),
            description: name,
            brand,
            condition,
            category,
            ...(kind === "part" ? { conditionPrices } : {}),
            qty: 1,
            unitPrice,
          },
        ];
      });
      return true;
    } catch (error) {
      console.error(
        "No se pudo agregar el elemento del catálogo a la orden.",
        error,
      );
      toast.error(
        "No se pudo agregar el elemento a la orden. Intenta de nuevo.",
      );
      return false;
    }
  };

  const addCatalogValue = async (type: OrderCatalogType) => {
    const name = catalogName.trim();
    if (!userId || !name || !isAdmin) return;
    setAddingCatalogType(type);
    try {
      const created = await addOrderCatalogItem(type, name, userId);
      if (type === "inspection") {
        setInspectionCatalog((current) =>
          [...current, created].sort(
            (a, b) =>
              a.sort_order - b.sort_order || a.name.localeCompare(b.name),
          ),
        );
        setInspection((current) => ({ ...current, [created.name]: false }));
      } else {
        setAccessoryCatalog((current) =>
          [...current, created].sort(
            (a, b) =>
              a.sort_order - b.sort_order || a.name.localeCompare(b.name),
          ),
        );
        setAccessories((current) => ({ ...current, [created.name]: false }));
      }
      setCatalogName("");
      toast.success("Valor agregado al catálogo.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el catálogo.",
      );
    } finally {
      setAddingCatalogType(null);
    }
  };

  const addInventoryEntry = async () => {
    if (!userId || !isAdmin) return;
    const conditionPrices = {
      price_original: Number(newInventory.price_original),
      price_generic: Number(newInventory.price_generic),
      price_repaired: Number(newInventory.price_repaired),
      price_aftermarket: Number(newInventory.price_aftermarket),
    };
    const isPart = newInventory.item_kind === "part";
    const price = isPart
      ? conditionPrices.price_original
      : Number(newInventory.suggested_price);
    const cost = Number(newInventory.unit_cost);
    if (
      !newInventory.name.trim() ||
      !Number.isFinite(price) ||
      price <= 0 ||
      (isPart &&
        (Object.values(conditionPrices).some(
          (conditionPrice) =>
            !Number.isFinite(conditionPrice) || conditionPrice <= 0,
        ) ||
          !newInventory.brand.trim() ||
          !newInventory.unit_cost.trim() ||
          !Number.isFinite(cost) ||
          cost < 0))
    ) {
      toast.error(
        "Completa nombre, un precio sugerido mayor que cero y marca; para repuestos, agrega también el costo de compra.",
      );
      return;
    }
    setAddingCatalogType(null);
    setBusy(true);
    try {
      const created = await addInventoryCatalogItem({
        item_kind: newInventory.item_kind,
        name: newInventory.name.trim(),
        code: newInventory.code.trim() || null,
        brand:
          newInventory.item_kind === "part" ? newInventory.brand.trim() : null,
        condition:
          newInventory.item_kind === "part" ? newInventory.condition : null,
        category:
          newInventory.item_kind === "part" ? newInventory.category : null,
        fitment: isPart ? newInventory.fitment.trim() || null : null,
        unit_cost: isPart ? cost : 0,
        suggested_price: price,
        ...conditionPrices,
        created_by: userId,
      });
      const added = handleAddCatalogItem({
        ...created,
        stock_quantity: 0,
      });
      if (added) {
        setInventorySearch("");
        setInventoryFocused(false);
        setInventoryResults([]);
      } else {
        setInventorySearch(created.name);
      }
      setShowNewInventory(false);
      setNewInventory({
        item_kind: "part",
        code: "",
        name: "",
        brand: "",
        condition: "new_original",
        category: "mechanical",
        fitment: "",
        unit_cost: "",
        suggested_price: "",
        price_original: "",
        price_generic: "",
        price_repaired: "",
        price_aftermarket: "",
      });
      toast[added ? "success" : "info"](
        added
          ? "Guardado en el catálogo y agregado a la cotización."
          : "Guardado en el catálogo. El repuesto requiere existencias antes de agregarlo a la cotización.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el catálogo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    setAudioError("");
    if (speechListening) {
      setAudioError("Detén el dictado antes de grabar una nota de voz.");
      return;
    }
    if (!audioConsent) {
      setAudioError("Confirma el consentimiento explícito antes de grabar.");
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setAudioError(
        "Este navegador no permite grabar audio. Usa HTTPS y un navegador compatible.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = getRecordingMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setAudioError(
          "La grabación falló. Verifica el micrófono e intenta nuevamente.",
        );
        setRecordingState("idle");
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size > MAX_AUDIO_BYTES) {
          setAudioError(
            "La grabación supera el límite de 20 MB. Graba un audio más corto.",
          );
          setPendingAudio(null);
        } else if (blob.size > 0) {
          setPendingAudio(blob);
          setRecordingState("ready");
        } else {
          setAudioError(
            "No se capturó audio. Comprueba el micrófono e intenta nuevamente.",
          );
          setRecordingState("idle");
        }
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
      };
      recorder.start();
      setRecordingSeconds(0);
      setPendingAudio(null);
      setRecordingState("recording");
      timerRef.current = setInterval(
        () => setRecordingSeconds((seconds) => seconds + 1),
        1000,
      );
    } catch (error) {
      setAudioError(
        error instanceof Error
          ? error.message
          : "No se pudo acceder al micrófono.",
      );
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  };

  const startSpeechDictation = () => {
    setSpeechError("");
    if (recordingState === "recording") {
      setSpeechError(
        "Detén la grabación de audio antes de iniciar el dictado.",
      );
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechAvailable(false);
      setSpeechError(
        "El dictado por voz no está disponible en este navegador.",
      );
      return;
    }

    const recognition = new Recognition();
    baseReportRef.current = reportRef.current ? `${reportRef.current} ` : "";
    recognition.lang = "es-CO";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let sessionTranscript = "";
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        sessionTranscript += result?.[0]?.transcript ?? "";
      }

      const nextReport = (baseReportRef.current + sessionTranscript).slice(
        0,
        5000,
      );
      reportRef.current = nextReport;
      setReport(nextReport);
    };
    recognition.onerror = (event) => {
      const errorMessages: Record<string, string> = {
        "not-allowed": "Permiso de micrófono denegado",
        "service-not-allowed":
          "El servicio de reconocimiento de voz no está permitido",
        "audio-capture": "No se encontró un micrófono",
        "no-speech": "No se detectó voz",
        network: "Error de red con el servicio de voz",
      };
      const message =
        errorMessages[event.error] ??
        `Error de reconocimiento de voz: ${event.error}`;
      if (event.error !== "aborted") {
        setSpeechError(message);
        toast.error(message);
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      setSpeechListening(false);
    };

    recognitionRef.current = recognition;
    setSpeechListening(true);
    try {
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      setSpeechListening(false);
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo iniciar el dictado por voz.";
      setSpeechError(message);
      toast.error(message);
    }
  };

  const stopSpeechDictation = () => {
    try {
      recognitionRef.current?.stop();
    } catch (error) {
      setSpeechError(
        error instanceof Error
          ? error.message
          : "No se pudo detener el dictado por voz.",
      );
      setSpeechListening(false);
      recognitionRef.current = null;
    }
  };

  const uploadPendingAudio = async (
    order: WorkOrder,
    sessionUserId: string,
  ) => {
    if (!pendingAudio) return;
    if (!audioConsent)
      throw new Error(
        "Falta confirmar el consentimiento del cliente para guardar el audio.",
      );
    if (pendingAudio.size > MAX_AUDIO_BYTES)
      throw new Error("El audio supera el límite de 20 MB.");
    const mimeType = pendingAudio.type.split(";")[0] || "audio/webm";
    const extension = mimeType.split("/")[1]?.replace("x-wav", "wav") ?? "webm";
    const storagePath = `${sessionUserId}/${order.number}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("order-audio")
      .upload(storagePath, pendingAudio, {
        contentType: mimeType,
        upsert: false,
      });
    if (uploadError)
      throw new Error(
        `La orden se guardó, pero el audio no se pudo cargar: ${uploadError.message}`,
      );
    try {
      await saveOrderAudioMetadata({
        user_id: sessionUserId,
        order_number: order.number,
        storage_path: storagePath,
        transcript: audioTranscript.trim(),
        mime_type: mimeType,
        duration_seconds: recordingSeconds || null,
        consent_given: true,
        consented_by: sessionUserId,
      });
    } catch (error) {
      const { error: cleanupError } = await supabase.storage
        .from("order-audio")
        .remove([storagePath]);
      if (cleanupError) {
        throw new Error(
          `${error instanceof Error ? error.message : "No se pudo guardar la transcripción."} El archivo temporal también requiere limpieza.`,
        );
      }
      throw error;
    }
    setPendingAudio(null);
    setAudioTranscript("");
    setAudioConsent(false);
    setRecordingState("idle");
  };

  const submit = async () => {
    if (!formValid || !quoteValid) {
      toast.error(
        !formValid
          ? "Corrige los campos obligatorios del paso 1."
          : "Revisa nombre, estado, categoría, cantidad y precio de cada ítem.",
      );
      if (!formValid) setStep(0);
      else setStep(3);
      return;
    }
    if (recordingState === "recording") {
      toast.error("Detén la grabación antes de guardar la orden.");
      return;
    }
    if (speechListening) {
      toast.error("Detén el dictado antes de guardar la orden.");
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      toast.error(
        "No se pudo validar la sesión. Cierra sesión y vuelve a entrar.",
      );
      return;
    }
    if (!data.session) {
      setAccess(true);
      return;
    }
    setBusy(true);
    try {
      const saved = await saveOrder({
        data: {
          number: activeOrder?.number,
          version: activeOrder?.version,
          order: {
            date:
              activeOrder?.date ??
              new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" })
                .format(new Date())
                .replaceAll("-", "/"),
            owner: {
              ...owner,
              name: owner.name.trim(),
              cc: owner.cc.trim(),
              phone: owner.phone.trim(),
              documentType: owner.documentType ?? "CC",
              email: owner.email?.trim() ?? "",
            },
            bike: numericBike,
            technician,
            status: activeOrder?.status ?? "diagnostico",
            report: report.trim(),
            inspection,
            accessories,
            items: items.map((item) => ({
              ...item,
              description: item.description.trim(),
            })),
          },
        },
      });
      if (activeOrder) ordersStore.update(saved);
      else ordersStore.add(saved);
      setActiveOrder(saved);
      await queryClient.invalidateQueries({ queryKey: ["saved-orders"] });
      await queryClient.invalidateQueries({
        queryKey: ["history", saved.number],
      });
      await uploadPendingAudio(saved, data.session.user.id);
      toast.success(
        initial ? "Cambios guardados" : `Orden #${saved.number} creada`,
      );
      navigate({ to: "/orders/$orderId", params: { orderId: saved.number } });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo completar el guardado.",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveTranscript = async (recording: OrderAudioRecording) => {
    setSavingTranscriptId(recording.id);
    try {
      await updateOrderAudioTranscript(
        recording.id,
        recordingTranscripts[recording.id] ?? "",
      );
      toast.success("Transcripción guardada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la transcripción.",
      );
    } finally {
      setSavingTranscriptId(null);
    }
  };

  const removeRecording = async (recording: OrderAudioRecording) => {
    setDeletingRecordingId(recording.id);
    try {
      const { error } = await supabase.storage
        .from("order-audio")
        .remove([recording.storage_path]);
      if (error)
        throw new Error(
          `No se pudo eliminar el archivo de audio: ${error.message}`,
        );
      await deleteOrderAudio(recording.id);
      setRecordings((current) =>
        current.filter((entry) => entry.id !== recording.id),
      );
      toast.success("Audio eliminado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el audio.",
      );
    } finally {
      setDeletingRecordingId(null);
    }
  };

  const toggleCatalog = (type: OrderCatalogType) => {
    if (addingCatalogType === type) {
      setAddingCatalogType(null);
      setCatalogName("");
    } else {
      setAddingCatalogType(type);
      setCatalogName("");
    }
  };

  const renderCatalogEditor = (type: OrderCatalogType) => {
    if (!isAdmin) return null;
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3">
        {addingCatalogType === type ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Nuevo valor para catálogo"
              maxLength={100}
              value={catalogName}
              onChange={(event) => setCatalogName(event.target.value)}
              placeholder="Ej. Carenado rayado"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={!catalogName.trim() || busy}
                onClick={() => void addCatalogValue(type)}
              >
                <Plus /> Agregar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => toggleCatalog(type)}
                aria-label="Cancelar"
              >
                <X />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toggleCatalog(type)}
          >
            <Plus /> Agregar valor al catálogo
          </Button>
        )}
      </div>
    );
  };

  const renderAudioSection = () => (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-primary/10 p-2 text-primary">
          <AudioLines className="size-5" />
        </span>
        <div>
          <h3 className="font-semibold">Nota de voz del cliente</h3>
          <p className="text-sm text-muted-foreground">
            El audio queda privado en Supabase. La nota de voz no se transcribe
            automáticamente; usa el dictado por voz para escribir en el reporte.
          </p>
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
        <Checkbox
          checked={audioConsent}
          onCheckedChange={(checked) => setAudioConsent(checked === true)}
        />
        <span>
          Confirmo que el cliente autorizó expresamente la grabación y el
          almacenamiento de su voz.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {recordingState === "recording" ? (
          <Button type="button" variant="destructive" onClick={stopRecording}>
            <Square /> Detener · {Math.floor(recordingSeconds / 60)}:
            {String(recordingSeconds % 60).padStart(2, "0")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={!audioConsent || busy || speechListening}
            onClick={() => void startRecording()}
          >
            <Mic />{" "}
            {recordingState === "ready" ? "Grabar de nuevo" : "Grabar audio"}
          </Button>
        )}
        {speechListening && (
          <p className="text-sm text-muted-foreground">
            Detén el dictado antes de grabar una nota de voz.
          </p>
        )}
        {pendingAudio && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPendingAudio(null);
              setRecordingState("idle");
              setRecordingSeconds(0);
            }}
          >
            <Trash2 /> Descartar grabación
          </Button>
        )}
      </div>
      {audioError && (
        <p role="alert" className="text-sm text-destructive">
          {audioError}
        </p>
      )}
      {pendingAudio && (
        <div className="space-y-3 rounded-md bg-muted/50 p-3">
          <audio controls src={audioBlobUrl} className="w-full" />
          <Field
            label="Transcripción revisada"
            help="Escribe el relato del cliente. El audio no se transcribe automáticamente."
          >
            <Textarea
              value={audioTranscript}
              maxLength={5000}
              rows={3}
              onChange={(event) => setAudioTranscript(event.target.value)}
              placeholder="Transcribe el relato después de escuchar la grabación…"
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            {(pendingAudio.size / (1024 * 1024)).toFixed(1)} MB · Se almacenará
            al guardar la orden y conservará el consentimiento registrado.
          </p>
        </div>
      )}
      {audioError && recordings.length === 0 && activeOrder && (
        <p role="alert" className="text-sm text-destructive">
          {audioError}
        </p>
      )}
      {recordings.length > 0 && (
        <div className="space-y-3 border-t border-border pt-4">
          <h4 className="text-sm font-semibold">Audios guardados</h4>
          {recordings.map((recording) => (
            <div
              key={recording.id}
              className="space-y-3 rounded-md border border-border p-3"
            >
              {recordingUrls[recording.id] ? (
                <audio
                  controls
                  src={recordingUrls[recording.id]}
                  className="w-full"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Preparando reproducción privada…
                </p>
              )}
              <Textarea
                aria-label="Transcripción de audio guardado"
                maxLength={5000}
                rows={3}
                value={recordingTranscripts[recording.id] ?? ""}
                onChange={(event) =>
                  setRecordingTranscripts((current) => ({
                    ...current,
                    [recording.id]: event.target.value,
                  }))
                }
                placeholder="Transcripción revisada del cliente"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingTranscriptId === recording.id}
                  onClick={() => void saveTranscript(recording)}
                >
                  <Check /> Guardar transcripción
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={deletingRecordingId === recording.id}
                  onClick={() => void removeRecording(recording)}
                >
                  <Trash2 /> Eliminar audio
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const itemInputs = (item: QuoteItem, stockQuantity?: number) => ({
    condition: (
      <select
        aria-label={`Estado / tipo de ${item.description || "repuesto"}`}
        value={
          item.kind === "service"
            ? "service"
            : (item.condition ?? "Nueva Original")
        }
        disabled={item.kind === "service"}
        onChange={(event) => {
          if (item.kind !== "service") {
            const condition = event.target.value as PartCondition;
            const configuredPrice = item.conditionPrices?.[condition];
            updateItem(item.id, {
              condition,
              ...(configuredPrice !== undefined
                ? { unitPrice: configuredPrice }
                : {}),
            });
          }
        }}
        className="h-10 w-full min-w-[150px] rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 disabled:cursor-not-allowed disabled:opacity-80"
      >
        {item.kind === "service" ? (
          <option value="service">Mano de obra</option>
        ) : (
          PART_CONDITIONS.map((condition) => (
            <option key={condition} value={condition}>
              {condition}
            </option>
          ))
        )}
      </select>
    ),
    qty: (
      <Input
        aria-label={`Cantidad de ${item.description || "elemento"}`}
        type="number"
        min={1}
        max={
          item.kind !== "service" && stockQuantity !== undefined
            ? Math.min(1000, stockQuantity)
            : 1000
        }
        step={1}
        value={item.qty}
        className="h-10 w-16 min-w-0 px-1 text-center tabular-nums"
        onChange={(event) =>
          updateItemQuantity(item, Number(event.target.value))
        }
      />
    ),
    price: (
      <Input
        aria-label={`Valor unitario de ${item.description || "elemento"}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={1_000_000_000}
        step={1}
        value={item.unitPrice}
        className="h-10 w-32 min-w-0 px-2 text-right tabular-nums"
        onChange={(event) =>
          updateItem(item.id, {
            unitPrice: toFiniteNumber(event.target.value),
          })
        }
      />
    ),
    remove: (
      <Hint text="Quitar este elemento de la cotización">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() =>
            setItems((current) =>
              current.filter((entry) => entry.id !== item.id),
            )
          }
          aria-label={`Eliminar ${item.description || "elemento"}`}
        >
          <Trash2 />
        </Button>
      </Hint>
    ),
  });

  const selectableConditions = [
    "Nueva Original",
    "Nueva Genérica",
    "Reparada",
  ] as const;
  const safeItems = items.map((item) => {
    const quantity = toFiniteNumber(item.qty, 1);
    const price = toFiniteNumber(item.unitPrice);
    return {
      ...item,
      id: typeof item.id === "string" ? item.id : "",
      kind: item.kind === "service" ? "service" : "part",
      description: typeof item.description === "string" ? item.description : "",
      ...(typeof item.code === "string" ? { code: item.code } : {}),
      brand: typeof item.brand === "string" ? item.brand : "",
      condition:
        selectableConditions.find(
          (condition) => condition === item.condition,
        ) ?? "Nueva Original",
      category:
        PART_CATEGORIES.find((category) => category === item.category) ??
        "Mecánica",
      qty: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
      unitPrice: price,
    } satisfies QuoteItem;
  });

  return (
    <div className="mx-auto max-w-5xl">
      <SaveAccess open={access} onOpenChange={setAccess} />
      <div className="relative mb-6 pt-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[12.5%] top-0 z-20 -translate-x-1/2 text-orange-500 transition-[left] duration-500 ease-out motion-reduce:transition-none"
          style={{ left: `${12.5 + step * 25}%` }}
        >
          <Bike className="size-5 animate-pulse" />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-11 h-0.5 bg-muted"
        >
          <span
            className="block h-full bg-orange-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
        <ol
          aria-label="Pasos del formulario"
          className="relative grid grid-cols-4 gap-1"
        >
          {STEPS.map((title, index) => (
            <li key={title} className="min-w-0">
              <Button
                type="button"
                variant="ghost"
                disabled={busy || (index > 0 && !stepValid[0])}
                aria-current={index === step ? "step" : undefined}
                onClick={() => setStep(index)}
                className="h-auto min-h-16 w-full flex-col justify-start gap-1 whitespace-normal px-0 py-0 text-center hover:bg-transparent"
              >
                <span className="relative z-10 flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold text-muted-foreground">
                  <span
                    className={cn(
                      "flex size-full items-center justify-center rounded-full border-2 transition-colors",
                      index <= step
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-muted-foreground/30 bg-background text-muted-foreground",
                    )}
                  >
                    {index < step ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                </span>
                <span
                  className={cn(
                    "max-w-full text-[11px] leading-tight sm:text-xs",
                    index === step
                      ? "font-bold text-orange-500"
                      : "text-muted-foreground",
                  )}
                >
                  {title}
                </span>
              </Button>
            </li>
          ))}
        </ol>
      </div>

      <section className="rounded-lg border-y border-border bg-background py-5 sm:border sm:px-6 sm:py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <h2 className="font-sans text-xl font-semibold tracking-tight">
              {STEPS[step]}
            </h2>
            <Help
              label={STEPS[step] ?? ""}
              text={
                [
                  "Identifica al cliente y registra la información de la motocicleta. Los campos con * son obligatorios.",
                  "Registra el relato del cliente y los daños visibles al recibir la moto.",
                  "Marca Sí solo en los elementos que acompañan la motocicleta.",
                  "Busca cada pieza por código, nombre o marca. El precio sugerido se puede modificar para esta orden.",
                ][step] ?? ""
              }
            />
          </div>
          {step === 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-muted-foreground">
                Ingresa la información básica del propietario y la motocicleta
                para iniciar la orden de servicio.
              </p>
              <p className="text-xs text-muted-foreground">
                Los campos marcados con (
                <span className="font-bold text-orange-500">*</span>) son
                obligatorios.
              </p>
            </div>
          )}
        </div>

        {catalogError && userId && (
          <p
            role="alert"
            className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {catalogError}
          </p>
        )}
        {!sessionReady && (
          <p role="status" className="mb-4 text-sm text-muted-foreground">
            Verificando acceso a los catálogos…
          </p>
        )}
        {sessionReady && !userId && (
          <p className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Completa el formulario y luego inicia sesión para guardar la orden y
            cargar los catálogos.
          </p>
        )}

        {step === 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-5 rounded-lg border border-border p-4">
              <h3 className="border-b border-border pb-2 font-bold text-foreground">
                Cliente
              </h3>
              <Field
                label="Nombre completo *"
                help="Nombre legal del propietario o responsable."
              >
                <Input
                  aria-label="Nombre completo"
                  autoComplete="name"
                  maxLength={120}
                  value={owner.name}
                  onChange={(event) =>
                    setOwner({ ...owner, name: event.target.value })
                  }
                  aria-invalid={owner.name.trim().length < 2}
                />
                {owner.name.trim().length < 2 && (
                  <p className="text-xs text-muted-foreground">
                    Escribe al menos dos caracteres.
                  </p>
                )}
              </Field>
              <div className="grid grid-cols-[minmax(100px,0.4fr)_1fr] gap-4">
                <Field label="Tipo *" help="Tipo de documento.">
                  <Select
                    value={owner.documentType ?? "CC"}
                    onValueChange={(value) =>
                      setOwner({
                        ...owner,
                        documentType: value as NonNullable<
                          WorkOrderOwner["documentType"]
                        >,
                      })
                    }
                  >
                    <SelectTrigger aria-label="Tipo de documento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Número de documento *"
                  help="Identificación del propietario o responsable."
                >
                  <Input
                    aria-label="Número de documento"
                    autoComplete="off"
                    maxLength={30}
                    value={owner.cc}
                    onChange={(event) =>
                      setOwner({ ...owner, cc: event.target.value })
                    }
                    aria-invalid={owner.cc.trim().length < 3}
                  />
                  {owner.cc.trim().length < 3 && (
                    <p className="text-xs text-muted-foreground">
                      Ingresa al menos tres caracteres.
                    </p>
                  )}
                </Field>
              </div>
              <Field
                label="Teléfono de contacto *"
                help="Número para autorizar y coordinar el servicio."
              >
                <Input
                  aria-label="Teléfono de contacto"
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                  value={owner.phone}
                  onChange={(event) =>
                    setOwner({ ...owner, phone: event.target.value })
                  }
                  aria-invalid={!phoneValid}
                />
                {!phoneValid && (
                  <p className="text-xs text-muted-foreground">
                    Ingresa al menos 7 caracteres para contacto.
                  </p>
                )}
              </Field>
              <Field
                label="Correo electrónico"
                help="Opcional; permite enviar cotizaciones y avisos."
              >
                <Input
                  aria-label="Correo electrónico"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={owner.email ?? ""}
                  onChange={(event) =>
                    setOwner({ ...owner, email: event.target.value })
                  }
                  aria-invalid={
                    !!owner.email &&
                    !orderDataSchema.shape.owner.shape.email.safeParse(
                      owner.email,
                    ).success
                  }
                />
                {!!owner.email &&
                  !orderDataSchema.shape.owner.shape.email.safeParse(
                    owner.email,
                  ).success && (
                    <p className="text-xs text-destructive">
                      Revisa el formato del correo electrónico.
                    </p>
                  )}
              </Field>
            </div>

            <div className="space-y-5 rounded-lg border border-border p-4">
              <h3 className="border-b border-border pb-2 font-bold text-foreground">
                Motocicleta
              </h3>
              <Field
                label="Placa *"
                help="Ingresa de 5 a 10 caracteres; se quitan espacios extremos y se normaliza a mayúsculas al guardar."
              >
                <Input
                  aria-label="Placa"
                  className="uppercase"
                  autoComplete="off"
                  maxLength={10}
                  value={bike.plate}
                  onChange={(event) =>
                    setBike({
                      ...bike,
                      plate: event.target.value.toUpperCase(),
                    })
                  }
                  aria-invalid={!plateValid}
                />
                {!plateValid && (
                  <p className="text-xs text-destructive">
                    La placa debe tener entre 5 y 10 caracteres.
                  </p>
                )}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Marca *" help="Ej. KTM, Yamaha, BMW.">
                  <Input
                    aria-label="Marca"
                    maxLength={60}
                    value={bike.brand}
                    onChange={(event) =>
                      setBike({ ...bike, brand: event.target.value })
                    }
                    aria-invalid={!bikeBrandValid}
                  />
                  {!bikeBrandValid && (
                    <p className="text-xs text-destructive">
                      Escribe la marca de la motocicleta.
                    </p>
                  )}
                </Field>
                <Field
                  label="Referencia / modelo *"
                  help="Ej. Duke 390, MT-09, G 310 GS."
                >
                  <Input
                    aria-label="Referencia o modelo"
                    maxLength={100}
                    value={bike.model}
                    onChange={(event) =>
                      setBike({ ...bike, model: event.target.value })
                    }
                    aria-invalid={!bikeModelValid}
                  />
                  {!bikeModelValid && (
                    <p className="text-xs text-destructive">
                      Escribe la referencia o modelo.
                    </p>
                  )}
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Año modelo" help="Entre 1950 y el próximo año.">
                  <Input
                    aria-label="Año modelo"
                    type="number"
                    min={1950}
                    max={new Date().getFullYear() + 1}
                    step={1}
                    value={bike.year}
                    onChange={(event) =>
                      setBike({ ...bike, year: event.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Kilometraje *"
                  help="Lectura actual del odómetro."
                >
                  <Input
                    aria-label="Kilometraje"
                    type="number"
                    min={0}
                    max={2_000_000}
                    step={1}
                    value={bike.km}
                    onChange={(event) =>
                      setBike({ ...bike, km: event.target.value })
                    }
                    aria-invalid={!mileageValid}
                  />
                  {!mileageValid && (
                    <p className="text-xs text-destructive">
                      Ingresa un kilometraje numérico entre 0 y 2.000.000.
                    </p>
                  )}
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="VIN / chasis"
                  help="Número de identificación del chasis; opcional."
                >
                  <Input
                    aria-label="VIN o chasis"
                    maxLength={32}
                    value={bike.vin}
                    onChange={(event) =>
                      setBike({
                        ...bike,
                        vin: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </Field>
                <Field
                  label="Número de motor"
                  help="Identificador del motor; opcional."
                >
                  <Input
                    aria-label="Número de motor"
                    maxLength={32}
                    value={bike.engineNumber}
                    onChange={(event) =>
                      setBike({
                        ...bike,
                        engineNumber: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </Field>
              </div>
              <Field
                label="Técnico encargado *"
                help="Responsable del diagnóstico y servicio."
              >
                <Select value={technician} onValueChange={setTechnician}>
                  <SelectTrigger aria-label="Técnico encargado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TECHNICIANS.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!technicianValid && (
                  <p className="text-xs text-destructive">
                    Selecciona un técnico encargado.
                  </p>
                )}
              </Field>
              {!bikeValid && (
                <p role="alert" className="text-xs text-destructive">
                  Completa placa, marca, referencia y kilometraje. El año es
                  opcional.
                </p>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <Field
              label="Reporte del cliente / diagnóstico inicial"
              help="Describe síntomas, cuándo ocurren y qué solicita el cliente. Máximo 5.000 caracteres."
            >
              <Textarea
                aria-label="Reporte del cliente"
                maxLength={5000}
                rows={5}
                value={report}
                onChange={(event) => {
                  const editedReport = event.target.value;
                  const recognition = recognitionRef.current;
                  if (recognition && speechListening) {
                    recognition.onresult = null;
                    recognition.onerror = null;
                    recognition.onend = null;
                    recognition.stop();
                    recognitionRef.current = null;
                    setSpeechListening(false);
                  }
                  reportRef.current = editedReport;
                  setReport(editedReport);
                }}
                placeholder="Ej. Ruido al frenar en frío desde hace dos días…"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={speechListening}
                  disabled={
                    !speechAvailable || recordingState === "recording" || busy
                  }
                  onClick={
                    speechListening ? stopSpeechDictation : startSpeechDictation
                  }
                  className={cn(
                    "min-h-11",
                    speechListening &&
                      "animate-pulse border-orange-500 bg-orange-500/10 text-orange-500 hover:bg-orange-500/15",
                  )}
                >
                  <Mic
                    className={cn("size-4", speechListening && "animate-pulse")}
                  />
                  {speechListening ? "Detener dictado" : "Dictar por voz"}
                </Button>
                {report.trim().length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const recognition = recognitionRef.current;
                      if (recognition) {
                        recognition.onresult = null;
                        recognition.onerror = null;
                        recognition.onend = null;
                        recognitionRef.current = null;
                        setSpeechListening(false);
                        try {
                          recognition.stop();
                        } catch (error) {
                          const message =
                            error instanceof Error
                              ? error.message
                              : "No se pudo detener el dictado por voz.";
                          setSpeechError(message);
                          toast.error(message);
                        }
                      }
                      reportRef.current = "";
                      baseReportRef.current = "";
                      setReport("");
                    }}
                    className="min-h-11 text-muted-foreground"
                  >
                    <Eraser className="size-4" />
                    Limpiar texto
                  </Button>
                )}
                {speechListening && (
                  <span
                    role="status"
                    className="text-sm font-medium text-orange-500"
                  >
                    Escuchando…
                  </span>
                )}
                {!speechAvailable && (
                  <span className="text-sm text-muted-foreground">
                    Dictado no compatible con este navegador.
                  </span>
                )}
              </div>
              {speechError && (
                <p role="alert" className="text-sm text-destructive">
                  {speechError}
                </p>
              )}
              <p className="text-right text-xs text-muted-foreground">
                {report.length} / 5000
              </p>
            </Field>
            {renderAudioSection()}
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Novedades de ingreso</h3>
                  <p className="text-sm text-muted-foreground">
                    Marca cada daño visible y su ubicación en observaciones del
                    reporte.
                  </p>
                </div>
                {catalogLoading && (
                  <span className="text-xs text-muted-foreground">
                    Cargando catálogo…
                  </span>
                )}
              </div>
              <ToggleList
                items={inspectionNames}
                value={inspection}
                onChange={setInspection}
              />
              {renderCatalogEditor("inspection")}
            </div>
            {activeOrder && audioError && (
              <p role="alert" className="text-sm text-destructive">
                {audioError}
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Registra lo que el cliente deja físicamente con la motocicleta.
              Marca Sí únicamente después de verificarlo.
            </p>
            {catalogLoading && (
              <p role="status" className="text-xs text-muted-foreground">
                Cargando catálogo…
              </p>
            )}
            <ToggleList
              items={accessoryNames}
              value={accessories}
              onChange={setAccessories}
            />
            {renderCatalogEditor("accessory")}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Field
                    label="Buscar repuesto o servicio"
                    help="Busca por nombre, código OEM, marca o compatibilidad; escribe al menos dos caracteres o enfoca para ver sugerencias recientes."
                  >
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        aria-label="Buscar repuesto por código, nombre o marca"
                        className="border-input bg-muted/40 pl-9 transition-colors hover:bg-muted/60 focus-visible:bg-background"
                        value={inventorySearch}
                        onChange={(event) => {
                          setInventorySearch(event.target.value);
                          setInventorySelectionNotice("");
                        }}
                        onFocus={() => setInventoryFocused(true)}
                        onBlur={() => setInventoryFocused(false)}
                        placeholder="Ej. filtro de aceite, 90138015000, KTM"
                      />
                    </div>
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0"
                  onClick={addManualService}
                >
                  <Plus /> Agregar Mano de Obra / Servicio
                </Button>
              </div>
              {inventorySelectionNotice && (
                <p
                  role="status"
                  className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
                >
                  {inventorySelectionNotice}
                </p>
              )}
              {inventoryLoading && (
                <p role="status" className="mt-3 text-sm text-muted-foreground">
                  Buscando en el catálogo…
                </p>
              )}
              {inventoryError && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {inventoryError}
                </p>
              )}
              {inventoryLoginRequired && (
                <div
                  role="alert"
                  className="mt-3 flex flex-col gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p>
                    Sesión expirada o no iniciada. Inicia sesión para consultar
                    el inventario
                  </p>
                  <Button asChild type="button" variant="outline">
                    <a href="/login">Iniciar sesión</a>
                  </Button>
                </div>
              )}
              {inventorySearch.trim().length >= 2 &&
                !inventoryLoading &&
                !inventoryError &&
                inventoryResults.length === 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No encontramos coincidencias.{" "}
                    {isAdmin
                      ? "Puedes crear el elemento y agregarlo a esta orden."
                      : "Solicita al administrador que lo agregue al catálogo."}
                  </p>
                )}
              {inventoryResults.length > 0 &&
                (inventoryFocused || inventorySearch.trim().length >= 2) && (
                  <ul className="mt-3 divide-y overflow-hidden rounded-lg border border-border bg-card">
                    {inventoryResults.map((entry) => {
                      const stock = toFiniteNumber(entry.stock_quantity);
                      const physicalStock = toFiniteNumber(
                        entry.stock_physical,
                      );
                      const reservedStock = toFiniteNumber(
                        entry.stock_reserved,
                      );
                      const isUnavailable =
                        entry.item_kind !== "service" && stock <= 0;
                      const isReserved =
                        isUnavailable && physicalStock > 0 && reservedStock > 0;
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              if (handleAddCatalogItem(entry)) {
                                setInventorySearch("");
                                setInventoryFocused(false);
                                setInventoryResults([]);
                              }
                            }}
                            aria-disabled={isUnavailable}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                              isUnavailable
                                ? "cursor-not-allowed opacity-60"
                                : "hover:bg-accent/50",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                {entry.name}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {[
                                  entry.code ? `Código OEM: ${entry.code}` : "",
                                  entry.brand,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                              {entry.fitment && (
                                <span className="block text-xs text-muted-foreground">
                                  Compatible: {entry.fitment}
                                </span>
                              )}
                              <span
                                className={cn(
                                  "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                                  isUnavailable
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {entry.item_kind === "service"
                                  ? "Servicio · stock no aplica"
                                  : isReserved
                                    ? "Reservado (0 disp.)"
                                    : isUnavailable
                                      ? "Sin stock (0 disp.)"
                                      : `${stock} disponibles`}
                              </span>
                              {entry.item_kind === "part" &&
                                reservedStock > 0 && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {physicalStock} físicos · {reservedStock}{" "}
                                    reservados en otras órdenes activas
                                  </span>
                                )}
                              {entry.item_kind === "part" &&
                                entry.condition && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {CONDITION_LABELS[entry.condition]}
                                    {entry.category
                                      ? ` · ${CATEGORY_LABELS[entry.category]}`
                                      : ""}
                                  </span>
                                )}
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block font-mono text-sm font-semibold">
                                {formatCOP(Number(entry.suggested_price))}
                              </span>
                              <span className="block text-[10px] text-muted-foreground">
                                Precio base
                              </span>
                              <span
                                className={cn(
                                  "text-xs",
                                  isUnavailable
                                    ? "text-muted-foreground"
                                    : "text-primary",
                                )}
                              >
                                {isUnavailable ? "No disponible" : "Agregar"}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              {isAdmin && (
                <div className="mt-4 border-t border-border pt-4">
                  {!showNewInventory ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewInventory(true)}
                    >
                      <Plus /> Crear repuesto o servicio en catálogo
                    </Button>
                  ) : (
                    <div className="space-y-4 rounded-md bg-muted/30 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">
                          Nuevo elemento de catálogo
                        </h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowNewInventory(false)}
                          aria-label="Cerrar formulario"
                        >
                          <X />
                        </Button>
                      </div>
                      <Select
                        value={newInventory.item_kind}
                        onValueChange={(value) =>
                          setNewInventory({
                            ...newInventory,
                            item_kind: value as "part" | "service",
                          })
                        }
                      >
                        <SelectTrigger aria-label="Tipo de elemento">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="part">Repuesto</SelectItem>
                          <SelectItem value="service">
                            Servicio / mano de obra
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field
                          label="Nombre *"
                          help="Nombre reconocible en la búsqueda."
                        >
                          <Input
                            maxLength={160}
                            value={newInventory.name}
                            onChange={(event) =>
                              setNewInventory({
                                ...newInventory,
                                name: event.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field
                          label="Código"
                          help="Código OEM o interno; opcional."
                        >
                          <Input
                            maxLength={80}
                            value={newInventory.code}
                            onChange={(event) =>
                              setNewInventory({
                                ...newInventory,
                                code: event.target.value,
                              })
                            }
                          />
                        </Field>
                        {newInventory.item_kind === "part" && (
                          <>
                            <Field
                              label="Marca *"
                              help="Marca del fabricante o alternativa."
                            >
                              <Input
                                maxLength={100}
                                value={newInventory.brand}
                                onChange={(event) =>
                                  setNewInventory({
                                    ...newInventory,
                                    brand: event.target.value,
                                  })
                                }
                              />
                            </Field>
                            <Field
                              label="Costo unitario (COP) *"
                              help="Costo de compra interno; no se muestra en la cotización."
                            >
                              <CurrencyInput
                                value={newInventory.unit_cost}
                                onValueChange={(unit_cost) =>
                                  setNewInventory({
                                    ...newInventory,
                                    unit_cost,
                                  })
                                }
                              />
                            </Field>
                            <Field
                              label="Estado *"
                              help="Condición de la pieza ofertada."
                            >
                              <Select
                                value={newInventory.condition}
                                onValueChange={(value) =>
                                  setNewInventory({
                                    ...newInventory,
                                    condition: value as InventoryCondition,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="new_original">
                                    Nueva Original
                                  </SelectItem>
                                  <SelectItem value="new_generic">
                                    Nueva Genérica
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
                            <Field
                              label="Categoría *"
                              help="Clasificación mecánica, eléctrica o de lujo."
                            >
                              <Select
                                value={newInventory.category}
                                onValueChange={(value) =>
                                  setNewInventory({
                                    ...newInventory,
                                    category: value as InventoryCategory,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="mechanical">
                                    Mecánica
                                  </SelectItem>
                                  <SelectItem value="electrical">
                                    Eléctrica
                                  </SelectItem>
                                  <SelectItem value="luxury">Lujo</SelectItem>
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field
                              label="Motos compatibles"
                              help="Escribe modelos o marcas compatibles, o indica Universal si aplica."
                            >
                              <Input
                                maxLength={240}
                                value={newInventory.fitment}
                                onChange={(event) =>
                                  setNewInventory({
                                    ...newInventory,
                                    fitment: event.target.value,
                                  })
                                }
                                placeholder="Ej. Boxer CT100 o Universal"
                              />
                            </Field>
                          </>
                        )}
                        {newInventory.item_kind === "part" ? (
                          CONDITION_PRICE_INPUTS.map(([key, label]) => (
                            <Field
                              key={key}
                              label={`${label} (COP) *`}
                              help="Precio base de venta para esta condición."
                            >
                              <CurrencyInput
                                aria-label={label}
                                value={newInventory[key]}
                                onValueChange={(value) =>
                                  setNewInventory((current) => ({
                                    ...current,
                                    [key]: value,
                                  }))
                                }
                              />
                            </Field>
                          ))
                        ) : (
                          <Field
                            label="Precio sugerido (COP) *"
                            help="Precio de referencia del taller; cada cotización puede ajustarlo."
                          >
                            <CurrencyInput
                              value={newInventory.suggested_price}
                              onValueChange={(suggested_price) =>
                                setNewInventory({
                                  ...newInventory,
                                  suggested_price,
                                })
                              }
                            />
                          </Field>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          disabled={
                            busy ||
                            !newInventory.name.trim() ||
                            !newInventory.suggested_price.trim()
                          }
                          onClick={() => void addInventoryEntry()}
                        >
                          <Plus /> Guardar y agregar a orden
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {safeItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <p className="font-medium">
                  Aún no agregas repuestos ni servicios
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Busca un elemento arriba o créalo en el catálogo si eres
                  administrador.
                </p>
              </div>
            ) : (
              <div
                aria-label="Ítems de la cotización"
                className="overflow-x-auto rounded-lg border border-border bg-card"
              >
                <table className="w-full min-w-[860px] table-fixed border-collapse">
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[21%]" />
                    <col className="w-[9%]" />
                    <col className="w-[15%]" />
                    <col className="w-[17%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <thead className="bg-muted/50">
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="whitespace-nowrap px-4 py-3">
                        Descripción
                      </th>
                      <th className="whitespace-nowrap px-3 py-3">
                        Estado / tipo
                      </th>
                      <th className="whitespace-nowrap px-2 py-3 text-center">
                        Cant
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 text-right">
                        V. unitario
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 text-right">
                        Subtotal
                      </th>
                      <th className="whitespace-nowrap px-2 py-3 text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeItems.map((safeItem, index) => {
                      const stockValue = safeItem.catalogId
                        ? inventoryStockById[safeItem.catalogId]
                        : undefined;
                      const stockQuantity =
                        stockValue === undefined
                          ? undefined
                          : toFiniteNumber(stockValue);
                      const fields = itemInputs(safeItem, stockQuantity);
                      return (
                        <tr
                          key={safeItem.id}
                          className="whitespace-nowrap border-b border-border last:border-b-0 hover:bg-muted/20"
                        >
                          <td className="max-w-0 px-4 py-2 align-middle">
                            <h3 className="truncate font-sans text-sm font-semibold text-foreground">
                              {safeItem.description || `Ítem ${index + 1}`}
                            </h3>
                            <p className="truncate text-xs text-muted-foreground">
                              {[safeItem.code, safeItem.brand]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </td>
                          <td className="px-3 py-2 align-middle">
                            {fields.condition}
                          </td>
                          <td className="px-2 py-2 align-middle">
                            {fields.qty}
                          </td>
                          <td className="px-3 py-2 align-middle">
                            {fields.price}
                          </td>
                          <td className="px-3 py-2 text-right align-middle font-mono text-sm font-semibold tabular-nums text-foreground">
                            {formatCOP(safeItem.qty * safeItem.unitPrice)}
                          </td>
                          <td className="px-2 py-2 text-right align-middle">
                            {fields.remove}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-end justify-between border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {safeItems.length} {safeItems.length === 1 ? "ítem" : "ítems"} ·
                precios editables
              </p>
              <div className="text-right">
                <span className="text-sm text-muted-foreground">
                  Total de la cotización
                </span>
                <div className="font-display text-3xl font-bold text-primary">
                  {formatCOP(orderTotal({ items: safeItems }))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 z-10 mb-2 mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-border bg-background/95 px-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:flex sm:justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            step > 0
              ? setStep(step - 1)
              : navigate({
                  to: activeOrder ? "/orders/$orderId" : "/",
                  params: activeOrder ? { orderId: activeOrder.number } : {},
                })
          }
        >
          <ChevronLeft />
          {step ? "Anterior" : "Cancelar"}
        </Button>
        {step < 3 ? (
          <Button
            type="button"
            variant="race"
            disabled={busy || (step === 0 && !stepValid[0])}
            onClick={() => setStep(step + 1)}
          >
            Siguiente <ChevronRight />
          </Button>
        ) : (
          <Button
            type="button"
            variant="race"
            disabled={busy || !quoteValid || !formValid}
            onClick={() => void submit()}
          >
            <Check />
            {busy
              ? "Guardando…"
              : activeOrder
                ? "Guardar cambios"
                : "Crear orden"}
          </Button>
        )}
      </div>
    </div>
  );
}
