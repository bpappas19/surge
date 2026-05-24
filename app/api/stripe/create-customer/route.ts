/**
 * POST /api/stripe/create-customer
 * Creates a Stripe Customer for a league member and saves the customer ID
 * to league_members.stripe_customer_id.
 *
 * Body: { leagueId: string }
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

  const { leagueId } = (await request.json()) as { leagueId: string };

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // Create Stripe Customer
  const displayName =
    (user.user_metadata?.display_name as string | undefined) ?? undefined;

  const customer = await stripe.customers.create({
    email: user.email,
    name: displayName,
    metadata: {
      supabase_user_id: user.id,
      league_id: leagueId,
    },
  });

  // Save customer ID to league_members row
  await supabase
    .from("league_members")
    .update({ stripe_customer_id: customer.id })
    .eq("league_id", leagueId)
    .eq("user_id", user.id);

  return NextResponse.json({ customerId: customer.id });
}
