-- BasketMatch production-oriented schema.
-- All monetary values are integer minor units (cents) and all timestamps are UTC timestamptz.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

create type public.connection_status as enum (
  'active',
  'expired',
  'revoked',
  'failed'
);

create type public.price_type as enum (
  'regular',
  'sale',
  'loyalty'
);

create type public.availability_status as enum (
  'unknown',
  'in_stock',
  'out_of_stock',
  'limited'
);

create type public.fulfillment_method as enum (
  'in_store',
  'pickup',
  'delivery',
  'shipping'
);

create type public.offer_source_type as enum (
  'retailer_loyalty',
  'manufacturer',
  'universal',
  'promo_code',
  'sale',
  'rebate'
);

create type public.offer_redemption_mode as enum (
  'checkout',
  'rebate'
);

create type public.offer_scope as enum (
  'item',
  'basket'
);

create type public.offer_visibility as enum (
  'public',
  'personalized'
);

create type public.offer_state as enum (
  'verified',
  'recently_redeemed',
  'unverified',
  'failed',
  'expired'
);

create type public.offer_match_kind as enum (
  'gtin',
  'product',
  'category',
  'brand',
  'size'
);

create type public.offer_evidence_type as enum (
  'provider_validation',
  'cart_test',
  'exact_upc',
  'store_eligibility',
  'account_eligibility',
  'expiration_check',
  'redemption_history',
  'receipt_confirmation'
);

create type public.evidence_outcome as enum (
  'passed',
  'failed',
  'unknown'
);

create type public.recommendation_strategy as enum (
  'one_store',
  'split'
);

create type public.grocery_list_status as enum (
  'active',
  'completed',
  'archived'
);

create type public.recommendation_status as enum (
  'calculating',
  'complete',
  'selected',
  'failed'
);

create type public.trace_decision as enum (
  'applied',
  'rejected'
);

create type public.trace_stage as enum (
  'product_match',
  'item_checkout',
  'basket_checkout',
  'post_purchase_rebate'
);

create type public.receipt_status as enum (
  'imported',
  'processing',
  'reconciled',
  'failed'
);

create type public.redemption_status as enum (
  'attempted',
  'succeeded',
  'failed',
  'reversed'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'en-US',
  home_postal_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 120
  )
);

comment on table public.profiles is
  'Application profile linked one-to-one to Supabase auth.users; authentication secrets remain in auth.';

create table public.retailer_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_key text not null,
  oauth_subject text not null,
  status public.connection_status not null default 'active',
  scopes text[] not null default '{}',
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  revoked_at timestamptz,
  last_error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retailer_connections_provider_key_nonempty check (btrim(provider_key) <> ''),
  constraint retailer_connections_oauth_subject_nonempty check (btrim(oauth_subject) <> ''),
  constraint retailer_connections_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint retailer_connections_revocation_consistent check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  ),
  constraint retailer_connections_user_provider_subject_key
    unique (user_id, provider_key, oauth_subject),
  constraint retailer_connections_id_user_key unique (id, user_id)
);

comment on table public.retailer_connections is
  'OAuth/token-only retailer account links. Never add username or password credential columns.';

create table private.retailer_connection_secret_references (
  connection_id uuid primary key references public.retailer_connections (id) on delete cascade,
  token_secret_reference text not null unique,
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retailer_connection_secret_references_reference_nonempty
    check (btrim(token_secret_reference) <> '')
);

comment on table private.retailer_connection_secret_references is
  'Server-only opaque references to OAuth material held by a managed secret store; raw tokens never enter this database.';

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  retailer_key text not null,
  external_store_id text not null,
  slug text not null unique,
  name text not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country_code text not null default 'US',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  timezone text not null default 'UTC',
  demo_distance_miles numeric(7, 2),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_retailer_key_nonempty check (btrim(retailer_key) <> ''),
  constraint stores_external_id_nonempty check (btrim(external_store_id) <> ''),
  constraint stores_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint stores_name_nonempty check (btrim(name) <> ''),
  constraint stores_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint stores_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint stores_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint stores_distance_nonnegative check (
    demo_distance_miles is null or demo_distance_miles >= 0
  ),
  constraint stores_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint stores_retailer_external_key unique (retailer_key, external_store_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  store_id uuid not null references public.stores (id) on delete restrict,
  external_product_id text not null,
  gtin text,
  name text not null,
  aliases text[] not null default '{}',
  category text not null,
  brand text,
  package_size text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_provider_key_nonempty check (btrim(provider_key) <> ''),
  constraint products_external_id_nonempty check (btrim(external_product_id) <> ''),
  constraint products_name_nonempty check (btrim(name) <> ''),
  constraint products_category_nonempty check (btrim(category) <> ''),
  constraint products_gtin_format check (
    gtin is null or gtin ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'
  ),
  constraint products_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint products_provider_store_external_key
    unique (provider_key, store_id, external_product_id),
  constraint products_id_store_key unique (id, store_id)
);

