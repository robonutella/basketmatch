begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

select has_table(
  'public',
  'basket_recommendations',
  'basket recommendations are persisted'
);

select has_table(
  'public',
  'basket_recommendation_traces',
  'calculation traces are persisted'
);

select has_column(
  'public',
  'basket_recommendations',
  'checkout_total_cents',
  'checkout total is stored explicitly'
);

select has_column(
  'public',
  'basket_recommendations',
  'rebate_total_cents',
  'post-purchase rebates are stored explicitly'
);

select has_column(
  'public',
  'basket_recommendations',
  'net_total_cents',
  'after-rebate net total is stored explicitly'
);

select hasnt_column(
  'public',
  'retailer_connections',
  'access_token',
  'retailer connections do not store access tokens'
);

select hasnt_column(
  'public',
  'retailer_connections',
  'refresh_token',
  'retailer connections do not store refresh tokens'
);

select hasnt_column(
  'public',
  'retailer_connections',
  'password',
  'retailer connections do not store passwords'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated clients cannot access the private secret schema'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where (namespace.nspname, relation.relname) in (
      ('public', 'profiles'),
      ('public', 'retailer_connections'),
      ('private', 'retailer_connection_secret_references'),
      ('private', 'receipt_payloads'),
      ('public', 'stores'),
      ('public', 'products'),
      ('public', 'prices'),
      ('public', 'offers'),
      ('public', 'offer_eligibilities'),
      ('public', 'grocery_lists'),
      ('public', 'grocery_list_items'),
      ('public', 'basket_recommendations'),
      ('public', 'basket_recommendation_lines'),
      ('public', 'basket_recommendation_traces'),
      ('public', 'receipts'),
      ('public', 'receipt_lines'),
      ('public', 'offer_redemptions'),
      ('public', 'offer_evidence')
    )
      and not relation.relrowsecurity
  ),
  'RLS is enabled on every client-facing and private data table'
);

select results_eq(
  $$ select count(*)::bigint from public.stores $$,
  array[3::bigint],
  'the demo seed contains three stores'
);

select results_eq(
  $$ select count(*)::bigint from public.products $$,
  array[18::bigint],
  'the demo seed contains eighteen products'
);

select results_eq(
  $$ select count(*)::bigint from public.offers $$,
  array[6::bigint],
  'the demo seed contains six offers'
);

select results_eq(
  $$ select count(*)::bigint from public.grocery_list_items $$,
  array[5::bigint],
  'the demo seed contains the five prototype list items'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '60000000-0000-4000-8000-000000000001',
    'basketmatch-owner@example.test',
    '{"display_name":"Basket owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    'basketmatch-other@example.test',
    '{"display_name":"Other shopper"}'::jsonb,
    now(),
    now()
  );

insert into public.retailer_connections (
  id, user_id, provider_key, oauth_subject, scopes
)
values (
  '61000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  'test_retailer',
  'oauth-subject-1',
  array['offers.read']
);

insert into private.retailer_connection_secret_references (
  connection_id, token_secret_reference
)
values (
  '61000000-0000-4000-8000-000000000001',
  'vault://basketmatch/test/connection-1'
);

insert into public.offers (
  id, provider_key, external_offer_id, title, provider_display_name,
  source_type, redemption_mode, visibility, state, user_id,
  discount_amount_cents, max_redemptions_per_user, confidence_score, stack_group
)
values
  (
    '62000000-0000-4000-8000-000000000001',
    'test_provider',
    'owner-one-time',
    '$1 owner offer',
    'Test provider',
    'retailer_loyalty',
    'checkout',
    'personalized',
    'verified',
    '60000000-0000-4000-8000-000000000001',
    100,
    1,
    100,
    'retailer-item'
  ),
  (
    '62000000-0000-4000-8000-000000000002',
    'test_provider',
    'other-offer',
    '$1 other offer',
    'Test provider',
    'retailer_loyalty',
    'checkout',
    'personalized',
    'verified',
    '60000000-0000-4000-8000-000000000002',
    100,
    1,
    100,
    'retailer-item'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-4000-8000-000000000001',
  true
);

