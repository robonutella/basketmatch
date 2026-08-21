# Provider integrations

`@basketmatch/provider-adapters` is the boundary between BasketMatch domain data and approved external services. The pricing engine consumes normalized products, offers, evidence, and receipts; it does not depend on provider response shapes.

The repository currently ships deterministic mock adapters only. It has no live provider credentials or commercial approvals. Do not add unofficial scraping, browser automation, or password collection as a substitute for an API agreement.

## Adapter contracts

| Adapter | Normalized responsibility | Trust boundary |
| --- | --- | --- |
| Retailer catalog | Search by text, exact UPC/GTIN, category, brand, store/location, and fulfillment method; report integer-cent price and observation time. | A price is only as current as `priceObservedAt`; availability is not guaranteed inventory. |
| Retailer loyalty offers | Fetch clipped, eligible, and redeemed offers for an OAuth-connected account; refresh or revoke the connection reference. | The adapter receives an opaque vault reference, never a password or raw token. |
| Manufacturer coupons | Return exact product/category/brand eligibility, expiry, redemption constraints, and evidence. | Serialized coupon identities may be retained only when the contract permits it. |
| Promo-code validation | Test a code against a specific basket where the provider permits a sanctioned cart request. | `failed` and `not_tested` always produce zero checkout savings and are distinct from provider rejection. |
| Rebates | Return activation state, post-purchase requirements, and manufacturer-coupon stacking policy. | Rebate value is post-purchase and must never reduce checkout total. |
| Receipts | Normalize receipt lines, checkout discounts, tax, and total paid using integer cents. | Receipt access requires user consent and an approved API or import path. |

All calls carry a caller-generated request ID and a UTC request timestamp. Mock responses reuse that timestamp and sort fixtures by provider ID, making tests repeatable. Provider errors are typed and include a retriable flag.

Normalized offers preserve the domain states `verified`, `recently_redeemed`, `unverified`, `failed`, and `expired`. An adapter may add evidence, but it must not promote an offer to `verified` unless the provider response actually proves the relevant eligibility.

## OAuth and token storage

A retailer connection is represented by `OAuthConnectionReference`:

- `connectionId`, `userId`, provider/retailer identifiers, granted scopes, status, and timestamps are ordinary server data.
- `tokenSecretReference` is an opaque pointer to a server-side secret manager entry.
- Mock contract checks use normalized scopes: `offers.read` for loyalty offers, `promos.validate` for account promo validation, `rebates.read` for account rebates, and `receipts.read` for receipt import. Live adapters map provider-issued scope names to these capabilities only after authorization succeeds.
- Access and refresh tokens are resolved only inside a trusted backend or worker. They are never returned to Expo or browser clients.
- Retailer usernames and passwords are never requested, accepted, logged, or stored.
- Revocation deletes or disables the secret-manager entry and marks the database connection revoked.

OAuth state and PKCE must be bound to the signed-in BasketMatch user. Redirect URIs must be allowlisted exactly, and refresh-token rotation must be handled atomically. Logs may include `connectionId`; they must not include authorization codes, access tokens, refresh tokens, or full provider payloads containing personal data.

## Environment variable contract

The names below are BasketMatch's proposed server-side configuration contract. They are placeholders until each provider supplies approved endpoints and credentials. `resolveProviderAdapterModes` implements mode selection: an unset provider inherits `PROVIDER_ADAPTER_MODE`, which defaults to `mock`. A server composition root must explicitly instantiate the selected adapter; a non-mock mode without an approved implementation is a deployment error and must never fall back to scraping.

