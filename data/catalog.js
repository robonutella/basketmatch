export const stores = [
  { id: "safeway", name: "Safeway", distanceMiles: 1.8 },
  { id: "walmart", name: "Walmart", distanceMiles: 3.4 },
  { id: "target", name: "Target", distanceMiles: 2.6 }
];

export const products = [
  { id: "sf-milk", storeId: "safeway", name: "Lucerne Whole Milk, 1 gal", aliases: ["milk", "whole milk"], category: "milk", price: 5.49 },
  { id: "wm-milk", storeId: "walmart", name: "Great Value Whole Milk, 1 gal", aliases: ["milk", "whole milk"], category: "milk", price: 3.84 },
  { id: "tg-milk", storeId: "target", name: "Good & Gather Whole Milk, 1 gal", aliases: ["milk", "whole milk"], category: "milk", price: 4.19 },

  { id: "sf-eggs", storeId: "safeway", name: "Lucerne Large Eggs, 12 ct", aliases: ["eggs", "dozen eggs"], category: "eggs", price: 4.99 },
  { id: "wm-eggs", storeId: "walmart", name: "Great Value Large Eggs, 12 ct", aliases: ["eggs", "dozen eggs"], category: "eggs", price: 3.67 },
  { id: "tg-eggs", storeId: "target", name: "Good & Gather Large Eggs, 12 ct", aliases: ["eggs", "dozen eggs"], category: "eggs", price: 3.99 },

  { id: "sf-chicken", storeId: "safeway", name: "Boneless Skinless Chicken Breast, 2 lb", aliases: ["chicken", "chicken breast"], category: "meat", price: 10.98 },
  { id: "wm-chicken", storeId: "walmart", name: "Boneless Skinless Chicken Breast, 2 lb", aliases: ["chicken", "chicken breast"], category: "meat", price: 9.76 },
  { id: "tg-chicken", storeId: "target", name: "Good & Gather Chicken Breast, 2 lb", aliases: ["chicken", "chicken breast"], category: "meat", price: 11.49 },

  { id: "sf-rice", storeId: "safeway", name: "Mahatma Long Grain Rice, 5 lb", aliases: ["rice", "white rice"], category: "rice", price: 7.49 },
  { id: "wm-rice", storeId: "walmart", name: "Great Value Long Grain Rice, 5 lb", aliases: ["rice", "white rice"], category: "rice", price: 4.64 },
  { id: "tg-rice", storeId: "target", name: "Good & Gather Long Grain Rice, 5 lb", aliases: ["rice", "white rice"], category: "rice", price: 5.29 },

  { id: "sf-strawberries", storeId: "safeway", name: "Fresh Strawberries, 1 lb", aliases: ["strawberries", "strawberry"], category: "produce", price: 4.99 },
  { id: "wm-strawberries", storeId: "walmart", name: "Fresh Strawberries, 1 lb", aliases: ["strawberries", "strawberry"], category: "produce", price: 3.48 },
  { id: "tg-strawberries", storeId: "target", name: "Fresh Strawberries, 1 lb", aliases: ["strawberries", "strawberry"], category: "produce", price: 3.99 },

  { id: "sf-tide", storeId: "safeway", name: "Tide Original Liquid, 84 oz", aliases: ["tide", "laundry detergent", "detergent"], category: "laundry", brand: "Tide", price: 18.99 },
  { id: "wm-tide", storeId: "walmart", name: "Tide Original Liquid, 84 oz", aliases: ["tide", "laundry detergent", "detergent"], category: "laundry", brand: "Tide", price: 17.94 },
  { id: "tg-tide", storeId: "target", name: "Tide Original Liquid, 84 oz", aliases: ["tide", "laundry detergent", "detergent"], category: "laundry", brand: "Tide", price: 18.49 }
];

export const offers = [
  {
    id: "sf-meat-2",
    title: "$2 off a meat purchase",
    provider: "Safeway for U",
    sourceType: "retailer",
    storeId: "safeway",
    category: "meat",
    redemptionMode: "checkout",
    amount: 2,
    confidence: 99,
    status: "verified",
    expiresAt: "2026-08-05",
    stackGroup: "retailer-item"
  },
  {
    id: "mfr-tide-3",
    title: "$3 off Tide 84 oz or larger",
    provider: "Tide manufacturer offer",
    sourceType: "manufacturer",
    brand: "Tide",
    category: "laundry",
    redemptionMode: "checkout",
    amount: 3,
    confidence: 96,
    status: "verified",
    expiresAt: "2026-08-12",
    stackGroup: "manufacturer-item"
  },
  {
    id: "ibotta-tide-2",
    title: "$2 Tide cashback",
    provider: "Rebate network",
    sourceType: "rebate",
    brand: "Tide",
    category: "laundry",
    redemptionMode: "rebate",
    amount: 2,
    confidence: 91,
    status: "recent",
    expiresAt: "2026-08-02",
    stackGroup: "rebate-item"
  },
  {
    id: "target-berries-10",
    title: "10% off fresh berries",
    provider: "Target Circle",
    sourceType: "retailer",
    storeId: "target",
    category: "produce",
    redemptionMode: "checkout",
    percent: 10,
    confidence: 98,
    status: "verified",
    expiresAt: "2026-08-01",
    stackGroup: "retailer-item"
  },
  {
    id: "sf-milk-1",
    title: "$1 off one gallon of milk",
    provider: "Digital manufacturer coupon",
    sourceType: "manufacturer",
    category: "milk",
    redemptionMode: "checkout",
    amount: 1,
    confidence: 87,
    status: "recent",
    expiresAt: "2026-08-03",
    stackGroup: "manufacturer-item"
  },
  {
    id: "walmart-pickup-5",
    title: "$5 off a $35 pickup order",
    provider: "Online promo code",
    sourceType: "promo-code",
    storeId: "walmart",
    redemptionMode: "checkout",
    amount: 5,
    minimumBasket: 35,
    confidence: 55,
    status: "unverified",
    expiresAt: "2026-08-15",
    stackGroup: "basket-promo"
  }
];