select results_eq(
  $$ select count(*)::bigint from public.retailer_connections $$,
  array[1::bigint],
  'an authenticated owner can read their OAuth connection metadata'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.offers
    where id in (
      '62000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000002'
    )
  $$,
  array[1::bigint],
  'an authenticated owner sees only their personalized offer'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-4000-8000-000000000002',
  true
);

select results_eq(
  $$ select count(*)::bigint from public.retailer_connections $$,
  array[0::bigint],
  'another shopper cannot read the owner OAuth connection metadata'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.offers
    where id in (
      '62000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000002'
    )
  $$,
  array[1::bigint],
  'another shopper sees only their own personalized offer'
);

reset role;

select lives_ok(
  $$
    insert into public.offer_redemptions (
      id, user_id, offer_id, provider_key, ingestion_key,
      status, redeemed_at, amount_cents
    )
    values (
      '63000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      'test_provider',
      'owner-one-time:first',
      'succeeded',
      now(),
      100
    )
  $$,
  'the first successful redemption is accepted'
);

select throws_ok(
  $$
    insert into public.offer_redemptions (
      id, user_id, offer_id, provider_key, ingestion_key,
      status, redeemed_at, amount_cents
    )
    values (
      '63000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      'test_provider',
      'owner-one-time:second',
      'succeeded',
      now(),
      100
    )
  $$,
  '23514',
  'The offer redemption limit has already been reached for this user.',
  'the one-time-redemption trigger rejects a second success'
);

insert into public.grocery_lists (id, user_id, title, max_stores)
values (
  '64000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  'Database smoke list',
  1
);

select lives_ok(
  $$
    insert into public.basket_recommendations (
      id, user_id, grocery_list_id, idempotency_key, strategy, status,
      max_stores, store_count, checkout_subtotal_cents,
      checkout_discount_cents, checkout_total_cents, rebate_total_cents,
      net_total_cents, pricing_engine_version, input_snapshot
    )
    values (
      '65000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000001',
      'database-smoke-plan',
      'one_store',
      'complete',
      1,
      1,
      1000,
      100,
      900,
      200,
      700,
      'database-smoke',
      '{}'::jsonb
    )
  $$,
  'a reconciled basket recommendation can be persisted by the service role'
);

select lives_ok(
  $$
    insert into public.basket_recommendation_traces (
      id, recommendation_id, offer_id, sequence, decision, stage,
      offer_state_snapshot, reason_code, explanation,
      checkout_discount_cents, rebate_cents
    )
    values (
      '66000000-0000-4000-8000-000000000001',
      '65000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      0,
      'applied',
      'item_checkout',
      'verified',
      'applied_verified_offer',
      'The verified owner offer reduced checkout by one dollar.',
      100,
      0
    )
  $$,
  'a calculation trace can be persisted with its recommendation'
);

select results_eq(
  $$
    select concat_ws(
      ':',
      checkout_total_cents,
      rebate_total_cents,
      net_total_cents
    )
    from public.basket_recommendations
    where id = '65000000-0000-4000-8000-000000000001'
  $$,
  array['900:200:700'::text],
  'checkout, rebate, and after-rebate totals remain separate and reconciled'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-4000-8000-000000000001',
  true
);

select results_eq(
  $$ select count(*)::bigint from public.basket_recommendations $$,
  array[1::bigint],
  'the owner can read the persisted recommendation'
);

select results_eq(
  $$ select count(*)::bigint from public.basket_recommendation_traces $$,
  array[1::bigint],
  'the owner can read the persisted calculation trace'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-4000-8000-000000000002',
  true
);

select results_eq(
  $$ select count(*)::bigint from public.basket_recommendations $$,
  array[0::bigint],
  'another shopper cannot read the owner recommendation'
);

select results_eq(
  $$ select count(*)::bigint from public.basket_recommendation_traces $$,
  array[0::bigint],
  'another shopper cannot read the owner calculation trace'
);

reset role;

select * from finish();
rollback;
