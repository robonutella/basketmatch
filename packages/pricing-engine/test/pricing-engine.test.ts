import { describe, expect, it } from "vitest";
import {
  BasketOptimizationResultSchema,
  OfferSchema,
  ProductSchema,
  StoreSchema,
  type GroceryListItem,
  type Offer
} from "@basketmatch/domain";
import { demoCalculationNow, demoOffers, demoProducts } from "../src/demo.js";
import {
  matchItemsToProducts,
  optimizeBasket,
  priceProduct,
  productMatchesQuery
} from "../src/index.js";

const NOW = new Date("2026-07-29T19:00:00.000Z");
const product = ProductSchema.parse({
  id: "test-product",
  storeId: "test-store",
  name: "Acme Tomato Soup, 10 oz",
  aliases: ["soup", "tomato soup"],
  category: "soup",
  brand: "Acme",
  upc: "012345678905",
  priceCents: 1200,
  currency: "USD"
});
const store = StoreSchema.parse({ id: "test-store", name: "Test Store" });
const item: GroceryListItem = {
  id: "test-item",
  name: "tomato soup",
  quantity: 1,
  purchased: false
};

function makeOffer(overrides: Record<string, unknown>): Offer {
  const input: Record<string, unknown> = {
    id: "test-offer",
    title: "$1 off soup",
    provider: "Test provider",
    sourceType: "manufacturer",
    category: "soup",
    redemptionMode: "checkout",
    amountOffCents: 100,
    confidencePercent: 100,
    status: "verified",
    expiresAt: "2026-08-01T00:00:00.000Z",
    stackGroup: "manufacturer-item",
    ...overrides
  };
  if (input.sourceType === "promo_code" && input.promoCode === undefined) {
    input.promoCode = "TESTCODE";
  }
  return OfferSchema.parse(input);
}

describe("prototype behavior migration", () => {
  it("matches common grocery aliases", () => {
    const milk = demoProducts.find(candidate => candidate.id === "wm-milk");
    expect(milk).toBeDefined();
    expect(productMatchesQuery(milk!, "milk")).toBe(true);
    expect(productMatchesQuery(milk!, "paper towels")).toBe(false);
  });

  it("stacks one manufacturer coupon and one post-purchase rebate", () => {
    const tide = demoProducts.find(candidate => candidate.id === "wm-tide");
    const result = priceProduct(tide!, demoOffers, {
      includeRebates: true,
      verifiedOnly: true,
      now: demoCalculationNow
    });

    expect(result.checkoutPriceCents).toBe(1494);
    expect(result.netPriceCents).toBe(1294);
    expect(result.checkoutDiscountCents).toBe(300);
    expect(result.rebateCents).toBe(200);
  });
});

