# BasketMatch MVP product requirements

## User problem

Shoppers have fragmented savings across retailer loyalty accounts, manufacturer coupons, promotional codes, weekly sales, and cashback services. Existing tools often show offers without proving that the user's exact product, store, account, and basket qualify.

## MVP objective

Given a grocery list and selected stores, return:

- Cheapest trusted one-store basket.
- Cheapest trusted split-store basket within the user's store limit.
- Checkout total.
- Post-rebate net total.
- Item-level explanation of prices and offers.
- Confidence and evidence for every coupon.

## Primary screens

1. Onboarding and store selection.
2. Grocery-list builder.
3. Coupon wallet and connections.
4. Basket comparison.
5. Offer details and calculation trace.
6. Receipt confirmation.

## Offer types

- Retailer loyalty coupon.
- Manufacturer coupon.
- Universal/digital coupon.
- Basket promo code.
- Sale or loyalty price.
- Post-purchase rebate.

## Evidence model

Each offer can contain:

- Provider/API validation.
- Cart test result and timestamp.
- Exact UPC/GTIN eligibility.
- Store and location eligibility.
- User-account eligibility.
- Expiration.
- Redemption history.
- Receipt-confirmed success or failure.

## Success metrics

- Prediction-to-receipt price error.
- Verified coupon redemption success rate.
- Median savings per basket.
- Percentage of lists with complete product matches.
- Conversion from recommendation to cart or completed receipt.
- Weekly retained shoppers.

## Out of scope for first production pilot

- Nationwide retailer coverage.
- Automated access requiring users' retailer passwords.
- Unsupported scraping of retailer accounts.
- Payment processing.
- Guaranteed real-time inventory at unsupported retailers.
