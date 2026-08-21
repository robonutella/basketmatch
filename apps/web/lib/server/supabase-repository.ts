import type {
  BasketBackendRepository,
  RecommendationPersistenceInput,
  RecommendationPersistenceResult,
} from "@basketmatch/backend";
import {
  GroceryListSchema,
  type ReceiptPersistenceInput,
  type RedemptionInput,
  type SavedGroceryListInput,
} from "@basketmatch/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

function required<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export class SupabaseBasketRepository implements BasketBackendRepository {
  constructor(private readonly client: SupabaseClient) {}

  async loadGroceryList(userId: string, groceryListId: string) {
    const { data: list, error: listError } = await this.client
      .from("grocery_lists")
      .select("id,user_id,title,status,include_rebates,verified_offers_only,max_stores,created_at,updated_at")
      .eq("id", groceryListId)
      .eq("user_id", userId)
      .eq("is_demo", false)
      .maybeSingle();
    if (listError) throw listError;
    if (!list) return null;

    const { data: items, error: itemError } = await this.client
      .from("grocery_list_items")
      .select("id,query,quantity,purchased,requested_gtin,requested_category,requested_brand,position")
      .eq("grocery_list_id", groceryListId)
      .order("position");
    if (itemError) throw itemError;

    return GroceryListSchema.parse({
      id: list.id,
      userId: list.user_id,
      title: list.title,
      status: list.status,
      includeRebates: list.include_rebates,
      verifiedOffersOnly: list.verified_offers_only,
      maxStores: list.max_stores,
      createdAt: iso(list.created_at),
      updatedAt: iso(list.updated_at),
      items: (items ?? []).map((item: Row) => ({
        id: String(item.id),
        listId: groceryListId,
        name: String(item.query),
        quantity: Number(item.quantity),
        purchased: Boolean(item.purchased),
        ...(item.requested_gtin ? { requestedUpc: String(item.requested_gtin) } : {}),
        ...(item.requested_category ? { requestedCategory: String(item.requested_category) } : {}),
        ...(item.requested_brand ? { requestedBrand: String(item.requested_brand) } : {}),
      })),
    });
  }

  async persistRecommendation(
    input: RecommendationPersistenceInput,
  ): Promise<RecommendationPersistenceResult> {
    const { data: existing, error: existingError } = await this.client
      .from("basket_recommendations")
      .select("id,created_at")
      .eq("user_id", input.userId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return { id: existing.id, createdAt: iso(existing.created_at) };

    const productExternalIds = [...new Set(input.plan.lines.map((line) => line.product.id))];
    const storeSlugs = [...new Set(input.plan.stores.map((store) => store.id))];
    const offerExternalIds = [...new Set(input.plan.calculationTrace.map((trace) => trace.offerId))];
    const [{ data: products, error: productError }, { data: stores, error: storeError }, { data: offers, error: offerError }] = await Promise.all([
      this.client.from("products").select("id,external_product_id,store_id").in("external_product_id", productExternalIds),
      this.client.from("stores").select("id,slug").in("slug", storeSlugs),
      this.client.from("offers").select("id,external_offer_id,state,redemption_mode").in("external_offer_id", offerExternalIds),
    ]);
    if (productError) throw productError;
    if (storeError) throw storeError;
    if (offerError) throw offerError;

    const productByExternal = new Map((products ?? []).map((row: Row) => [String(row.external_product_id), row]));
    const storeBySlug = new Map((stores ?? []).map((row: Row) => [String(row.slug), String(row.id)]));
    const offerByExternal = new Map((offers ?? []).map((row: Row) => [String(row.external_offer_id), row]));
    for (const id of productExternalIds) required(productByExternal.get(id), `Product mapping missing for ${id}.`);
    for (const id of storeSlugs) required(storeBySlug.get(id), `Store mapping missing for ${id}.`);
    for (const id of offerExternalIds) required(offerByExternal.get(id), `Offer mapping missing for ${id}.`);

    const recommendationPayload = {
      user_id: input.userId,
      grocery_list_id: input.groceryList.id,
      idempotency_key: input.idempotencyKey,
      strategy: input.plan.strategy,
      status: "complete",
      max_stores: input.groceryList.maxStores,
      store_count: input.plan.stores.length,
      checkout_subtotal_cents: input.plan.subtotalCents,
      checkout_discount_cents: input.plan.itemCheckoutDiscountsCents + input.plan.basketDiscountCents,
      checkout_total_cents: input.plan.checkoutTotalCents,
      rebate_total_cents: input.plan.rebateTotalCents,
      net_total_cents: input.plan.netTotalCents,
      pricing_engine_version: input.pricingEngineVersion,
      input_snapshot: {
        groceryList: input.groceryList,
        unmatched: input.outcome.unmatched,
        catalogSource: input.catalog.source,
        launchRegion: input.catalog.region,
        primaryRetailer: input.catalog.primaryRetailer,
      },
      calculated_at: input.plan.calculatedAt,
    };
    const { data: recommendation, error: recommendationError } = await this.client
      .from("basket_recommendations")
      .insert(recommendationPayload)
      .select("id,created_at")
      .single();
    if (recommendationError) throw recommendationError;

    try {
      const linePayloads = input.plan.lines.map((line) => {
        const product = required(productByExternal.get(line.product.id), `Product mapping missing for ${line.product.id}.`);
        return {
          recommendation_id: recommendation.id,
          grocery_list_id: input.groceryList.id,
          grocery_list_item_id: line.groceryListItemId,
          store_id: required(storeBySlug.get(line.product.storeId), `Store mapping missing for ${line.product.storeId}.`),
          product_id: String(product.id),
          quantity: line.quantity,
          unit_price_cents: line.product.priceCents,
          checkout_subtotal_cents: line.basePriceCents,
          checkout_discount_cents: line.checkoutDiscountCents,
          checkout_total_cents: line.checkoutPriceCents,
          rebate_total_cents: line.rebateCents,
          net_total_cents: line.netPriceCents,
        };
      });
      const { data: persistedLines, error: lineError } = await this.client
        .from("basket_recommendation_lines")
        .insert(linePayloads)
        .select("id,grocery_list_item_id,product_id");
      if (lineError) throw lineError;
      const persistedLineByProduct = new Map((persistedLines ?? []).map((row: Row) => [String(row.product_id), String(row.id)]));

      const traces = input.plan.calculationTrace.map((trace) => {
        const offer = required(offerByExternal.get(trace.offerId), `Offer mapping missing for ${trace.offerId}.`);
        const product = trace.productId ? productByExternal.get(trace.productId) : undefined;
        const mode = String(offer.redemption_mode);
        return {
          recommendation_id: recommendation.id,
          recommendation_line_id: product ? persistedLineByProduct.get(String(product.id)) : null,
          offer_id: String(offer.id),
          sequence: trace.sequence,
          decision: trace.decision,
          stage: mode === "rebate" ? "post_purchase_rebate" : `${trace.scope}_checkout`,
          offer_state_snapshot: String(offer.state),
          reason_code: trace.reasonCode,
          explanation: trace.message,
          checkout_discount_cents: trace.decision === "applied" && mode === "checkout" ? (trace.appliedDiscountCents ?? 0) : 0,
          rebate_cents: trace.decision === "applied" && mode === "rebate" ? (trace.appliedDiscountCents ?? 0) : 0,
          rule_snapshot: trace.metadata,
          evidence_snapshot: Array.isArray(trace.metadata.evidence) ? trace.metadata.evidence : [],
          evaluated_at: trace.evaluatedAt,
        };
      });
      if (traces.length > 0) {
        const { error: traceError } = await this.client.from("basket_recommendation_traces").insert(traces);
        if (traceError) throw traceError;
      }
    } catch (error) {
      await this.client.from("basket_recommendations").delete().eq("id", recommendation.id);
      throw error;
    }

    return { id: recommendation.id, createdAt: iso(recommendation.created_at) };
  }

  async persistReceipt(userId: string, input: ReceiptPersistenceInput): Promise<{ id: string }> {
    const { data: existing } = await this.client
      .from("receipts")
      .select("id")
      .eq("provider_key", input.providerKey)
      .eq("ingestion_key", input.ingestionKey)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { id: existing.id };

    const storeQuery = this.client.from("stores").select("id");
    const { data: store, error: storeError } = await (looksLikeUuid(input.receipt.storeId)
      ? storeQuery.eq("id", input.receipt.storeId)
      : storeQuery.eq("slug", input.receipt.storeId)
    ).single();
    if (storeError) throw storeError;
    const { data: receipt, error: receiptError } = await this.client.from("receipts").insert({
      user_id: userId,
      store_id: store.id,
      recommendation_id: input.recommendationId ?? null,
      provider_key: input.providerKey,
      ingestion_key: input.ingestionKey,
      external_receipt_id: input.receipt.sourceReference ?? null,
      status: "reconciled",
      purchased_at: input.receipt.purchasedAt,
      subtotal_cents: input.receipt.subtotalCents,
      checkout_discount_cents: input.receipt.discountCents,
      tax_cents: input.receipt.taxCents,
      checkout_total_cents: input.receipt.totalCents,
      confirmed_rebate_cents: input.confirmedRebateCents,
      net_total_cents: input.receipt.totalCents - input.confirmedRebateCents,
    }).select("id").single();
    if (receiptError) throw receiptError;

    try {
      const lines = input.receipt.lines.map((line) => {
        const unitPriceCents = Math.round(line.lineSubtotalCents / line.quantity);
        if (Math.round(unitPriceCents * line.quantity) !== line.lineSubtotalCents) {
          throw new Error(`Receipt line ${line.id} cannot be represented in integer unit cents.`);
        }
        return {
          receipt_id: receipt.id,
          external_line_id: line.id,
          description: line.description,
          gtin: line.upc ?? null,
          quantity: line.quantity,
          unit_price_cents: unitPriceCents,
          subtotal_cents: line.lineSubtotalCents,
          checkout_discount_cents: line.discountCents,
          line_total_cents: line.lineSubtotalCents - line.discountCents,
        };
      });
      if (lines.length > 0) {
        const { error: lineError } = await this.client.from("receipt_lines").insert(lines);
        if (lineError) throw lineError;
      }
      if (input.rawPayload) {
        const { error: payloadError } = await this.client.rpc("store_receipt_payload", {
          target_receipt_id: receipt.id,
          payload: input.rawPayload,
        });
        if (payloadError) throw payloadError;
      }
      for (const redemption of input.redemptions) {
        await this.persistRedemption(userId, { ...redemption, receiptId: receipt.id });
      }
    } catch (error) {
      await this.client.from("receipts").delete().eq("id", receipt.id);
      throw error;
    }
    return { id: receipt.id };
  }

  async persistRedemption(userId: string, input: RedemptionInput): Promise<{ id: string }> {
    const { data: existing, error: existingError } = await this.client
      .from("offer_redemptions")
      .select("id,user_id")
      .eq("provider_key", input.providerKey)
      .eq("ingestion_key", input.ingestionKey)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      if (existing.user_id !== userId) throw new Error("Redemption ingestion key is already in use.");
      return { id: existing.id };
    }
    const offerQuery = this.client.from("offers").select("id");
    const { data: offer, error: offerError } = await (looksLikeUuid(input.offerId)
      ? offerQuery.eq("id", input.offerId)
      : offerQuery.eq("external_offer_id", input.offerId)
    ).single();
    if (offerError) throw offerError;
    const { data, error } = await this.client.from("offer_redemptions").insert({
      user_id: userId,
      offer_id: offer.id,
      receipt_id: input.receiptId ?? null,
      provider_key: input.providerKey,
      ingestion_key: input.ingestionKey,
      status: input.status,
      redeemed_at: input.redeemedAt ?? null,
      amount_cents: input.amountCents,
      metadata: input.metadata,
    }).select("id").single();
    if (error) throw error;
    return { id: data.id };
  }
}

