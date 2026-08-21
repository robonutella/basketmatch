import type {
  Offer,
  OfferEvidence,
  Product,
  Store,
} from "@basketmatch/domain";

/**
 * An opaque reference to OAuth credentials held by a server-side secret store.
 *
 * Adapters deliberately receive neither a retailer password nor a raw access or
 * refresh token. A live adapter resolves `tokenSecretReference` only on a
 * trusted server.
 */
export interface OAuthConnectionReference {
  readonly kind: "oauth_token_reference";
  readonly connectionId: string;
  readonly userId: string;
  readonly providerKey: string;
  readonly retailerId?: string;
  readonly tokenSecretReference: string;
  readonly scopes: readonly string[];
  readonly status: "active" | "expired" | "revoked";
  readonly connectedAt: string;
  readonly expiresAt?: string;
}

export interface AdapterRequestContext {
  /** Caller-generated and safe to include in structured logs. */
  readonly requestId: string;
  /** UTC ISO-8601 timestamp used for deterministic expiry decisions. */
  readonly requestedAt: string;
}

export interface ProviderDescriptor {
  readonly key: string;
  readonly displayName: string;
  readonly environment: "mock" | "sandbox" | "production";
}

export interface ProviderResult<T> {
  readonly provider: ProviderDescriptor;
  readonly requestId: string;
  readonly fetchedAt: string;
  readonly data: T;
}

export interface ProviderPage<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}

export type ProviderAdapterErrorCode =
  | "account_required"
  | "connection_expired"
  | "connection_revoked"
  | "invalid_request"
  | "not_found"
  | "provider_mismatch"
  | "provider_unavailable"
  | "rate_limited"
  | "unauthorized";

export class ProviderAdapterError extends Error {
  constructor(
    readonly code: ProviderAdapterErrorCode,
    message: string,
    readonly providerKey: string,
    readonly retriable = false,
  ) {
    super(message);
    this.name = "ProviderAdapterError";
  }
}

export type FulfillmentMethod = "delivery" | "pickup" | "in_store";

/** Provider metadata kept alongside the normalized domain product. */
export interface CatalogProductRecord {
  readonly providerProductId: string;
  readonly product: Product;
  readonly storeId: string;
  readonly locationId?: string;
  readonly upcGtin?: string;
  readonly category?: string;
  readonly brand?: string;
  readonly packageSize?: string;
  readonly priceCents: number;
  readonly priceObservedAt: string;
  readonly available: boolean;
  readonly fulfillmentMethods: readonly FulfillmentMethod[];
  readonly searchableText: string;
  readonly sourceReference: string;
}

