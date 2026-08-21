# BasketMatch

**BasketMatch is a grocery purchasing optimizer that helps shoppers find the lowest possible grocery total by combining store prices, sales, coupons, rebates, loyalty offers, and other verified discounts.**

Instead of making shoppers search multiple apps and websites for deals, BasketMatch is designed to answer one question:

> **What should I buy, where should I buy it, and which discounts should I use to get the lowest total?**

---

## What BasketMatch Does

A user creates a grocery list such as:

* Milk
* Eggs
* Chicken breast
* Strawberries
* Cereal
* Laundry detergent

BasketMatch then works toward comparing available products across supported retailers and evaluating:

* Regular prices
* Sale prices
* Retailer coupons
* Personalized loyalty offers
* Manufacturer coupons
* Universal Coupons
* Cashback offers
* Rebates
* Online promotional codes
* Offer expiration dates
* Product eligibility
* Coupon stacking rules
* Redemption limits

The app can then recommend the best purchasing strategy.

For example:

### Cheapest One-Store Trip

**Store A**

Regular total: $92.40
Sales: -$11.20
Coupons: -$9.50
Checkout total: **$71.70**
Cashback: -$5.00

**Final effective cost: $66.70**

### Cheapest Split-Store Trip

**Store A**

* Milk
* Eggs
* Chicken
* Cereal

**Store B**

* Strawberries
* Laundry detergent

Checkout total: **$64.80**
Cashback: -$6.50

**Final effective cost: $58.30**

---

# Core Product Philosophy

BasketMatch is not intended to be another coupon-listing website.

The goal is to build a **grocery optimization engine**.

The system should eventually determine:

```text
Grocery List
     ↓
Available Products
     ↓
Store Prices
     ↓
Sales
     ↓
Coupons
     ↓
Manufacturer Offers
     ↓
Cashback + Rebates
     ↓
Stacking Rules
     ↓
Basket Optimization
     ↓
Lowest Verified Total
```

---

# Current Architecture

BasketMatch is structured as a monorepo.

## Mobile App

Located in:

```text
apps/mobile
```

Built with:

* Expo
* Expo Router
* React Native
* TypeScript

The mobile application is intended to become the primary consumer experience.

---

## Web App

Located in:

```text
apps/web
```

Built with:

* Next.js
* TypeScript

The web project is designed to support:

* Consumer web access
* Administrative tools
* Internal testing
* Offer management
* Provider monitoring

---

## Pricing Engine

Located in:

```text
packages/pricing-engine
```

The pricing engine is framework-independent so it can be used by both the mobile and web applications.

Responsibilities include:

* Product pricing
* Sale application
* Coupon eligibility
* Discount stacking
* Checkout-total calculation
* Cashback calculation
* Final net-cost calculation
* Applied-offer traces
* Rejected-offer traces

All monetary calculations use integer cents to reduce floating-point pricing errors.

---

## Shared Domain Models

Located in:

```text
packages/domain
```

This package contains shared:

* TypeScript types
* Zod schemas
* Product models
* Offer models
* Retailer models
* Grocery-list models
* Validation rules

These shared models help keep the web app, mobile app, pricing engine, and provider integrations consistent.

---

## Provider Adapters

Located in:

```text
packages/provider-adapters
```

External services connect to BasketMatch through provider adapters.

This architecture makes it possible to add or replace providers without rewriting the core pricing engine.

Potential future providers include:

* Retailer product and pricing systems
* Instacart
* Manufacturer coupon networks
* Universal Coupon providers
* Cashback providers
* Loyalty programs
* Receipt verification services

The current development environment uses deterministic mock providers where live credentials are not yet available.

---

# Database

BasketMatch uses a Supabase-oriented database architecture.

Database files are located in:

```text
supabase
```

The schema includes support for concepts such as:

* Users
* Products
* Retailers
* Store locations
* Grocery lists
* Grocery-list items
* Offers
* Coupons
* Retailer connections
* Redemptions
* Pricing results

The database design includes Row Level Security policies and redemption protections.

---

# Security Philosophy

BasketMatch is being designed around a privacy-first architecture.

The application should **never store retailer account passwords**.

Retailer connections should use approved authentication mechanisms such as:

* OAuth
* Authorized API tokens
* Secure token references

Raw passwords should never be modeled inside the BasketMatch database.

Future production integrations should also follow principles including:

* Minimum necessary permissions
* Encryption of sensitive credentials
* User-controlled account disconnection
* Data deletion controls
* Audit logging
* Redemption fraud protection
* Secure secret management

---

# Coupon and Offer States

BasketMatch distinguishes between different levels of offer reliability.

Examples include:

### Verified

Confirmed through an official provider, API, retailer, or validated coupon network.

### Recently Confirmed

Successfully redeemed or validated recently.

### Unverified

Found or submitted but not yet confirmed.

Unverified offers should not automatically be included in BasketMatch's trusted lowest-total calculation.