export async function getActiveList(client: SupabaseClient, userId: string): Promise<SavedGroceryListInput & { id: string }> {
  let { data: list, error } = await client.from("grocery_lists")
    .select("id,title,include_rebates,verified_offers_only,max_stores")
    .eq("user_id", userId).eq("status", "active").eq("is_demo", false)
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!list) {
    const { data: created, error: createError } = await client.from("grocery_lists").insert({
      user_id: userId, title: "My grocery list", status: "active", is_demo: false,
    }).select("id,title,include_rebates,verified_offers_only,max_stores").single();
    if (createError) throw createError;
    list = created;
    const { data: demoItems, error: demoError } = await client
      .from("grocery_list_items")
      .select("client_item_id,query,quantity,purchased,requested_gtin,requested_category,requested_brand,position,grocery_lists!inner(is_demo)")
      .eq("grocery_lists.is_demo", true)
      .order("position");
    if (demoError) throw demoError;
    if ((demoItems ?? []).length > 0) {
      const { error: copyError } = await client.from("grocery_list_items").insert(
        (demoItems ?? []).map((item: Row) => ({
          grocery_list_id: created.id,
          client_item_id: item.client_item_id,
          query: item.query,
          quantity: item.quantity,
          purchased: item.purchased,
          requested_gtin: item.requested_gtin,
          requested_category: item.requested_category,
          requested_brand: item.requested_brand,
          position: item.position,
        })),
      );
      if (copyError) throw copyError;
    }
  }
  const { data: items, error: itemError } = await client.from("grocery_list_items")
    .select("id,client_item_id,query,quantity,purchased,requested_gtin,requested_category,requested_brand")
    .eq("grocery_list_id", list.id).order("position");
  if (itemError) throw itemError;
  return {
    id: list.id,
    title: list.title,
    includeRebates: list.include_rebates,
    verifiedOffersOnly: list.verified_offers_only,
    maxStores: list.max_stores,
    items: (items ?? []).map((item: Row) => ({
      id: String(item.client_item_id ?? item.id),
      listId: list.id,
      name: String(item.query),
      quantity: Number(item.quantity),
      purchased: Boolean(item.purchased),
      ...(item.requested_gtin ? { requestedUpc: String(item.requested_gtin) } : {}),
      ...(item.requested_category ? { requestedCategory: String(item.requested_category) } : {}),
      ...(item.requested_brand ? { requestedBrand: String(item.requested_brand) } : {}),
    })),
  };
}