create table public.prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  provider_key text not null,
  ingestion_key text not null,
  kind public.price_type not null default 'regular',
  price_cents integer not null,
  currency text not null default 'USD',
  availability public.availability_status not null default 'unknown',
  fulfillment public.fulfillment_method not null default 'in_store',
  observed_at timestamptz not null,
  valid_from timestamptz,
  valid_to timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint prices_provider_key_nonempty check (btrim(provider_key) <> ''),
  constraint prices_ingestion_key_nonempty check (btrim(ingestion_key) <> ''),
  constraint prices_nonnegative check (price_cents >= 0),
  constraint prices_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint prices_valid_window check (
    valid_from is null or valid_to is null or valid_to > valid_from
  ),
  constraint prices_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint prices_provider_ingestion_key unique (provider_key, ingestion_key)
);

comment on column public.prices.price_cents is 'Integer minor currency units; never floating point.';

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  external_offer_id text not null,
  title text not null,
  provider_display_name text not null,
  source_type public.offer_source_type not null,
  redemption_mode public.offer_redemption_mode not null,
  scope public.offer_scope not null default 'item',
  visibility public.offer_visibility not null default 'public',
  state public.offer_state not null default 'unverified',
  user_id uuid references auth.users (id) on delete cascade,
  retailer_connection_id uuid,
  store_id uuid references public.stores (id) on delete restrict,
  discount_amount_cents integer,
  discount_percent_bps integer,
  max_discount_cents integer,
  minimum_spend_cents integer not null default 0,
  minimum_quantity numeric(10, 3) not null default 1,
  max_redemptions_per_user integer,
  confidence_score smallint not null default 0,
  stack_group text not null,
  stacking_rules jsonb not null default '{}'::jsonb,
  terms_url text,
  promo_code text,
  starts_at timestamptz,
  expires_at timestamptz,
  provider_updated_at timestamptz,
  ingested_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_connection_owner_fk
    foreign key (retailer_connection_id, user_id)
    references public.retailer_connections (id, user_id) on delete cascade,
  constraint offers_visibility_owner_shape check (
    (
      visibility = 'public'
      and user_id is null
      and retailer_connection_id is null
    )
    or
    (
      visibility = 'personalized'
      and user_id is not null
    )
  ),
  constraint offers_provider_key_nonempty check (btrim(provider_key) <> ''),
  constraint offers_external_id_nonempty check (btrim(external_offer_id) <> ''),
  constraint offers_title_nonempty check (btrim(title) <> ''),
  constraint offers_provider_name_nonempty check (btrim(provider_display_name) <> ''),
  constraint offers_exactly_one_discount check (
    num_nonnulls(discount_amount_cents, discount_percent_bps) = 1
  ),
  constraint offers_amount_positive check (
    discount_amount_cents is null or discount_amount_cents > 0
  ),
  constraint offers_percent_range check (
    discount_percent_bps is null or discount_percent_bps between 1 and 10000
  ),
  constraint offers_max_discount_shape check (
    max_discount_cents is null
    or (max_discount_cents > 0 and discount_percent_bps is not null)
  ),
  constraint offers_minimum_spend_nonnegative check (minimum_spend_cents >= 0),
  constraint offers_minimum_quantity_positive check (minimum_quantity > 0),
  constraint offers_redemption_limit_positive check (
    max_redemptions_per_user is null or max_redemptions_per_user > 0
  ),
  constraint offers_confidence_range check (confidence_score between 0 and 100),
  constraint offers_stack_group_nonempty check (btrim(stack_group) <> ''),
  constraint offers_promo_code_nonempty check (promo_code is null or btrim(promo_code) <> ''),
  constraint offers_promo_code_required check (
    source_type <> 'promo_code' or promo_code is not null
  ),
  constraint offers_promo_shape check (
    source_type <> 'promo_code'
    or (scope = 'basket' and redemption_mode = 'checkout')
  ),
  constraint offers_rebate_shape check (
    (source_type = 'rebate') = (redemption_mode = 'rebate')
  ),
  constraint offers_stacking_rules_object check (jsonb_typeof(stacking_rules) = 'object'),
  constraint offers_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint offers_valid_window check (
    starts_at is null or expires_at is null or expires_at > starts_at
  )
);

create unique index offers_public_provider_external_key
  on public.offers (provider_key, external_offer_id)
  where visibility = 'public';

create unique index offers_personalized_provider_external_user_key
  on public.offers (provider_key, external_offer_id, user_id)
  where visibility = 'personalized' and retailer_connection_id is null;

create unique index offers_personalized_provider_external_connection_key
  on public.offers (provider_key, external_offer_id, user_id, retailer_connection_id)
  where visibility = 'personalized' and retailer_connection_id is not null;

comment on column public.offers.discount_percent_bps is
  'Percentage discount in basis points; 1000 means 10.00%.';
