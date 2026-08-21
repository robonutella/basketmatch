import type {
  AppliedOffer,
  BasketOptimizationResult,
  BasketPlan,
  BasketPlanLine,
  CalculationReasonCode,
  CalculationTraceEntry,
  GroceryListItem,
  Offer,
  Product,
  Store
} from "@basketmatch/domain";

export interface PricingOptions {
  includeRebates?: boolean;
  verifiedOnly?: boolean;
  now?: Date | string;
}

export interface PriceProductOptions extends PricingOptions {
  quantity?: number;
}

export interface PriceProductResult {
  product: Product;
  quantity: number;
  basePriceCents: number;
  checkoutDiscountCents: number;
  rebateCents: number;
  checkoutPriceCents: number;
  netPriceCents: number;
  offers: AppliedOffer[];
  calculationTrace: CalculationTraceEntry[];
}

export interface ProductMatch {
  item: GroceryListItem;
  products: Product[];
}

export interface OptimizeBasketInput extends PricingOptions {
  items: GroceryListItem[];
  products: Product[];
  offers: Offer[];
  stores: Store[];
  maxStores?: number;
}

type OfferEvaluation = {
  offer: Offer;
  inputIndex: number;
  discountCents: number;
  metadata?: Record<string, unknown>;
  rejection?: { reasonCode: CalculationReasonCode; message: string };
  appliedDiscountCents?: number;
};

type LineChoice = PriceProductResult & { groceryListItemId: string };

const TRUSTED_STATUSES = new Set<Offer["status"]>(["verified", "recently_redeemed"]);

export function normalize(text: unknown): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function productMatchesQuery(product: Product, query: string): boolean {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return false;
  if (product.upc && query.trim() === product.upc) return true;

  const searchable = [product.name, product.category, product.brand, ...product.aliases]
    .filter((value): value is string => Boolean(value))
    .map(normalize);

  return searchable.some(
    value => value === normalizedQuery || value.includes(normalizedQuery) || normalizedQuery.includes(value)
  );
}

function requestedProductMatches(item: GroceryListItem, product: Product): boolean {
  if (item.requestedUpc) {
    if (item.requestedUpc !== product.upc) return false;
  } else if (!productMatchesQuery(product, item.name)) {
    return false;
  }
  if (item.requestedCategory && normalize(item.requestedCategory) !== normalize(product.category)) return false;
  if (item.requestedBrand && normalize(item.requestedBrand) !== normalize(product.brand)) return false;
  return true;
}

function productOfferMismatch(
  offer: Offer,
  product: Product
): { reasonCode: CalculationReasonCode; message: string } | undefined {
  if (offer.scope === "basket") {
    return { reasonCode: "scope_mismatch", message: "Basket-level offer is not evaluated against an item." };
  }
  if (offer.storeId && offer.storeId !== product.storeId) {
    return { reasonCode: "store_mismatch", message: `Offer is not valid at store ${product.storeId}.` };
  }
  if (offer.productIds && !offer.productIds.includes(product.id)) {
    return { reasonCode: "product_mismatch", message: `Product ${product.id} is not explicitly eligible.` };
  }
  if (offer.upcs && (!product.upc || !offer.upcs.includes(product.upc))) {
    return { reasonCode: "upc_mismatch", message: "The product UPC/GTIN is not an exact eligible code." };
  }
  if (offer.brand && normalize(offer.brand) !== normalize(product.brand)) {
    return { reasonCode: "brand_mismatch", message: `Product brand does not match ${offer.brand}.` };
  }
  if (offer.category && normalize(offer.category) !== normalize(product.category)) {
    return { reasonCode: "category_mismatch", message: `Product category does not match ${offer.category}.` };
  }
  if (offer.eligibleSizes && (
    !product.size || !offer.eligibleSizes.some(size => normalize(size) === normalize(product.size))
  )) {
    return { reasonCode: "size_mismatch", message: "Product package size is not explicitly eligible." };
  }

  const hasProductSelector = Boolean(
    offer.productIds || offer.upcs || offer.brand || offer.category || offer.eligibleSizes
  );
  if (!hasProductSelector) {
    return { reasonCode: "scope_mismatch", message: "Basket-level offer is not evaluated against an item." };
  }
  return undefined;
}