export interface CatalogSearchRequest {
  readonly context: AdapterRequestContext;
  readonly storeId: string;
  readonly locationId?: string;
  readonly query?: string;
  readonly exactUpcGtin?: string;
  readonly category?: string;
  readonly brand?: string;
  readonly fulfillmentMethod?: FulfillmentMethod;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface RetailerCatalogAdapter {
  readonly provider: ProviderDescriptor;
  searchProducts(
    request: CatalogSearchRequest,
  ): Promise<ProviderResult<ProviderPage<CatalogProductRecord>>>;
  getStore(
    request: AdapterRequestContext & { readonly storeId: string },
  ): Promise<ProviderResult<Store | null>>;
}

export interface LoyaltyOfferRecord {
  readonly providerOfferId: string;
  readonly offer: Offer;
  readonly storeId?: string;
  readonly clipped: boolean;
  readonly accountEligible: boolean;
  readonly redeemedAt?: string;
  readonly expiresAt?: string;
  readonly evidence: readonly OfferEvidence[];
  readonly sourceReference: string;
}

export interface LoyaltyOfferRequest {
  readonly context: AdapterRequestContext;
  readonly connection: OAuthConnectionReference;
  readonly storeId?: string;
  readonly includeRedeemed?: boolean;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface RetailerLoyaltyOffersAdapter {
  readonly provider: ProviderDescriptor;
  listOffers(
    request: LoyaltyOfferRequest,
  ): Promise<ProviderResult<ProviderPage<LoyaltyOfferRecord>>>;
  refreshConnection(
    context: AdapterRequestContext,
    connection: OAuthConnectionReference,
  ): Promise<ProviderResult<OAuthConnectionReference>>;
  revokeConnection(
    context: AdapterRequestContext,
    connection: OAuthConnectionReference,
  ): Promise<ProviderResult<OAuthConnectionReference>>;
}

export interface ManufacturerCouponRecord {
  readonly providerOfferId: string;
  readonly offer: Offer;
  readonly eligibleUpcs: readonly string[];
  readonly eligibleCategories: readonly string[];
  readonly eligibleBrands: readonly string[];
  readonly expiresAt?: string;
  readonly evidence: readonly OfferEvidence[];
  readonly sourceReference: string;
}

export interface ManufacturerCouponRequest {
  readonly context: AdapterRequestContext;
  readonly exactUpcGtin?: string;
  readonly category?: string;
  readonly brand?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ManufacturerCouponAdapter {
  readonly provider: ProviderDescriptor;
  findCoupons(
    request: ManufacturerCouponRequest,
  ): Promise<ProviderResult<ProviderPage<ManufacturerCouponRecord>>>;
}

export type PromoValidationStatus =
  | "accepted"
  | "rejected"
  | "failed"
  | "not_tested";

export type PromoValidationReason =
  | "accepted"
  | "account_required"
  | "already_redeemed"
  | "expired"
  | "invalid_code"
  | "minimum_not_met"
  | "product_ineligible"
  | "provider_error"
  | "provider_not_configured"
  | "store_ineligible";

export interface PromoCodeValidationRequest {
  readonly context: AdapterRequestContext;
  readonly code: string;
  readonly storeId: string;
  readonly locationId?: string;
  readonly subtotalCents: number;
  readonly productIds: readonly string[];
  readonly upcs: readonly string[];
  readonly connection?: OAuthConnectionReference;
}

export interface PromoCodeValidationResult {
  readonly status: PromoValidationStatus;
  readonly reason: PromoValidationReason;
  readonly message: string;
  /** Checkout discount only. Rebates never appear in this field. */
  readonly checkoutDiscountCents: number;
  readonly validatedAt: string;
  readonly offer?: Offer;
  readonly evidence?: OfferEvidence;
  readonly sourceReference?: string;
}

export interface PromoCodeValidationAdapter {
  readonly provider: ProviderDescriptor;
  validateCode(
    request: PromoCodeValidationRequest,
  ): Promise<ProviderResult<PromoCodeValidationResult>>;
}

export type CouponStackingPolicy = "allowed" | "disallowed" | "unknown";

export type RebateOffer = Omit<Offer, "sourceType" | "redemptionMode"> & {
  readonly sourceType: "rebate";
  readonly redemptionMode: "rebate";
};

export interface RebateRecord {
  readonly providerOfferId: string;
  readonly offer: RebateOffer;
  readonly eligibleUpcs: readonly string[];
  readonly eligibleCategories: readonly string[];
  readonly eligibleBrands: readonly string[];
  readonly activationRequired: boolean;
  /** Connection-specific activation state at fetch time. */
  readonly activated: boolean;
  readonly postPurchaseRequirements: readonly string[];
  readonly manufacturerCouponStacking: CouponStackingPolicy;
  readonly expiresAt?: string;
  readonly evidence: readonly OfferEvidence[];
  readonly sourceReference: string;
}

export interface RebateSearchRequest {
  readonly context: AdapterRequestContext;
  readonly connection?: OAuthConnectionReference;
  readonly exactUpcGtin?: string;
  readonly category?: string;
  readonly brand?: string;
  readonly activatedOnly?: boolean;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface RebateAdapter {
  readonly provider: ProviderDescriptor;
  findRebates(
    request: RebateSearchRequest,
  ): Promise<ProviderResult<ProviderPage<RebateRecord>>>;
}

export interface ReceiptLineItem {
  readonly providerLineId: string;
  readonly productId?: string;
  readonly upcGtin?: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly lineSubtotalCents: number;
  readonly checkoutDiscountCents: number;
}

export interface ImportedReceipt {
  readonly providerReceiptId: string;
  readonly retailerId: string;
  readonly storeId?: string;
  readonly purchasedAt: string;
  readonly importedAt: string;
  readonly currency: string;
  readonly subtotalCents: number;
  readonly checkoutDiscountCents: number;
  readonly taxCents: number;
  readonly totalPaidCents: number;
  readonly lineItems: readonly ReceiptLineItem[];
  readonly sourceReference: string;
}

export interface ReceiptImportRequest {
  readonly context: AdapterRequestContext;
  readonly connection: OAuthConnectionReference;
  readonly providerReceiptId: string;
}

export interface ReceiptAdapter {
  readonly provider: ProviderDescriptor;
  importReceipt(
    request: ReceiptImportRequest,
  ): Promise<ProviderResult<ImportedReceipt>>;
}
