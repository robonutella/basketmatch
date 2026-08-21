import type { GroceryListItem, Offer, Product, Store } from "@basketmatch/domain";

export const demoCalculationNow = new Date("2026-07-29T19:00:00.000Z");

export const demoStores: Store[] = [
  { id: "safeway", name: "Safeway", distanceMiles: 1.8 },
  { id: "walmart", name: "Walmart", distanceMiles: 3.4 },
  { id: "target", name: "Target", distanceMiles: 2.6 }
];

const productDefaults = {
  currency: "USD" as const,
  available: true
};

export const demoProducts: Product[] = [
  { ...productDefaults, id: "sf-milk", storeId: "safeway", name: "Lucerne Whole Milk, 1 gal", aliases: ["milk", "whole milk"], category: "milk", upc: "021130070338", priceCents: 549 },
  { ...productDefaults, id: "wm-milk", storeId: "walmart", name: "Great Value Whole Milk, 1 gal", aliases: ["milk", "whole milk"], category: "milk", upc: "007874204122", priceCents: 384 },
  { ...productDefaults, id: "tg-milk", storeId: "target", name: "Good & Gather Whole Milk, 1 gal", aliases: ["milk", "whole milk"], category: "milk", upc: "008523906855", priceCents: 419 },
  { ...productDefaults, id: "sf-eggs", storeId: "safeway", name: "Lucerne Large Eggs, 12 ct", aliases: ["eggs", "dozen eggs"], category: "eggs", upc: "021130031681", priceCents: 499 },
  { ...productDefaults, id: "wm-eggs", storeId: "walmart", name: "Great Value Large Eggs, 12 ct", aliases: ["eggs", "dozen eggs"], category: "eggs", upc: "007874223908", priceCents: 367 },
  { ...productDefaults, id: "tg-eggs", storeId: "target", name: "Good & Gather Large Eggs, 12 ct", aliases: ["eggs", "dozen eggs"], category: "eggs", upc: "008523902543", priceCents: 399 },
  { ...productDefaults, id: "sf-chicken", storeId: "safeway", name: "Boneless Skinless Chicken Breast, 2 lb", aliases: ["chicken", "chicken breast"], category: "meat", priceCents: 1098 },
  { ...productDefaults, id: "wm-chicken", storeId: "walmart", name: "Boneless Skinless Chicken Breast, 2 lb", aliases: ["chicken", "chicken breast"], category: "meat", priceCents: 976 },
  { ...productDefaults, id: "tg-chicken", storeId: "target", name: "Good & Gather Chicken Breast, 2 lb", aliases: ["chicken", "chicken breast"], category: "meat", priceCents: 1149 },
  { ...productDefaults, id: "sf-rice", storeId: "safeway", name: "Mahatma Long Grain Rice, 5 lb", aliases: ["rice", "white rice"], category: "rice", priceCents: 749 },
  { ...productDefaults, id: "wm-rice", storeId: "walmart", name: "Great Value Long Grain Rice, 5 lb", aliases: ["rice", "white rice"], category: "rice", priceCents: 464 },
  { ...productDefaults, id: "tg-rice", storeId: "target", name: "Good & Gather Long Grain Rice, 5 lb", aliases: ["rice", "white rice"], category: "rice", priceCents: 529 },
  { ...productDefaults, id: "sf-strawberries", storeId: "safeway", name: "Fresh Strawberries, 1 lb", aliases: ["strawberries", "strawberry"], category: "produce", priceCents: 499 },
  { ...productDefaults, id: "wm-strawberries", storeId: "walmart", name: "Fresh Strawberries, 1 lb", aliases: ["strawberries", "strawberry"], category: "produce", priceCents: 348 },
  { ...productDefaults, id: "tg-strawberries", storeId: "target", name: "Fresh Strawberries, 1 lb", aliases: ["strawberries", "strawberry"], category: "produce", priceCents: 399 },
  { ...productDefaults, id: "sf-tide", storeId: "safeway", name: "Tide Original Liquid, 84 oz", aliases: ["tide", "laundry detergent", "detergent"], category: "laundry", brand: "Tide", size: "84 oz", upc: "003700087458", priceCents: 1899 },
  { ...productDefaults, id: "wm-tide", storeId: "walmart", name: "Tide Original Liquid, 84 oz", aliases: ["tide", "laundry detergent", "detergent"], category: "laundry", brand: "Tide", size: "84 oz", upc: "003700087465", priceCents: 1794 },
  { ...productDefaults, id: "tg-tide", storeId: "target", name: "Tide Original Liquid, 84 oz", aliases: ["tide", "laundry detergent", "detergent"], category: "laundry", brand: "Tide", size: "84 oz", upc: "003700087472", priceCents: 1849 }
];

