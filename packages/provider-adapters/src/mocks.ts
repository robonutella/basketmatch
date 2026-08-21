import {
  OfferEvidenceSchema,
  OfferSchema,
  ProductSchema,
  StoreSchema,
  UtcDateTimeSchema,
  type Offer,
  type OfferEvidence,
  type Store,
} from "@basketmatch/domain";

import {
  ProviderAdapterError,
  type AdapterRequestContext,
  type CatalogProductRecord,
  type CatalogSearchRequest,
  type ImportedReceipt,
  type LoyaltyOfferRecord,
  type LoyaltyOfferRequest,
  type ManufacturerCouponRecord,
  type ManufacturerCouponRequest,
  type OAuthConnectionReference,
  type PromoCodeValidationRequest,
  type PromoCodeValidationResult,
  type PromoValidationReason,
  type ProviderDescriptor,
  type ProviderPage,
  type ProviderResult,
  type RebateRecord,
  type RebateSearchRequest,
  type ReceiptImportRequest,
  type RetailerCatalogAdapter,
  type RetailerLoyaltyOffersAdapter,
  type ManufacturerCouponAdapter,
  type PromoCodeValidationAdapter,
  type RebateAdapter,
  type ReceiptAdapter,
} from "./types.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function sameOptionalText(actual: string | undefined, expected: string | undefined): boolean {
  return expected === undefined ||
    (actual !== undefined && normalized(actual) === normalized(expected));
}

function includesText(actual: string, query: string | undefined): boolean {
  return query === undefined || normalized(actual).includes(normalized(query));
}

function includesOptionalValue(
  values: readonly string[],
  expected: string | undefined,
): boolean {
  return expected === undefined || values.some((value) => sameOptionalText(value, expected));
}

function assertIsoTimestamp(value: string, field: string, providerKey: string): void {
  if (!UtcDateTimeSchema.safeParse(value).success) {
    throw new ProviderAdapterError(
      "invalid_request",
      `${field} must be an ISO-8601 UTC timestamp ending in Z`,
      providerKey,
    );
  }
}

function assertOptionalTimestamp(
  value: string | undefined,
  field: string,
  providerKey: string,
): void {
  if (value !== undefined) assertIsoTimestamp(value, field, providerKey);
}

type RuntimeSchema = {
  safeParse(value: unknown): { success: boolean };
};

function assertSchema(
  value: unknown,
  schema: RuntimeSchema,
  field: string,
  providerKey: string,
): void {
  if (!schema.safeParse(value).success) {
    throw new ProviderAdapterError(
      "invalid_request",
      `${field} does not satisfy the BasketMatch domain schema`,
      providerKey,
    );
  }
}

function assertEvidence(
  evidence: readonly OfferEvidence[],
  offerId: string,
  field: string,
  providerKey: string,
): void {
  for (const item of evidence) {
    assertSchema(item, OfferEvidenceSchema, field, providerKey);
    if (item.offerId !== offerId) {
      throw new ProviderAdapterError(
        "invalid_request",
        `${field}.offerId must match the normalized offer id`,
        providerKey,
      );
    }
  }
}

function assertEqualText(
  actual: string | undefined,
  expected: string | undefined,
  field: string,
  providerKey: string,
): void {
  if (actual === undefined && expected === undefined) return;
  if (actual === undefined || expected === undefined || normalized(actual) !== normalized(expected)) {
    throw new ProviderAdapterError(
      "invalid_request",
      `${field} contradicts the normalized domain object`,
      providerKey,
    );
  }
}

function assertOptionalCanonicalText(
  wrapperValue: string | undefined,
  canonicalValue: string | undefined,
  field: string,
  providerKey: string,
): void {
  if (wrapperValue === undefined) return;
  assertEqualText(wrapperValue, canonicalValue, field, providerKey);
}

function normalizedSet(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map(normalized))].sort();
}

function assertUniqueFixtureIds<T>(
  values: readonly T[],
  idFor: (value: T) => string,
  field: string,
  providerKey: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    const id = normalized(idFor(value));
    if (!id || seen.has(id)) {
      throw new ProviderAdapterError(
        "invalid_request",
        `${field} must contain unique, non-empty stable identifiers`,
        providerKey,
      );
    }
    seen.add(id);
  }
}

function assertEqualTextSets(
  actual: readonly string[],
  expected: readonly string[] | undefined,
  field: string,
  providerKey: string,
): void {
  if (JSON.stringify(normalizedSet(actual)) !== JSON.stringify(normalizedSet(expected))) {
    throw new ProviderAdapterError(
      "invalid_request",
      `${field} contradicts the normalized offer selectors`,
      providerKey,
    );
  }
}

