import { z } from "zod";
import { AppliedOfferSchema, OfferSchema } from "./offer.js";
import { ProductSchema } from "./product.js";
import { StoreSchema } from "./store.js";
import { EntityIdSchema, MoneyCentsSchema, UtcDateTimeSchema } from "./shared.js";

export const CalculationDecisionSchema = z.enum(["applied", "rejected"]);

export const CalculationReasonCodeSchema = z.enum([
  "applied",
  "scope_mismatch",
  "store_mismatch",
  "product_mismatch",
  "upc_mismatch",
  "category_mismatch",
  "brand_mismatch",
  "size_mismatch",
  "not_started",
  "unverified",
  "failed",
  "expired",
  "already_redeemed",
  "rebate_disabled",
  "stack_conflict",
  "minimum_spend_not_met",
  "minimum_quantity_not_met",
  "promo_validation_failed",
  "total_cap_reached",
  "zero_value"
]);

export const CalculationTraceEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  planId: EntityIdSchema.optional(),
  scope: z.enum(["item", "basket"]),
  decision: CalculationDecisionSchema,
  reasonCode: CalculationReasonCodeSchema,
  message: z.string().trim().min(1),
  offerId: EntityIdSchema,
  offerTitle: z.string().trim().min(1),
  productId: EntityIdSchema.optional(),
  groceryListItemId: EntityIdSchema.optional(),
  evaluatedAt: UtcDateTimeSchema,
  appliedDiscountCents: MoneyCentsSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const BasketPlanLineSchema = z.object({
  groceryListItemId: EntityIdSchema,
  product: ProductSchema,
  quantity: z.number().int().positive(),
  basePriceCents: MoneyCentsSchema,
  checkoutDiscountCents: MoneyCentsSchema,
  rebateCents: MoneyCentsSchema,
  checkoutPriceCents: MoneyCentsSchema,
  netPriceCents: MoneyCentsSchema,
  offers: z.array(AppliedOfferSchema),
  calculationTrace: z.array(CalculationTraceEntrySchema)
}).superRefine((line, context) => {
  const extendedPriceCents = line.product.priceCents * line.quantity;
  if (!Number.isSafeInteger(extendedPriceCents) || line.basePriceCents !== extendedPriceCents) {
    context.addIssue({ code: "custom", path: ["basePriceCents"], message: "Base price does not match unit price times quantity" });
  }
  const appliedCheckoutCents = line.offers
    .filter(offer => offer.redemptionMode === "checkout")
    .reduce((sum, offer) => sum + offer.appliedDiscountCents, 0);
  const appliedRebateCents = line.offers
    .filter(offer => offer.redemptionMode === "rebate")
    .reduce((sum, offer) => sum + offer.appliedDiscountCents, 0);
  if (appliedCheckoutCents !== line.checkoutDiscountCents) {
    context.addIssue({ code: "custom", path: ["offers"], message: "Applied checkout offers do not reconcile" });
  }
  if (appliedRebateCents !== line.rebateCents) {
    context.addIssue({ code: "custom", path: ["offers"], message: "Applied rebate offers do not reconcile" });
  }
  if (line.offers.some(offer => offer.scope !== "item")) {
    context.addIssue({ code: "custom", path: ["offers"], message: "Basket-scoped offer cannot be attached to an item line" });
  }
  if (line.checkoutDiscountCents > line.basePriceCents) {
    context.addIssue({ code: "custom", path: ["checkoutDiscountCents"], message: "Checkout discount exceeds base price" });
  }
  if (line.checkoutPriceCents !== line.basePriceCents - line.checkoutDiscountCents) {
    context.addIssue({ code: "custom", path: ["checkoutPriceCents"], message: "Checkout price does not reconcile" });
  }
  if (line.rebateCents > line.checkoutPriceCents) {
    context.addIssue({ code: "custom", path: ["rebateCents"], message: "Rebate exceeds checkout price" });
  }
  if (line.netPriceCents !== line.checkoutPriceCents - line.rebateCents) {
    context.addIssue({ code: "custom", path: ["netPriceCents"], message: "Net price does not reconcile" });
  }
});

