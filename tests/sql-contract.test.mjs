import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/202608200001_initial_schema.sql", import.meta.url),
  "utf8",
);
const seed = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");

test("database schema preserves the security and pricing boundaries", () => {
  for (const table of [
    "profiles",
    "retailer_connections",
    "stores",
    "products",
    "prices",
    "offers",
    "offer_eligibilities",
    "offer_evidence",
    "grocery_lists",
    "grocery_list_items",
    "basket_recommendations",
    "basket_recommendation_lines",
    "basket_recommendation_traces",
    "receipts",
    "receipt_lines",
    "offer_redemptions",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
  }

  assert.match(migration, /'verified'[\s\S]*'recently_redeemed'[\s\S]*'unverified'[\s\S]*'failed'[\s\S]*'expired'/);
  assert.match(migration, /checkout_total_cents integer not null[\s\S]*rebate_total_cents integer not null[\s\S]*net_total_cents integer not null/);
  assert.match(migration, /create table private\.retailer_connection_secret_references/);
  assert.match(migration, /create table private\.receipt_payloads/);
  assert.doesNotMatch(
    tableDefinition("retailer_connections"),
    /\b(?:password|username)\s+(?:text|varchar|character)/i,
  );
  assert.doesNotMatch(tableDefinition("receipts"), /raw_payload/i);
  assert.match(migration, /offers_read_personalized_own/);
  assert.match(migration, /basket_recommendation_traces_select_own/);
  assert.doesNotMatch(migration, /basket_recommendation_traces[^;]*for (?:insert|update|delete|all) to authenticated/is);
  assert.match(migration, /offer_redemptions_enforce_limit/);
});

test("SQL seed recreates the browser prototype deterministically", () => {
  assert.equal(countInsertIds("stores", "10000000"), 3, "stores");
  assert.equal(countInsertIds("products", "20000000"), 18, "products");
  assert.equal(countInsertIds("prices", "30000000"), 18, "prices");
  assert.equal(countInsertIds("offers", "40000000"), 6, "offers");
  assert.equal(countInsertIds("offer_eligibilities", "41000000"), 9, "eligibility rules");
  assert.equal(countInsertIds("offer_evidence", "42000000"), 6, "evidence records");
  assert.equal(countInsertIds("grocery_lists", "50000000"), 1, "demo lists");
  assert.equal(countInsertIds("grocery_list_items", "51000000"), 5, "demo list items");
  assert.match(seed, /'DEMO5'/);
  assert.match(seed, /'2026-07-29T19:00:00Z'/);

  for (const gtin of [
    "021130070338", "007874204122", "008523906855",
    "021130031681", "007874223908", "008523902543",
    "003700087458", "003700087465", "003700087472",
  ]) {
    assert.match(seed, new RegExp(`'${gtin}'`));
  }
});

function tableDefinition(table) {
  const match = migration.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\n\\);`));
  assert.ok(match, `missing ${table} definition`);
  return match[0];
}

function countInsertIds(table, prefix) {
  const match = seed.match(new RegExp(
    `insert into public\\.${table} \\([\\s\\S]*?on conflict`,
  ));
  assert.ok(match, `missing ${table} seed block`);
  return [...match[0].matchAll(new RegExp(`'${prefix}[0-9a-f-]*'`, "g"))].length;
}