function assertEvidenceIdsMatch(
  wrapperEvidence: readonly OfferEvidence[],
  offer: Offer,
  field: string,
  providerKey: string,
): void {
  assertEvidence(wrapperEvidence, offer.id, field, providerKey);
  const wrapperById = new Map(wrapperEvidence.map(item => [item.id, item]));
  const evidenceMatches = wrapperEvidence.length === offer.evidence.length &&
    offer.evidence.every(item =>
      canonicalJson(wrapperById.get(item.id)) === canonicalJson(item)
    );
  if (!evidenceMatches) {
    throw new ProviderAdapterError(
      "invalid_request",
      `${field} must contain the same evidence records as offer.evidence`,
      providerKey,
    );
  }
}

function canonicalJson(value: unknown): string | undefined {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJsonValue(item)]),
    );
  }
  return value;
}

function assertCents(value: number, field: string, providerKey: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ProviderAdapterError(
      "invalid_request",
      `${field} must be a non-negative safe integer number of cents`,
      providerKey,
    );
  }
}

function result<T>(
  provider: ProviderDescriptor,
  context: AdapterRequestContext,
  data: T,
): ProviderResult<T> {
  assertIsoTimestamp(context.requestedAt, "context.requestedAt", provider.key);
  if (context.requestId.trim().length === 0) {
    throw new ProviderAdapterError(
      "invalid_request",
      "context.requestId is required",
      provider.key,
    );
  }

  return {
    provider,
    requestId: context.requestId,
    fetchedAt: context.requestedAt,
    data,
  };
}

function page<T>(
  providerKey: string,
  items: readonly T[],
  cursor?: string,
  requestedLimit?: number,
): ProviderPage<T> {
  const offset = cursor === undefined ? 0 : Number(cursor);
  const limit = requestedLimit ?? DEFAULT_PAGE_SIZE;

  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new ProviderAdapterError(
      "invalid_request",
      "cursor must be a non-negative integer offset",
      providerKey,
    );
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new ProviderAdapterError(
      "invalid_request",
      `limit must be an integer from 1 to ${MAX_PAGE_SIZE}`,
      providerKey,
    );
  }

  const pagedItems = items.slice(offset, offset + limit);
  const nextOffset = offset + pagedItems.length;
  return {
    items: pagedItems,
    ...(nextOffset < items.length ? { nextCursor: String(nextOffset) } : {}),
  };
}

function assertConnection(
  provider: ProviderDescriptor,
  connection: OAuthConnectionReference,
  requestedAt: string,
  options: {
    readonly allowExpired?: boolean;
    readonly requiredScope?: string;
  } = {},
): void {
  assertIsoTimestamp(requestedAt, "context.requestedAt", provider.key);
  assertIsoTimestamp(connection.connectedAt, "connection.connectedAt", provider.key);
  assertOptionalTimestamp(connection.expiresAt, "connection.expiresAt", provider.key);
  if (connection.kind !== "oauth_token_reference" ||
    connection.connectionId.trim().length === 0 ||
    connection.userId.trim().length === 0 ||
    connection.providerKey.trim().length === 0 ||
    (connection.retailerId !== undefined && connection.retailerId.trim().length === 0) ||
    !["active", "expired", "revoked"].includes(connection.status) ||
    connection.scopes.some(scope => scope.trim().length === 0)) {
    throw new ProviderAdapterError(
      "invalid_request",
      "Connection is not a valid OAuth token-reference record",
      provider.key,
    );
  }
  if (Date.parse(connection.connectedAt) > Date.parse(requestedAt)) {
    throw new ProviderAdapterError(
      "invalid_request",
      "connection.connectedAt cannot be later than context.requestedAt",
      provider.key,
    );
  }
  if (connection.expiresAt !== undefined &&
    Date.parse(connection.expiresAt) <= Date.parse(connection.connectedAt)) {
    throw new ProviderAdapterError(
      "invalid_request",
      "connection.expiresAt must be later than connection.connectedAt",
      provider.key,
    );
  }
  if (connection.providerKey !== provider.key) {
    throw new ProviderAdapterError(
      "provider_mismatch",
      `Connection ${connection.connectionId} belongs to ${connection.providerKey}`,
      provider.key,
    );
  }
  if (connection.status === "revoked") {
    throw new ProviderAdapterError(
      "connection_revoked",
      `Connection ${connection.connectionId} is revoked`,
      provider.key,
    );
  }
  if (connection.status === "expired" && !options.allowExpired) {
    throw new ProviderAdapterError(
      "connection_expired",
      `Connection ${connection.connectionId} must be refreshed`,
      provider.key,
    );
  }
  if (!options.allowExpired && isExpired(connection.expiresAt, requestedAt)) {
    throw new ProviderAdapterError(
      "connection_expired",
      `Connection ${connection.connectionId} expired at ${connection.expiresAt}`,
      provider.key,
    );
  }
  if (connection.tokenSecretReference.trim().length === 0) {
    throw new ProviderAdapterError(
      "unauthorized",
      "Connection is missing its server-side token secret reference",
      provider.key,
    );
  }
  if (!isOpaqueSecretReference(connection.tokenSecretReference)) {
    throw new ProviderAdapterError(
      "unauthorized",
      "Connection token material must be represented by an opaque secret-manager reference",
      provider.key,
    );
  }
  if (options.requiredScope !== undefined && !connection.scopes.includes(options.requiredScope)) {
    throw new ProviderAdapterError(
      "unauthorized",
      `Connection is missing required OAuth scope ${options.requiredScope}`,
      provider.key,
    );
  }
}

