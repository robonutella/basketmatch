# BasketMatch

BasketMatch compares a grocery list against store prices, retailer loyalty offers, manufacturer coupons, promo codes, and post-purchase rebates. This repository is a pnpm TypeScript monorepo with a preserved dependency-free prototype for migration regression coverage.

## Workspace

| Path | Purpose |
| --- | --- |
| `apps/mobile` | Expo React Native consumer app using Expo Router |
| `apps/web` | Next.js responsive consumer app and `/admin` operations view |
| `packages/domain` | Shared Zod schemas and inferred TypeScript domain types |
| `packages/pricing-engine` | Framework-independent matching, pricing, optimization, and calculation trace |
| `packages/provider-adapters` | Provider interfaces and deterministic mocks; no scraping or live credentials |
| `supabase` | PostgreSQL/Supabase schema, RLS policies, and prototype-equivalent demo seed |
| `src`, `data`, root HTML/CSS | Original static PWA retained as a browser prototype and parity reference |

Money is represented as integer cents. Percentage discounts use integer basis points. Checkout totals never include post-purchase rebates; each basket exposes both `checkoutTotalCents` and `netTotalCents`. Only `verified` and `recently_redeemed` offers contribute to trusted totals by default.

## Prerequisites

- Node.js 22.13 or newer
- pnpm 11.19 or newer (Corepack may install the pinned version)
- Expo Go or a native simulator for mobile development
- Docker Desktop or another Docker-compatible runtime when running the local database

## Install and verify

```bash
corepack enable
pnpm install
pnpm test
pnpm typecheck
```

`pnpm test` builds the shared packages, runs the original Node pricing tests and migration-parity checks, then runs package unit tests.

## Run applications

```bash
# Responsive consumer web and /admin
pnpm dev

# Expo Router mobile app
pnpm dev:mobile

# Preserved dependency-free browser prototype
pnpm dev:prototype
```

The web app runs at `http://localhost:3000`; the preserved prototype runs at `http://localhost:4173`.

## Local database

The Supabase CLI is pinned as a workspace development dependency. With a Docker-compatible runtime running:

```bash
pnpm db:start
pnpm db:reset
pnpm test:db
```

The reset applies `supabase/migrations` and then `supabase/seed.sql`. The seed recreates the three demo stores, catalog, offers, and grocery list from the original browser prototype. The pgTAP smoke suite verifies the seed, RLS ownership boundaries, OAuth-secret isolation, recommendation and calculation-trace persistence, reconciled checkout/rebate totals, and the atomic one-time-redemption trigger.

## Continuous integration

`.github/workflows/ci.yml` runs the full package test and typecheck suites, the Next.js production build, Expo exports for Android, iOS, and web, and a clean Supabase migration reset plus pgTAP database tests. The database job uses only the local Supabase stack and does not require hosted-project credentials.

## External providers

All external services are behind typed adapters. The repository ships mocks only and never asks for retailer passwords. Live retailer connections must use official OAuth flows with tokens held in a server-side secret manager. Required environment-variable names, approval prerequisites, and onboarding steps are documented in [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md).

No unofficial scraping is implemented or permitted. The shared mode resolver defaults missing provider configuration to `mock`; deployment code must refuse non-mock modes until the corresponding approved adapter and credentials are available.

## Architecture

See [`docs/adr/0001-monorepo.md`](docs/adr/0001-monorepo.md) for the initial architecture decision and [`docs/PRD.md`](docs/PRD.md) for product scope.
