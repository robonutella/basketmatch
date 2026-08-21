# BasketMatch web

Next.js App Router application with the responsive consumer planner at `/` and an operational demo dashboard at `/admin`.

## Local setup

1. Install workspace dependencies from the repository root.
2. Copy `.env.example` to `.env.local`.
3. Set the public API/Supabase values only when the approved backend is available, then run the root web script or `npm run dev` here.

The service-role key is server-only and must never be imported by a Client Component. Retailer and savings-provider client secrets also belong only in the server/provider-adapter deployment. Retailer authorization must use an approved OAuth redirect; do not add username/password fields or unofficial scraping.