function isOpaqueSecretReference(value: string): boolean {
  const reference = value.trim();
  return /^(?:vault|secret|aws-secretsmanager|gcp-secret|azure-keyvault|supabase-vault):\/\/[\S]+$/i.test(reference) ||
    /^arn:[a-z0-9-]+:[\S]+$/i.test(reference) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference);
}

function isExpired(expiresAt: string | undefined, requestedAt: string): boolean {
  return expiresAt !== undefined && Date.parse(expiresAt) <= Date.parse(requestedAt);
}

export interface MockRetailerCatalogOptions {
  readonly provider: ProviderDescriptor;
  readonly storesById?: Readonly<Record<string, Store>>;
  readonly products?: readonly CatalogProductRecord[];
}

export class MockRetailerCatalogAdapter implements RetailerCatalogAdapter {
  readonly provider: ProviderDescriptor;
  private readonly storesById: Readonly<Record<string, Store>>;
  private readonly products: readonly CatalogProductRecord[];

  constructor(options: MockRetailerCatalogOptions) {
    this.provider = options.provider;
    this.storesById = options.storesById ?? {};
    this.products = [...(options.products ?? [])].sort((left, right) =>
      left.providerProductId.localeCompare(right.providerProductId),
    );
    assertUniqueFixtureIds(this.products, item => item.providerProductId, "products.providerProductId", this.provider.key);
    for (const [storeId, store] of Object.entries(this.storesById)) {
      assertSchema(store, StoreSchema, `storesById.${storeId}`, this.provider.key);
      if (store.id !== storeId) {
        throw new ProviderAdapterError(
          "invalid_request",
          `storesById.${storeId}.id must match its map key`,
          this.provider.key,
        );
      }
    }
    for (const record of this.products) {
      assertSchema(record.product, ProductSchema, "catalogRecord.product", this.provider.key);
      assertCents(record.priceCents, "catalogRecord.priceCents", this.provider.key);
      assertIsoTimestamp(record.priceObservedAt, "catalogRecord.priceObservedAt", this.provider.key);
      if (record.product.storeId !== record.storeId ||
        record.product.priceCents !== record.priceCents ||
        record.product.available !== record.available) {
        throw new ProviderAdapterError(
          "invalid_request",
          "Catalog wrapper store, price, and availability must match its normalized product",
          this.provider.key,
        );
      }
      assertOptionalCanonicalText(record.upcGtin, record.product.upc, "catalogRecord.upcGtin", this.provider.key);
      assertOptionalCanonicalText(record.category, record.product.category, "catalogRecord.category", this.provider.key);
      assertOptionalCanonicalText(record.brand, record.product.brand, "catalogRecord.brand", this.provider.key);
      assertOptionalCanonicalText(record.packageSize, record.product.size, "catalogRecord.packageSize", this.provider.key);
      if (record.product.observedAt !== undefined && record.product.observedAt !== record.priceObservedAt) {
        throw new ProviderAdapterError(
          "invalid_request",
          "catalogRecord.priceObservedAt contradicts product.observedAt",
          this.provider.key,
        );
      }
    }
  }

  async searchProducts(
    request: CatalogSearchRequest,
  ): Promise<ProviderResult<ProviderPage<CatalogProductRecord>>> {
    const items = this.products.filter((record) =>
      record.storeId === request.storeId &&
      sameOptionalText(record.locationId, request.locationId) &&
      includesText(record.searchableText, request.query) &&
      sameOptionalText(record.upcGtin ?? record.product.upc, request.exactUpcGtin) &&
      sameOptionalText(record.category ?? record.product.category, request.category) &&
      sameOptionalText(record.brand ?? record.product.brand, request.brand) &&
      (request.fulfillmentMethod === undefined ||
        record.fulfillmentMethods.includes(request.fulfillmentMethod)),
    );

    return result(
      this.provider,
      request.context,
      page(this.provider.key, items, request.cursor, request.limit),
    );
  }

  async getStore(
    request: AdapterRequestContext & { readonly storeId: string },
  ): Promise<ProviderResult<Store | null>> {
    return result(this.provider, request, this.storesById[request.storeId] ?? null);
  }
}

