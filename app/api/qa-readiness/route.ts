import { NextResponse } from "next/server";
import { assertQaPreviewIsolation } from "@/lib/supabase/qa-preview-isolation";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return new Response(null, { status: 404 });
  }

  const headers = { "Cache-Control": "no-store, max-age=0" };
  try {
    assertQaPreviewIsolation();
    // Configuration safety only; this response does not certify login or RPC access.
    return NextResponse.json({ qaPreviewIsolation: "configured" }, { headers });
  } catch {
    return NextResponse.json({ qaPreviewIsolation: "blocked" }, { status: 503, headers });
  }
}
