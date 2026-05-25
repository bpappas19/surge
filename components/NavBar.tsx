"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, LayoutGrid } from "lucide-react";

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
      className="fixed top-0 left-0 right-0 z-30 h-14 flex items-center bg-[#0a0e1a] border-b"
      style={{ borderBottomColor: "rgba(26, 158, 110, 0.45)" }}
    >
      <div className="w-full px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Logo size="sm" />
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {loading ? (
            /* Skeleton — resolves once auth state is known (typically < 100 ms) */
            <div className="flex items-center gap-3" aria-hidden>
              <div className="w-14 h-6 bg-navy-800 rounded animate-pulse" />
              <div className="w-16 h-6 bg-navy-800 rounded-lg animate-pulse" />
            </div>
          ) : user ? (
            <>
              {/* My Leagues icon link */}
              <Link
                href="/leagues"
                className="text-slate-500 hover:text-slate-200 transition-colors p-1"
                aria-label="My Leagues"
              >
                <LayoutGrid className="w-4 h-4" strokeWidth={1.5} />
              </Link>

              <div ref={menuRef} className="relative">
                {/* User avatar button */}
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="w-7 h-7 rounded-full bg-navy-700 border border-navy-600 flex items-center justify-center hover:border-navy-500 transition-colors"
                  aria-label="Account menu"
                >
                  <span className="text-[11px] font-semibold text-slate-300 leading-none">
                    {initial}
                  </span>
                </button>

                {/* Dropdown */}
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 min-w-[180px] bg-navy-800 border border-navy-700 rounded-xl shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-navy-700">
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <p className="text-xs font-medium text-slate-300 mt-0.5 truncate">{displayName}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-400 hover:text-slate-200 hover:bg-navy-750 transition-colors text-left"
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
                className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/auth/signup"
                className="text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
