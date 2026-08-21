# ADR 0001: TypeScript monorepo and trusted pricing boundary

- Status: Accepted
- Date: 2026-08-20

## Context

The dependency-free PWA proves the BasketMatch flow but cannot safely share contracts across mobile, web, database ingestion, and approved provider integrations. Pricing must remain deterministic, explainable, and independent of UI or provider response formats.

## Decision

Use a pnpm workspace with Expo Router in `apps/mobile`, Next.js in `apps/web`, and three shared TypeScript packages:

- `domain` owns Zod schemas and inferred types.
- `pricing-engine` owns pure matching and calculation functions. Money is integer cents, percentages are basis points, checkout and post-rebate totals are distinct, and every considered offer receives an applied/rejected trace entry.
- `provider-adapters` normalizes approved provider data behind typed interfaces and deterministic mocks. Retailer accounts are OAuth/token references only; secrets remain server-side.

Use Supabase/PostgreSQL for auth-linked user data, normalized catalog/offer history, evidence, lists, recommendations with immutable traces, and receipt reconciliation. UTC timestamps are stored; locale formatting belongs to clients. Provider ingestion uses stable external IDs/idempotency keys.

The original static PWA remains in place as a parity fixture while the production apps consume the shared engine. No unofficial scraping is an integration fallback.

## Consequences

- Mobile, web, workers, and future APIs share validation and pricing semantics.
- Schema or pricing changes require package tests and legacy parity tests.
- Live coverage depends on provider credentials, contracts, OAuth review, and sandbox certification described in `docs/INTEGRATIONS.md`; mocks remain the default until then.
- Calculation traces and receipt evidence increase storage, but make totals auditable and prediction accuracy measurable.