export async function saveList(
  client: SupabaseClient,
  userId: string,
  input: SavedGroceryListInput,
): Promise<SavedGroceryListInput & { id: string }> {
  let listId = input.id;
  if (listId) {
    const { data, error } = await client.from("grocery_lists").update({
      title: input.title,
      include_rebates: input.includeRebates,
      verified_offers_only: input.verifiedOffersOnly,
      max_stores: input.maxStores,
    }).eq("id", listId).eq("user_id", userId).eq("is_demo", false).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Grocery list was not found for this user.");
  } else {
    const { data, error } = await client.from("grocery_lists").insert({
      user_id: userId,
      title: input.title,
      status: "active",
      is_demo: false,
      include_rebates: input.includeRebates,
      verified_offers_only: input.verifiedOffersOnly,
      max_stores: input.maxStores,
    }).select("id").single();
    if (error) throw error;
    listId = data.id;
  }
  const resolvedListId = required(listId, "List id was not created.");
  const { error: deleteError } = await client.from("grocery_list_items").delete().eq("grocery_list_id", resolvedListId);
  if (deleteError) throw deleteError;
  if (input.items.length > 0) {
    const { error: itemError } = await client.from("grocery_list_items").insert(input.items.map((item, position) => ({
      grocery_list_id: resolvedListId,
      client_item_id: item.id,
      query: item.name,
      quantity: item.quantity,
      purchased: item.purchased,
      requested_gtin: item.requestedUpc ?? null,
      requested_category: item.requestedCategory ?? null,
      requested_brand: item.requestedBrand ?? null,
      position,
    })));
    if (itemError) throw itemError;
  }
  return { ...input, id: resolvedListId };
}
