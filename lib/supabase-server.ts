/**
 * Creates an SSR-aware Supabase client for use in Server Components and
 * Route Handlers (API routes). Uses next/headers cookies() to read/write
 * the auth session.
 *
 * NOTE: cookies() is async in Next.js 15 — always await this function.
 *
 * The `as unknown as SupabaseClient<Database>` cast bridges a generic-signature
 * mismatch between @supabase/ssr 0.5.2 (built for supabase-js ^2.43) and the
 * installed supabase-js 2.45+. Runtime behaviour is identical.
 *
 * Usage (in a Route Handler or Server Component):
 *   const supabase = await createServerSupabaseClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */

import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export async function createServerSupabaseClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cookieStore.set(name, value, options as any);
            });
          } catch {
            // setAll called from a Server Component context — safely ignored.
            // Middleware handles cookie refresh for server-rendered pages.
          }
        },
      },
    }
  ) as unknown as SupabaseClient<Database>;
}