export interface MockRetailerLoyaltyOffersOptions {
  readonly provider: ProviderDescriptor;
  readonly offers?: readonly LoyaltyOfferRecord[];
  readonly refreshedExpiresAt?: string;
}

export class MockRetailerLoyaltyOffersAdapter
implements RetailerLoyaltyOffersAdapter {
  readonly provider: ProviderDescriptor;
  private readonly offers: readonly LoyaltyOfferRecord[];
  private readonly refreshedExpiresAt?: string;

  constructor(options: MockRetailerLoyaltyOffersOptions) {
    this.provider = options.provider;
    this.offers = [...(options.offers ?? [])].sort((left, right) =>
      left.providerOfferId.localeCompare(right.providerOfferId),
    );
    assertUniqueFixtureIds(this.offers, item => item.providerOfferId, "offers.providerOfferId", this.provider.key);
    this.refreshedExpiresAt = options.refreshedExpiresAt;
    assertOptionalTimestamp(this.refreshedExpiresAt, "refreshedExpiresAt", this.provider.key);
    for (const record of this.offers) {
      assertSchema(record.offer, OfferSchema, "loyaltyRecord.offer", this.provider.key);
      assertEvidenceIdsMatch(record.evidence, record.offer, "loyaltyRecord.evidence", this.provider.key);
      assertOptionalTimestamp(record.redeemedAt, "loyaltyRecord.redeemedAt", this.provider.key);
      assertOptionalTimestamp(record.expiresAt, "loyaltyRecord.expiresAt", this.provider.key);
      assertOptionalCanonicalText(record.storeId, record.offer.storeId, "loyaltyRecord.storeId", this.provider.key);
      assertOptionalCanonicalText(record.expiresAt, record.offer.expiresAt, "loyaltyRecord.expiresAt", this.provider.key);
      if (record.offer.sourceType !== "retailer_loyalty" && record.offer.sourceType !== "sale") {
        throw new ProviderAdapterError(
          "invalid_request",
          "A loyalty adapter fixture must use a retailer_loyalty or sale offer",
          this.provider.key,
        );
      }
    }
  }

  async listOffers(
    request: LoyaltyOfferRequest,
  ): Promise<ProviderResult<ProviderPage<LoyaltyOfferRecord>>> {
    assertConnection(this.provider, request.connection, request.context.requestedAt, {
      requiredScope: "offers.read",
    });
    const items = this.offers.filter((record) =>
      (request.storeId === undefined || record.storeId === request.storeId) &&
      (request.includeRedeemed === true || record.redeemedAt === undefined),
    );
    return result(
      this.provider,
      request.context,
      page(this.provider.key, items, request.cursor, request.limit),
    );
  }

  async refreshConnection(
    context: AdapterRequestContext,
    connection: OAuthConnectionReference,
  ): Promise<ProviderResult<OAuthConnectionReference>> {
    assertConnection(this.provider, connection, context.requestedAt, { allowExpired: true });
    if (this.refreshedExpiresAt !== undefined &&
      Date.parse(this.refreshedExpiresAt) <= Date.parse(context.requestedAt)) {
      throw new ProviderAdapterError(
        "provider_unavailable",
        "OAuth refresh did not produce a future token expiry",
        this.provider.key,
        true,
      );
    }
    const { expiresAt: _previousExpiry, ...connectionWithoutExpiry } = connection;
    const refreshed: OAuthConnectionReference = {
      ...connectionWithoutExpiry,
      status: "active",
      ...(this.refreshedExpiresAt === undefined ? {} : { expiresAt: this.refreshedExpiresAt }),
    };
    return result(this.provider, context, refreshed);
  }

  async revokeConnection(
    context: AdapterRequestContext,
    connection: OAuthConnectionReference,
  ): Promise<ProviderResult<OAuthConnectionReference>> {
    if (connection.providerKey !== this.provider.key) {
      throw new ProviderAdapterError(
        "provider_mismatch",
        `Connection ${connection.connectionId} belongs to ${connection.providerKey}`,
        this.provider.key,
      );
    }
    return result(this.provider, context, { ...connection, status: "revoked" });
  }
}

export interface MockManufacturerCouponOptions {
  readonly provider: ProviderDescriptor;
  readonly coupons?: readonly ManufacturerCouponRecord[];
}

export class MockManufacturerCouponAdapter implements ManufacturerCouponAdapter {
  readonly provider: ProviderDescriptor;
  private readonly coupons: readonly ManufacturerCouponRecord[];

