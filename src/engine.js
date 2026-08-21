const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;

export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function productMatchesQuery(product, query) {
  const q = normalize(query);
  if (!q) return false;
  const searchable = [product.name, product.category, product.brand, ...(product.aliases || [])]
    .filter(Boolean)
    .map(normalize);
  return searchable.some(value => value === q || value.includes(q) || q.includes(value));
}

export function offerMatchesProduct(offer, product) {
  if (offer.storeId && offer.storeId !== product.storeId) return false;
  if (offer.productIds && !offer.productIds.includes(product.id)) return false;
  if (offer.brand && normalize(offer.brand) !== normalize(product.brand)) return false;
  if (offer.category && normalize(offer.category) !== normalize(product.category)) return false;
  return Boolean(offer.productIds || offer.brand || offer.category);
}

function offerDiscount(offer, price) {
  if (offer.percent) return roundMoney(price * (offer.percent / 100));
  return roundMoney(Math.min(price, offer.amount || 0));
}

export function priceProduct(product, offers, options = {}) {
  const { includeRebates = true, verifiedOnly = true, now = new Date("2026-07-29T12:00:00-07:00") } = options;
  const valid = offers.filter(offer => {
    if (!offerMatchesProduct(offer, product)) return false;
    if (verifiedOnly && offer.status === "unverified") return false;
    if (offer.expiresAt && new Date(`${offer.expiresAt}T23:59:59`) < now) return false;
    if (!includeRebates && offer.redemptionMode === "rebate") return false;
    return true;
  });

  const chosen = [];
  const usedGroups = new Set();
  const ordered = [...valid].sort((a, b) => offerDiscount(b, product.price) - offerDiscount(a, product.price));
  let checkoutDiscount = 0;
  let rebate = 0;

  for (const offer of ordered) {
    if (usedGroups.has(offer.stackGroup)) continue;
    const discount = offerDiscount(offer, product.price);
    if (offer.redemptionMode === "rebate") rebate += discount;
    else checkoutDiscount += discount;
    usedGroups.add(offer.stackGroup);
    chosen.push({ ...offer, appliedDiscount: discount });
  }

  checkoutDiscount = Math.min(product.price, checkoutDiscount);
  const checkoutPrice = roundMoney(product.price - checkoutDiscount);
  rebate = Math.min(checkoutPrice, rebate);
  const netPrice = roundMoney(checkoutPrice - rebate);

  return { product, basePrice: product.price, checkoutDiscount: roundMoney(checkoutDiscount), rebate: roundMoney(rebate), checkoutPrice, netPrice, offers: chosen };
}

export function matchItemsToProducts(items, products) {
  return items.map(item => ({
    item,
    products: products.filter(product => productMatchesQuery(product, item.name))
  }));
}

function applyBasketOffers(plan, offers, options) {
  const { verifiedOnly = true, now = new Date("2026-07-29T12:00:00-07:00") } = options;
  let basketDiscount = 0;
  const matched = [];

  for (const offer of offers) {
    if (offer.stackGroup !== "basket-promo") continue;
    if (verifiedOnly && offer.status === "unverified") continue;
    if (offer.expiresAt && new Date(`${offer.expiresAt}T23:59:59`) < now) continue;
    const storeSpend = plan.lines
      .filter(line => line.product.storeId === offer.storeId)
      .reduce((sum, line) => sum + line.checkoutPrice, 0);
    if (storeSpend >= (offer.minimumBasket || 0)) {
      const discount = Math.min(storeSpend, offer.amount || 0);
      basketDiscount += discount;
      matched.push({ ...offer, appliedDiscount: discount });
    }
  }

  return { basketDiscount: roundMoney(basketDiscount), basketOffers: matched };
}

function summarizePlan(lines, stores, offers, options, label, strategy) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.basePrice, 0));
  const itemCheckoutDiscounts = roundMoney(lines.reduce((sum, line) => sum + line.checkoutDiscount, 0));
  const rebates = roundMoney(lines.reduce((sum, line) => sum + line.rebate, 0));
  const storeIds = [...new Set(lines.map(line => line.product.storeId))];
  const draft = { lines, storeIds };
  const { basketDiscount, basketOffers } = applyBasketOffers(draft, offers, options);
  const checkoutTotal = roundMoney(subtotal - itemCheckoutDiscounts - basketDiscount);
  const netTotal = roundMoney(checkoutTotal - rebates);
  const savings = roundMoney(subtotal - netTotal);
  return {
    label,
    strategy,
    lines,
    subtotal,
    itemCheckoutDiscounts,
    basketDiscount,
    rebates,
    checkoutTotal,
    netTotal,
    savings,
    basketOffers,
    stores: storeIds.map(id => stores.find(store => store.id === id)).filter(Boolean)
  };
}

export function optimizeBasket({ items, products, offers, stores, includeRebates = true, verifiedOnly = true, maxStores = 2 }) {
  const options = { includeRebates, verifiedOnly };
  const activeItems = items.filter(item => !item.purchased);
  const matches = matchItemsToProducts(activeItems, products);
  const unmatched = matches.filter(match => match.products.length === 0).map(match => match.item.name);
  const matchable = matches.filter(match => match.products.length > 0);

  if (!matchable.length) return { plans: [], unmatched, matchedOffers: [] };

  const priced = matchable.map(match => ({
    item: match.item,
    choices: match.products.map(product => priceProduct(product, offers, options))
  }));

  const plans = [];

  // Best single-store plan for every store that carries all matched items.
  for (const store of stores) {
    const lines = [];
    let complete = true;
    for (const entry of priced) {
      const storeChoices = entry.choices.filter(choice => choice.product.storeId === store.id);
      if (!storeChoices.length) { complete = false; break; }
      storeChoices.sort((a, b) => a.netPrice - b.netPrice);
      lines.push(storeChoices[0]);
    }
    if (complete) plans.push(summarizePlan(lines, stores, offers, options, `${store.name} only`, "one-store"));
  }

  // Cheapest item-by-item split, honoring maximum store count with a greedy reduction.
  let splitLines = priced.map(entry => [...entry.choices].sort((a, b) => a.netPrice - b.netPrice)[0]);
  let splitStores = [...new Set(splitLines.map(line => line.product.storeId))];
  if (splitStores.length > maxStores) {
    const storeCost = splitStores.map(storeId => ({
      storeId,
      cost: splitLines.filter(line => line.product.storeId === storeId).reduce((sum, line) => sum + line.netPrice, 0)
    })).sort((a, b) => b.cost - a.cost);
    const keep = new Set(storeCost.slice(0, maxStores).map(entry => entry.storeId));
    splitLines = priced.map(entry => {
      const allowed = entry.choices.filter(choice => keep.has(choice.product.storeId));
      const pool = allowed.length ? allowed : entry.choices;
      return [...pool].sort((a, b) => a.netPrice - b.netPrice)[0];
    });
  }
  plans.push(summarizePlan(splitLines, stores, offers, options, `Best split basket`, "split"));

  const deduped = [];
  const keys = new Set();
  for (const plan of plans.sort((a, b) => a.netTotal - b.netTotal)) {
    const key = plan.lines.map(line => line.product.id).sort().join("|");
    if (!keys.has(key)) { keys.add(key); deduped.push(plan); }
  }

  const matchedOffers = deduped.flatMap(plan => [
    ...plan.lines.flatMap(line => line.offers),
    ...plan.basketOffers
  ]).filter((offer, index, all) => all.findIndex(candidate => candidate.id === offer.id) === index);

  return { plans: deduped.slice(0, 3), unmatched, matchedOffers };
}
