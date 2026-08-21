import { persistReceipt } from "@basketmatch/backend";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/server/http";
import { SupabaseBasketRepository } from "@/lib/server/supabase-repository";
import { authenticateRequest, createServiceSupabaseClient, createUserSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const result = await persistReceipt(
      new SupabaseBasketRepository(createServiceSupabaseClient()),
      auth.userId,
      await request.json(),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const { data, error } = await createUserSupabaseClient(auth.accessToken)
      .from("receipts")
      .select("*,receipt_lines(*),offer_redemptions(*)")
      .order("purchased_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ receipts: data });
  } catch (error) {
    return apiError(error);
  }
}