```dotenv
# Adapter selection and server-side OAuth/token infrastructure
PROVIDER_ADAPTER_MODE=mock
BASKETMATCH_OAUTH_STATE_SIGNING_SECRET=<secret-manager-reference-or-injected-secret>
BASKETMATCH_TOKEN_VAULT_NAMESPACE=<vault-namespace>

# Albertsons Companies / Safeway (only after consumer catalog/loyalty approval)
ALBERTSONS_ADAPTER_MODE=mock
ALBERTSONS_API_BASE_URL=<provider-issued-api-base-url>
ALBERTSONS_OAUTH_AUTHORIZE_URL=<provider-issued-authorize-url>
ALBERTSONS_OAUTH_TOKEN_URL=<provider-issued-token-url>
ALBERTSONS_CLIENT_ID=<provider-issued-client-id>
ALBERTSONS_CLIENT_SECRET=<provider-issued-client-secret>
ALBERTSONS_OAUTH_REDIRECT_URI=<server-callback-url>
ALBERTSONS_WEBHOOK_SIGNING_SECRET=<provider-issued-webhook-secret>

# Walmart (only after the approved API program explicitly covers this use case)
WALMART_ADAPTER_MODE=mock
WALMART_API_BASE_URL=<provider-issued-api-base-url>
WALMART_OAUTH_AUTHORIZE_URL=<provider-issued-authorize-url>
WALMART_OAUTH_TOKEN_URL=<provider-issued-token-url>
WALMART_CLIENT_ID=<provider-issued-client-id>
WALMART_CLIENT_SECRET=<provider-issued-client-secret>
WALMART_OAUTH_REDIRECT_URI=<server-callback-url>
WALMART_WEBHOOK_SIGNING_SECRET=<provider-issued-webhook-secret>

# Target (only after the approved API program explicitly covers this use case)
TARGET_ADAPTER_MODE=mock
TARGET_API_BASE_URL=<provider-issued-api-base-url>
TARGET_OAUTH_AUTHORIZE_URL=<provider-issued-authorize-url>
TARGET_OAUTH_TOKEN_URL=<provider-issued-token-url>
TARGET_CLIENT_ID=<provider-issued-client-id>
TARGET_CLIENT_SECRET=<provider-issued-client-secret>
TARGET_OAUTH_REDIRECT_URI=<server-callback-url>
TARGET_WEBHOOK_SIGNING_SECRET=<provider-issued-webhook-secret>

# Contracted manufacturer-coupon network
MFR_COUPON_NETWORK_ADAPTER_MODE=mock
MFR_COUPON_NETWORK_API_BASE_URL=<network-issued-api-base-url>
MFR_COUPON_NETWORK_CLIENT_ID=<network-issued-client-id>
MFR_COUPON_NETWORK_CLIENT_SECRET=<network-issued-client-secret>
MFR_COUPON_NETWORK_PARTNER_ID=<network-issued-partner-id>
MFR_COUPON_NETWORK_WEBHOOK_SIGNING_SECRET=<network-issued-webhook-secret>

# Sanctioned checkout/promo validation provider, if separate from a retailer API
PROMO_VALIDATION_ADAPTER_MODE=mock
PROMO_VALIDATION_API_BASE_URL=<provider-issued-api-base-url>
PROMO_VALIDATION_CLIENT_ID=<provider-issued-client-id>
PROMO_VALIDATION_CLIENT_SECRET=<provider-issued-client-secret>
PROMO_VALIDATION_PARTNER_ID=<provider-issued-partner-id>

# Contracted rebate network
REBATE_NETWORK_ADAPTER_MODE=mock
REBATE_NETWORK_API_BASE_URL=<network-issued-api-base-url>
REBATE_NETWORK_OAUTH_AUTHORIZE_URL=<network-issued-authorize-url>
REBATE_NETWORK_OAUTH_TOKEN_URL=<network-issued-token-url>
REBATE_NETWORK_CLIENT_ID=<network-issued-client-id>
REBATE_NETWORK_CLIENT_SECRET=<network-issued-client-secret>
REBATE_NETWORK_OAUTH_REDIRECT_URI=<server-callback-url>
REBATE_NETWORK_WEBHOOK_SIGNING_SECRET=<network-issued-webhook-secret>

# Contracted receipt provider or approved retailer receipt API
RECEIPT_PROVIDER_ADAPTER_MODE=mock
RECEIPT_PROVIDER_API_BASE_URL=<provider-issued-api-base-url>
RECEIPT_PROVIDER_OAUTH_AUTHORIZE_URL=<provider-issued-authorize-url>
RECEIPT_PROVIDER_OAUTH_TOKEN_URL=<provider-issued-token-url>
RECEIPT_PROVIDER_CLIENT_ID=<provider-issued-client-id>
RECEIPT_PROVIDER_CLIENT_SECRET=<provider-issued-client-secret>
RECEIPT_PROVIDER_OAUTH_REDIRECT_URI=<server-callback-url>
RECEIPT_PROVIDER_WEBHOOK_SIGNING_SECRET=<provider-issued-webhook-secret>
```

None of these secrets may use a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefix. Production should inject secrets from the hosting platform's secret manager rather than commit a `.env` file.

## Commercial and API onboarding

### Retailers: Albertsons/Safeway, Walmart, and Target

Repeat this process separately for each retailer; approval from one does not cover another.