comment on column public.offers.max_redemptions_per_user is
  'Set to 1 for one-time offers; redemption history is stored separately.';

create table public.offer_eligibilities (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  eligibility_group smallint not null default 1,
  match_kind public.offer_match_kind not null,
  match_value text,
  product_id uuid references public.products (id) on delete cascade,
  require_exact boolean not null default true,
  created_at timestamptz not null default now(),
  constraint offer_eligibilities_group_positive check (eligibility_group > 0),
  constraint offer_eligibilities_shape check (
    (match_kind = 'product' and product_id is not null and match_value is null)
    or
    (
      match_kind <> 'product'
      and product_id is null
      and match_value is not null
      and btrim(match_value) <> ''
    )
  ),
  constraint offer_eligibilities_gtin_format check (
    match_kind <> 'gtin'
    or match_value ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'
  ),
  constraint offer_eligibilities_gtin_exact check (
    match_kind <> 'gtin' or require_exact
  )
);

comment on table public.offer_eligibilities is
  'Rules within one eligibility_group are ANDed; different groups are ORed. Exact GTIN and package-size rules are first-class.';

create unique index offer_eligibilities_value_key
  on public.offer_eligibilities (offer_id, eligibility_group, match_kind, lower(match_value))
  where match_kind <> 'product';

create unique index offer_eligibilities_product_key
  on public.offer_eligibilities (offer_id, eligibility_group, product_id)
  where match_kind = 'product';

create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  title text not null,
  status public.grocery_list_status not null default 'active',
  is_demo boolean not null default false,
  demo_calculation_at timestamptz,
  include_rebates boolean not null default true,
  verified_offers_only boolean not null default true,
  max_stores smallint not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grocery_lists_title_nonempty check (btrim(title) <> ''),
  constraint grocery_lists_owner_shape check (
    (is_demo and user_id is null) or (not is_demo and user_id is not null)
  ),
  constraint grocery_lists_demo_calculation_shape check (
    (is_demo and demo_calculation_at is not null)
    or (not is_demo and demo_calculation_at is null)
  ),
  constraint grocery_lists_max_stores_range check (max_stores between 1 and 10),
  constraint grocery_lists_id_user_key unique (id, user_id)
);

comment on table public.grocery_lists is
  'User-owned lists plus read-only, ownerless demo templates that clients may copy.';

create table public.grocery_list_items (
  id uuid primary key default gen_random_uuid(),
  grocery_list_id uuid not null references public.grocery_lists (id) on delete cascade,
  client_item_id text,
  query text not null,
  quantity numeric(10, 3) not null default 1,
  purchased boolean not null default false,
  requested_gtin text,
  requested_category text,
  requested_brand text,
  matched_product_id uuid references public.products (id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grocery_list_items_query_nonempty check (btrim(query) <> ''),
  constraint grocery_list_items_quantity_positive check (quantity > 0),
  constraint grocery_list_items_requested_gtin_format check (
    requested_gtin is null
    or requested_gtin ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'
  ),
  constraint grocery_list_items_requested_category_nonempty check (
    requested_category is null or btrim(requested_category) <> ''
  ),
  constraint grocery_list_items_requested_brand_nonempty check (
    requested_brand is null or btrim(requested_brand) <> ''
  ),
  constraint grocery_list_items_position_nonnegative check (position >= 0),
  constraint grocery_list_items_client_id_nonempty check (
    client_item_id is null or btrim(client_item_id) <> ''
  ),
  constraint grocery_list_items_id_list_key unique (id, grocery_list_id)
);

create unique index grocery_list_items_client_key
  on public.grocery_list_items (grocery_list_id, client_item_id)
  where client_item_id is not null;

create table public.basket_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  grocery_list_id uuid not null,
  idempotency_key text not null,
  strategy public.recommendation_strategy not null,
  status public.recommendation_status not null default 'calculating',
  max_stores smallint not null,
  store_count smallint not null,
  checkout_subtotal_cents integer not null,
  checkout_discount_cents integer not null,
  checkout_total_cents integer not null,
  rebate_total_cents integer not null,
  net_total_cents integer not null,
  currency text not null default 'USD',
  pricing_engine_version text not null,
  input_snapshot jsonb not null,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basket_recommendations_list_owner_fk
    foreign key (grocery_list_id, user_id)
    references public.grocery_lists (id, user_id) on delete cascade,
  constraint basket_recommendations_idempotency_nonempty check (btrim(idempotency_key) <> ''),
  constraint basket_recommendations_max_stores_range check (max_stores between 1 and 10),
  constraint basket_recommendations_store_count_range check (
    store_count between 1 and max_stores
  ),
  constraint basket_recommendations_checkout_math check (
    checkout_subtotal_cents >= 0
    and checkout_discount_cents >= 0
    and checkout_discount_cents <= checkout_subtotal_cents
    and checkout_total_cents = checkout_subtotal_cents - checkout_discount_cents
  ),
  constraint basket_recommendations_rebate_math check (
    rebate_total_cents >= 0
    and rebate_total_cents <= checkout_total_cents
    and net_total_cents = checkout_total_cents - rebate_total_cents
  ),
  constraint basket_recommendations_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint basket_recommendations_engine_version_nonempty check (
    btrim(pricing_engine_version) <> ''
  ),
  constraint basket_recommendations_input_snapshot_object check (
    jsonb_typeof(input_snapshot) = 'object'
  ),
  constraint basket_recommendations_user_idempotency_key unique (user_id, idempotency_key),
  constraint basket_recommendations_id_list_key unique (id, grocery_list_id),
  constraint basket_recommendations_id_user_key unique (id, user_id)
);

