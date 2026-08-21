import test from "node:test";
import assert from "node:assert/strict";
import { products, offers, stores } from "../data/catalog.js";
import { productMatchesQuery, priceProduct, optimizeBasket } from "../src/engine.js";

test("matches common grocery aliases", () => {
  const milk = products.find(product => product.id === "wm-milk");
  assert.equal(productMatchesQuery(milk, "milk"), true);
  assert.equal(productMatchesQuery(milk, "paper towels"), false);
});

test("stacks one manufacturer coupon and one rebate", () => {
  const tide = products.find(product => product.id === "wm-tide");
  const result = priceProduct(tide, offers, { includeRebates: true, verifiedOnly: true });
  assert.equal(result.checkoutPrice, 14.94);
  assert.equal(result.netPrice, 12.94);
});

test("excludes unverified basket promo by default", () => {
  const items = [
    { id: "1", name: "Tide", purchased: false },
    { id: "2", name: "chicken breast", purchased: false },
    { id: "3", name: "rice", purchased: false },
    { id: "4", name: "milk", purchased: false }
  ];
  const outcome = optimizeBasket({ items, products, offers, stores, verifiedOnly: true, maxStores: 1 });
  assert.ok(outcome.plans.every(plan => plan.basketDiscount === 0));
});

test("returns a recommended basket", () => {
  const items = [
    { id: "1", name: "milk", purchased: false },
    { id: "2", name: "eggs", purchased: false }
  ];
  const outcome = optimizeBasket({ items, products, offers, stores });
  assert.ok(outcome.plans.length > 0);
  assert.ok(outcome.plans[0].netTotal > 0);
});
