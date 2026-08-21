import {
  BasketOptimizationResultSchema,
  ReceiptPersistenceInputSchema,
  RedemptionInputSchema,
  type BasketOptimizationResult,
  type BasketPlan,
  type GroceryList,
  type Offer,
  type Product,
  type ReceiptPersistenceInput,
  type RedemptionInput,
  type Store,
} from "@basketmatch/domain";
import { optimizeBasket } from "@basketmatch/pricing-engine";

export const PRICING_ENGINE_VERSION = "basketmatch-pricing-engine@0.1.0";

export interface PricingCatalog {
  readonly products: readonly Product[];
  readonly offers: readonly Offer[];
  readonly stores: readonly Store[];
  readonly source: "typed_mock" | "approved_provider";
  readonly region: string;
  readonly primaryRetailer: string;
}

export interface RecommendationPersistenceInput {
  readonly userId: string;
  readonly groceryList: GroceryList;
  readonly idempotencyKey: string;
  readonly plan: BasketPlan;
  readonly outcome: BasketOptimizationResult;
  readonly catalog: PricingCatalog;
  readonly pricingEngineVersion: string;
}

export interface RecommendationPersistenceResult {
  readonly id: string;
  readonly createdAt: string;
}

export interface BasketBackendRepository {
  loadGroceryList(userId: string, groceryListId: string): Promise<GroceryList | null>;
  persistRecommendation(
    input: RecommendationPersistenceInput,
  ): Promise<RecommendationPersistenceResult>;
  persistReceipt(userId: string, input: ReceiptPersistenceInput): Promise<{ id: string }>;
  persistRedemption(userId: string, input: RedemptionInput): Promise<{ id: string }>;
}

export interface CalculateAndPersistInput {
  readonly userId: string;
  readonly groceryListId: string;
  readonly idempotencyKey: string;
  readonly catalog: PricingCatalog;
  readonly repository: BasketBackendRepository;
  readonly now?: Date | string;
}

export interface CalculateAndPersistResult {
  readonly recommendationId?: string;
  readonly outcome: BasketOptimizationResult;
  readonly persistedAt?: string;
}

export async function calculateAndPersistRecommendation(
  input: CalculateAndPersistInput,
): Promise<CalculateAndPersistResult> {
  const groceryList = await input.repository.loadGroceryList(input.userId, input.groceryListId);
  if (!groceryList) throw new Error("Grocery list was not found for this user.");

  const outcome = BasketOptimizationResultSchema.parse(optimizeBasket({
    items: groceryList.items,
    products: [...input.catalog.products],
    offers: [...input.catalog.offers],
    stores: [...input.catalog.stores],
    includeRebates: groceryList.includeRebates ?? true,
    verifiedOnly: groceryList.verifiedOffersOnly ?? true,
    maxStores: groceryList.maxStores ?? 2,
    now: input.now,
  }));
  const plan = outcome.plans[0];
  if (!plan) return { outcome };

  const persisted = await input.repository.persistRecommendation({
    userId: input.userId,
    groceryList,
    idempotencyKey: input.idempotencyKey,
    plan,
    outcome,
    catalog: input.catalog,
    pricingEngineVersion: PRICING_ENGINE_VERSION,
  });

  return {
    recommendationId: persisted.id,
    outcome,
    persistedAt: persisted.createdAt,
  };
}

export async function persistReceipt(
  repository: BasketBackendRepository,
  userId: string,
  value: unknown,
): Promise<{ id: string }> {
  return repository.persistReceipt(userId, ReceiptPersistenceInputSchema.parse(value));
}

export async function persistRedemption(
  repository: BasketBackendRepository,
  userId: string,
  value: unknown,
): Promise<{ id: string }> {
  return repository.persistRedemption(userId, RedemptionInputSchema.parse(value));
}
