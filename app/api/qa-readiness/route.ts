import { NextResponse } from "next/server";
import {
  QA_PREVIEW_REF,
  assertQaPreviewIsolation,
} from "@/lib/supabase/qa-preview-isolation";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== QA_PREVIEW_REF) {
    return new Response(null, { status: 404 });
  }

  const headers = { "Cache-Control": "no-store, max-age=0" };
  try {
    assertQaPreviewIsolation();
    if(process.env.LAUNDRY_DATABASE_MODE==="single"){
      return NextResponse.json({qaPreviewIsolation:"retired",databaseMode:"single"},{headers});
    }
    // Intentionally excludes URLs, credentials, cookies, member data and tokens.
    // Shows configuration safety only; it does not certify login or RPC access.
    return NextResponse.json({ qaPreviewIsolation: "configured" }, { headers });
  } catch {
    return NextResponse.json({ qaPreviewIsolation: "blocked" }, { status: 503, headers });
  }
}
