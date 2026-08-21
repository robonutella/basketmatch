import { z } from "zod";
import { OfferEvidenceSchema } from "./evidence.js";
import {
  BasisPointsSchema,
  EntityIdSchema,
  MoneyCentsSchema,
  UtcDateTimeSchema
} from "./shared.js";
import { UpcSchema } from "./product.js";

export const OfferStatusSchema = z.enum([
  "verified",
  "recently_redeemed",
  "unverified",
  "failed",
  "expired"
]);

export const OfferSourceTypeSchema = z.enum([
  "retailer_loyalty",
  "manufacturer",
  "universal",
  "promo_code",
  "sale",
  "rebate"
]);

export const RedemptionModeSchema = z.enum(["checkout", "rebate"]);
export const OfferScopeSchema = z.enum(["item", "basket"]);

export const offerShape = {
  id: EntityIdSchema,
  externalId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  sourceType: OfferSourceTypeSchema,
  scope: OfferScopeSchema.default("item"),
  storeId: EntityIdSchema.optional(),
  productIds: z.array(EntityIdSchema).min(1).optional(),
  upcs: z.array(UpcSchema).min(1).optional(),
  brand: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  eligibleSizes: z.array(z.string().trim().min(1)).min(1).optional(),
  redemptionMode: RedemptionModeSchema,
  amountOffCents: MoneyCentsSchema.optional(),
  percentOffBasisPoints: BasisPointsSchema.optional(),
  maxDiscountCents: MoneyCentsSchema.optional(),
  minimumSpendCents: MoneyCentsSchema.optional(),
  minimumQuantity: z.number().int().positive().default(1),
  confidencePercent: z.number().int().min(0).max(100),
  status: OfferStatusSchema,
  startsAt: UtcDateTimeSchema.optional(),
  expiresAt: UtcDateTimeSchema.optional(),
  stackGroup: z.string().trim().min(1),
  redemptionLimit: z.number().int().positive().optional(),
  redemptionCount: z.number().int().nonnegative().default(0),
  lastRedeemedAt: UtcDateTimeSchema.optional(),
  promoCode: z.string().trim().min(1).optional(),
  validationFailureReason: z.string().trim().min(1).optional(),
  evidence: z.array(OfferEvidenceSchema).default([])
} satisfies z.ZodRawShape;

function validateOfferValue(
  offer: { amountOffCents?: number; percentOffBasisPoints?: number; maxDiscountCents?: number },
  context: z.RefinementCtx
) {
  const valueKinds = [offer.amountOffCents !== undefined, offer.percentOffBasisPoints !== undefined]
    .filter(Boolean).length;
  if (valueKinds !== 1) {
    context.addIssue({
      code: "custom",
      path: ["amountOffCents"],
      message: "Provide exactly one of amountOffCents or percentOffBasisPoints"
    });
  }
  if (offer.amountOffCents !== undefined && offer.amountOffCents <= 0) {
    context.addIssue({
      code: "custom",
      path: ["amountOffCents"],
      message: "amountOffCents must be greater than zero"
    });
  }
  if (offer.percentOffBasisPoints !== undefined && offer.percentOffBasisPoints <= 0) {
    context.addIssue({
      code: "custom",
      path: ["percentOffBasisPoints"],
      message: "percentOffBasisPoints must be greater than zero"
    });
  }
  if (offer.maxDiscountCents !== undefined && offer.percentOffBasisPoints === undefined) {
    context.addIssue({
      code: "custom",
      path: ["maxDiscountCents"],
      message: "maxDiscountCents is only valid with a percentage discount"
    });
  }
}

function validateOfferInvariants(
  offer: {
    id: string;
    status: z.infer<typeof OfferStatusSchema>;
    sourceType: z.infer<typeof OfferSourceTypeSchema>;
    scope: z.infer<typeof OfferScopeSchema>;
    redemptionMode: z.infer<typeof RedemptionModeSchema>;
    promoCode?: string;
    validationFailureReason?: string;
    percentOffBasisPoints?: number;
    maxDiscountCents?: number;
    startsAt?: string;
    expiresAt?: string;
    redemptionLimit?: number;
    redemptionCount: number;
    lastRedeemedAt?: string;
    evidence: Array<z.infer<typeof OfferEvidenceSchema>>;
  },
  context: z.RefinementCtx
) {
  if (offer.startsAt !== undefined && offer.expiresAt !== undefined &&
    Date.parse(offer.startsAt) >= Date.parse(offer.expiresAt)) {
    context.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "Offer expiration must be later than its start"
    });
  }
  if (offer.redemptionLimit !== undefined && offer.redemptionCount > offer.redemptionLimit) {
    context.addIssue({
      code: "custom",
      path: ["redemptionCount"],
      message: "Redemption count exceeds the offer limit"
    });
  }
  if (offer.maxDiscountCents !== undefined && offer.maxDiscountCents <= 0) {
    context.addIssue({
      code: "custom",
      path: ["maxDiscountCents"],
      message: "maxDiscountCents must be greater than zero"
    });
  }
  if (offer.sourceType === "promo_code" &&
    (offer.scope !== "basket" || offer.redemptionMode !== "checkout" || offer.promoCode === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["promoCode"],
      message: "Promo codes must be basket-scoped checkout offers with a code"
    });
  }
  if ((offer.sourceType === "rebate") !== (offer.redemptionMode === "rebate")) {
    context.addIssue({
      code: "custom",
      path: ["redemptionMode"],
      message: "Post-purchase redemption mode must use the rebate source type"
    });
  }
  if (offer.sourceType === "promo_code" && offer.status === "failed" &&
    offer.validationFailureReason === undefined) {
    context.addIssue({
      code: "custom",
      path: ["validationFailureReason"],
      message: "Failed promo codes require a provider failure reason"
    });
  }
  if (offer.evidence.some(item => item.offerId !== offer.id)) {
    context.addIssue({
      code: "custom",
      path: ["evidence"],
      message: "Embedded evidence must reference the containing offer"
    });
  }
  const hasRedemptionEvidence = offer.evidence.some(item =>
    item.outcome === "passed" &&
    (item.kind === "redemption_history" || item.kind === "receipt_confirmation")
  );
  if (offer.status === "recently_redeemed" &&
    offer.lastRedeemedAt === undefined && !hasRedemptionEvidence) {
    context.addIssue({
      code: "custom",
      path: ["lastRedeemedAt"],
      message: "Recently redeemed offers require a redemption timestamp or passed redemption evidence"
    });
  }
}

export const OfferSchema = z.object(offerShape).superRefine((offer, context) => {
  validateOfferValue(offer, context);
  validateOfferInvariants(offer, context);
});

export const AppliedOfferSchema = z.object({
  ...offerShape,
  appliedDiscountCents: MoneyCentsSchema
}).superRefine((offer, context) => {
  validateOfferValue(offer, context);
  validateOfferInvariants(offer, context);
});

export type OfferStatus = z.infer<typeof OfferStatusSchema>;
export type OfferSourceType = z.infer<typeof OfferSourceTypeSchema>;
export type RedemptionMode = z.infer<typeof RedemptionModeSchema>;
export type OfferScope = z.infer<typeof OfferScopeSchema>;
export type Offer = z.infer<typeof OfferSchema>;
export type AppliedOffer = z.infer<typeof AppliedOfferSchema>;
