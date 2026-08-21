import test from "node:test";
import assert from "node:assert/strict";
import { products as legacyProducts, offers as legacyOffers, stores as legacyStores } from "../data/catalog.js";
import { priceProduct as legacyPriceProduct, optimizeBasket as legacyOptimizeBasket } from "../src/engine.js";
import { optimizeBasket, priceProduct } from "../packages/pricing-engine/dist/index.js";
import { demoCalculationNow, demoItems, demoOffers, demoProducts, demoStores } from "../packages/pricing-engine/dist/demo.js";

test("migrated engine preserves the prototype Tide checkout and rebate totals", () => {
  const legacyTide = legacyProducts.find(product => product.id === "wm-tide");
  const migratedTide = demoProducts.find(product => product.id === "wm-tide");
  const legacy = legacyPriceProduct(legacyTide, legacyOffers, { includeRebates: true, verifiedOnly: true });
  const migrated = priceProduct(migratedTide, demoOffers, {
    includeRebates: true,
    verifiedOnly: true,
    now: demoCalculationNow
  });

  assert.equal(migrated.checkoutPriceCents, Math.round(legacy.checkoutPrice * 100));
  assert.equal(migrated.netPriceCents, Math.round(legacy.netPrice * 100));
  assert.equal(migrated.checkoutDiscountCents, Math.round(legacy.checkoutDiscount * 100));
  assert.equal(migrated.rebateCents, Math.round(legacy.rebate * 100));
  assert.deepEqual(
    migrated.offers.map(offer => offer.id),
    legacy.offers.map(offer => offer.id)
  );
});

test("migrated engine preserves the prototype's recommended demo totals", () => {
  const legacyItems = demoItems.map(item => ({ id: item.id, name: item.name, purchased: item.purchased }));
  const legacy = legacyOptimizeBasket({
    items: legacyItems,
    products: legacyProducts,
    offers: legacyOffers,
    stores: legacyStores,
    includeRebates: true,
    verifiedOnly: true,
    maxStores: 2
  });
  const migrated = optimizeBasket({
    items: demoItems,
    products: demoProducts,
    offers: demoOffers,
    stores: demoStores,
    includeRebates: true,
    verifiedOnly: true,
    maxStores: 2,
    now: demoCalculationNow
  });

  assert.equal(migrated.plans[0].checkoutTotalCents, Math.round(legacy.plans[0].checkoutTotal * 100));
  assert.equal(migrated.plans[0].netTotalCents, Math.round(legacy.plans[0].netTotal * 100));
  assert.equal(migrated.plans[0].subtotalCents, Math.round(legacy.plans[0].subtotal * 100));
  assert.equal(
    migrated.plans[0].itemCheckoutDiscountsCents,
    Math.round(legacy.plans[0].itemCheckoutDiscounts * 100)
  );
  assert.equal(migrated.plans[0].rebateTotalCents, Math.round(legacy.plans[0].rebates * 100));
  assert.equal(migrated.plans[0].savingsCents, Math.round(legacy.plans[0].savings * 100));
  assert.deepEqual(
    migrated.plans[0].lines.map(line => line.product.id),
    legacy.plans[0].lines.map(line => line.product.id)
  );
  assert.deepEqual(
    migrated.plans[0].lines.flatMap(line => line.offers.map(offer => offer.id)),
    legacy.plans[0].lines.flatMap(line => line.offers.map(offer => offer.id))
  );
  assert.deepEqual(migrated.unmatched, legacy.unmatched);
  assert.deepEqual(
    new Set(migrated.matchedOffers.map(offer => offer.id)),
    new Set(legacy.matchedOffers.map(offer => offer.id))
  );
});