  constructor(options: MockManufacturerCouponOptions) {
    this.provider = options.provider;
    this.coupons = [...(options.coupons ?? [])].sort((left, right) =>
      left.providerOfferId.localeCompare(right.providerOfferId),
    );
    assertUniqueFixtureIds(this.coupons, item => item.providerOfferId, "coupons.providerOfferId", this.provider.key);
    for (const record of this.coupons) {
      assertSchema(record.offer, OfferSchema, "manufacturerCoupon.offer", this.provider.key);
      assertEvidenceIdsMatch(record.evidence, record.offer, "manufacturerCoupon.evidence", this.provider.key);
      assertEqualTextSets(record.eligibleUpcs, record.offer.upcs, "manufacturerCoupon.eligibleUpcs", this.provider.key);
      assertEqualTextSets(record.eligibleCategories, record.offer.category ? [record.offer.category] : [], "manufacturerCoupon.eligibleCategories", this.provider.key);
      assertEqualTextSets(record.eligibleBrands, record.offer.brand ? [record.offer.brand] : [], "manufacturerCoupon.eligibleBrands", this.provider.key);
      assertOptionalTimestamp(record.expiresAt, "manufacturerCoupon.expiresAt", this.provider.key);
      assertOptionalCanonicalText(record.expiresAt, record.offer.expiresAt, "manufacturerCoupon.expiresAt", this.provider.key);
      if (record.offer.sourceType !== "manufacturer" || record.offer.redemptionMode !== "checkout") {
        throw new ProviderAdapterError(
          "invalid_request",
          "A manufacturer coupon must be a manufacturer checkout offer",
          this.provider.key,
        );
      }
    }
  }

  async findCoupons(
    request: ManufacturerCouponRequest,
  ): Promise<ProviderResult<ProviderPage<ManufacturerCouponRecord>>> {
    const items = this.coupons.filter((record) =>
      includesOptionalValue(record.eligibleUpcs, request.exactUpcGtin) &&
      includesOptionalValue(record.eligibleCategories, request.category) &&
      includesOptionalValue(record.eligibleBrands, request.brand),
    );
    return result(
      this.provider,
      request.context,
      page(this.provider.key, items, request.cursor, request.limit),
    );
  }
}

export interface MockPromoCodeFailure {
  readonly status: "failed" | "not_tested";
  readonly reason: Extract<
    PromoValidationReason,
    "provider_error" | "provider_not_configured"
  >;
  readonly message: string;
}

export interface MockPromoCodeRule {
  readonly code: string;
  readonly checkoutDiscountCents: number;
  readonly offer?: Offer;
  readonly evidence?: OfferEvidence;
  readonly sourceReference?: string;
  readonly eligibleStoreIds?: readonly string[];
  readonly eligibleUpcs?: readonly string[];
  readonly minimumSubtotalCents?: number;
  readonly expiresAt?: string;
  readonly connectionRequired?: boolean;
  readonly oneTimePerConnection?: boolean;
  readonly redeemedConnectionIds?: readonly string[];
  readonly forcedFailure?: MockPromoCodeFailure;
}

export interface MockPromoCodeValidationOptions {
  readonly provider: ProviderDescriptor;
  readonly rules?: readonly MockPromoCodeRule[];
}

