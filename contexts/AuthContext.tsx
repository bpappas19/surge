"use client";

/**
 * Auth context — wraps the entire app via layout.tsx.
 * Provides `user`, `loading`, and `signOut` to all client components.
 *
 * Pattern: the root layout (a Server Component) reads the session from cookies
 * via createServerSupabaseClient and passes it here as `initialSession`.
 * This means `loading` is already false on the very first render, so the
 * NavBar never shows a skeleton on a hard refresh.
 *
 * onAuthStateChange keeps the state in sync after client-side sign-in / sign-out
 * / token refresh without needing to reload the page.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  /**
   * Session resolved server-side in the root layout.
   *   Session   → user is logged in; render immediately with correct state
   *   null      → server confirmed no active session; render logged-out immediately
   *   undefined → not provided (fallback); start in loading state and wait for
   *               onAuthStateChange to resolve (legacy behaviour)
   */
  initialSession?: Session | null;
}) {
  const [supabase] = useState(() => createClient());

  // Seed state from the server-resolved session — no async round-trip needed.
  const [user,    setUser]    = useState<User | null>(initialSession?.user ?? null);
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  // When the server provided an explicit value (even null = "not logged in"),
  // we already know the auth state and can skip the loading phase entirely.
  const [loading, setLoading] = useState(initialSession === undefined);

  useEffect(() => {
    // Keep auth state in sync after client-side sign-in / sign-out / token refresh.
    // Also covers the fallback path where no initialSession was provided.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
