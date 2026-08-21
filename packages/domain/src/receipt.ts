import { z } from "zod";
import { EntityIdSchema, MoneyCentsSchema, UtcDateTimeSchema } from "./shared.js";
import { UpcSchema } from "./product.js";

export const ReceiptLineSchema = z.object({
  id: EntityIdSchema,
  description: z.string().trim().min(1),
  productId: EntityIdSchema.optional(),
  upc: UpcSchema.optional(),
  quantity: z.number().positive(),
  lineSubtotalCents: MoneyCentsSchema,
  discountCents: MoneyCentsSchema
}).superRefine((line, context) => {
  if (line.discountCents > line.lineSubtotalCents) {
    context.addIssue({
      code: "custom",
      path: ["discountCents"],
      message: "Receipt-line discount exceeds its subtotal"
    });
  }
});

export const ReceiptSchema = z.object({
  id: EntityIdSchema,
  userId: EntityIdSchema.optional(),
  storeId: EntityIdSchema,
  purchasedAt: UtcDateTimeSchema,
  subtotalCents: MoneyCentsSchema,
  discountCents: MoneyCentsSchema,
  taxCents: MoneyCentsSchema,
  totalCents: MoneyCentsSchema,
  lines: z.array(ReceiptLineSchema),
  sourceReference: z.string().trim().min(1).optional()
}).superRefine((receipt, context) => {
  const lineSubtotalCents = receipt.lines.reduce((sum, line) => sum + line.lineSubtotalCents, 0);
  const allocatedDiscountCents = receipt.lines.reduce((sum, line) => sum + line.discountCents, 0);
  if (receipt.discountCents > receipt.subtotalCents) {
    context.addIssue({
      code: "custom",
      path: ["discountCents"],
      message: "Receipt discount exceeds subtotal"
    });
  }
  if (lineSubtotalCents !== receipt.subtotalCents) {
    context.addIssue({
      code: "custom",
      path: ["lines"],
      message: "Receipt-line subtotals do not reconcile with receipt subtotal"
    });
  }
  if (allocatedDiscountCents > receipt.discountCents) {
    context.addIssue({
      code: "custom",
      path: ["lines"],
      message: "Allocated receipt-line discounts exceed receipt discount"
    });
  }
  if (receipt.totalCents !== receipt.subtotalCents - receipt.discountCents + receipt.taxCents) {
    context.addIssue({
      code: "custom",
      path: ["totalCents"],
      message: "Receipt total does not reconcile"
    });
  }
});

export type ReceiptLine = z.infer<typeof ReceiptLineSchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;