export function offerMatchesProduct(offer: Offer, product: Product): boolean {
  return productOfferMismatch(offer, product) === undefined;
}

function parseNow(now: Date | string | undefined): Date {
  const parsed = now instanceof Date ? new Date(now) : new Date(now ?? Date.now());
  if (Number.isNaN(parsed.getTime())) throw new TypeError("Pricing options.now must be a valid date");
  return parsed;
}

function statusRejection(
  offer: Offer,
  options: Required<Pick<PricingOptions, "includeRebates" | "verifiedOnly">>,
  now: Date
): { reasonCode: CalculationReasonCode; message: string } | undefined {
  if (offer.status === "failed") {
    return offer.sourceType === "promo_code"
      ? {
          reasonCode: "promo_validation_failed",
          message: offer.validationFailureReason ?? "Promo-code validation failed."
        }
      : { reasonCode: "failed", message: "Provider validation marked this offer as failed." };
  }
  if (offer.status === "expired") {
    return { reasonCode: "expired", message: "Offer is marked expired." };
  }
  if (offer.startsAt && new Date(offer.startsAt) > now) {
    return { reasonCode: "not_started", message: `Offer starts at ${offer.startsAt}.` };
  }
  if (offer.expiresAt && new Date(offer.expiresAt) <= now) {
    return { reasonCode: "expired", message: `Offer expired at ${offer.expiresAt}.` };
  }
  if (options.verifiedOnly && !TRUSTED_STATUSES.has(offer.status)) {
    return { reasonCode: "unverified", message: "Offer is not verified or recently redeemed." };
  }
  if (offer.redemptionLimit !== undefined && offer.redemptionCount >= offer.redemptionLimit) {
    return { reasonCode: "already_redeemed", message: "The redemption limit has already been reached." };
  }
  if (!options.includeRebates && offer.redemptionMode === "rebate") {
    return { reasonCode: "rebate_disabled", message: "Post-purchase rebates are disabled for this calculation." };
  }
  return undefined;
}

function offerDiscountCents(offer: Offer, eligibleSpendCents: number): number {
  if (offer.percentOffBasisPoints !== undefined) {
    const percentageValue = Math.round((eligibleSpendCents * offer.percentOffBasisPoints) / 10_000);
    return Math.min(eligibleSpendCents, percentageValue, offer.maxDiscountCents ?? eligibleSpendCents);
  }
  return Math.min(eligibleSpendCents, offer.amountOffCents ?? 0);
}

function makeTrace(
  evaluation: OfferEvaluation,
  scope: "item" | "basket",
  evaluatedAt: string,
  productId?: string
): CalculationTraceEntry {
  const rejection = evaluation.rejection;
  const appliedDiscountCents = evaluation.appliedDiscountCents;
  const applied = !rejection && appliedDiscountCents !== undefined && appliedDiscountCents > 0;
  return {
    sequence: evaluation.inputIndex,
    scope,
    decision: applied ? "applied" : "rejected",
    reasonCode: applied ? "applied" : (rejection?.reasonCode ?? "zero_value"),
    message: applied
      ? `Applied ${appliedDiscountCents} cents from ${evaluation.offer.title}.`
      : (rejection?.message ?? "Offer produced no discount."),
    offerId: evaluation.offer.id,
    offerTitle: evaluation.offer.title,
    ...(productId ? { productId } : {}),
    evaluatedAt,
    ...(applied ? { appliedDiscountCents } : {}),
    metadata: {
      provider: evaluation.offer.provider,
      sourceType: evaluation.offer.sourceType,
      status: evaluation.offer.status,
      storeId: evaluation.offer.storeId,
      productIds: evaluation.offer.productIds,
      upcs: evaluation.offer.upcs,
      category: evaluation.offer.category,
      brand: evaluation.offer.brand,
      eligibleSizes: evaluation.offer.eligibleSizes,
      startsAt: evaluation.offer.startsAt,
      expiresAt: evaluation.offer.expiresAt,
      redemptionLimit: evaluation.offer.redemptionLimit,
      redemptionCount: evaluation.offer.redemptionCount,
      evidence: evaluation.offer.evidence.map(item => ({
        id: item.id,
        kind: item.kind,
        outcome: item.outcome,
        capturedAt: item.capturedAt
      })),
      stackGroup: evaluation.offer.stackGroup,
      redemptionMode: evaluation.offer.redemptionMode,
      ...evaluation.metadata
    }
  };
}

