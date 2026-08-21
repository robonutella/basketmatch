import { z } from "zod";
import {
  CurrencyCodeSchema,
  EntityIdSchema,
  MoneyCentsSchema,
  UtcDateTimeSchema
} from "./shared.js";

export const UpcSchema = z.string().regex(
  /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/,
  "UPC/GTIN must contain 8, 12, 13, or 14 digits"
);

export const ProductSchema = z.object({
  id: EntityIdSchema,
  storeId: EntityIdSchema,
  name: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).default([]),
  category: z.string().trim().min(1),
  brand: z.string().trim().min(1).optional(),
  upc: UpcSchema.optional(),
  size: z.string().trim().min(1).optional(),
  priceCents: MoneyCentsSchema,
  currency: CurrencyCodeSchema,
  observedAt: UtcDateTimeSchema.optional(),
  available: z.boolean().default(true)
});

export type Product = z.infer<typeof ProductSchema>;
