/**
 * POST /api/stripe/connect-account
 * Creates a Stripe Connect Express account for the commissioner and returns
 * an onboarding URL. Redirects on return go to the league dashboard.
 *
 * Body: { leagueId: string, mode: "manual" | "sleeper", sleeperId?: string }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured on this server. Add STRIPE_SECRET_KEY to .env.local." },
      { status: 503 }
    );
  }

  // Verify auth
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueId, mode, sleeperId } =
    (await request.json()) as { leagueId: string; mode: "manual" | "sleeper"; sleeperId?: string };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dashboardHref =
    mode === "sleeper" && sleeperId
      ? `${appUrl}/league/${sleeperId}`
      : `${appUrl}/m/${leagueId}`;

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // Create Express Connected Account
  const account = await stripe.accounts.create({ type: "express" });

  // Create onboarding link (user completes KYC on Stripe's hosted page)
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${dashboardHref}?stripe=refresh`,
    return_url: `${dashboardHref}?stripe=success`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url, accountId: account.id });
}
