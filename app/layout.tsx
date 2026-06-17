import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { NavBar } from "@/components/NavBar";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Session } from "@supabase/supabase-js";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Surge — Fantasy Pot Tracker",
  description: "Track your fantasy football league pot. Lowest scorer pays. Champion collects.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2'><polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/></svg>",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the session from cookies on the server so AuthProvider receives it
  // as initial state. This means the NavBar renders with the correct auth
  // buttons on the very first paint — no skeleton flash on hard refresh.
  let initialSession: Session | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getSession();
    initialSession = data.session;
  } catch {
    // Supabase unreachable (e.g. missing env vars in some environments).
    // Fall back to client-side resolution — loading state will still resolve.
  }

  return (
    <html lang="en">
      <body className={`${inter.className} bg-navy-950 text-slate-100 min-h-screen antialiased`}>
        <AuthProvider initialSession={initialSession}>
          {/* Fixed nav — appears on every page */}
          <NavBar />
          {/* Spacer so content starts below the 64px nav */}
          <div className="pt-16">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