comment on column public.basket_recommendations.checkout_total_cents is
  'Amount due at checkout after checkout-time discounts; rebates are not subtracted here.';
comment on column public.basket_recommendations.net_total_cents is
  'Checkout total less post-purchase rebates.';

create table public.basket_recommendation_lines (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null,
  grocery_list_id uuid not null,
  grocery_list_item_id uuid not null,
  store_id uuid not null references public.stores (id) on delete restrict,
  product_id uuid not null,
  quantity numeric(10, 3) not null,
  unit_price_cents integer not null,
  checkout_subtotal_cents integer not null,
  checkout_discount_cents integer not null,
  checkout_total_cents integer not null,
  rebate_total_cents integer not null,
  net_total_cents integer not null,
  created_at timestamptz not null default now(),
  constraint basket_recommendation_lines_recommendation_fk
    foreign key (recommendation_id, grocery_list_id)
    references public.basket_recommendations (id, grocery_list_id) on delete cascade,
  constraint basket_recommendation_lines_list_item_fk
    foreign key (grocery_list_item_id, grocery_list_id)
    references public.grocery_list_items (id, grocery_list_id) on delete restrict,
  constraint basket_recommendation_lines_product_store_fk
    foreign key (product_id, store_id)
    references public.products (id, store_id) on delete restrict,
  constraint basket_recommendation_lines_quantity_positive check (quantity > 0),
  constraint basket_recommendation_lines_unit_price_nonnegative check (unit_price_cents >= 0),
  constraint basket_recommendation_lines_unit_extension check (
    checkout_subtotal_cents = round(unit_price_cents * quantity)
  ),
  constraint basket_recommendation_lines_checkout_math check (
    checkout_subtotal_cents >= 0
    and checkout_discount_cents >= 0
    and checkout_discount_cents <= checkout_subtotal_cents
    and checkout_total_cents = checkout_subtotal_cents - checkout_discount_cents
  ),
  constraint basket_recommendation_lines_rebate_math check (
    rebate_total_cents >= 0
    and rebate_total_cents <= checkout_total_cents
    and net_total_cents = checkout_total_cents - rebate_total_cents
  ),
  constraint basket_recommendation_lines_item_key
    unique (recommendation_id, grocery_list_item_id),
  constraint basket_recommendation_lines_id_recommendation_key
    unique (id, recommendation_id)
);

create table public.basket_recommendation_traces (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.basket_recommendations (id) on delete cascade,
  recommendation_line_id uuid,
  offer_id uuid not null references public.offers (id) on delete restrict,
  sequence integer not null,
  decision public.trace_decision not null,
  stage public.trace_stage not null,
  offer_state_snapshot public.offer_state not null,
  reason_code text not null,
  explanation text not null,
  checkout_discount_cents integer not null default 0,
  rebate_cents integer not null default 0,
  rule_snapshot jsonb not null default '{}'::jsonb,
  evidence_snapshot jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now(),
  constraint basket_recommendation_traces_line_fk
    foreign key (recommendation_line_id, recommendation_id)
    references public.basket_recommendation_lines (id, recommendation_id) on delete cascade,
  constraint basket_recommendation_traces_sequence_nonnegative check (sequence >= 0),
  constraint basket_recommendation_traces_reason_nonempty check (btrim(reason_code) <> ''),
  constraint basket_recommendation_traces_explanation_nonempty check (btrim(explanation) <> ''),
  constraint basket_recommendation_traces_amounts_nonnegative check (
    checkout_discount_cents >= 0 and rebate_cents >= 0
  ),
  constraint basket_recommendation_traces_rule_object check (
    jsonb_typeof(rule_snapshot) = 'object'
  ),
  constraint basket_recommendation_traces_evidence_array check (
    jsonb_typeof(evidence_snapshot) = 'array'
  ),
  constraint basket_recommendation_traces_sequence_key
    unique (recommendation_id, sequence)
);

