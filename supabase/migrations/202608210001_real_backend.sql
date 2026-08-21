-- Real-backend milestone defaults and server-only raw receipt persistence.

alter table public.profiles
  add column launch_region text not null default 'sf_bay_area',
  add column preferred_retailer_key text not null default 'safeway';

alter table public.profiles
  add constraint profiles_launch_region_nonempty check (btrim(launch_region) <> ''),
  add constraint profiles_preferred_retailer_nonempty check (btrim(preferred_retailer_key) <> '');

comment on column public.profiles.launch_region is
  'Initial market preference. The launch default is the San Francisco Bay Area.';
comment on column public.profiles.preferred_retailer_key is
  'Retailer prioritization preference. Safeway is the first launch retailer.';

grant update (launch_region, preferred_retailer_key) on table public.profiles to authenticated;

create or replace function public.store_receipt_payload(
  target_receipt_id uuid,
  payload jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private, public
as $$
begin
  if jsonb_typeof(payload) <> 'object' then
    raise exception 'Receipt payload must be a JSON object.' using errcode = '22023';
  end if;

  insert into private.receipt_payloads (receipt_id, raw_payload)
  values (target_receipt_id, payload)
  on conflict (receipt_id) do update
    set raw_payload = excluded.raw_payload,
        updated_at = now();
end;
$$;

revoke all on function public.store_receipt_payload(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.store_receipt_payload(uuid, jsonb) to service_role;
