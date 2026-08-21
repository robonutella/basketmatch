import { z } from "zod";

export const EntityIdSchema = z.string().trim().min(1).max(160);
export const UtcDateTimeSchema = z.string()
  .datetime({ offset: true })
  .refine(value => value.endsWith("Z"), "Timestamp must be expressed in UTC with a trailing Z");
export const CurrencyCodeSchema = z.literal("USD");
export const MoneyCentsSchema = z.number().int().nonnegative().safe();
export const BasisPointsSchema = z.number().int().min(0).max(10_000);

export type EntityId = z.infer<typeof EntityIdSchema>;
export type UtcDateTime = z.infer<typeof UtcDateTimeSchema>;
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;
export type MoneyCents = z.infer<typeof MoneyCentsSchema>;
export type BasisPoints = z.infer<typeof BasisPointsSchema>;