export function priceProduct(
  product: Product,
  offers: Offer[],
  options: PriceProductOptions = {}
): PriceProductResult {
  const resolvedOptions = {
    includeRebates: options.includeRebates ?? true,
    verifiedOnly: options.verifiedOnly ?? true
  };
  const now = parseNow(options.now);
  const quantity = options.quantity ?? 1;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new TypeError("Pricing options.quantity must be a positive safe integer");
  }
  const basePriceCents = product.priceCents * quantity;
  if (!Number.isSafeInteger(basePriceCents)) {
    throw new RangeError("Extended product price exceeds the safe integer range");
  }
  const evaluations: OfferEvaluation[] = offers.map((offer, inputIndex) => {
    const mismatch = productOfferMismatch(offer, product);
    const quantityMismatch = offer.minimumQuantity > quantity
      ? {
          reasonCode: "minimum_quantity_not_met" as const,
          message: `Offer requires quantity ${offer.minimumQuantity}; basket line has ${quantity}.`
        }
      : undefined;
    const minimumSpendMismatch = offer.minimumSpendCents !== undefined && basePriceCents < offer.minimumSpendCents
      ? {
          reasonCode: "minimum_spend_not_met" as const,
          message: `Eligible item spend is ${basePriceCents} cents; ${offer.minimumSpendCents} cents is required.`
        }
      : undefined;
    const rejection = mismatch ?? quantityMismatch ?? minimumSpendMismatch ?? statusRejection(offer, resolvedOptions, now);
    return {
      offer,
      inputIndex,
      discountCents: rejection ? 0 : offerDiscountCents(offer, basePriceCents),
      metadata: {
        productStoreId: product.storeId,
        productUpc: product.upc,
        productCategory: product.category,
        productBrand: product.brand,
        productSize: product.size,
        eligibleSpendCents: basePriceCents,
        quantity
      },
      ...(rejection ? { rejection } : {})
    };
  });

  const eligible = evaluations
    .filter(evaluation => !evaluation.rejection)
    .sort((left, right) =>
      right.discountCents - left.discountCents || left.inputIndex - right.inputIndex
    );
  const selected: OfferEvaluation[] = [];
  const usedGroups = new Set<string>();

  for (const evaluation of eligible) {
    if (usedGroups.has(evaluation.offer.stackGroup)) {
      evaluation.rejection = {
        reasonCode: "stack_conflict",
        message: `A higher-value offer already used stack group ${evaluation.offer.stackGroup}.`
      };
      continue;
    }
    if (evaluation.discountCents <= 0) {
      evaluation.rejection = { reasonCode: "zero_value", message: "Offer produced no discount." };
      continue;
    }
    usedGroups.add(evaluation.offer.stackGroup);
    selected.push(evaluation);
  }

  let checkoutRemainingCents = basePriceCents;
  for (const evaluation of selected.filter(item => item.offer.redemptionMode === "checkout")) {
    evaluation.appliedDiscountCents = Math.min(evaluation.discountCents, checkoutRemainingCents);
    checkoutRemainingCents -= evaluation.appliedDiscountCents;
  }

  const checkoutPriceCents = checkoutRemainingCents;
  let rebateRemainingCents = checkoutPriceCents;
  for (const evaluation of selected.filter(item => item.offer.redemptionMode === "rebate")) {
    evaluation.appliedDiscountCents = Math.min(evaluation.discountCents, rebateRemainingCents);
    rebateRemainingCents -= evaluation.appliedDiscountCents;
  }

  const applied = selected.filter(
    (evaluation): evaluation is OfferEvaluation & { appliedDiscountCents: number } =>
      (evaluation.appliedDiscountCents ?? 0) > 0
  );
  const checkoutDiscountCents = basePriceCents - checkoutPriceCents;
  const rebateCents = checkoutPriceCents - rebateRemainingCents;
  const evaluatedAt = now.toISOString();

  return {
    product,
    quantity,
    basePriceCents,
    checkoutDiscountCents,
    rebateCents,
    checkoutPriceCents,
    netPriceCents: checkoutPriceCents - rebateCents,
    offers: applied.map(evaluation => ({
      ...evaluation.offer,
      appliedDiscountCents: evaluation.appliedDiscountCents
    })),
    calculationTrace: evaluations
      .sort((left, right) => left.inputIndex - right.inputIndex)
      .map(evaluation => makeTrace(evaluation, "item", evaluatedAt, product.id))
  };
}