---

# Checkout Total vs. Net Total

BasketMatch intentionally separates money saved immediately from money received later.

For example:

```text
Retail price               $50.00
Store coupon               -$5.00
Manufacturer coupon        -$3.00
---------------------------------
Checkout total             $42.00

Cashback                   -$4.00
---------------------------------
Final effective cost       $38.00
```

This prevents the app from misleading users about how much money they actually need to pay at checkout.

---

# Coupon Stacking

BasketMatch evaluates whether multiple discounts can legally and technically be combined.

The engine is designed to consider rules including:

* Product UPC or GTIN
* Brand
* Package size
* Quantity
* Minimum purchase
* Retailer restrictions
* Coupon expiration
* Manufacturer restrictions
* Loyalty eligibility
* One-time redemption
* Offer stacking exclusions

The system records both applied and rejected offers so pricing calculations can be explained and audited.

---

# Testing

The current project includes automated validation covering major pricing and architecture behavior.

Current verification includes:

* Pricing-engine tests
* TypeScript type checking
* Web production builds
* Expo exports
* Legacy pricing parity
* Migration contract validation
* Seed-data validation

The project was last validated with:

```text
63 tests passing
```

Database migrations and Row Level Security policies should also be tested against a live Supabase/PostgreSQL environment before production deployment.

---

# Planned Live Integrations

BasketMatch is designed to eventually connect with several categories of services.

## Product and Retail Pricing

Potential providers:

* Retailer APIs
* Grocery marketplace APIs
* Approved product-data providers

## Manufacturer Offers

Potential providers:

* Manufacturer promotion networks
* Cashback networks
* Universal Coupon infrastructure

## Loyalty Accounts

Retailer loyalty connections should use retailer-approved OAuth or token-based integrations.

## Receipt Verification

Receipt ingestion may eventually help BasketMatch verify:

* Actual product price
* Coupon redemption
* Loyalty savings
* Cashback qualification
* Prediction accuracy

---

# Development Roadmap

## Phase 1 — Prototype

* Grocery-list creation
* Product matching
* Mock retailer catalogs
* Coupon matching
* Checkout calculations
* Cashback calculations
* One-store comparison
* Split-store comparison

## Phase 2 — Production Backend

* Supabase deployment
* Authentication
* User accounts
* Persistent grocery lists
* Offer database
* Redemption tracking
* Secure provider credentials

## Phase 3 — Live Pricing

* Connect live retailer data
* Add inventory information
* Add location-specific pricing
* Improve substitutions

## Phase 4 — Real Offers

* Manufacturer coupons
* Retailer coupons
* Cashback
* Rebates
* Universal Coupons
* Coupon verification

## Phase 5 — Loyalty Connections

* Approved retailer account connections
* Personalized offers
* Clipped coupon detection
* Loyalty pricing

## Phase 6 — Basket Optimization

* Full multi-store optimization
* Travel-cost calculations
* Convenience preferences
* Delivery fees
* Pickup fees
* Minimum-order thresholds

---

# Example User Experience

```text
User creates grocery list
          ↓
BasketMatch finds matching products
          ↓
Prices are retrieved from nearby stores
          ↓
Eligible discounts are identified
          ↓
Stacking rules are evaluated
          ↓
Checkout totals are calculated
          ↓
Cashback is calculated separately
          ↓
Store combinations are compared
          ↓
BasketMatch recommends the lowest-cost plan
```

---

# Repository Structure

```text
basketmatch/
│
├── apps/
│   ├── mobile/
│   └── web/
│
├── packages/
│   ├── domain/
│   ├── pricing-engine/
│   └── provider-adapters/
│
├── supabase/
│
├── docs/
│   ├── adr/
│   └── INTEGRATIONS.md
│
├── README.md
└── AGENTS.md
```

---

# Running the Project

Exact development commands may change as the project evolves.

Start by reviewing:

```text
AGENTS.md
README.md
docs/INTEGRATIONS.md
docs/adr/
```

Then install the project dependencies and use the package scripts defined in the repository.

Before submitting changes:

* Run tests
* Run TypeScript type checking
* Verify the affected application builds
* Review pricing-engine behavior
* Review the Git diff

---

# Contributing

BasketMatch is currently under active development.

Before modifying the architecture:

1. Read `AGENTS.md`.
2. Review existing Architecture Decision Records.
3. Preserve pricing-engine test coverage.
4. Do not introduce retailer-password storage.
5. Keep provider-specific logic outside the core pricing engine.
6. Add tests when changing pricing or coupon behavior.

Major architectural decisions should be documented with an ADR.

---

# Vision

The long-term goal is simple:

> **Users should not have to search five grocery apps, coupon sites, weekly ads, cashback services, and loyalty accounts just to determine where groceries are cheapest.**

BasketMatch should do that work for them.

The user provides the grocery list.

BasketMatch determines the optimal purchase.

**Search less. Save more. Buy smarter.**
