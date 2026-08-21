import { z } from "zod";
import { EntityIdSchema, UtcDateTimeSchema } from "./shared.js";

export const EvidenceKindSchema = z.enum([
  "provider_validation",
  "cart_test",
  "exact_upc",
  "store_eligibility",
  "account_eligibility",
  "expiration_check",
  "redemption_history",
  "receipt_confirmation"
]);

export const EvidenceOutcomeSchema = z.enum(["passed", "failed", "unknown"]);

export const OfferEvidenceSchema = z.object({
  id: EntityIdSchema,
  offerId: EntityIdSchema,
  kind: EvidenceKindSchema,
  outcome: EvidenceOutcomeSchema,
  capturedAt: UtcDateTimeSchema,
  source: z.string().trim().min(1),
  sourceReference: z.string().trim().min(1).optional(),
  expiresAt: UtcDateTimeSchema.optional(),
  details: z.record(z.string(), z.unknown()).default({})
});

export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;
export type EvidenceOutcome = z.infer<typeof EvidenceOutcomeSchema>;
export type OfferEvidence = z.infer<typeof OfferEvidenceSchema>;
