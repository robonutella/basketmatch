import { calculateAndPersistRecommendation } from "@basketmatch/backend";
import { CalculateBasketRequestSchema } from "@basketmatch/domain";
import {
  demoCalculationNow,
  demoOffers,
  demoProducts,
  demoStores,
} from "@basketmatch/pricing-engine/demo";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/server/http";
import { SupabaseBasketRepository } from "@/lib/server/supabase-repository";
import { authenticateRequest, createServiceSupabaseClient, createUserSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const input = CalculateBasketRequestSchema.parse(await request.json());
    const result = await calculateAndPersistRecommendation({
      userId: auth.userId,
      groceryListId: input.groceryListId,
      idempotencyKey: input.idempotencyKey,
      repository: new SupabaseBasketRepository(createServiceSupabaseClient()),
      catalog: {
        products: demoProducts,
        offers: demoOffers,
        stores: demoStores,
        source: "typed_mock",
        region: "San Francisco Bay Area",
        primaryRetailer: "Safeway",
      },
      // The mock catalog is a time-stable fixture that reproduces the browser prototype.
      now: demoCalculationNow,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const client = createUserSupabaseClient(auth.accessToken);
    const { data: recommendations, error } = await client
      .from("basket_recommendations")
      .select("*,basket_recommendation_lines(*),basket_recommendation_traces(*)")
      .order("calculated_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return NextResponse.json({ recommendations });
  } catch (error) {
    return apiError(error);
  }
}
