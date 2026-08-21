import { OfferSchema, ProductSchema, StoreSchema } from "@basketmatch/domain";
import { describe, expect, it } from "vitest";

import {
  MockManufacturerCouponAdapter,
  MockPromoCodeValidationAdapter,
  MockRebateAdapter,
  MockReceiptAdapter,
  MockRetailerCatalogAdapter,
  MockRetailerLoyaltyOffersAdapter,
  type AdapterRequestContext,
  type ImportedReceipt,
  type OAuthConnectionReference,
  type ProviderDescriptor,
  resolveProviderAdapterModes,
} from "../src/index.js";

const provider: ProviderDescriptor = {
  key: "mock-retailer",
  displayName: "Mock Retailer",
  environment: "mock",
};

const context: AdapterRequestContext = {
  requestId: "request-001",
  requestedAt: "2026-08-01T12:00:00.000Z",
};

const connection: OAuthConnectionReference = {
  kind: "oauth_token_reference",
  connectionId: "connection-001",
  userId: "user-001",
  providerKey: provider.key,
  retailerId: "walmart",
  tokenSecretReference: "vault://basketmatch/mock-retailer/connection-001",
  scopes: ["offers.read", "promos.validate", "rebates.read", "receipts.read"],
  status: "active",
  connectedAt: "2026-07-01T12:00:00.000Z",
};

const product = ProductSchema.parse({
  id: "domain-product-001",
  storeId: "walmart",
  name: "Tide Original Liquid, 84 oz",
  aliases: ["tide", "laundry detergent"],
  category: "laundry",
  brand: "Tide",
  upc: "037000930184",
  size: "84 oz",
  priceCents: 1_794,
  currency: "USD",
  observedAt: context.requestedAt,
  available: true,
});
const store = StoreSchema.parse({ id: "walmart", name: "Walmart" });
const offer = OfferSchema.parse({
  id: "domain-offer-001",
  title: "$3 off Tide",
  provider: "Mock coupon network",
  sourceType: "manufacturer",
  scope: "item",
  upcs: ["037000930184"],
  category: "laundry",
  brand: "Tide",
  redemptionMode: "checkout",
  amountOffCents: 300,
  confidencePercent: 100,
  status: "verified",
  expiresAt: "2026-08-15T23:59:59.000Z",
  stackGroup: "manufacturer-item",
});

describe("MockRetailerCatalogAdapter", () => {
  it("performs deterministic exact UPC, category, and brand matching", async () => {
    const adapter = new MockRetailerCatalogAdapter({
      provider,
      storesById: { walmart: store },
      products: [
        {
          providerProductId: "tide-84",
          product,
          storeId: "walmart",
          upcGtin: "037000930184",
          category: "Laundry",
          brand: "Tide",
          packageSize: "84 oz",
          priceCents: 1_794,
          priceObservedAt: context.requestedAt,
          available: true,
          fulfillmentMethods: ["pickup", "in_store"],
          searchableText: "Tide Original Liquid 84 oz laundry detergent",
          sourceReference: "mock://catalog/tide-84",
        },
      ],
    });

    const response = await adapter.searchProducts({
      context,
      storeId: "walmart",
      exactUpcGtin: "037000930184",
      category: "laundry",
      brand: "tide",
    });

    expect(response.fetchedAt).toBe(context.requestedAt);
    expect(response.data.items.map((item) => item.providerProductId)).toEqual([
      "tide-84",
    ]);
    expect((await adapter.getStore({ ...context, storeId: "walmart" })).data).toBe(store);
  });

  it("uses canonical product fields when optional provider wrappers are omitted", async () => {
    const adapter = new MockRetailerCatalogAdapter({
      provider,
      products: [{
        providerProductId: "canonical-only",
        product,
        storeId: product.storeId,
        priceCents: product.priceCents,
        priceObservedAt: context.requestedAt,
        available: product.available,
        fulfillmentMethods: ["pickup"],
        searchableText: product.name,
        sourceReference: "mock://catalog/canonical-only",
      }],
    });
    const response = await adapter.searchProducts({
      context,
      storeId: product.storeId,
      exactUpcGtin: product.upc,
      category: product.category,
      brand: product.brand,
    });
    expect(response.data.items).toHaveLength(1);
  });
});