comment on table public.basket_recommendation_traces is
  'Immutable per-calculation explanation of every offer considered, including applied and rejected decisions.';

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  retailer_connection_id uuid,
  store_id uuid not null references public.stores (id) on delete restrict,
  recommendation_id uuid,
  provider_key text not null,
  ingestion_key text not null,
  external_receipt_id text,
  status public.receipt_status not null default 'imported',
  purchased_at timestamptz not null,
  subtotal_cents integer not null,
  checkout_discount_cents integer not null,
  tax_cents integer not null default 0,
  checkout_total_cents integer not null,
  confirmed_rebate_cents integer not null default 0,
  net_total_cents integer not null,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receipts_connection_owner_fk
    foreign key (retailer_connection_id, user_id)
    references public.retailer_connections (id, user_id)
    on delete set null (retailer_connection_id),
  constraint receipts_recommendation_owner_fk
    foreign key (recommendation_id, user_id)
    references public.basket_recommendations (id, user_id)
    on delete set null (recommendation_id),
  constraint receipts_provider_key_nonempty check (btrim(provider_key) <> ''),
  constraint receipts_ingestion_key_nonempty check (btrim(ingestion_key) <> ''),
  constraint receipts_checkout_math check (
    subtotal_cents >= 0
    and checkout_discount_cents >= 0
    and checkout_discount_cents <= subtotal_cents
    and tax_cents >= 0
    and checkout_total_cents = subtotal_cents - checkout_discount_cents + tax_cents
  ),
  constraint receipts_rebate_math check (
    confirmed_rebate_cents >= 0
    and confirmed_rebate_cents <= checkout_total_cents
    and net_total_cents = checkout_total_cents - confirmed_rebate_cents
  ),
  constraint receipts_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint receipts_provider_ingestion_key unique (provider_key, ingestion_key),
  constraint receipts_id_user_key unique (id, user_id)
);

create table private.receipt_payloads (
  receipt_id uuid primary key references public.receipts (id) on delete cascade,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receipt_payloads_payload_object check (jsonb_typeof(raw_payload) = 'object')
);

comment on table private.receipt_payloads is
  'Server-only provider receipt payloads. Public receipt rows expose normalized fields only.';

create table public.receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  external_line_id text,
  product_id uuid references public.products (id) on delete set null,
  recommendation_line_id uuid references public.basket_recommendation_lines (id) on delete set null,
  description text not null,
  gtin text,
  quantity numeric(10, 3) not null default 1,
  unit_price_cents integer not null,
  subtotal_cents integer not null,
  checkout_discount_cents integer not null default 0,
  line_total_cents integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint receipt_lines_external_id_nonempty check (
    external_line_id is null or btrim(external_line_id) <> ''
  ),
  constraint receipt_lines_description_nonempty check (btrim(description) <> ''),
  constraint receipt_lines_gtin_format check (
    gtin is null or gtin ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'
  ),
  constraint receipt_lines_quantity_positive check (quantity > 0),
  constraint receipt_lines_unit_price_nonnegative check (unit_price_cents >= 0),
  constraint receipt_lines_unit_extension check (
    subtotal_cents = round(unit_price_cents * quantity)
  ),
  constraint receipt_lines_total_math check (
    subtotal_cents >= 0
    and checkout_discount_cents >= 0
    and checkout_discount_cents <= subtotal_cents
    and line_total_cents = subtotal_cents - checkout_discount_cents
  ),
  constraint receipt_lines_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index receipt_lines_external_key
  on public.receipt_lines (receipt_id, external_line_id)
  where external_line_id is not null;

create table public.offer_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  offer_id uuid not null references public.offers (id) on delete restrict,
  receipt_id uuid,
  provider_key text not null,
  ingestion_key text not null,
  status public.redemption_status not null,
  redeemed_at timestamptz,
  amount_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint offer_redemptions_receipt_owner_fk
    foreign key (receipt_id, user_id)
    references public.receipts (id, user_id)
    on delete set null (receipt_id),
  constraint offer_redemptions_provider_nonempty check (btrim(provider_key) <> ''),
  constraint offer_redemptions_ingestion_nonempty check (btrim(ingestion_key) <> ''),
  constraint offer_redemptions_amount_nonnegative check (amount_cents >= 0),
  constraint offer_redemptions_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint offer_redemptions_provider_ingestion_key unique (provider_key, ingestion_key)
);