export function matchItemsToProducts(items: GroceryListItem[], products: Product[]): ProductMatch[] {
  return items.map(item => ({
    item,
    products: products.filter(product => product.available && requestedProductMatches(item, product))
  }));
}

function isBasketOffer(offer: Offer): boolean {
  return offer.scope === "basket";
}

function applyBasketOffers(
  lines: LineChoice[],
  offers: Offer[],
  options: PricingOptions,
  now: Date
): {
  basketDiscountCents: number;
  basketRebateCents: number;
  basketOffers: AppliedOffer[];
  trace: CalculationTraceEntry[];
} {
  const resolvedOptions = {
    includeRebates: options.includeRebates ?? true,
    verifiedOnly: options.verifiedOnly ?? true
  };
  const storeSpend = new Map<string, number>();
  for (const line of lines) {
    storeSpend.set(
      line.product.storeId,
      (storeSpend.get(line.product.storeId) ?? 0) + line.checkoutPriceCents
    );
  }
  const basketSpendCents = lines.reduce((sum, line) => sum + line.checkoutPriceCents, 0);
  const basketOffers = offers.filter(isBasketOffer);
  const evaluations: OfferEvaluation[] = basketOffers.map((offer, inputIndex) => {
    const applicableSpendCents = offer.storeId
      ? (storeSpend.get(offer.storeId) ?? 0)
      : basketSpendCents;
    let rejection = statusRejection(offer, resolvedOptions, now);
    if (!rejection && offer.storeId && !storeSpend.has(offer.storeId)) {
      rejection = { reasonCode: "store_mismatch", message: `Basket has no items at store ${offer.storeId}.` };
    }
    if (!rejection && applicableSpendCents < (offer.minimumSpendCents ?? 0)) {
      rejection = {
        reasonCode: "minimum_spend_not_met",
        message: `Eligible spend is ${applicableSpendCents} cents; ${offer.minimumSpendCents} cents is required.`
      };
    }
    return {
      offer,
      inputIndex,
      discountCents: rejection ? 0 : offerDiscountCents(offer, applicableSpendCents),
      metadata: {
        eligibleSpendCents: applicableSpendCents,
        minimumSpendCents: offer.minimumSpendCents ?? 0,
        basketSpendCents
      },
      ...(rejection ? { rejection } : {})
    };
  });

  const eligible = evaluations
    .filter(evaluation => !evaluation.rejection)
    .sort((left, right) =>
      right.discountCents - left.discountCents || left.inputIndex - right.inputIndex
    );
  const usedGroups = new Set<string>();
  const selected: OfferEvaluation[] = [];

  for (const evaluation of eligible) {
    if (usedGroups.has(evaluation.offer.stackGroup)) {
      evaluation.rejection = {
        reasonCode: "stack_conflict",
        message: `A higher-value offer already used stack group ${evaluation.offer.stackGroup}.`
      };
      continue;
    }
    if (evaluation.discountCents <= 0) {
      evaluation.rejection = { reasonCode: "zero_value", message: "Offer produced no discount." };
      continue;
    }
    usedGroups.add(evaluation.offer.stackGroup);
    selected.push(evaluation);
  }

  const remainingByStore = new Map(storeSpend);
  let remainingBasketCents = basketSpendCents;

  for (const evaluation of selected.filter(item => item.offer.redemptionMode === "checkout")) {
    const remainingEligibleCents = evaluation.offer.storeId
      ? (remainingByStore.get(evaluation.offer.storeId) ?? 0)
      : remainingBasketCents;
    evaluation.appliedDiscountCents = Math.min(
      evaluation.discountCents,
      remainingEligibleCents,
      remainingBasketCents
    );
    if (evaluation.appliedDiscountCents <= 0) {
      evaluation.rejection = { reasonCode: "zero_value", message: "Offer produced no discount." };
      continue;
    }
    remainingBasketCents -= evaluation.appliedDiscountCents;
    if (evaluation.offer.storeId) {
      remainingByStore.set(
        evaluation.offer.storeId,
        remainingEligibleCents - evaluation.appliedDiscountCents
      );
    }
  }

  const rebateRemainingByStore = new Map(remainingByStore);
  let rebateRemainingBasketCents = remainingBasketCents;
  for (const evaluation of selected.filter(item => item.offer.redemptionMode === "rebate")) {
    const remainingEligibleCents = evaluation.offer.storeId
      ? (rebateRemainingByStore.get(evaluation.offer.storeId) ?? 0)
      : rebateRemainingBasketCents;
    evaluation.appliedDiscountCents = Math.min(
      evaluation.discountCents,
      remainingEligibleCents,
      rebateRemainingBasketCents
    );
    if (evaluation.appliedDiscountCents <= 0) {
      evaluation.rejection = { reasonCode: "zero_value", message: "Offer produced no rebate." };
      continue;
    }
    rebateRemainingBasketCents -= evaluation.appliedDiscountCents;
    if (evaluation.offer.storeId) {
      rebateRemainingByStore.set(
        evaluation.offer.storeId,
        remainingEligibleCents - evaluation.appliedDiscountCents
      );
    }
  }

  const applied = evaluations.filter(
    (evaluation): evaluation is OfferEvaluation & { appliedDiscountCents: number } =>
      !evaluation.rejection && (evaluation.appliedDiscountCents ?? 0) > 0
  );
  const evaluatedAt = now.toISOString();
  return {
    basketDiscountCents: applied
      .filter(item => item.offer.redemptionMode === "checkout")
      .reduce((sum, item) => sum + item.appliedDiscountCents, 0),
    basketRebateCents: applied
      .filter(item => item.offer.redemptionMode === "rebate")
      .reduce((sum, item) => sum + item.appliedDiscountCents, 0),
    basketOffers: applied.map(evaluation => ({
      ...evaluation.offer,
      appliedDiscountCents: evaluation.appliedDiscountCents
    })),
    trace: evaluations
      .sort((left, right) => left.inputIndex - right.inputIndex)
      .map(evaluation => makeTrace(evaluation, "basket", evaluatedAt))
  };
}

