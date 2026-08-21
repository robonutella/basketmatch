import { SavedGroceryListInputSchema } from "@basketmatch/domain";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/server/http";
import { getActiveList, saveList } from "@/lib/server/supabase-repository";
import { authenticateRequest, createUserSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const list = await getActiveList(createUserSupabaseClient(auth.accessToken), auth.userId);
    return NextResponse.json({ list });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const input = SavedGroceryListInputSchema.parse(await request.json());
    const list = await saveList(createUserSupabaseClient(auth.accessToken), auth.userId, input);
    return NextResponse.json({ list });
  } catch (error) {
    return apiError(error);
  }
}
