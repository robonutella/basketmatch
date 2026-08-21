# Codex instructions for BasketMatch

## Product promise

A user writes a grocery list once. BasketMatch searches legitimate store prices, retailer offers, manufacturer coupons, promo codes, and rebates, then shows the lowest trustworthy checkout total and final net cost.

## Non-negotiable rules

1. Never request or store retailer usernames or passwords directly.
2. Use official OAuth/API integrations where available.
3. Never include an unverified offer in the primary trusted total.
4. Always distinguish checkout discounts from post-purchase rebates.
5. Show why an offer matched: product, brand, size, store, location, expiration, and stacking rules.
6. Preserve a full calculation trace for every recommendation.
7. Do not claim a coupon is guaranteed unless the relevant provider or checkout has validated it.
8. Run `npm test` after changing `src/engine.js` or coupon data structures.

## Coding standards

- TypeScript for all production migration work.
- Pure functions for pricing and optimization.
- Money represented as integer cents in production.
- External providers behind typed adapter interfaces.
- Idempotent offer ingestion.
- UTC timestamps in storage; user locale only at display time.
- No secrets in client code.
- Add tests for every coupon rule and regression.

## Current milestone

Convert the static PWA into an Expo React Native application while extracting the pricing engine into a shared TypeScript package. Preserve existing behavior and tests before adding live integrations.