function capRebateApplications(
  offers: AppliedOffer[],
  trace: CalculationTraceEntry[],
  availableCents: number
): {
  offers: AppliedOffer[];
  trace: CalculationTraceEntry[];
  rebateCents: number;
  remainingCents: number;
} {
  let remainingCents = availableCents;
  const appliedByOffer = new Map<string, number>();
  const adjustedOffers = offers.flatMap(offer => {
    if (offer.redemptionMode !== "rebate") return [offer];
    const appliedDiscountCents = Math.min(offer.appliedDiscountCents, remainingCents);
    remainingCents -= appliedDiscountCents;
    appliedByOffer.set(offer.id, appliedDiscountCents);
    return appliedDiscountCents > 0 ? [{ ...offer, appliedDiscountCents }] : [];
  });
  const adjustedTrace = trace.map(entry => {
    const appliedDiscountCents = appliedByOffer.get(entry.offerId);
    if (appliedDiscountCents === undefined) return entry;
    if (appliedDiscountCents === 0) {
      return {
        ...entry,
        decision: "rejected" as const,
        reasonCode: "total_cap_reached" as const,
        message: "Eligible rebate was not counted because trusted net cost cannot fall below zero.",
        appliedDiscountCents: undefined
      };
    }
    return {
      ...entry,
      appliedDiscountCents,
      message: `Applied ${appliedDiscountCents} cents from ${entry.offerTitle} after the net-total cap.`
    };
  });
  return {
    offers: adjustedOffers,
    trace: adjustedTrace,
    rebateCents: availableCents - remainingCents,
    remainingCents
  };
}

