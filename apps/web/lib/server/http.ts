import { NextResponse } from "next/server";

export function apiError(error: unknown): NextResponse {
  if (error instanceof Response) {
    return NextResponse.json({ error: "Authentication required." }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  console.error("BasketMatch API error", error);
  return NextResponse.json({ error: message }, { status: 500 });
}