describe("MockRetailerLoyaltyOffersAdapter", () => {
  it("requires an active OAuth token reference and never accepts credentials", async () => {
    const adapter = new MockRetailerLoyaltyOffersAdapter({ provider });
    const revoked = { ...connection, status: "revoked" as const };

    await expect(
      adapter.listOffers({ context, connection: revoked }),
    ).rejects.toMatchObject({
      code: "connection_revoked",
    });
  });

  it("rejects an active connection whose OAuth token reference has expired", async () => {
    const adapter = new MockRetailerLoyaltyOffersAdapter({ provider });
    await expect(adapter.listOffers({
      context,
      connection: { ...connection, expiresAt: "2026-08-01T11:59:59.000Z" },
    })).rejects.toMatchObject({ code: "connection_expired" });
  });

  it("rejects raw token material masquerading as a secret reference", async () => {
    const adapter = new MockRetailerLoyaltyOffersAdapter({ provider });
    await expect(adapter.listOffers({
      context,
      connection: { ...connection, tokenSecretReference: "raw-access-token-value" },
    })).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("removes the old expiry when a refresh fixture represents a non-expiring token", async () => {
    const adapter = new MockRetailerLoyaltyOffersAdapter({ provider });
    const response = await adapter.refreshConnection(context, {
      ...connection,
      status: "expired",
      expiresAt: "2026-07-31T12:00:00.000Z",
    });
    expect(response.data.status).toBe("active");
    expect(response.data).not.toHaveProperty("expiresAt");
  });
});

describe("MockManufacturerCouponAdapter", () => {
  it("does not return a coupon for a near UPC match", async () => {
    const adapter = new MockManufacturerCouponAdapter({
      provider,
      coupons: [
        {
          providerOfferId: "coupon-tide",
          offer,
          eligibleUpcs: ["037000930184"],
          eligibleCategories: ["laundry"],
          eligibleBrands: ["Tide"],
          evidence: [],
          sourceReference: "mock://coupon/coupon-tide",
        },
      ],
    });

    const exact = await adapter.findCoupons({
      context,
      exactUpcGtin: "037000930184",
    });
    const near = await adapter.findCoupons({
      context,
      exactUpcGtin: "037000930185",
    });

    expect(exact.data.items).toHaveLength(1);
    expect(near.data.items).toHaveLength(0);
  });
});

describe("MockPromoCodeValidationAdapter", () => {
  const adapter = new MockPromoCodeValidationAdapter({
    provider,
    rules: [
      {
        code: "SAVE5",
        checkoutDiscountCents: 500,
        eligibleStoreIds: ["walmart"],
        minimumSubtotalCents: 3_500,
        oneTimePerConnection: true,
        redeemedConnectionIds: ["connection-redeemed"],
        expiresAt: "2026-08-15T23:59:59.000Z",
      },
      {
        code: "BROKEN",
        checkoutDiscountCents: 500,
        forcedFailure: {
          status: "failed",
          reason: "provider_error",
          message: "The mock checkout provider failed.",
        },
      },
    ],
  });

  it("keeps a minimum-spend rejection at zero checkout savings", async () => {
    const response = await adapter.validateCode({
      context,
      code: "save5",
      storeId: "walmart",
      subtotalCents: 3_499,
      productIds: [],
      upcs: [],
      connection,
    });

    expect(response.data).toMatchObject({
      status: "rejected",
      reason: "minimum_not_met",
      checkoutDiscountCents: 0,
    });
  });

  it("accepts an eligible basket and returns only a checkout discount", async () => {
    const response = await adapter.validateCode({
      context,
      code: "SAVE5",
      storeId: "walmart",
      subtotalCents: 3_500,
      productIds: [],
      upcs: [],
      connection,
    });

    expect(response.data).toMatchObject({
      status: "accepted",
      reason: "accepted",
      checkoutDiscountCents: 500,
    });
    expect(response.data).not.toHaveProperty("rebateCents");
  });

  it("distinguishes a provider failure from a rejected promo", async () => {
    const failed = await adapter.validateCode({
      context,
      code: "BROKEN",
      storeId: "walmart",
      subtotalCents: 4_000,
      productIds: [],
      upcs: [],
    });
    const unknown = await adapter.validateCode({
      context,
      code: "NOT-A-CODE",
      storeId: "walmart",
      subtotalCents: 4_000,
      productIds: [],
      upcs: [],
    });

    expect(failed.data).toMatchObject({
      status: "failed",
      reason: "provider_error",
      checkoutDiscountCents: 0,
    });
    expect(unknown.data).toMatchObject({
      status: "rejected",
      reason: "invalid_code",
      checkoutDiscountCents: 0,
    });
  });

  it("rejects a one-time code for a previously redeemed connection", async () => {
    const response = await adapter.validateCode({
      context,
      code: "SAVE5",
      storeId: "walmart",
      subtotalCents: 4_000,
      productIds: [],
      upcs: [],
      connection: {
        ...connection,
        connectionId: "connection-redeemed",
      },
    });

    expect(response.data).toMatchObject({
      status: "rejected",
      reason: "already_redeemed",
      checkoutDiscountCents: 0,
    });
  });

  it("rejects a fixed-value rule that contradicts its normalized offer", () => {
    const promoOffer = OfferSchema.parse({
      id: "promo-offer",
      title: "$3 off",
      provider: "Mock Retailer",
      sourceType: "promo_code",
      scope: "basket",
      redemptionMode: "checkout",
      amountOffCents: 300,
      confidencePercent: 100,
      status: "verified",
      expiresAt: "2026-08-15T23:59:59.000Z",
      stackGroup: "basket-promo",
      promoCode: "SAVE3",
    });
    expect(() => new MockPromoCodeValidationAdapter({
      provider,
      rules: [{ code: "SAVE3", checkoutDiscountCents: 500, offer: promoOffer }],
    })).toThrow(/must match/);
  });
});

describe("MockReceiptAdapter", () => {
  it("returns a normalized, integer-cent receipt fixture", async () => {
    const receipt: ImportedReceipt = {
      providerReceiptId: "receipt-001",
      retailerId: "walmart",
      storeId: "walmart",
      purchasedAt: "2026-07-31T17:00:00.000Z",
      importedAt: context.requestedAt,
      currency: "USD",
      subtotalCents: 1_794,
      checkoutDiscountCents: 300,
      taxCents: 0,
      totalPaidCents: 1_494,
      lineItems: [
        {
          providerLineId: "line-001",
          productId: "domain-product-001",
          description: "Tide Original Liquid, 84 oz",
          quantity: 1,
          unitPriceCents: 1_794,
          lineSubtotalCents: 1_794,
          checkoutDiscountCents: 300,
        },
      ],
      sourceReference: "mock://receipt/receipt-001",
    };
    const adapter = new MockReceiptAdapter({ provider, receipts: [receipt] });

    const response = await adapter.importReceipt({
      context,
      connection,
      providerReceiptId: receipt.providerReceiptId,
    });

    expect(response.data.totalPaidCents).toBe(1_494);
    expect(Number.isInteger(response.data.totalPaidCents)).toBe(true);
  });

  it("rejects receipt lines whose unit extension does not reconcile", () => {
    const malformed: ImportedReceipt = {
      providerReceiptId: "receipt-bad",
      retailerId: "walmart",
      purchasedAt: "2026-07-31T17:00:00.000Z",
      importedAt: context.requestedAt,
      currency: "USD",
      subtotalCents: 1_700,
      checkoutDiscountCents: 0,
      taxCents: 0,
      totalPaidCents: 1_700,
      lineItems: [{
        providerLineId: "line-bad",
        description: "Tide",
        quantity: 1,
        unitPriceCents: 1_794,
        lineSubtotalCents: 1_700,
        checkoutDiscountCents: 0,
      }],
      sourceReference: "mock://receipt/receipt-bad",
    };
    expect(() => new MockReceiptAdapter({ provider, receipts: [malformed] })).toThrow(
      /unit price times quantity/,
    );
  });
});

describe("MockRebateAdapter", () => {
  const rebateOffer = {
    ...OfferSchema.parse({
      id: "rebate-tide-001",
      title: "$2 Tide rebate",
      provider: "Mock rebate network",
      sourceType: "rebate",
      scope: "item",
      upcs: ["037000930184"],
      category: "laundry",
      brand: "Tide",
      redemptionMode: "rebate",
      amountOffCents: 200,
      confidencePercent: 100,
      status: "verified",
      expiresAt: "2026-08-15T23:59:59.000Z",
      stackGroup: "rebate-item",
    }),
    sourceType: "rebate" as const,
    redemptionMode: "rebate" as const,
  };

  it("returns connection-specific activation without treating rebates as checkout savings", async () => {
    const adapter = new MockRebateAdapter({
      provider,
      rebates: [{
        record: {
          providerOfferId: "rebate-tide-001",
          offer: rebateOffer,
          eligibleUpcs: ["037000930184"],
          eligibleCategories: ["laundry"],
          eligibleBrands: ["Tide"],
          activationRequired: true,
          postPurchaseRequirements: ["Upload a receipt"],
          manufacturerCouponStacking: "allowed",
          expiresAt: rebateOffer.expiresAt,
          evidence: [],
          sourceReference: "mock://rebate/rebate-tide-001",
        },
        activatedConnectionIds: [connection.connectionId],
      }],
    });

    const response = await adapter.findRebates({ context, connection, activatedOnly: true });
    expect(response.data.items[0]).toMatchObject({
      activated: true,
      offer: { sourceType: "rebate", redemptionMode: "rebate" },
    });
  });

  it("rejects a checkout-mode offer at the rebate boundary", () => {
    expect(() => new MockRebateAdapter({
      provider,
      rebates: [{
        record: {
          providerOfferId: "bad-rebate",
          offer: offer as never,
          eligibleUpcs: ["037000930184"],
          eligibleCategories: ["laundry"],
          eligibleBrands: ["Tide"],
          activationRequired: false,
          postPurchaseRequirements: [],
          manufacturerCouponStacking: "unknown",
          evidence: [],
          sourceReference: "mock://rebate/bad-rebate",
        },
      }],
    })).toThrow(/post-purchase rebate/);
  });
});

describe("provider boundary validation", () => {
  it("rejects non-UTC timestamps and fractional cents", () => {
    expect(() => new MockRetailerCatalogAdapter({
      provider,
      products: [{
        providerProductId: "bad-price",
        product,
        storeId: "walmart",
        upcGtin: product.upc,
        category: product.category,
        brand: product.brand,
        packageSize: product.size,
        priceCents: 1.5,
        priceObservedAt: "2026-08-01T05:00:00-07:00",
        available: true,
        fulfillmentMethods: ["pickup"],
        searchableText: product.name,
        sourceReference: "mock://catalog/bad-price",
      }],
    })).toThrow(/cents|UTC/);
  });

  it("defaults every unset adapter mode to mock and rejects unknown modes", () => {
    expect(new Set(Object.values(resolveProviderAdapterModes({})))).toEqual(new Set(["mock"]));
    expect(() => resolveProviderAdapterModes({ PROVIDER_ADAPTER_MODE: "scrape" })).toThrow(
      /mock, sandbox, or production/,
    );
  });
});