function planIdFor(lines: LineChoice[], strategy: BasketPlan["strategy"]): string {
  const productKey = lines.map(line => line.product.id).sort().join("-");
  return `plan-${strategy}-${productKey}`;
}

function enforceRedemptionLimits(
  inputLines: LineChoice[],
  offers: Offer[],
  options: PricingOptions
): LineChoice[] {
  const lines = [...inputLines];
  const disabledByLine = new Map<number, Set<string>>();
  const limitedOffers = offers.filter(offer => offer.redemptionLimit !== undefined);
  const maximumPasses = Math.max(1, limitedOffers.length * lines.length + 1);

  for (let pass = 0; pass < maximumPasses; pass += 1) {
    let changed = false;
    for (const offer of limitedOffers) {
      const remainingUses = Math.max(0, (offer.redemptionLimit ?? 0) - offer.redemptionCount);
      const occurrences = lines
        .map((line, lineIndex) => ({
          lineIndex,
          applied: line.offers.find(candidate => candidate.id === offer.id)
        }))
        .filter((entry): entry is { lineIndex: number; applied: AppliedOffer } => Boolean(entry.applied))
        .sort((left, right) =>
          right.applied.appliedDiscountCents - left.applied.appliedDiscountCents ||
          left.lineIndex - right.lineIndex
        );

      for (const occurrence of occurrences.slice(remainingUses)) {
        const disabled = disabledByLine.get(occurrence.lineIndex) ?? new Set<string>();
        if (disabled.has(offer.id)) continue;
        disabled.add(offer.id);
        disabledByLine.set(occurrence.lineIndex, disabled);

        const currentLine = lines[occurrence.lineIndex];
        if (!currentLine) continue;
        const lineOffers = offers.map(candidate =>
          disabled.has(candidate.id) && candidate.redemptionLimit !== undefined
            ? { ...candidate, redemptionCount: candidate.redemptionLimit }
            : candidate
        );
        lines[occurrence.lineIndex] = {
          ...priceProduct(currentLine.product, lineOffers, {
            ...options,
            quantity: currentLine.quantity
          }),
          groceryListItemId: currentLine.groceryListItemId
        };
        changed = true;
      }
    }
    if (!changed) return lines;
  }

  throw new Error("Unable to resolve per-plan offer redemption limits");
}

