# First prompt for Codex

You are the lead engineer for BasketMatch. Read `README.md`, `AGENTS.md`, `docs/PRD.md`, and the existing pricing-engine tests before editing anything.

Goal: convert this working static PWA into a production-oriented monorepo without breaking the current pricing behavior.

Create:

1. `apps/mobile`: Expo React Native + Expo Router + TypeScript.
2. `apps/web`: Next.js TypeScript admin and responsive consumer web app.
3. `packages/pricing-engine`: framework-independent TypeScript package migrated from `src/engine.js`.
4. `packages/domain`: shared Zod schemas and types for stores, products, offers, grocery lists, basket plans, and evidence.
5. `supabase/`: SQL migrations for users, retailer connections, stores, products, prices, offers, offer evidence, grocery lists, basket recommendations, and receipts.
6. `packages/provider-adapters`: interfaces plus mock adapters for retailer catalog, retailer loyalty offers, manufacturer coupons, promo-code validation, rebates, and receipts.

Requirements:

- Use integer cents for money.
- Keep checkout total and after-rebate net total separate.
- Support verified, recently redeemed, unverified, failed, and expired offer states.
- Build a calculation trace that explains every applied or rejected offer.
- Never collect retailer passwords. Model OAuth/token connections only.
- Add unit tests for stacking, minimum spend, expiration, exact UPC match, category match, brand match, one-time redemption, and failed promo codes.
- Add a demo seed that reproduces the current browser prototype.
- Add a concise architecture decision record in `docs/adr/0001-monorepo.md`.
- Run tests and report any remaining blockers.

Do not integrate unofficial scraping. Where credentials or commercial approvals are required, provide a typed mock adapter and document the exact environment variables and onboarding steps.