create table public.offer_evidence (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  retailer_connection_id uuid,
  receipt_id uuid,
  store_id uuid references public.stores (id) on delete restrict,
  provider_key text not null,
  ingestion_key text not null,
  evidence_type public.offer_evidence_type not null,
  outcome public.evidence_outcome not null,
  state public.offer_state not null,
  confidence_score smallint not null,
  exact_gtin text,
  observed_at timestamptz not null,
  valid_until timestamptz,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint offer_evidence_connection_owner_fk
    foreign key (retailer_connection_id, user_id)
    references public.retailer_connections (id, user_id) on delete cascade,
  constraint offer_evidence_receipt_owner_fk
    foreign key (receipt_id, user_id)
    references public.receipts (id, user_id) on delete cascade,
  constraint offer_evidence_user_context check (
    (retailer_connection_id is null and receipt_id is null)
    or user_id is not null
  ),
  constraint offer_evidence_provider_nonempty check (btrim(provider_key) <> ''),
  constraint offer_evidence_ingestion_nonempty check (btrim(ingestion_key) <> ''),
  constraint offer_evidence_confidence_range check (confidence_score between 0 and 100),
  constraint offer_evidence_gtin_format check (
    exact_gtin is null or exact_gtin ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'
  ),
  constraint offer_evidence_validity_window check (
    valid_until is null or valid_until >= observed_at
  ),
  constraint offer_evidence_details_object check (jsonb_typeof(details) = 'object'),
  constraint offer_evidence_provider_ingestion_key unique (provider_key, ingestion_key)
);

comment on table public.offer_evidence is
  'Provider, cart, account, redemption, and receipt evidence. Null user_id denotes non-personal global evidence.';

-- Query and foreign-key indexes.
create index profiles_updated_at_idx on public.profiles (updated_at desc);
create index retailer_connections_user_status_idx
  on public.retailer_connections (user_id, status);
create index stores_retailer_active_idx on public.stores (retailer_key, active);
create index products_store_active_idx on public.products (store_id, active);
create index products_category_idx on public.products (lower(category));
create index products_brand_idx on public.products (lower(brand)) where brand is not null;
create index products_gtin_idx on public.products (gtin) where gtin is not null;
create index products_aliases_gin_idx on public.products using gin (aliases);
create index prices_product_observed_idx on public.prices (product_id, observed_at desc);
create index prices_validity_idx on public.prices (valid_from, valid_to);
create index offers_store_state_expiry_idx on public.offers (store_id, state, expires_at);
create index offers_source_state_idx on public.offers (source_type, state);
create index offers_user_state_expiry_idx
  on public.offers (user_id, state, expires_at)
  where visibility = 'personalized';
create index offers_connection_idx
  on public.offers (retailer_connection_id)
  where retailer_connection_id is not null;
create index offer_eligibilities_offer_group_idx
  on public.offer_eligibilities (offer_id, eligibility_group);
create index grocery_lists_user_updated_idx on public.grocery_lists (user_id, updated_at desc);
create index grocery_list_items_list_position_idx
  on public.grocery_list_items (grocery_list_id, position, created_at);
create index basket_recommendations_user_calculated_idx
  on public.basket_recommendations (user_id, calculated_at desc);
create index basket_recommendation_lines_recommendation_idx
  on public.basket_recommendation_lines (recommendation_id);
create index basket_recommendation_lines_store_idx
  on public.basket_recommendation_lines (store_id);
create index basket_recommendation_lines_product_idx
  on public.basket_recommendation_lines (product_id);
create index basket_recommendation_traces_offer_idx
  on public.basket_recommendation_traces (offer_id, decision);
create index receipts_user_purchased_idx on public.receipts (user_id, purchased_at desc);
create index receipts_store_purchased_idx on public.receipts (store_id, purchased_at desc);
create index receipt_lines_receipt_idx on public.receipt_lines (receipt_id);
create index receipt_lines_gtin_idx on public.receipt_lines (gtin) where gtin is not null;
create index offer_redemptions_user_offer_idx
  on public.offer_redemptions (user_id, offer_id, redeemed_at desc);
create index offer_redemptions_succeeded_count_idx
  on public.offer_redemptions (user_id, offer_id)
  where status = 'succeeded';
create index offer_evidence_offer_observed_idx
  on public.offer_evidence (offer_id, observed_at desc);
create index offer_evidence_user_observed_idx
  on public.offer_evidence (user_id, observed_at desc) where user_id is not null;

-- updated_at and auth profile hooks.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 120), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.enforce_offer_redemption_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  offer_limit integer;
  offer_owner_id uuid;
  offer_visibility public.offer_visibility;
  succeeded_count bigint;
begin
  if tg_op = 'DELETE' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(old.user_id::text || ':' || old.offer_id::text, 0::bigint)
    );
    return old;
  end if;

  if tg_op = 'UPDATE' and (
    new.user_id is distinct from old.user_id
    or new.offer_id is distinct from old.offer_id
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'offer_redemptions_identity_immutable',
      message = 'An offer redemption cannot be moved to another user or offer.';
  end if;

  select o.max_redemptions_per_user, o.user_id, o.visibility
    into offer_limit, offer_owner_id, offer_visibility
  from public.offers o
  where o.id = new.offer_id
  for share;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text || ':' || new.offer_id::text, 0::bigint)
  );

  if offer_visibility = 'personalized' and offer_owner_id <> new.user_id then
    raise exception using
      errcode = '23514',
      constraint = 'offer_redemptions_personalized_owner',
      message = 'A personalized offer can only be redeemed by its owner.';
  end if;

  if new.status <> 'succeeded' or offer_limit is null then
    return new;
  end if;

  select count(*)
    into succeeded_count
  from public.offer_redemptions redemption
  where redemption.user_id = new.user_id
    and redemption.offer_id = new.offer_id
    and redemption.status = 'succeeded'
    and redemption.id <> new.id;

  if succeeded_count >= offer_limit then
    raise exception using
      errcode = '23514',
      constraint = 'offer_redemptions_per_user_limit',
      message = 'The offer redemption limit has already been reached for this user.';
  end if;

  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger retailer_connections_set_updated_at