function summarizePlan(
  lines: LineChoice[],
  stores: Store[],
  offers: Offer[],
  options: PricingOptions,
  label: string,
  strategy: BasketPlan["strategy"],
  now: Date
): BasketPlan {
  const limitedLines = enforceRedemptionLimits(lines, offers, options);
  const subtotalCents = limitedLines.reduce((sum, line) => sum + line.basePriceCents, 0);
  const itemCheckoutDiscountsCents = limitedLines.reduce(
    (sum, line) => sum + line.checkoutDiscountCents,
    0
  );
  const planId = planIdFor(limitedLines, strategy);
  const basketResult = applyBasketOffers(limitedLines, offers, options, now);
  const checkoutTotalCents = Math.max(
    0,
    subtotalCents - itemCheckoutDiscountsCents - basketResult.basketDiscountCents
  );
  const storeIds = [...new Set(limitedLines.map(line => line.product.storeId))];
  let sequence = 0;

  const uncappedPlanLines: BasketPlanLine[] = limitedLines.map(line => {
    const calculationTrace = line.calculationTrace.map(entry => ({
      ...entry,
      sequence: sequence++,
      planId,
      groceryListItemId: line.groceryListItemId
    }));
    return { ...line, calculationTrace };
  });
  let rebateCapacityCents = checkoutTotalCents;
  const planLines = uncappedPlanLines.map(line => {
    const capped = capRebateApplications(line.offers, line.calculationTrace, rebateCapacityCents);
    rebateCapacityCents = capped.remainingCents;
    return {
      ...line,
      offers: capped.offers,
      calculationTrace: capped.trace,
      rebateCents: capped.rebateCents,
      netPriceCents: line.checkoutPriceCents - capped.rebateCents
    };
  });
  const uncappedBasketTrace = basketResult.trace.map(entry => ({ ...entry, sequence: sequence++, planId }));
  const cappedBasket = capRebateApplications(
    basketResult.basketOffers,
    uncappedBasketTrace,
    rebateCapacityCents
  );
  const basketTrace = cappedBasket.trace;
  const rebateTotalCents = checkoutTotalCents - cappedBasket.remainingCents;
  const netTotalCents = checkoutTotalCents - rebateTotalCents;
  const calculationTrace = [
    ...planLines.flatMap(line => line.calculationTrace),
    ...basketTrace
  ];

  return {
    id: planId,
    label,
    strategy,
    lines: planLines,
    subtotalCents,
    itemCheckoutDiscountsCents,
    basketDiscountCents: basketResult.basketDiscountCents,
    rebateTotalCents,
    checkoutTotalCents,
    netTotalCents,
    savingsCents: subtotalCents - netTotalCents,
    basketOffers: cappedBasket.offers,
    stores: storeIds.map(id => stores.find(store => store.id === id)).filter((store): store is Store => Boolean(store)),
    calculationTrace,
    calculatedAt: now.toISOString()
  };
}

function productChoiceVariants(choicePools: LineChoice[][], limit = 50_000): LineChoice[][] {
  let variants: LineChoice[][] = [[]];
  for (const pool of choicePools) {
    const next: LineChoice[][] = [];
    for (const variant of variants) {
      for (const choice of pool) {
        next.push([...variant, choice]);
        if (next.length >= limit) break;
      }
      if (next.length >= limit) break;
    }
    variants = next;
  }
  return variants;
}

function storeCombinations(storeIds: string[], maxStores: number): string[][] {
  const output: string[][] = [];
  const walk = (start: number, selected: string[]) => {
    if (selected.length > 0) output.push([...selected]);
    if (selected.length === maxStores) return;
    for (let index = start; index < storeIds.length; index += 1) {
      const storeId = storeIds[index];
      if (!storeId) continue;
      selected.push(storeId);
      walk(index + 1, selected);
      selected.pop();
    }
  };
  walk(0, []);
  return output;
}

