/**
 * Creates an SSR-aware Supabase client for use in "use client" components.
 * `createBrowserClient` stores the auth session in cookies (not localStorage),
 * so the middleware can read it for route protection.
 *
 * The `as unknown as SupabaseClient<Database>` cast bridges a generic-signature
 * mismatch between @supabase/ssr 0.5.2 (built for supabase-js ^2.43) and the
 * installed supabase-js 2.45+. Runtime behaviour is identical; only compile-time
 * types are affected.
 *
 * Usage:
 *   const supabase = createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as unknown as SupabaseClient<Database>;
}
