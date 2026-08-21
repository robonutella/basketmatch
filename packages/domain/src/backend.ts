import { z } from "zod";
import { BasketOptimizationResultSchema, BasketPlanSchema } from "./basket.js";
import { GroceryListItemSchema, GroceryListSchema } from "./grocery-list.js";
import { ReceiptSchema } from "./receipt.js";
import { EntityIdSchema, MoneyCentsSchema, UtcDateTimeSchema } from "./shared.js";

export const AuthProviderSchema = z.enum(["email_magic_link", "apple", "google"]);

export const SavedGroceryListInputSchema = z.object({
  id: EntityIdSchema.optional(),
  title: z.string().trim().min(1).max(160).default("My grocery list"),
  items: z.array(GroceryListItemSchema),
  includeRebates: z.boolean().default(true),
  verifiedOffersOnly: z.boolean().default(true),
  maxStores: z.number().int().min(1).max(10).default(2),
});

export const CalculateBasketRequestSchema = z.object({
  groceryListId: EntityIdSchema,
  idempotencyKey: z.string().trim().min(8).max(200),
});

export const StoredBasketRecommendationSchema = z.object({
  id: EntityIdSchema,
  groceryListId: EntityIdSchema,
  plan: BasketPlanSchema,
  outcome: BasketOptimizationResultSchema,
  createdAt: UtcDateTimeSchema,
});

export const RedemptionStatusSchema = z.enum(["attempted", "succeeded", "failed", "reversed"]);

export const RedemptionInputSchema = z.object({
  offerId: EntityIdSchema,
  receiptId: EntityIdSchema.optional(),
  providerKey: z.string().trim().min(1),
  ingestionKey: z.string().trim().min(1),
  status: RedemptionStatusSchema,
  redeemedAt: UtcDateTimeSchema.optional(),
  amountCents: MoneyCentsSchema.default(0),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const ReceiptPersistenceInputSchema = z.object({
  receipt: ReceiptSchema,
  providerKey: z.string().trim().min(1),
  ingestionKey: z.string().trim().min(1),
  recommendationId: EntityIdSchema.optional(),
  confirmedRebateCents: MoneyCentsSchema.default(0),
  redemptions: z.array(RedemptionInputSchema.omit({ receiptId: true })).default([]),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
});

export type AuthProvider = z.infer<typeof AuthProviderSchema>;
export type SavedGroceryListInput = z.infer<typeof SavedGroceryListInputSchema>;
export type CalculateBasketRequest = z.infer<typeof CalculateBasketRequestSchema>;
export type StoredBasketRecommendation = z.infer<typeof StoredBasketRecommendationSchema>;
export type RedemptionStatus = z.infer<typeof RedemptionStatusSchema>;
export type RedemptionInput = z.infer<typeof RedemptionInputSchema>;
export type ReceiptPersistenceInput = z.infer<typeof ReceiptPersistenceInputSchema>;
export type PersistedGroceryList = z.infer<typeof GroceryListSchema>;