describe("offer eligibility and trace", () => {
  it("selects only the highest-value offer in a stack group", () => {
    const result = priceProduct(product, [
      makeOffer({ id: "small", amountOffCents: 100 }),
      makeOffer({ id: "large", amountOffCents: 300 })
    ], { now: NOW });

    expect(result.checkoutDiscountCents).toBe(300);
    expect(result.offers.map(offer => offer.id)).toEqual(["large"]);
    expect(result.calculationTrace.find(entry => entry.offerId === "small")?.reasonCode)
      .toBe("stack_conflict");
  });

  it("applies an exact UPC and rejects a near match", () => {
    const result = priceProduct(product, [
      makeOffer({ id: "exact", category: undefined, upcs: ["012345678905"], stackGroup: "exact" }),
      makeOffer({ id: "near", category: undefined, upcs: ["012345678904"], stackGroup: "near", amountOffCents: 500 })
    ], { now: NOW });

    expect(result.offers.map(offer => offer.id)).toContain("exact");
    expect(result.calculationTrace.find(entry => entry.offerId === "near")?.reasonCode)
      .toBe("upc_mismatch");
  });

  it("matches category rules exactly after normalization", () => {
    const result = priceProduct(product, [
      makeOffer({ id: "category", category: "SOUP", stackGroup: "category" })
    ], { now: NOW });
    expect(result.checkoutDiscountCents).toBe(100);
  });

  it("matches brand rules exactly after normalization", () => {
    const result = priceProduct(product, [
      makeOffer({ id: "brand", category: undefined, brand: "acme", stackGroup: "brand" })
    ], { now: NOW });
    expect(result.checkoutDiscountCents).toBe(100);
  });

  it("rejects an expired offer even when its state has not been refreshed", () => {
    const result = priceProduct(product, [
      makeOffer({ expiresAt: "2026-07-29T18:59:59.000Z" })
    ], { now: NOW });
    expect(result.checkoutDiscountCents).toBe(0);
    expect(result.calculationTrace[0]?.reasonCode).toBe("expired");
  });

  it("rejects a one-time offer after redemption", () => {
    const result = priceProduct(product, [
      makeOffer({ redemptionLimit: 1, redemptionCount: 1 })
    ], { now: NOW });
    expect(result.checkoutDiscountCents).toBe(0);
    expect(result.calculationTrace[0]?.reasonCode).toBe("already_redeemed");
  });

  it("records one decision for every item offer evaluated", () => {
    const offers = [
      makeOffer({ id: "eligible" }),
      makeOffer({ id: "wrong-brand", category: undefined, brand: "Elsewhere", stackGroup: "brand" }),
      makeOffer({ id: "unverified", status: "unverified", stackGroup: "unverified" })
    ];
    const result = priceProduct(product, offers, { now: NOW, verifiedOnly: true });
    expect(result.calculationTrace).toHaveLength(offers.length);
    expect(result.calculationTrace.map(entry => entry.decision)).toEqual([
      "applied",
      "rejected",
      "rejected"
    ]);
  });

  it("enforces item minimum spend against quantity-extended spend", () => {
    const offer = makeOffer({ minimumSpendCents: 1201 });
    const belowMinimum = priceProduct(product, [offer], { now: NOW, quantity: 1 });
    const atMinimum = priceProduct(product, [offer], { now: NOW, quantity: 2 });

    expect(belowMinimum.checkoutDiscountCents).toBe(0);
    expect(belowMinimum.calculationTrace[0]?.reasonCode).toBe("minimum_spend_not_met");
    expect(atMinimum.checkoutDiscountCents).toBe(100);
  });

  it("enforces minimum item quantity", () => {
    const offer = makeOffer({ minimumQuantity: 2 });
    const oneUnit = priceProduct(product, [offer], { now: NOW, quantity: 1 });
    const twoUnits = priceProduct(product, [offer], { now: NOW, quantity: 2 });

    expect(oneUnit.checkoutDiscountCents).toBe(0);
    expect(oneUnit.calculationTrace[0]?.reasonCode).toBe("minimum_quantity_not_met");
    expect(twoUnits.checkoutDiscountCents).toBe(100);
  });

  it("matches eligible sizes exactly after normalization", () => {
    const sizedProduct = ProductSchema.parse({ ...product, size: "10 oz" });
    const result = priceProduct(sizedProduct, [
      makeOffer({ id: "right-size", category: undefined, eligibleSizes: ["10 OZ"], stackGroup: "right-size" }),
      makeOffer({ id: "wrong-size", category: undefined, eligibleSizes: ["12 oz"], stackGroup: "wrong-size" })
    ], { now: NOW });

    expect(result.offers.map(offer => offer.id)).toEqual(["right-size"]);
    expect(result.calculationTrace.find(entry => entry.offerId === "wrong-size")?.reasonCode)
      .toBe("size_mismatch");
  });
});

describe("catalog matching", () => {
  it("does not recommend unavailable products", () => {
    const unavailableProduct = ProductSchema.parse({ ...product, available: false });
    const matches = matchItemsToProducts([item], [unavailableProduct]);
    const outcome = optimizeBasket({
      items: [item],
      products: [unavailableProduct],
      offers: [],
      stores: [store],
      now: NOW
    });

    expect(matches[0]?.products).toEqual([]);
    expect(outcome.plans).toEqual([]);
    expect(outcome.unmatched).toEqual([item.name]);
  });

  it("uses an exact requested UPC without requiring a fuzzy name match", () => {
    const exactProduct = ProductSchema.parse({
      ...product,
      name: "Acme Corn Flakes",
      aliases: ["corn flakes"],
      category: "pantry"
    });
    const exactItem: GroceryListItem = {
      ...item,
      name: "breakfast cereal",
      requestedUpc: product.upc
    };

    expect(matchItemsToProducts([exactItem], [exactProduct])[0]?.products.map(candidate => candidate.id))
      .toEqual([product.id]);
  });
});