export class MockPromoCodeValidationAdapter
implements PromoCodeValidationAdapter {
  readonly provider: ProviderDescriptor;
  private readonly rules: ReadonlyMap<string, MockPromoCodeRule>;

  constructor(options: MockPromoCodeValidationOptions) {
    this.provider = options.provider;
    assertUniqueFixtureIds(options.rules ?? [], item => item.code, "rules.code", this.provider.key);
    this.rules = new Map(
      (options.rules ?? []).map((rule) => {
        if (rule.code.trim().length === 0) {
          throw new ProviderAdapterError(
            "invalid_request",
            "promoRule.code is required",
            this.provider.key,
          );
        }
        assertCents(
          rule.checkoutDiscountCents,
          "promoRule.checkoutDiscountCents",
          this.provider.key,
        );
        if (rule.minimumSubtotalCents !== undefined) {
          assertCents(
            rule.minimumSubtotalCents,
            "promoRule.minimumSubtotalCents",
            this.provider.key,
          );
        }
        assertOptionalTimestamp(rule.expiresAt, "promoRule.expiresAt", this.provider.key);
        if (rule.offer !== undefined) {
          assertSchema(rule.offer, OfferSchema, "promoRule.offer", this.provider.key);
          if (rule.offer.sourceType !== "promo_code" ||
            rule.offer.scope !== "basket" ||
            rule.offer.redemptionMode !== "checkout") {
            throw new ProviderAdapterError(
              "invalid_request",
              "promoRule.offer must be a basket-scoped promo_code checkout offer",
              this.provider.key,
            );
          }
          if (normalized(rule.offer.promoCode ?? "") !== normalized(rule.code)) {
            throw new ProviderAdapterError(
              "invalid_request",
              "promoRule.code must match offer.promoCode",
              this.provider.key,
            );
          }
          if (rule.offer.amountOffCents !== undefined &&
            rule.offer.amountOffCents !== rule.checkoutDiscountCents) {
            throw new ProviderAdapterError(
              "invalid_request",
              "promoRule.checkoutDiscountCents must match the fixed-value normalized offer",
              this.provider.key,
            );
          }
          if (rule.offer.percentOffBasisPoints !== undefined &&
            rule.offer.maxDiscountCents !== rule.checkoutDiscountCents) {
            throw new ProviderAdapterError(
              "invalid_request",
              "A percentage promo rule must use offer.maxDiscountCents as its validation cap",
              this.provider.key,
            );
          }
          if (rule.expiresAt !== rule.offer.expiresAt) {
            throw new ProviderAdapterError(
              "invalid_request",
              "promoRule.expiresAt contradicts offer.expiresAt",
              this.provider.key,
            );
          }
          if (rule.minimumSubtotalCents !== rule.offer.minimumSpendCents) {
            throw new ProviderAdapterError(
              "invalid_request",
              "promoRule.minimumSubtotalCents must match offer.minimumSpendCents",
              this.provider.key,
            );
          }
          assertEqualTextSets(
            rule.eligibleStoreIds ?? [],
            rule.offer.storeId ? [rule.offer.storeId] : [],
            "promoRule.eligibleStoreIds",
            this.provider.key,
          );
          assertEqualTextSets(
            rule.eligibleUpcs ?? [],
            rule.offer.upcs,
            "promoRule.eligibleUpcs",
            this.provider.key,
          );
          if (rule.forcedFailure === undefined &&
            rule.offer.status !== "verified" && rule.offer.status !== "recently_redeemed") {
            throw new ProviderAdapterError(
              "invalid_request",
              "An accepted promo rule must attach a trusted-status offer",
              this.provider.key,
            );
          }
        }
        if (rule.evidence !== undefined) {
          if (rule.offer === undefined) {
            throw new ProviderAdapterError(
              "invalid_request",
              "promoRule.evidence requires a normalized offer",
              this.provider.key,
            );
          }
          assertSchema(rule.evidence, OfferEvidenceSchema, "promoRule.evidence", this.provider.key);
          if (rule.evidence.offerId !== rule.offer.id) {
            throw new ProviderAdapterError(
              "invalid_request",
              "promoRule.evidence.offerId must match promoRule.offer.id",
              this.provider.key,
            );
          }
        }
        return [normalized(rule.code), rule] as const;
      }),
    );
  }

  async validateCode(
    request: PromoCodeValidationRequest,
  ): Promise<ProviderResult<PromoCodeValidationResult>> {
    assertCents(request.subtotalCents, "subtotalCents", this.provider.key);
    const rule = this.rules.get(normalized(request.code));

    if (rule === undefined) {
      return this.validationResult(request, {
        status: "rejected",
        reason: "invalid_code",
        message: "The provider did not recognize this promo code.",
        checkoutDiscountCents: 0,
        validatedAt: request.context.requestedAt,
      });
    }

    if (rule.forcedFailure !== undefined) {
      return this.validationResult(request, {
        ...rule.forcedFailure,
        checkoutDiscountCents: 0,
        validatedAt: request.context.requestedAt,
        ...(rule.evidence === undefined ? {} : { evidence: rule.evidence }),
        ...(rule.sourceReference === undefined
          ? {}
          : { sourceReference: rule.sourceReference }),
      });
    }

    if (request.connection !== undefined) {
      assertConnection(this.provider, request.connection, request.context.requestedAt, {
        requiredScope: "promos.validate",
      });
    }
    if ((rule.connectionRequired || rule.oneTimePerConnection) &&
      request.connection === undefined) {
      return this.rejection(request, rule, "account_required", "Connect the retailer account with OAuth before validating this code.");
    }
    if (isExpired(rule.expiresAt ?? rule.offer?.expiresAt, request.context.requestedAt)) {
      return this.rejection(request, rule, "expired", "The promo code is expired.");
    }
    const eligibleStoreIds = rule.eligibleStoreIds ??
      (rule.offer?.storeId === undefined ? undefined : [rule.offer.storeId]);
    if (eligibleStoreIds !== undefined &&
      !eligibleStoreIds.includes(request.storeId)) {
      return this.rejection(request, rule, "store_ineligible", "The promo code is not valid at this store.");
    }
    const minimumSubtotalCents = rule.minimumSubtotalCents ?? rule.offer?.minimumSpendCents;
    if (minimumSubtotalCents !== undefined &&
      request.subtotalCents < minimumSubtotalCents) {
      return this.rejection(request, rule, "minimum_not_met", "The basket does not meet the promo code minimum.");
    }
    const eligibleUpcs = rule.eligibleUpcs ?? rule.offer?.upcs;
    if (eligibleUpcs !== undefined &&
      !request.upcs.some((upc) => eligibleUpcs.includes(upc))) {
      return this.rejection(request, rule, "product_ineligible", "The basket has no product eligible for this promo code.");
    }
    if (rule.oneTimePerConnection && request.connection !== undefined &&
      rule.redeemedConnectionIds?.includes(request.connection.connectionId)) {
      return this.rejection(request, rule, "already_redeemed", "This account has already redeemed the promo code.");
    }

    return this.validationResult(request, {
      status: "accepted",
      reason: "accepted",
      message: "The provider accepted the promo code for this basket.",
      checkoutDiscountCents: rule.offer?.percentOffBasisPoints === undefined
        ? Math.min(rule.checkoutDiscountCents, request.subtotalCents)
        : Math.min(
            Math.round(request.subtotalCents * rule.offer.percentOffBasisPoints / 10_000),
            rule.offer.maxDiscountCents ?? 0,
            request.subtotalCents,
          ),
      validatedAt: request.context.requestedAt,
      ...(rule.offer === undefined ? {} : { offer: rule.offer }),
      ...(rule.evidence === undefined ? {} : { evidence: rule.evidence }),
      ...(rule.sourceReference === undefined
        ? {}
        : { sourceReference: rule.sourceReference }),
    });
  }

  private rejection(
    request: PromoCodeValidationRequest,
    rule: MockPromoCodeRule,
    reason: Extract<
      PromoValidationReason,
      | "account_required"
      | "already_redeemed"
      | "expired"
      | "minimum_not_met"
      | "product_ineligible"
      | "store_ineligible"
    >,
    message: string,
  ): Promise<ProviderResult<PromoCodeValidationResult>> {
    return this.validationResult(request, {
      status: "rejected",
      reason,
      message,
      checkoutDiscountCents: 0,
      validatedAt: request.context.requestedAt,
      ...(rule.offer === undefined ? {} : { offer: rule.offer }),
      ...(rule.evidence === undefined ? {} : { evidence: rule.evidence }),
      ...(rule.sourceReference === undefined
        ? {}
        : { sourceReference: rule.sourceReference }),
    });
  }

  private async validationResult(
    request: PromoCodeValidationRequest,
    validation: PromoCodeValidationResult,
  ): Promise<ProviderResult<PromoCodeValidationResult>> {
    return result(this.provider, request.context, validation);
  }
}

