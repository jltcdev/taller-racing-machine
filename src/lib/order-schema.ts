import { z } from "zod";
import { PART_CATEGORIES, PART_CONDITIONS } from "./orders";

const optionalEmail = z.union([z.string().email(), z.literal("")]).optional();

export const orderDataSchema = z.object({
  date: z.string().min(1),
  owner: z.object({
    name: z.string().trim().min(2).max(120),
    cc: z.string().trim().min(3).max(30),
    phone: z.string().trim().max(30).default(""),
    documentType: z
      .enum(["CC", "CE", "NIT", "Pasaporte", "Otro"])
      .default("CC"),
    email: optionalEmail,
  }),
  bike: z.object({
    plate: z.string().trim().min(5).max(10),
    model: z.string().trim().min(1).max(100),
    brand: z.string().trim().min(1).max(60).optional(),
    year: z
      .number()
      .int()
      .min(1950)
      .max(new Date().getFullYear() + 1)
      .optional(),
    vin: z.string().trim().max(32).optional(),
    engineNumber: z.string().trim().max(32).optional(),
    km: z.number().finite().nonnegative().max(2_000_000),
  }),
  technician: z.string().trim().min(1).max(120),
  status: z.enum([
    "diagnostico",
    "reparacion",
    "lista",
    "entregada",
    "finalizada",
    "cancelada",
  ]),
  report: z.string().max(5000),
  inspection: z.record(z.boolean()),
  accessories: z.record(z.boolean()),
  items: z
    .array(
      z
        .object({
          id: z.string(),
          catalogId: z.string().optional(),
          kind: z.enum(["part", "service"]).optional(),
          code: z.string().optional(),
          description: z.string().trim().min(1).max(160),
          brand: z.string().optional(),
          condition: z
            .enum([...PART_CONDITIONS, "Repuesto de Lujo"])
            .optional(),
          conditionPrices: z
            .record(
              z.enum([...PART_CONDITIONS, "Repuesto de Lujo"]),
              z.number().finite().nonnegative().max(1_000_000_000),
            )
            .optional(),
          category: z.enum(PART_CATEGORIES).optional(),
          partType: z.enum(["Pieza de Repuesto", "Pieza de Lujo"]).optional(),
          qty: z.number().int().positive().max(1000),
          unitPrice: z.number().finite().nonnegative().max(1_000_000_000),
        })
        .superRefine((item, ctx) => {
          if (
            item.kind === "part" &&
            (!item.condition || !item.category || !item.brand?.trim())
          ) {
            ctx.addIssue({
              code: "custom",
              message: "Cada repuesto requiere estado, categoría y marca.",
            });
          }
        }),
    )
    .max(100),
});