const offerDefaults = {
  scope: "item" as const,
  minimumQuantity: 1,
  redemptionCount: 0,
  evidence: []
};

export const demoOffers: Offer[] = [
  { ...offerDefaults, id: "sf-meat-2", title: "$2 off a meat purchase", provider: "Safeway for U", sourceType: "retailer_loyalty", storeId: "safeway", category: "meat", redemptionMode: "checkout", amountOffCents: 200, confidencePercent: 99, status: "verified", expiresAt: "2026-08-06T06:59:59.000Z", stackGroup: "retailer-item" },
  { ...offerDefaults, id: "mfr-tide-3", title: "$3 off Tide 84 oz or larger", provider: "Tide manufacturer offer", sourceType: "manufacturer", brand: "Tide", category: "laundry", eligibleSizes: ["84 oz"], redemptionMode: "checkout", amountOffCents: 300, confidencePercent: 96, status: "verified", expiresAt: "2026-08-13T06:59:59.000Z", stackGroup: "manufacturer-item" },
  { ...offerDefaults, id: "ibotta-tide-2", title: "$2 Tide cashback", provider: "Rebate network", sourceType: "rebate", brand: "Tide", category: "laundry", eligibleSizes: ["84 oz"], redemptionMode: "rebate", amountOffCents: 200, confidencePercent: 91, status: "recently_redeemed", lastRedeemedAt: "2026-07-28T19:00:00.000Z", expiresAt: "2026-08-03T06:59:59.000Z", stackGroup: "rebate-item" },
  { ...offerDefaults, id: "target-berries-10", title: "10% off fresh berries", provider: "Target Circle", sourceType: "retailer_loyalty", storeId: "target", category: "produce", redemptionMode: "checkout", percentOffBasisPoints: 1000, confidencePercent: 98, status: "verified", expiresAt: "2026-08-02T06:59:59.000Z", stackGroup: "retailer-item" },
  { ...offerDefaults, id: "sf-milk-1", title: "$1 off one gallon of milk", provider: "Digital manufacturer coupon", sourceType: "manufacturer", category: "milk", redemptionMode: "checkout", amountOffCents: 100, confidencePercent: 87, status: "recently_redeemed", lastRedeemedAt: "2026-07-27T19:00:00.000Z", expiresAt: "2026-08-04T06:59:59.000Z", stackGroup: "manufacturer-item" },
  { ...offerDefaults, scope: "basket", id: "walmart-pickup-5", title: "$5 off a $35 pickup order", provider: "Online promo code", sourceType: "promo_code", storeId: "walmart", redemptionMode: "checkout", amountOffCents: 500, minimumSpendCents: 3500, confidencePercent: 55, status: "unverified", expiresAt: "2026-08-16T06:59:59.000Z", stackGroup: "basket-promo", promoCode: "DEMO5" }
];

export const demoItems: GroceryListItem[] = [
  { id: "demo-item-milk", name: "milk", quantity: 1, purchased: false },
  { id: "demo-item-eggs", name: "eggs", quantity: 1, purchased: false },
  { id: "demo-item-chicken", name: "chicken breast", quantity: 1, purchased: false },
  { id: "demo-item-strawberries", name: "strawberries", quantity: 1, purchased: false },
  { id: "demo-item-tide", name: "Tide", quantity: 1, purchased: false }
];
