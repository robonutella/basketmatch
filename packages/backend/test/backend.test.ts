import { demoItems, demoOffers, demoProducts, demoStores } from "@basketmatch/pricing-engine/demo";
import { describe, expect, it } from "vitest";

import {
  calculateAndPersistRecommendation,
  persistReceipt,
  persistRedemption,
  type BasketBackendRepository,
  type RecommendationPersistenceInput,
} from "../src/index.js";

function repository(): BasketBackendRepository & { recommendations: RecommendationPersistenceInput[] } {
  const recommendations: RecommendationPersistenceInput[] = [];
  return {
    recommendations,
    async loadGroceryList(userId, groceryListId) {
      return {
        id: groceryListId,
        userId,
        title: "Bay Area list",
        status: "active",
        items: demoItems,
        includeRebates: true,
        verifiedOffersOnly: true,
        maxStores: 2,
        createdAt: "2026-07-29T19:00:00.000Z",
        updatedAt: "2026-07-29T19:00:00.000Z",
      };
    },
    async persistRecommendation(input) {
      recommendations.push(input);
      return { id: "stored-recommendation", createdAt: "2026-07-29T19:00:01.000Z" };
    },
    async persistReceipt() {
      return { id: "stored-receipt" };
    },
    async persistRedemption() {
      return { id: "stored-redemption" };
    },
  };
}

describe("server-side backend services", () => {
  it("calculates with the unchanged engine and persists checkout/net totals and the full trace", async () => {
    const store = repository();
    const result = await calculateAndPersistRecommendation({
      userId: "user-1",
      groceryListId: "list-1",
      idempotencyKey: "calculation-0001",
      catalog: {
        products: demoProducts,
        offers: demoOffers,
        stores: demoStores,
        source: "typed_mock",
        region: "San Francisco Bay Area",
        primaryRetailer: "Safeway",
      },
      repository: store,
      now: "2026-07-29T19:00:00.000Z",
    });

    expect(result.recommendationId).toBe("stored-recommendation");
    expect(result.outcome.plans[0]?.checkoutTotalCents).toBeGreaterThan(
      result.outcome.plans[0]?.netTotalCents ?? 0,
    );
    expect(store.recommendations[0]?.plan.calculationTrace.length).toBeGreaterThan(0);
    expect(store.recommendations[0]?.catalog.source).toBe("typed_mock");
  });

  it("validates receipts and redemptions before persistence", async () => {
    const store = repository();
    await expect(persistReceipt(store, "user-1", {
      providerKey: "mock_receipts",
      ingestionKey: "receipt-1",
      receipt: {
        id: "client-receipt-1",
        storeId: "safeway",
        purchasedAt: "2026-07-29T19:00:00.000Z",
        subtotalCents: 1000,
        discountCents: 100,
        taxCents: 80,
        totalCents: 980,
        lines: [{
          id: "line-1",
          description: "Milk",
          quantity: 1,
          lineSubtotalCents: 1000,
          discountCents: 100,
        }],
      },
    })).resolves.toEqual({ id: "stored-receipt" });

    await expect(persistRedemption(store, "user-1", {
      offerId: "sf-meat-2",
      providerKey: "mock_loyalty",
      ingestionKey: "redemption-1",
      status: "succeeded",
      redeemedAt: "2026-07-29T19:00:00.000Z",
      amountCents: 200,
    })).resolves.toEqual({ id: "stored-redemption" });
  });
});