describe("basket offers", () => {
  function optimize(offer: Offer) {
    return optimizeBasket({
      items: [item],
      products: [product],
      offers: [offer],
      stores: [store],
      maxStores: 1,
      verifiedOnly: false,
      now: NOW
    });
  }

  it("applies a promo when minimum spend is met", () => {
    const outcome = optimize(makeOffer({
      id: "basket-promo",
      scope: "basket",
      category: undefined,
      sourceType: "promo_code",
      storeId: "test-store",
      minimumSpendCents: 1200,
      amountOffCents: 200,
      stackGroup: "basket-promo"
    }));
    expect(outcome.plans[0]?.basketDiscountCents).toBe(200);
    expect(outcome.plans[0]?.checkoutTotalCents).toBe(1000);
  });

  it("rejects a promo below minimum spend", () => {
    const outcome = optimize(makeOffer({
      id: "basket-promo",
      scope: "basket",
      category: undefined,
      sourceType: "promo_code",
      storeId: "test-store",
      minimumSpendCents: 1201,
      amountOffCents: 200,
      stackGroup: "basket-promo"
    }));
    expect(outcome.plans[0]?.basketDiscountCents).toBe(0);
    expect(outcome.calculationTrace.some(entry => entry.reasonCode === "minimum_spend_not_met"))
      .toBe(true);
  });

  it("rejects a failed promo code and preserves the provider reason", () => {
    const outcome = optimize(makeOffer({
      id: "failed-promo",
      scope: "basket",
      category: undefined,
      sourceType: "promo_code",
      storeId: "test-store",
      minimumSpendCents: 1000,
      amountOffCents: 200,
      status: "failed",
      validationFailureReason: "Code is not valid for this account",
      stackGroup: "basket-promo"
    }));
    const trace = outcome.calculationTrace.find(entry => entry.offerId === "failed-promo" && entry.scope === "basket");
    expect(outcome.plans[0]?.basketDiscountCents).toBe(0);
    expect(trace?.reasonCode).toBe("promo_validation_failed");
    expect(trace?.message).toBe("Code is not valid for this account");
  });

  it("keeps a basket rebate out of the checkout total", () => {
    const outcome = optimize(makeOffer({
      id: "basket-rebate",
      scope: "basket",
      category: undefined,
      sourceType: "rebate",
      redemptionMode: "rebate",
      amountOffCents: 200,
      stackGroup: "basket-rebate"
    }));
    const plan = outcome.plans[0];

    expect(plan?.subtotalCents).toBe(1200);
    expect(plan?.basketDiscountCents).toBe(0);
    expect(plan?.checkoutTotalCents).toBe(1200);
    expect(plan?.rebateTotalCents).toBe(200);
    expect(plan?.netTotalCents).toBe(1000);
  });

  it("caps mixed global and store discounts and reconciles trace amounts", () => {
    const thousandCentProduct = ProductSchema.parse({ ...product, priceCents: 1000 });
    const outcome = optimizeBasket({
      items: [item],
      products: [thousandCentProduct],
      stores: [store],
      now: NOW,
      maxStores: 1,
      offers: [
        makeOffer({
          id: "global",
          scope: "basket",
          category: undefined,
          sourceType: "promo_code",
          amountOffCents: 900,
          stackGroup: "global"
        }),
        makeOffer({
          id: "store",
          scope: "basket",
          category: undefined,
          sourceType: "promo_code",
          storeId: store.id,
          amountOffCents: 500,
          stackGroup: "store"
        })
      ]
    });
    const plan = outcome.plans[0]!;
    const basketTrace = plan.calculationTrace.filter(entry => entry.scope === "basket");
    const tracedDiscountCents = basketTrace.reduce(
      (sum, entry) => sum + (entry.appliedDiscountCents ?? 0),
      0
    );

    expect(plan.basketDiscountCents).toBe(1000);
    expect(plan.checkoutTotalCents).toBe(0);
    expect(plan.basketOffers.map(offer => offer.appliedDiscountCents)).toEqual([900, 100]);
    expect(tracedDiscountCents).toBe(plan.basketDiscountCents);
    expect(plan.basketOffers.reduce((sum, offer) => sum + offer.appliedDiscountCents, 0))
      .toBe(plan.basketDiscountCents);
  });

  it("uses explicit basket scope without applying the offer to an item too", () => {
    const outcome = optimize(makeOffer({
      id: "scoped-basket-offer",
      scope: "basket",
      category: "soup",
      amountOffCents: 100,
      stackGroup: "basket-promo"
    }));
    const plan = outcome.plans[0]!;
    const offerTrace = plan.calculationTrace.filter(entry => entry.offerId === "scoped-basket-offer");

    expect(plan.itemCheckoutDiscountsCents).toBe(0);
    expect(plan.basketDiscountCents).toBe(100);
    expect(plan.checkoutTotalCents).toBe(1100);
    expect(offerTrace.filter(entry => entry.decision === "applied")).toHaveLength(1);
  });
});