before update on public.retailer_connections
for each row execute function public.set_updated_at();

create trigger retailer_connection_secret_references_set_updated_at
before update on private.retailer_connection_secret_references
for each row execute function public.set_updated_at();

create trigger stores_set_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger offers_set_updated_at
before update on public.offers
for each row execute function public.set_updated_at();

create trigger grocery_lists_set_updated_at
before update on public.grocery_lists
for each row execute function public.set_updated_at();

create trigger grocery_list_items_set_updated_at
before update on public.grocery_list_items
for each row execute function public.set_updated_at();

create trigger basket_recommendations_set_updated_at
before update on public.basket_recommendations
for each row execute function public.set_updated_at();

create trigger receipts_set_updated_at
before update on public.receipts
for each row execute function public.set_updated_at();

create trigger receipt_payloads_set_updated_at
before update on private.receipt_payloads
for each row execute function public.set_updated_at();

create trigger offer_redemptions_enforce_limit
before insert or update or delete on public.offer_redemptions
for each row execute function private.enforce_offer_redemption_limit();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- The trigger covers future signups; this backfill makes the migration safe for existing projects.
insert into public.profiles (id, display_name, created_at, updated_at)
select
  existing_user.id,
  nullif(
    left(btrim(coalesce(existing_user.raw_user_meta_data ->> 'display_name', '')), 120),
    ''
  ),
  coalesce(existing_user.created_at, now()),
  now()
from auth.users existing_user
on conflict (id) do nothing;

-- Row-level security. Service-role ingestion and OAuth callbacks bypass RLS.
alter table public.profiles enable row level security;
alter table public.retailer_connections enable row level security;
alter table private.retailer_connection_secret_references enable row level security;
alter table private.receipt_payloads enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.prices enable row level security;
alter table public.offers enable row level security;
alter table public.offer_eligibilities enable row level security;
alter table public.grocery_lists enable row level security;
alter table public.grocery_list_items enable row level security;
alter table public.basket_recommendations enable row level security;
alter table public.basket_recommendation_lines enable row level security;
alter table public.basket_recommendation_traces enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_lines enable row level security;
alter table public.offer_redemptions enable row level security;
alter table public.offer_evidence enable row level security;

create policy profiles_select_self
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy profiles_update_self
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy retailer_connections_select_self
on public.retailer_connections for select to authenticated
using (user_id = (select auth.uid()));

create policy stores_read_active
on public.stores for select to anon, authenticated
using (active);

create policy products_read_active
on public.products for select to anon, authenticated
using (active);

create policy prices_read_catalog
on public.prices for select to anon, authenticated
using (true);

create policy offers_read_public
on public.offers for select to anon, authenticated
using (visibility = 'public');

create policy offers_read_personalized_own
on public.offers for select to authenticated
using (
  visibility = 'personalized'
  and user_id = (select auth.uid())
);

create policy offer_eligibilities_read_public
on public.offer_eligibilities for select to anon, authenticated
using (
  exists (
    select 1
    from public.offers offer
    where offer.id = public.offer_eligibilities.offer_id
      and offer.visibility = 'public'
  )
);

create policy offer_eligibilities_read_personalized_own
on public.offer_eligibilities for select to authenticated
using (
  exists (
    select 1
    from public.offers offer
    where offer.id = public.offer_eligibilities.offer_id
      and offer.visibility = 'personalized'
      and offer.user_id = (select auth.uid())
  )
);

create policy grocery_lists_read_own_or_demo
on public.grocery_lists for select to authenticated
using (is_demo or user_id = (select auth.uid()));

create policy grocery_lists_read_demo_anon
on public.grocery_lists for select to anon
using (is_demo);

create policy grocery_lists_insert_own
on public.grocery_lists for insert to authenticated
with check (not is_demo and user_id = (select auth.uid()));

create policy grocery_lists_update_own
on public.grocery_lists for update to authenticated
using (not is_demo and user_id = (select auth.uid()))
with check (not is_demo and user_id = (select auth.uid()));

create policy grocery_lists_delete_own
on public.grocery_lists for delete to authenticated
using (not is_demo and user_id = (select auth.uid()));

create policy grocery_list_items_read_own_or_demo
on public.grocery_list_items for select to authenticated
using (
  exists (
    select 1
    from public.grocery_lists gl
    where gl.id = grocery_list_id
      and (gl.is_demo or gl.user_id = (select auth.uid()))
  )
);

