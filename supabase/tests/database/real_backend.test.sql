begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

select has_column('public', 'profiles', 'launch_region', 'profiles store a launch region');
select has_column('public', 'profiles', 'preferred_retailer_key', 'profiles store a retailer priority');
select ok(
  not has_table_privilege('authenticated', 'public.basket_recommendations', 'INSERT'),
  'authenticated clients cannot forge server calculations'
);
select ok(
  not has_table_privilege('authenticated', 'public.receipts', 'INSERT'),
  'authenticated clients cannot bypass server receipt validation'
);
select ok(
  not has_table_privilege('authenticated', 'public.offer_redemptions', 'INSERT'),
  'authenticated clients cannot bypass server redemption validation'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values (
  '70000000-0000-4000-8000-000000000001',
  'magic-link-user@example.test',
  '{"authentication_method":"email_magic_link"}'::jsonb,
  now(),
  now()
);

select results_eq(
  $$ select concat_ws(':', launch_region, preferred_retailer_key) from public.profiles where id = '70000000-0000-4000-8000-000000000001' $$,
  array['sf_bay_area:safeway'::text],
  'new magic-link users receive Bay Area and Safeway defaults'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$ insert into public.grocery_lists (id, user_id, title) values ('71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'Persistent list') $$,
  'an authenticated user can create a persistent list'
);
select lives_ok(
  $$ insert into public.grocery_list_items (id, grocery_list_id, client_item_id, query, quantity) values ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'mobile-milk', 'milk', 1) $$,
  'an authenticated user can persist a list item'
);
select results_eq(
  $$ select count(*)::bigint from public.grocery_list_items where grocery_list_id = '71000000-0000-4000-8000-000000000001' $$,
  array[1::bigint],
  'the persisted list item can be read back through RLS'
);

reset role;

insert into public.receipts (
  id, user_id, store_id, provider_key, ingestion_key, status, purchased_at,
  subtotal_cents, checkout_discount_cents, tax_cents, checkout_total_cents,
  confirmed_rebate_cents, net_total_cents
) values (
  '73000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'mock_receipts', 'real-backend-receipt', 'reconciled', now(),
  1000, 100, 80, 980, 200, 780
);

select lives_ok(
  $$ select public.store_receipt_payload('73000000-0000-4000-8000-000000000001', '{"fixture":true}'::jsonb) $$,
  'the service path can persist a private raw receipt payload'
);
select results_eq(
  $$ select raw_payload ->> 'fixture' from private.receipt_payloads where receipt_id = '73000000-0000-4000-8000-000000000001' $$,
  array['true'::text],
  'the private receipt payload is stored'
);

insert into public.offer_redemptions (
  id, user_id, offer_id, receipt_id, provider_key, ingestion_key, status,
  redeemed_at, amount_cents
) values (
  '74000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000001',
  'mock_loyalty', 'real-backend-redemption', 'succeeded', now(), 200
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);
select results_eq(
  $$ select concat_ws(':', checkout_total_cents, confirmed_rebate_cents, net_total_cents) from public.receipts $$,
  array['980:200:780'::text],
  'receipt checkout and after-rebate totals remain separate'
);
select results_eq(
  $$ select count(*)::bigint from public.offer_redemptions where status = 'succeeded' $$,
  array[1::bigint],
  'the user can read the persisted successful redemption'
);

reset role;
insert into auth.users (id, email, created_at, updated_at)
values ('70000000-0000-4000-8000-000000000002', 'other-magic-link@example.test', now(), now());
set local role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000002', true);
select results_eq(
  $$ select count(*)::bigint from public.receipts $$,
  array[0::bigint],
  'another authenticated user cannot read the receipt'
);
select results_eq(
  $$ select count(*)::bigint from public.offer_redemptions $$,
  array[0::bigint],
  'another authenticated user cannot read the redemption'
);

reset role;
select ok(
  not has_function_privilege('authenticated', 'public.store_receipt_payload(uuid,jsonb)', 'EXECUTE'),
  'authenticated clients cannot write private receipt payloads'
);

select * from finish();
rollback;
