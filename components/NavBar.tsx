"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";

export function NavBar() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    router.push("/");
    router.refresh();
  }

  // Display name: user_metadata.display_name → email prefix → "?"
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "?";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-30 h-16 flex items-center bg-[#0a0e1a] border-b border-white/5"
    >
      <div className="w-full px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Logo size="nav" />
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-5">
          {loading ? (
            /* Skeleton — resolves once auth state is known. With server-side
               initialSession this should never show on a hard refresh. */
            <div className="flex items-center gap-2" aria-hidden>
              <div className="w-20 h-6 bg-white/5 rounded-lg animate-pulse" />
              <div className="w-24 h-6 bg-white/5 rounded-lg animate-pulse" />
              <div className="w-8 h-8 bg-white/5 rounded-full animate-pulse" />
            </div>
          ) : user ? (
            <>
              <div className="flex items-center gap-8">
                <Link
                  href="/leagues"
                  className="text-sm font-medium text-slate-200 hover:text-white transition-colors"
                >
                  My Leagues
                </Link>
                <Link
                  href="/create"
                  className="border border-emerald-500/40 text-emerald-400 hover:border-emerald-500/70 hover:text-emerald-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Create Surge
                </Link>
              </div>

              {/* User avatar + dropdown */}
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="w-8 h-8 rounded-full bg-white/8 border border-white/15 flex items-center justify-center hover:border-white/20 transition-colors"
                  aria-label="Account menu"
                >
                  <span className="text-[11px] font-semibold text-slate-300 leading-none">
                    {initial}
                  </span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 min-w-[180px] bg-[#0d1420] border border-white/6 rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/6">
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <p className="text-xs font-medium text-slate-300 mt-0.5 truncate">{displayName}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors text-left"
                    >
                      <LogOut className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/auth/login"
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors px-2 py-1.5"
              >
                Log in
              </Link>
              {/* "Create Surge" doubles as the sign-up CTA for logged-out users */}
              <Link
                href="/auth/signup?next=/create"
                className="border border-emerald-500/40 text-emerald-400 hover:border-emerald-500/70 hover:text-emerald-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Create Surge
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
