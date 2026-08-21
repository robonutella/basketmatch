-- Local/demo data matching data/catalog.js and the browser prototype's initial list.
-- Safe to rerun: stable UUIDs and provider ingestion keys make each insert idempotent.

begin;

insert into public.stores (
  id, retailer_key, external_store_id, slug, name, demo_distance_miles,
  timezone, active, metadata, created_at, updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001', 'safeway', 'demo-safeway',
    'safeway', 'Safeway', 1.80, 'America/Los_Angeles', true,
    '{"source":"browser-prototype"}'::jsonb, '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000002', 'walmart', 'demo-walmart',
    'walmart', 'Walmart', 3.40, 'America/Los_Angeles', true,
    '{"source":"browser-prototype"}'::jsonb, '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000003', 'target', 'demo-target',
    'target', 'Target', 2.60, 'America/Los_Angeles', true,
    '{"source":"browser-prototype"}'::jsonb, '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'
  )
on conflict (id) do update set
  retailer_key = excluded.retailer_key,
  external_store_id = excluded.external_store_id,
  slug = excluded.slug,
  name = excluded.name,
  demo_distance_miles = excluded.demo_distance_miles,
  timezone = excluded.timezone,
  active = excluded.active,
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

insert into public.products (
  id, provider_key, store_id, external_product_id, gtin, name, aliases, category,
  brand, package_size, active, metadata, created_at, updated_at
)
values
  ('20000000-0000-4000-8000-000000000001', 'demo_catalog', '10000000-0000-4000-8000-000000000001', 'sf-milk', '021130070338', 'Lucerne Whole Milk, 1 gal', array['milk','whole milk'], 'milk', null, '1 gal', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000002', 'demo_catalog', '10000000-0000-4000-8000-000000000002', 'wm-milk', '007874204122', 'Great Value Whole Milk, 1 gal', array['milk','whole milk'], 'milk', null, '1 gal', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000003', 'demo_catalog', '10000000-0000-4000-8000-000000000003', 'tg-milk', '008523906855', 'Good & Gather Whole Milk, 1 gal', array['milk','whole milk'], 'milk', null, '1 gal', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000004', 'demo_catalog', '10000000-0000-4000-8000-000000000001', 'sf-eggs', '021130031681', 'Lucerne Large Eggs, 12 ct', array['eggs','dozen eggs'], 'eggs', null, '12 ct', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000005', 'demo_catalog', '10000000-0000-4000-8000-000000000002', 'wm-eggs', '007874223908', 'Great Value Large Eggs, 12 ct', array['eggs','dozen eggs'], 'eggs', null, '12 ct', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000006', 'demo_catalog', '10000000-0000-4000-8000-000000000003', 'tg-eggs', '008523902543', 'Good & Gather Large Eggs, 12 ct', array['eggs','dozen eggs'], 'eggs', null, '12 ct', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000007', 'demo_catalog', '10000000-0000-4000-8000-000000000001', 'sf-chicken', null, 'Boneless Skinless Chicken Breast, 2 lb', array['chicken','chicken breast'], 'meat', null, '2 lb', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000008', 'demo_catalog', '10000000-0000-4000-8000-000000000002', 'wm-chicken', null, 'Boneless Skinless Chicken Breast, 2 lb', array['chicken','chicken breast'], 'meat', null, '2 lb', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000009', 'demo_catalog', '10000000-0000-4000-8000-000000000003', 'tg-chicken', null, 'Good & Gather Chicken Breast, 2 lb', array['chicken','chicken breast'], 'meat', null, '2 lb', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000010', 'demo_catalog', '10000000-0000-4000-8000-000000000001', 'sf-rice', null, 'Mahatma Long Grain Rice, 5 lb', array['rice','white rice'], 'rice', null, '5 lb', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000011', 'demo_catalog', '10000000-0000-4000-8000-000000000002', 'wm-rice', null, 'Great Value Long Grain Rice, 5 lb', array['rice','white rice'], 'rice', null, '5 lb', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000012', 'demo_catalog', '10000000-0000-4000-8000-000000000003', 'tg-rice', null, 'Good & Gather Long Grain Rice, 5 lb', array['rice','white rice'], 'rice', null, '5 lb', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000013', 'demo_catalog', '10000000-0000-4000-8000-000000000001', 'sf-strawberries', null, 'Fresh Strawberries, 1 lb', array['strawberries','strawberry'], 'produce', null, '1 lb', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000014', 'demo_catalog', '10000000-0000-4000-8000-000000000002', 'wm-strawberries', null, 'Fresh Strawberries, 1 lb', array['strawberries','strawberry'], 'produce', null, '1 lb', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000015', 'demo_catalog', '10000000-0000-4000-8000-000000000003', 'tg-strawberries', null, 'Fresh Strawberries, 1 lb', array['strawberries','strawberry'], 'produce', null, '1 lb', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000016', 'demo_catalog', '10000000-0000-4000-8000-000000000001', 'sf-tide', '003700087458', 'Tide Original Liquid, 84 oz', array['tide','laundry detergent','detergent'], 'laundry', 'Tide', '84 oz', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000017', 'demo_catalog', '10000000-0000-4000-8000-000000000002', 'wm-tide', '003700087465', 'Tide Original Liquid, 84 oz', array['tide','laundry detergent','detergent'], 'laundry', 'Tide', '84 oz', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('20000000-0000-4000-8000-000000000018', 'demo_catalog', '10000000-0000-4000-8000-000000000003', 'tg-tide', '003700087472', 'Tide Original Liquid, 84 oz', array['tide','laundry detergent','detergent'], 'laundry', 'Tide', '84 oz', true, '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z')
on conflict (id) do update set
  provider_key = excluded.provider_key,
  store_id = excluded.store_id,
  external_product_id = excluded.external_product_id,
  gtin = excluded.gtin,
  name = excluded.name,
  aliases = excluded.aliases,
  category = excluded.category,
  brand = excluded.brand,
  package_size = excluded.package_size,
  active = excluded.active,
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

insert into public.prices (
  id, product_id, provider_key, ingestion_key, kind, price_cents, currency,
  availability, fulfillment, observed_at, metadata, created_at
)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'demo_catalog', 'prototype:sf-milk:2026-07-29', 'regular', 549, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'demo_catalog', 'prototype:wm-milk:2026-07-29', 'regular', 384, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'demo_catalog', 'prototype:tg-milk:2026-07-29', 'regular', 419, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 'demo_catalog', 'prototype:sf-eggs:2026-07-29', 'regular', 499, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 'demo_catalog', 'prototype:wm-eggs:2026-07-29', 'regular', 367, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006', 'demo_catalog', 'prototype:tg-eggs:2026-07-29', 'regular', 399, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000007', 'demo_catalog', 'prototype:sf-chicken:2026-07-29', 'regular', 1098, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000008', 'demo_catalog', 'prototype:wm-chicken:2026-07-29', 'regular', 976, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000009', 'demo_catalog', 'prototype:tg-chicken:2026-07-29', 'regular', 1149, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000010', 'demo_catalog', 'prototype:sf-rice:2026-07-29', 'regular', 749, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000011', 'demo_catalog', 'prototype:wm-rice:2026-07-29', 'regular', 464, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000012', 'demo_catalog', 'prototype:tg-rice:2026-07-29', 'regular', 529, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000013', 'demo_catalog', 'prototype:sf-strawberries:2026-07-29', 'regular', 499, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000014', 'demo_catalog', 'prototype:wm-strawberries:2026-07-29', 'regular', 348, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000015', 'demo_catalog', 'prototype:tg-strawberries:2026-07-29', 'regular', 399, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000016', 'demo_catalog', 'prototype:sf-tide:2026-07-29', 'regular', 1899, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000017', '20000000-0000-4000-8000-000000000017', 'demo_catalog', 'prototype:wm-tide:2026-07-29', 'regular', 1794, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('30000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000018', 'demo_catalog', 'prototype:tg-tide:2026-07-29', 'regular', 1849, 'USD', 'in_stock', 'in_store', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z')
on conflict (provider_key, ingestion_key) do update set
  product_id = excluded.product_id,
  kind = excluded.kind,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  availability = excluded.availability,
  fulfillment = excluded.fulfillment,
  observed_at = excluded.observed_at,
  metadata = excluded.metadata;

insert into public.offers (
  id, provider_key, external_offer_id, title, provider_display_name, source_type,
  redemption_mode, scope, visibility, state, store_id, discount_amount_cents,
  discount_percent_bps, minimum_spend_cents, confidence_score, stack_group,
  stacking_rules, promo_code, expires_at, provider_updated_at, ingested_at, metadata,
  created_at, updated_at
)
values
  ('40000000-0000-4000-8000-000000000001', 'safeway_for_u', 'sf-meat-2', '$2 off a meat purchase', 'Safeway for U', 'retailer_loyalty', 'checkout', 'item', 'public', 'verified', '10000000-0000-4000-8000-000000000001', 200, null, 0, 99, 'retailer-item', '{"may_stack_with":["manufacturer-item","rebate-item"]}', null, '2026-08-06T06:59:59Z', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('40000000-0000-4000-8000-000000000002', 'tide_manufacturer', 'mfr-tide-3', '$3 off Tide 84 oz or larger', 'Tide manufacturer offer', 'manufacturer', 'checkout', 'item', 'public', 'verified', null, 300, null, 0, 96, 'manufacturer-item', '{"may_stack_with":["retailer-item","rebate-item"]}', null, '2026-08-13T06:59:59Z', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z', '{"source":"browser-prototype","minimum_package_size":"84 oz"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('40000000-0000-4000-8000-000000000003', 'demo_rebate_network', 'ibotta-tide-2', '$2 Tide cashback', 'Rebate network', 'rebate', 'rebate', 'item', 'public', 'recently_redeemed', null, 200, null, 0, 91, 'rebate-item', '{"may_stack_with":["manufacturer-item","retailer-item"]}', null, '2026-08-03T06:59:59Z', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z', '{"source":"browser-prototype","legacy_state":"recent"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('40000000-0000-4000-8000-000000000004', 'target_circle', 'target-berries-10', '10% off fresh berries', 'Target Circle', 'retailer_loyalty', 'checkout', 'item', 'public', 'verified', '10000000-0000-4000-8000-000000000003', null, 1000, 0, 98, 'retailer-item', '{"may_stack_with":["manufacturer-item","rebate-item"]}', null, '2026-08-02T06:59:59Z', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('40000000-0000-4000-8000-000000000005', 'digital_manufacturer', 'sf-milk-1', '$1 off one gallon of milk', 'Digital manufacturer coupon', 'manufacturer', 'checkout', 'item', 'public', 'recently_redeemed', null, 100, null, 0, 87, 'manufacturer-item', '{"may_stack_with":["retailer-item","rebate-item"]}', null, '2026-08-04T06:59:59Z', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z', '{"source":"browser-prototype","legacy_state":"recent"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('40000000-0000-4000-8000-000000000006', 'demo_promo_validator', 'walmart-pickup-5', '$5 off a $35 pickup order', 'Online promo code', 'promo_code', 'checkout', 'basket', 'public', 'unverified', '10000000-0000-4000-8000-000000000002', 500, null, 3500, 55, 'basket-promo', '{"fulfillment":["pickup"]}', 'DEMO5', '2026-08-16T06:59:59Z', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z')
on conflict (provider_key, external_offer_id) where visibility = 'public' do update set
  title = excluded.title,
  provider_display_name = excluded.provider_display_name,
  source_type = excluded.source_type,
  redemption_mode = excluded.redemption_mode,
  scope = excluded.scope,
  state = excluded.state,
  store_id = excluded.store_id,
  discount_amount_cents = excluded.discount_amount_cents,
  discount_percent_bps = excluded.discount_percent_bps,
  minimum_spend_cents = excluded.minimum_spend_cents,
  confidence_score = excluded.confidence_score,
  stack_group = excluded.stack_group,
  stacking_rules = excluded.stacking_rules,
  promo_code = excluded.promo_code,
  expires_at = excluded.expires_at,
  provider_updated_at = excluded.provider_updated_at,
  ingested_at = excluded.ingested_at,
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

insert into public.offer_eligibilities (
  id, offer_id, eligibility_group, match_kind, match_value, require_exact, created_at
)
values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, 'category', 'meat', true, '2026-07-29T19:00:00Z'),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 1, 'brand', 'Tide', true, '2026-07-29T19:00:00Z'),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', 1, 'category', 'laundry', true, '2026-07-29T19:00:00Z'),
  ('41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000003', 1, 'brand', 'Tide', true, '2026-07-29T19:00:00Z'),
  ('41000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000003', 1, 'category', 'laundry', true, '2026-07-29T19:00:00Z'),
  ('41000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000004', 1, 'category', 'produce', true, '2026-07-29T19:00:00Z'),
  ('41000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000005', 1, 'category', 'milk', true, '2026-07-29T19:00:00Z'),
  ('41000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000002', 1, 'size', '84 oz', true, '2026-07-29T19:00:00Z'),
  ('41000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000003', 1, 'size', '84 oz', true, '2026-07-29T19:00:00Z')
on conflict (id) do update set
  offer_id = excluded.offer_id,
  eligibility_group = excluded.eligibility_group,
  match_kind = excluded.match_kind,
  match_value = excluded.match_value,
  require_exact = excluded.require_exact;

insert into public.offer_evidence (
  id, offer_id, provider_key, ingestion_key, evidence_type, outcome, state,
  confidence_score, observed_at, valid_until, details, created_at
)
values
  ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'safeway_for_u', 'prototype:sf-meat-2:validation', 'provider_validation', 'passed', 'verified', 99, '2026-07-29T19:00:00Z', '2026-08-06T06:59:59Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('42000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'tide_manufacturer', 'prototype:mfr-tide-3:validation', 'provider_validation', 'passed', 'verified', 96, '2026-07-29T19:00:00Z', '2026-08-13T06:59:59Z', '{"source":"browser-prototype","minimum_package_size":"84 oz"}', '2026-07-29T19:00:00Z'),
  ('42000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', 'demo_rebate_network', 'prototype:ibotta-tide-2:redemption', 'redemption_history', 'passed', 'recently_redeemed', 91, '2026-07-29T19:00:00Z', '2026-08-03T06:59:59Z', '{"source":"browser-prototype","legacy_state":"recent"}', '2026-07-29T19:00:00Z'),
  ('42000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', 'target_circle', 'prototype:target-berries-10:validation', 'provider_validation', 'passed', 'verified', 98, '2026-07-29T19:00:00Z', '2026-08-02T06:59:59Z', '{"source":"browser-prototype"}', '2026-07-29T19:00:00Z'),
  ('42000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000005', 'digital_manufacturer', 'prototype:sf-milk-1:redemption', 'redemption_history', 'passed', 'recently_redeemed', 87, '2026-07-29T19:00:00Z', '2026-08-04T06:59:59Z', '{"source":"browser-prototype","legacy_state":"recent"}', '2026-07-29T19:00:00Z'),
  ('42000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000006', 'demo_promo_validator', 'prototype:walmart-pickup-5:cart-test', 'cart_test', 'unknown', 'unverified', 55, '2026-07-29T19:00:00Z', '2026-08-16T06:59:59Z', '{"source":"browser-prototype","reason":"No approved checkout validation was available in the static demo."}', '2026-07-29T19:00:00Z')
on conflict (provider_key, ingestion_key) do update set
  offer_id = excluded.offer_id,
  evidence_type = excluded.evidence_type,
  outcome = excluded.outcome,
  state = excluded.state,
  confidence_score = excluded.confidence_score,
  observed_at = excluded.observed_at,
  valid_until = excluded.valid_until,
  details = excluded.details;

insert into public.grocery_lists (
  id, user_id, title, status, is_demo, demo_calculation_at, include_rebates,
  verified_offers_only, max_stores, created_at, updated_at
)
values (
  '50000000-0000-4000-8000-000000000001', null,
  'Browser prototype demo', 'active', true, '2026-07-29T19:00:00Z', true, true, 2,
  '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'
)
on conflict (id) do update set
  user_id = excluded.user_id,
  title = excluded.title,
  status = excluded.status,
  is_demo = excluded.is_demo,
  demo_calculation_at = excluded.demo_calculation_at,
  include_rebates = excluded.include_rebates,
  verified_offers_only = excluded.verified_offers_only,
  max_stores = excluded.max_stores,
  updated_at = excluded.updated_at;

insert into public.grocery_list_items (
  id, grocery_list_id, client_item_id, query, quantity, purchased, position,
  created_at, updated_at
)
values
  ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'prototype-milk', 'milk', 1, false, 0, '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 'prototype-eggs', 'eggs', 1, false, 1, '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('51000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', 'prototype-chicken-breast', 'chicken breast', 1, false, 2, '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('51000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000001', 'prototype-strawberries', 'strawberries', 1, false, 3, '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),
  ('51000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000001', 'prototype-tide', 'Tide', 1, false, 4, '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z')
on conflict (id) do update set
  grocery_list_id = excluded.grocery_list_id,
  client_item_id = excluded.client_item_id,
  query = excluded.query,
  quantity = excluded.quantity,
  purchased = excluded.purchased,
  position = excluded.position,
  updated_at = excluded.updated_at;

commit;
