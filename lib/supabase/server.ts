import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { assertQaPreviewIsolation } from "@/lib/supabase/qa-preview-isolation";

export function ownerAuthReady(): boolean {
  assertQaPreviewIsolation();
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.OWNER_AUTH_EMAIL);
}

export async function createOwnerClient() {
  assertQaPreviewIsolation();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    auth: { flowType: "pkce", autoRefreshToken: true, persistSession: true },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, { ...options, secure: process.env.NODE_ENV === "production" }));
        } catch {
          // Next server components cannot set cookies: proxy.ts handles token refresh.
          // Server Actions and route handlers can write cookies.
        }
      },
    },
  });
}