export interface MockRebateFixture {
  readonly record: Omit<RebateRecord, "activated">;
  readonly activatedConnectionIds?: readonly string[];
}

export interface MockRebateOptions {
  readonly provider: ProviderDescriptor;
  readonly rebates?: readonly MockRebateFixture[];
}

export class MockRebateAdapter implements RebateAdapter {
  readonly provider: ProviderDescriptor;
  private readonly rebates: readonly MockRebateFixture[];

  constructor(options: MockRebateOptions) {
    this.provider = options.provider;
    this.rebates = [...(options.rebates ?? [])].sort((left, right) =>
      left.record.providerOfferId.localeCompare(right.record.providerOfferId),
    );
    assertUniqueFixtureIds(this.rebates, item => item.record.providerOfferId, "rebates.providerOfferId", this.provider.key);
    for (const { record } of this.rebates) {
      assertSchema(record.offer, OfferSchema, "rebateRecord.offer", this.provider.key);
      assertEvidenceIdsMatch(record.evidence, record.offer, "rebateRecord.evidence", this.provider.key);
      assertEqualTextSets(record.eligibleUpcs, record.offer.upcs, "rebateRecord.eligibleUpcs", this.provider.key);
      assertEqualTextSets(record.eligibleCategories, record.offer.category ? [record.offer.category] : [], "rebateRecord.eligibleCategories", this.provider.key);
      assertEqualTextSets(record.eligibleBrands, record.offer.brand ? [record.offer.brand] : [], "rebateRecord.eligibleBrands", this.provider.key);
      assertOptionalTimestamp(record.expiresAt, "rebateRecord.expiresAt", this.provider.key);
      assertOptionalCanonicalText(record.expiresAt, record.offer.expiresAt, "rebateRecord.expiresAt", this.provider.key);
      if (record.offer.sourceType !== "rebate" || record.offer.redemptionMode !== "rebate") {
        throw new ProviderAdapterError(
          "invalid_request",
          "A rebate record must contain a post-purchase rebate offer",
          this.provider.key,
        );
      }
    }
  }

