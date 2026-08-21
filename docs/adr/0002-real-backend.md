# ADR 0002: Supabase identity and server-owned pricing persistence

- Status: Accepted
- Date: 2026-08-21

## Context

BasketMatch needs account-backed lists and durable calculation evidence without exposing privileged database credentials or coupling clients to the pricing engine. The first release uses email magic links; Apple and Google sign-in are expected later. The launch market is the San Francisco Bay Area, Safeway is the first retailer priority, and provider data remains typed mock data until official access is approved.

## Decision

Use Supabase Auth as the identity boundary. Application rows reference `auth.users.id`, not an email address or a provider-specific subject. Email PKCE magic links are enabled first; future Apple and Google identities attach to the same user model.

Web and mobile use the public Supabase key only for authentication. They send the resulting access token to authenticated Next.js API routes. Grocery-list mutations execute with the caller's token and row-level security. Pricing executes in `@basketmatch/backend` on the server with the unchanged framework-independent engine. Only the server service role may store recommendations, recommendation lines, calculation traces, normalized receipts, private receipt payloads, and redemptions.

The server composition root currently supplies deterministic typed mock catalog and offer data. Its explicit metadata records `typed_mock`, `San Francisco Bay Area`, and `Safeway` in each calculation input snapshot. Live adapters may replace that catalog only after approved credentials and conformance tests are available.

## Consequences

- A leaked public key cannot forge calculations, receipts, or redemptions; those tables remain read-only to authenticated clients.
- Checkout and after-rebate totals remain separately constrained in PostgreSQL and validated in TypeScript.
- Every stored recommendation includes all applied and rejected offer trace entries for the selected plan.
- Provider expansion changes server composition, not client authentication or core pricing behavior.
- Next.js is the initial API deployment unit; background ingestion can later reuse the backend package and persistence ports.