1. Contact the retailer's partnerships or developer-program team with the BasketMatch use case, planned regions, expected request volume, retention policy, and requested operations: store/location lookup, consumer product and price search, loyalty-offer read, sanctioned cart/promo validation, and receipt read.
2. Obtain written confirmation that the selected program covers consumer comparison and loyalty-account use. Marketplace, affiliate, advertising, or seller APIs must not be assumed to grant those rights.
3. Complete the commercial agreement, API terms, privacy/DPA review, security questionnaire, branding review, rate-limit plan, and support/escalation contacts.
4. Register a confidential server OAuth application. Provide exact development, staging, and production callback URLs and request only approved scopes. Mobile and web clients initiate OAuth but the backend completes code exchange and token storage.
5. Receive sandbox endpoints and credentials, place them under the exact variables above, and implement a provider-specific mapper behind the shared adapter interface.
6. Pass conformance tests for token refresh/rotation, revocation, pagination, price timestamps, location eligibility, clipped versus merely eligible offers, expiry, one-time redemption, invalid codes, and provider outages.
7. Complete provider certification and production review before setting that provider's `*_ADAPTER_MODE=production`. Add monitoring, rate-limit backoff, webhook signature verification, and a documented kill switch.

### Manufacturer-coupon network

1. Select a network or issuer willing to license coupon discovery and validation for BasketMatch; identify supported brands, territories, and retailers.
2. Agree in writing on coupon-identity storage, display rights, offer-update cadence, exact UPC/GTIN and size rules, category/brand rules, clipping, stacking, one-time redemption, and audit retention.
3. Complete partner verification and receive sandbox credentials, a partner ID, API schema, webhook signing method, rate limits, and certification fixtures.
4. Map each response to a domain `Offer` plus `OfferEvidence`. Preserve the provider offer ID for idempotent ingestion and never infer eligibility that the source did not provide.
5. Certify successful, expired, ineligible, already-redeemed, and revoked-offer paths before production enablement.

### Promo-code validation

1. Obtain explicit written permission for programmatic basket/cart validation. If a retailer does not offer it, return `not_tested` with zero discount.
2. Confirm whether the endpoint requires an OAuth account, supports guest carts, mutates a cart, reserves inventory, or consumes one-time codes. Use an isolated validation cart only when the provider contract permits it.
3. Receive sandbox credentials and test codes for accepted, invalid, expired, minimum-not-met, item-ineligible, already-redeemed, rate-limited, and provider-error cases.
4. Record validation timestamp and evidence. Only an `accepted` response may contribute checkout savings; a network or configuration failure is not a rejection and is never treated as success.

### Rebate network

1. Obtain a commercial agreement covering offer display, activation, receipt submission, payout attribution, and user-consent requirements.
2. Document whether each rebate may stack with manufacturer or retailer discounts, its activation deadline, purchase window, receipt deadline, quantity cap, and account eligibility.
3. Register OAuth callbacks if account activation/history is exposed, then receive sandbox credentials and webhook verification material.
4. Test activation, expired offers, duplicate submissions, rejected receipts, and successful payout. Store rebate value separately from checkout discount at every layer.

### Receipt provider

1. Choose an approved retailer receipt API, receipt aggregator, or explicit user-upload flow. Obtain user-consent language and confirm permitted data retention and deletion behavior.
2. Agree on stable receipt and line IDs, UPC availability, quantities/weights, item discounts, basket discounts, taxes, tips/fees, returns, and correction events.
3. Register OAuth and webhook endpoints where supported, then receive sandbox credentials and signed sample receipts.
4. Reconcile predicted products and offers to actual lines without overwriting the original calculation trace. A receipt-confirmed success or failure adds new evidence to the offer.
5. Certify duplicate imports, partial receipts, refunds, malformed totals, revoked access, deletion requests, and webhook replay handling.

## Mock-to-live implementation checklist

1. Keep the public adapter interface unchanged; add a provider-specific implementation in a server-only package.
2. Validate raw provider payloads at the boundary and map them to `@basketmatch/domain` objects with integer-cent money and UTC timestamps.
3. Store the provider's stable IDs and ingestion idempotency key. Do not expose raw payloads to clients by default.
4. Emit evidence for what the provider actually proved: exact product, store/location, account, cart result, expiration, or receipt result.
5. Treat missing fields as unknown, not as eligible. Treat timeouts and unavailable integrations as failed/unverified, with zero trusted savings.
6. Run contract tests against recorded, contractually permitted sandbox fixtures and the deterministic mocks before enabling a live adapter.