describe("basket optimization invariants", () => {
  it("charges the requested quantity and preserves line arithmetic", () => {
    const outcome = optimizeBasket({
      items: [{ ...item, quantity: 2 }],
      products: [product],
      offers: [],
      stores: [store],
      maxStores: 1,
      now: NOW
    });
    const plan = outcome.plans[0]!;

    expect(plan.lines[0]?.quantity).toBe(2);
    expect(plan.lines[0]?.basePriceCents).toBe(2400);
    expect(plan.subtotalCents).toBe(2400);
    expect(plan.checkoutTotalCents).toBe(2400);
    expect(plan.netTotalCents).toBe(2400);
    expect(BasketOptimizationResultSchema.safeParse(outcome).success).toBe(true);
  });

  it("applies a one-time offer to only one of two eligible lines", () => {
    const outcome = optimizeBasket({
      items: [
        { ...item, id: "first-item" },
        { ...item, id: "second-item" }
      ],
      products: [product],
      offers: [makeOffer({ id: "one-time", redemptionLimit: 1 })],
      stores: [store],
      maxStores: 1,
      now: NOW
    });
    const plan = outcome.plans[0]!;
    const appliedUses = plan.lines.flatMap(line => line.offers)
      .filter(offer => offer.id === "one-time");

    expect(plan.subtotalCents).toBe(2400);
    expect(plan.itemCheckoutDiscountsCents).toBe(100);
    expect(appliedUses).toHaveLength(1);
    expect(plan.calculationTrace.filter(entry =>
      entry.offerId === "one-time" && entry.reasonCode === "already_redeemed"
    )).toHaveLength(1);
  });

  it("considers a higher-priced product when it unlocks a lower basket total", () => {
    const cheapProduct = ProductSchema.parse({ ...product, id: "cheap", priceCents: 1000 });
    const thresholdProduct = ProductSchema.parse({ ...product, id: "threshold", priceCents: 1200 });
    const outcome = optimizeBasket({
      items: [item],
      products: [cheapProduct, thresholdProduct],
      offers: [makeOffer({
        id: "threshold-promo",
        scope: "basket",
        category: undefined,
        sourceType: "promo_code",
        minimumSpendCents: 1200,
        amountOffCents: 400,
        stackGroup: "basket-promo"
      })],
      stores: [store],
      maxStores: 1,
      now: NOW
    });
    const best = outcome.plans[0]!;

    expect(best.lines[0]?.product.id).toBe("threshold");
    expect(best.basketDiscountCents).toBe(400);
    expect(best.checkoutTotalCents).toBe(800);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid maxStores value %s",
    invalidMaxStores => {
      expect(() => optimizeBasket({
        items: [item],
        products: [product],
        offers: [],
        stores: [store],
        maxStores: invalidMaxStores,
        now: NOW
      })).toThrow(TypeError);
    }
  );
});
