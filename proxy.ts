import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, { ...options, secure: process.env.NODE_ENV === "production" }),
        );
      },
    },
  });

  // Refresh the session without treating a cookie/JWT claim alone as authorization.
  // Verify signed session claims and refresh cookies without a full user lookup
  // on every admin navigation. requireOwner() still checks the current Auth
  // user and active owner row before any protected data is read or mutated.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
