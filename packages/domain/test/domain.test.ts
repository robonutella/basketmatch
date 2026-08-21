import { describe, expect, it } from "vitest";
import { BasketPlanSchema } from "../src/basket.ts";
import { OfferSchema, OfferStatusSchema } from "../src/offer.ts";
import { ReceiptSchema } from "../src/receipt.ts";
import { MoneyCentsSchema, UtcDateTimeSchema } from "../src/shared.ts";

const validPlan = {
  id: "schema-plan",
  label: "Schema test plan",
  strategy: "one_store",
  lines: [{
    groceryListItemId: "item-1",
    product: {
      id: "product-1",
      storeId: "store-1",
      name: "Soup",
      aliases: [],
      category: "soup",
      priceCents: 1200,
      currency: "USD",
      available: true,
    },
    quantity: 1,
    basePriceCents: 1200,
    checkoutDiscountCents: 0,
    rebateCents: 0,
    checkoutPriceCents: 1200,
    netPriceCents: 1200,
    offers: [],
    calculationTrace: [],
  }],
  subtotalCents: 1200,
  itemCheckoutDiscountsCents: 0,
  basketDiscountCents: 0,
  rebateTotalCents: 0,
  checkoutTotalCents: 1200,
  netTotalCents: 1200,
  savingsCents: 0,
  basketOffers: [],
  stores: [{ id: "store-1", name: "Test Store" }],
  calculationTrace: [],
  calculatedAt: "2026-07-29T19:00:00.000Z"
};

describe("UTC timestamps", () => {
  it("accepts trailing-Z timestamps and rejects offset-local timestamps", () => {
    expect(UtcDateTimeSchema.safeParse("2026-07-29T19:00:00.000Z").success).toBe(true);
    expect(UtcDateTimeSchema.safeParse("2026-07-29T19:00:00+00:00").success).toBe(false);
    expect(UtcDateTimeSchema.safeParse("2026-07-29T12:00:00-07:00").success).toBe(false);
  });
});

describe("shared pricing primitives", () => {
  it("accepts only non-negative safe integer cents", () => {
    expect(MoneyCentsSchema.safeParse(1794).success).toBe(true);
    expect(MoneyCentsSchema.safeParse(17.94).success).toBe(false);
    expect(MoneyCentsSchema.safeParse(-1).success).toBe(false);
    expect(MoneyCentsSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
  });

  it("represents every trust and validation state", () => {
    for (const status of [
      "verified",
      "recently_redeemed",
      "unverified",
      "failed",
      "expired",
    ]) {
      expect(OfferStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("requires trusted redemption provenance and evidence ownership", () => {
    const recentlyRedeemed = {
      id: "offer-1",
      title: "$1 off",
      provider: "Provider",
      sourceType: "manufacturer",
      scope: "item",
      category: "soup",
      redemptionMode: "checkout",
      amountOffCents: 100,
      confidencePercent: 100,
      status: "recently_redeemed",
      expiresAt: "2026-08-01T00:00:00.000Z",
      stackGroup: "manufacturer-item",
    };
    expect(OfferSchema.safeParse(recentlyRedeemed).success).toBe(false);
    expect(OfferSchema.safeParse({
      ...recentlyRedeemed,
      lastRedeemedAt: "2026-07-29T19:00:00.000Z",
    }).success).toBe(true);
    expect(OfferSchema.safeParse({
      ...recentlyRedeemed,
      lastRedeemedAt: "2026-07-29T19:00:00.000Z",
      evidence: [{
        id: "evidence-1",
        offerId: "another-offer",
        kind: "redemption_history",
        outcome: "passed",
        capturedAt: "2026-07-29T19:00:00.000Z",
        source: "Provider",
      }],
    }).success).toBe(false);
  });
});

describe("basket arithmetic", () => {
  it("accepts a fully reconciled plan", () => {
    expect(BasketPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it("rejects inconsistent checkout, net, and savings totals", () => {
    expect(BasketPlanSchema.safeParse({
      ...validPlan,
      checkoutTotalCents: 899
    }).success).toBe(false);
    expect(BasketPlanSchema.safeParse({
      ...validPlan,
      netTotalCents: 601
    }).success).toBe(false);
    expect(BasketPlanSchema.safeParse({
      ...validPlan,
      savingsCents: 599
    }).success).toBe(false);
  });

  it("reconciles line quantities and plan aggregates", () => {
    expect(BasketPlanSchema.safeParse({
      ...validPlan,
      lines: [{ ...validPlan.lines[0], quantity: 2 }],
    }).success).toBe(false);
    expect(BasketPlanSchema.safeParse({ ...validPlan, lines: [] }).success).toBe(false);
  });
});

describe("receipt arithmetic", () => {
  const receipt = {
    id: "receipt-1",
    storeId: "store-1",
    purchasedAt: "2026-07-29T19:00:00.000Z",
    subtotalCents: 1200,
    discountCents: 200,
    taxCents: 80,
    totalCents: 1080,
    lines: [{
      id: "line-1",
      description: "Soup",
      quantity: 1,
      lineSubtotalCents: 1200,
      discountCents: 100,
    }],
  };

  it("accepts unallocated basket discounts while reconciling the paid total", () => {
    expect(ReceiptSchema.safeParse(receipt).success).toBe(true);
  });

  it("rejects impossible line and receipt totals", () => {
    expect(ReceiptSchema.safeParse({ ...receipt, totalCents: 1081 }).success).toBe(false);
    expect(ReceiptSchema.safeParse({
      ...receipt,
      lines: [{ ...receipt.lines[0], discountCents: 1201 }],
    }).success).toBe(false);
  });
});