export const BasketPlanSchema = z.object({
  id: EntityIdSchema,
  label: z.string().trim().min(1),
  strategy: z.enum(["one_store", "split"]),
  lines: z.array(BasketPlanLineSchema).min(1),
  subtotalCents: MoneyCentsSchema,
  itemCheckoutDiscountsCents: MoneyCentsSchema,
  basketDiscountCents: MoneyCentsSchema,
  rebateTotalCents: MoneyCentsSchema,
  checkoutTotalCents: MoneyCentsSchema,
  netTotalCents: MoneyCentsSchema,
  savingsCents: MoneyCentsSchema,
  basketOffers: z.array(AppliedOfferSchema),
  stores: z.array(StoreSchema),
  calculationTrace: z.array(CalculationTraceEntrySchema),
  calculatedAt: UtcDateTimeSchema
}).superRefine((plan, context) => {
  const lineSubtotalCents = plan.lines.reduce((sum, line) => sum + line.basePriceCents, 0);
  const lineCheckoutDiscountCents = plan.lines.reduce((sum, line) => sum + line.checkoutDiscountCents, 0);
  const lineRebateCents = plan.lines.reduce((sum, line) => sum + line.rebateCents, 0);
  const basketCheckoutDiscountCents = plan.basketOffers
    .filter(offer => offer.redemptionMode === "checkout")
    .reduce((sum, offer) => sum + offer.appliedDiscountCents, 0);
  const basketRebateCents = plan.basketOffers
    .filter(offer => offer.redemptionMode === "rebate")
    .reduce((sum, offer) => sum + offer.appliedDiscountCents, 0);
  if (lineSubtotalCents !== plan.subtotalCents) {
    context.addIssue({ code: "custom", path: ["subtotalCents"], message: "Line subtotals do not reconcile" });
  }
  if (lineCheckoutDiscountCents !== plan.itemCheckoutDiscountsCents) {
    context.addIssue({ code: "custom", path: ["itemCheckoutDiscountsCents"], message: "Line checkout discounts do not reconcile" });
  }
  if (basketCheckoutDiscountCents !== plan.basketDiscountCents) {
    context.addIssue({ code: "custom", path: ["basketDiscountCents"], message: "Applied basket discounts do not reconcile" });
  }
  if (lineRebateCents + basketRebateCents !== plan.rebateTotalCents) {
    context.addIssue({ code: "custom", path: ["rebateTotalCents"], message: "Applied rebates do not reconcile" });
  }
  if (plan.basketOffers.some(offer => offer.scope !== "basket")) {
    context.addIssue({ code: "custom", path: ["basketOffers"], message: "Item-scoped offer cannot be attached as a basket offer" });
  }
  const lineStoreIds = [...new Set(plan.lines.map(line => line.product.storeId))].sort();
  const planStoreIds = [...new Set(plan.stores.map(store => store.id))].sort();
  if (JSON.stringify(lineStoreIds) !== JSON.stringify(planStoreIds)) {
    context.addIssue({ code: "custom", path: ["stores"], message: "Plan stores do not match line stores" });
  }
  if (plan.calculationTrace.some((entry, index) =>
    entry.sequence !== index || entry.planId !== plan.id
  )) {
    context.addIssue({ code: "custom", path: ["calculationTrace"], message: "Plan trace must be ordered and reference its plan" });
  }
  const totalCheckoutDiscountCents = plan.itemCheckoutDiscountsCents + plan.basketDiscountCents;
  if (totalCheckoutDiscountCents > plan.subtotalCents) {
    context.addIssue({ code: "custom", path: ["basketDiscountCents"], message: "Checkout discounts exceed subtotal" });
  }
  if (plan.checkoutTotalCents !== plan.subtotalCents - totalCheckoutDiscountCents) {
    context.addIssue({ code: "custom", path: ["checkoutTotalCents"], message: "Checkout total does not reconcile" });
  }
  if (plan.rebateTotalCents > plan.checkoutTotalCents) {
    context.addIssue({ code: "custom", path: ["rebateTotalCents"], message: "Rebates exceed checkout total" });
  }
  if (plan.netTotalCents !== plan.checkoutTotalCents - plan.rebateTotalCents) {
    context.addIssue({ code: "custom", path: ["netTotalCents"], message: "Net total does not reconcile" });
  }
  if (plan.savingsCents !== plan.subtotalCents - plan.netTotalCents) {
    context.addIssue({ code: "custom", path: ["savingsCents"], message: "Savings total does not reconcile" });
  }
});

export const BasketOptimizationResultSchema = z.object({
  plans: z.array(BasketPlanSchema),
  unmatched: z.array(z.string()),
  matchedOffers: z.array(OfferSchema),
  calculationTrace: z.array(CalculationTraceEntrySchema)
});

export type CalculationDecision = z.infer<typeof CalculationDecisionSchema>;
export type CalculationReasonCode = z.infer<typeof CalculationReasonCodeSchema>;
export type CalculationTraceEntry = z.infer<typeof CalculationTraceEntrySchema>;
export type BasketPlanLine = z.infer<typeof BasketPlanLineSchema>;
export type BasketPlan = z.infer<typeof BasketPlanSchema>;
export type BasketOptimizationResult = z.infer<typeof BasketOptimizationResultSchema>;