  async findRebates(
    request: RebateSearchRequest,
  ): Promise<ProviderResult<ProviderPage<RebateRecord>>> {
    if (request.connection !== undefined) {
      assertConnection(this.provider, request.connection, request.context.requestedAt, {
        requiredScope: "rebates.read",
      });
    }
    const items = this.rebates
      .filter(({ record, activatedConnectionIds }) =>
        includesOptionalValue(record.eligibleUpcs, request.exactUpcGtin) &&
        includesOptionalValue(record.eligibleCategories, request.category) &&
        includesOptionalValue(record.eligibleBrands, request.brand) &&
        (!request.activatedOnly ||
          !record.activationRequired ||
          (request.connection !== undefined &&
            Boolean(activatedConnectionIds?.includes(request.connection.connectionId)))),
      )
      .map(({ record, activatedConnectionIds }): RebateRecord => ({
        ...record,
        activated: !record.activationRequired ||
          (request.connection !== undefined &&
            Boolean(activatedConnectionIds?.includes(request.connection.connectionId))),
      }));

    return result(
      this.provider,
      request.context,
      page(this.provider.key, items, request.cursor, request.limit),
    );
  }
}

export interface MockReceiptOptions {
  readonly provider: ProviderDescriptor;
  readonly receipts?: readonly ImportedReceipt[];
}

export class MockReceiptAdapter implements ReceiptAdapter {
  readonly provider: ProviderDescriptor;
  private readonly receipts: ReadonlyMap<string, ImportedReceipt>;

  constructor(options: MockReceiptOptions) {
    this.provider = options.provider;
    assertUniqueFixtureIds(options.receipts ?? [], item => item.providerReceiptId, "receipts.providerReceiptId", this.provider.key);
    this.receipts = new Map(
      (options.receipts ?? []).map((receipt) => {
        assertIsoTimestamp(receipt.purchasedAt, "receipt.purchasedAt", this.provider.key);
        assertIsoTimestamp(receipt.importedAt, "receipt.importedAt", this.provider.key);
        if (receipt.currency !== "USD") {
          throw new ProviderAdapterError(
            "invalid_request",
            "receipt.currency must be USD",
            this.provider.key,
          );
        }
        assertCents(receipt.subtotalCents, "receipt.subtotalCents", this.provider.key);
        assertCents(receipt.checkoutDiscountCents, "receipt.checkoutDiscountCents", this.provider.key);
        assertCents(receipt.taxCents, "receipt.taxCents", this.provider.key);
        assertCents(receipt.totalPaidCents, "receipt.totalPaidCents", this.provider.key);
        if (receipt.checkoutDiscountCents > receipt.subtotalCents) {
          throw new ProviderAdapterError(
            "invalid_request",
            "receipt.checkoutDiscountCents cannot exceed receipt.subtotalCents",
            this.provider.key,
          );
        }
        for (const line of receipt.lineItems) {
          if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
            throw new ProviderAdapterError(
              "invalid_request",
              "receipt.lineItem.quantity must be positive",
              this.provider.key,
            );
          }
          assertCents(line.unitPriceCents, "receipt.lineItem.unitPriceCents", this.provider.key);
          assertCents(line.lineSubtotalCents, "receipt.lineItem.lineSubtotalCents", this.provider.key);
          assertCents(line.checkoutDiscountCents, "receipt.lineItem.checkoutDiscountCents", this.provider.key);
          if (line.checkoutDiscountCents > line.lineSubtotalCents) {
            throw new ProviderAdapterError(
              "invalid_request",
              "receipt.lineItem checkout discount exceeds its subtotal",
              this.provider.key,
            );
          }
          if (Math.round(line.unitPriceCents * line.quantity) !== line.lineSubtotalCents) {
            throw new ProviderAdapterError(
              "invalid_request",
              "receipt.lineItem subtotal must equal rounded unit price times quantity",
              this.provider.key,
            );
          }
        }
        const lineSubtotalCents = receipt.lineItems.reduce((sum, line) => sum + line.lineSubtotalCents, 0);
        const lineDiscountCents = receipt.lineItems.reduce((sum, line) => sum + line.checkoutDiscountCents, 0);
        if (lineSubtotalCents !== receipt.subtotalCents ||
          lineDiscountCents > receipt.checkoutDiscountCents ||
          receipt.totalPaidCents !== receipt.subtotalCents - receipt.checkoutDiscountCents + receipt.taxCents) {
          throw new ProviderAdapterError(
            "invalid_request",
            "Receipt totals do not reconcile with normalized line items",
            this.provider.key,
          );
        }
        return [receipt.providerReceiptId, receipt] as const;
      }),
    );
  }

  async importReceipt(
    request: ReceiptImportRequest,
  ): Promise<ProviderResult<ImportedReceipt>> {
    assertConnection(this.provider, request.connection, request.context.requestedAt, {
      requiredScope: "receipts.read",
    });
    const receipt = this.receipts.get(request.providerReceiptId);
    if (receipt === undefined) {
      throw new ProviderAdapterError(
        "not_found",
        `Receipt ${request.providerReceiptId} was not found`,
        this.provider.key,
      );
    }
    return result(this.provider, request.context, receipt);
  }
}