export function optimizeBasket({
  items,
  products,
  offers,
  stores,
  includeRebates = true,
  verifiedOnly = true,
  maxStores = 2,
  now: nowInput
}: OptimizeBasketInput): BasketOptimizationResult {
  if (!Number.isSafeInteger(maxStores) || maxStores < 1) {
    throw new TypeError("maxStores must be a positive safe integer");
  }
  const now = parseNow(nowInput);
  const options = { includeRebates, verifiedOnly, now };
  const activeItems = items.filter(item => !item.purchased);
  const matches = matchItemsToProducts(activeItems, products);
  const unmatched = matches.filter(match => match.products.length === 0).map(match => match.item.name);
  const matchable = matches.filter(match => match.products.length > 0);
  if (matchable.length === 0) {
    return { plans: [], unmatched, matchedOffers: [], calculationTrace: [] };
  }

  const priced = matchable.map(match => ({
    item: match.item,
    choices: match.products.map(product => ({
      ...priceProduct(product, offers, { ...options, quantity: match.item.quantity }),
      groceryListItemId: match.item.id
    }))
  }));
  const availableStoreIds = stores
    .map(store => store.id)
    .filter(storeId => priced.some(entry => entry.choices.some(choice => choice.product.storeId === storeId)));
  const boundedMaxStores = Math.max(1, Math.min(Math.trunc(maxStores), availableStoreIds.length));
  const plans: BasketPlan[] = [];

  for (const combination of storeCombinations(availableStoreIds, boundedMaxStores)) {
    const allowedStores = new Set(combination);
    const choicePools = priced.map(entry =>
      entry.choices
        .filter(choice => allowedStores.has(choice.product.storeId))
        .sort((left, right) => left.netPriceCents - right.netPriceCents)
    );
    if (choicePools.some(pool => pool.length === 0)) continue;

    const candidates = productChoiceVariants(choicePools).map(lines => {
      const usedStoreIds = [...new Set(lines.map(line => line.product.storeId))];
      const strategy: BasketPlan["strategy"] = usedStoreIds.length === 1 ? "one_store" : "split";
      const names = usedStoreIds
        .map(id => stores.find(store => store.id === id)?.name)
        .filter((name): name is string => Boolean(name));
      const label = strategy === "one_store" ? `${names[0]} only` : `Best split: ${names.join(" + ")}`;
      return summarizePlan(lines, stores, offers, options, label, strategy, now);
    });
    for (const strategy of ["one_store", "split"] as const) {
      const best = candidates
        .filter(plan => plan.strategy === strategy)
        .sort((left, right) =>
          left.netTotalCents - right.netTotalCents ||
          left.checkoutTotalCents - right.checkoutTotalCents
        )[0];
      if (best) plans.push(best);
    }
  }

  const deduped: BasketPlan[] = [];
  const planKeys = new Set<string>();
  for (const plan of plans.sort(
    (left, right) => left.netTotalCents - right.netTotalCents || left.checkoutTotalCents - right.checkoutTotalCents
  )) {
    const key = plan.lines.map(line => line.product.id).sort().join("|");
    if (!planKeys.has(key)) {
      planKeys.add(key);
      deduped.push(plan);
    }
  }

  const selectedPlans: BasketPlan[] = [];
  const selectedIds = new Set<string>();
  const addPlan = (plan: BasketPlan | undefined) => {
    if (plan && !selectedIds.has(plan.id)) {
      selectedIds.add(plan.id);
      selectedPlans.push(plan);
    }
  };
  addPlan(deduped[0]);
  addPlan(deduped.find(plan => plan.strategy === "one_store"));
  addPlan(deduped.find(plan => plan.strategy === "split"));
  for (const plan of deduped) {
    if (selectedPlans.length >= 3) break;
    addPlan(plan);
  }
  const recommendedPlans = selectedPlans.sort((left, right) =>
    left.netTotalCents - right.netTotalCents || left.checkoutTotalCents - right.checkoutTotalCents
  );
  const appliedOfferIds = new Set(
    recommendedPlans.flatMap(plan => [
      ...plan.lines.flatMap(line => line.offers.map(offer => offer.id)),
      ...plan.basketOffers.map(offer => offer.id)
    ])
  );
  const matchedOffers = offers.filter(offer => appliedOfferIds.has(offer.id));
  const calculationTrace = recommendedPlans.flatMap(plan => plan.calculationTrace);

  return { plans: recommendedPlans, unmatched, matchedOffers, calculationTrace };
}