create policy grocery_list_items_read_demo_anon
on public.grocery_list_items for select to anon
using (
  exists (
    select 1
    from public.grocery_lists gl
    where gl.id = grocery_list_id and gl.is_demo
  )
);

create policy grocery_list_items_insert_own
on public.grocery_list_items for insert to authenticated
with check (
  exists (
    select 1
    from public.grocery_lists gl
    where gl.id = grocery_list_id
      and not gl.is_demo
      and gl.user_id = (select auth.uid())
  )
);

create policy grocery_list_items_update_own
on public.grocery_list_items for update to authenticated
using (
  exists (
    select 1
    from public.grocery_lists gl
    where gl.id = grocery_list_id
      and not gl.is_demo
      and gl.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.grocery_lists gl
    where gl.id = grocery_list_id
      and not gl.is_demo
      and gl.user_id = (select auth.uid())
  )
);

create policy grocery_list_items_delete_own
on public.grocery_list_items for delete to authenticated
using (
  exists (
    select 1
    from public.grocery_lists gl
    where gl.id = grocery_list_id
      and not gl.is_demo
      and gl.user_id = (select auth.uid())
  )
);

create policy basket_recommendations_select_own
on public.basket_recommendations for select to authenticated
using (user_id = (select auth.uid()));

create policy basket_recommendation_lines_select_own
on public.basket_recommendation_lines for select to authenticated
using (
  exists (
    select 1
    from public.basket_recommendations br
    where br.id = recommendation_id and br.user_id = (select auth.uid())
  )
);

create policy basket_recommendation_traces_select_own
on public.basket_recommendation_traces for select to authenticated
using (
  exists (
    select 1
    from public.basket_recommendations br
    where br.id = recommendation_id and br.user_id = (select auth.uid())
  )
);

create policy receipts_select_own
on public.receipts for select to authenticated
using (user_id = (select auth.uid()));

create policy receipt_lines_select_own
on public.receipt_lines for select to authenticated
using (
  exists (
    select 1
    from public.receipts r
    where r.id = receipt_id and r.user_id = (select auth.uid())
  )
);

create policy offer_redemptions_select_own
on public.offer_redemptions for select to authenticated
using (user_id = (select auth.uid()));

create policy offer_evidence_read_global_anon
on public.offer_evidence for select to anon
using (
  public.offer_evidence.user_id is null
  and exists (
    select 1
    from public.offers offer
    where offer.id = public.offer_evidence.offer_id
      and offer.visibility = 'public'
  )
);

create policy offer_evidence_read_global_or_own
on public.offer_evidence for select to authenticated
using (
  (
    public.offer_evidence.user_id is null
    or public.offer_evidence.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.offers offer
    where offer.id = public.offer_evidence.offer_id
      and (
        offer.visibility = 'public'
        or offer.user_id = (select auth.uid())
      )
  )
);

-- Remove Supabase's broad public-schema defaults before granting the intended API surface.
revoke all on table public.profiles, public.retailer_connections, public.stores,
  public.products, public.prices, public.offers, public.offer_eligibilities,
  public.grocery_lists, public.grocery_list_items, public.basket_recommendations,
  public.basket_recommendation_lines, public.basket_recommendation_traces,
  public.receipts, public.receipt_lines, public.offer_redemptions,
  public.offer_evidence from public, anon, authenticated;

revoke all on schema private from public, anon, authenticated;
revoke all on table private.retailer_connection_secret_references,
  private.receipt_payloads from public, anon, authenticated;
revoke execute on function public.set_updated_at(), public.handle_new_user(),
  private.enforce_offer_redemption_limit() from public, anon, authenticated;

grant usage on schema private to service_role;
grant all on table private.retailer_connection_secret_references,
  private.receipt_payloads to service_role;
grant all on table public.profiles, public.retailer_connections, public.stores,
  public.products, public.prices, public.offers, public.offer_eligibilities,
  public.grocery_lists, public.grocery_list_items, public.basket_recommendations,
  public.basket_recommendation_lines, public.basket_recommendation_traces,
  public.receipts, public.receipt_lines, public.offer_redemptions,
  public.offer_evidence to service_role;

grant select on table public.profiles to authenticated;
grant update (display_name, locale, home_postal_code) on table public.profiles to authenticated;
grant select on table public.retailer_connections to authenticated;
grant select on table public.stores, public.products, public.prices, public.offers,
  public.offer_eligibilities, public.offer_evidence to anon, authenticated;
grant select, insert, update, delete on table public.grocery_lists,
  public.grocery_list_items to authenticated;
grant select on table public.grocery_lists, public.grocery_list_items to anon;
grant select on table public.basket_recommendations,
  public.basket_recommendation_lines, public.basket_recommendation_traces,
  public.receipts, public.receipt_lines, public.offer_redemptions to authenticated;
