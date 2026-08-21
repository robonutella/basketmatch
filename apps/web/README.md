# BasketMatch web

Next.js App Router application with the responsive consumer planner at `/`, an operational demo dashboard at `/admin`, email magic-link authentication, and authenticated APIs for lists, server-side recommendations/traces, receipts, and redemptions.

## Local setup

1. Install workspace dependencies from the repository root.
2. Copy `.env.example` to `.env.local`.
3. Use the values printed by local `supabase start`, then run the root web script or `pnpm dev` here. If the variables are absent, the consumer screen stays in deterministic demo mode and API requests return a configuration error.

The service-role key is server-only and must never be imported by a Client Component. Retailer and savings-provider client secrets also belong only in the server/provider-adapter deployment. Retailer authorization must use an approved OAuth redirect; do not add username/password fields or unofficial scraping.
