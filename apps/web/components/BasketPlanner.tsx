"use client";

import type { GroceryListItem, Offer } from "@basketmatch/domain";
import { optimizeBasket } from "@basketmatch/pricing-engine";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  DEMO_NOW,
  DEMO_SUGGESTIONS,
  demoItems,
  demoOffers,
  demoProducts,
  demoStores,
} from "@/lib/demo";
import { describeTraceEntry, formatCents, formatStatus, readCents } from "@/lib/format";
import { useAuth } from "./AuthProvider";

type BasketOutcome = ReturnType<typeof optimizeBasket>;

interface SavedListResponse {
  list: {
    id: string;
    title: string;
    items: GroceryListItem[];
    includeRebates: boolean;
    verifiedOffersOnly: boolean;
    maxStores: number;
  };
}

function cloneDemoItems(): GroceryListItem[] {
  return demoItems.map((item) => ({ ...item }));
}

function newItemId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}`;
}

export function BasketPlanner() {
  const { session, user } = useAuth();
  const [items, setItems] = useState<GroceryListItem[]>(cloneDemoItems);
  const [draft, setDraft] = useState("");
  const [includeRebates, setIncludeRebates] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [maxStores, setMaxStores] = useState(2);
  const [listId, setListId] = useState<string>();
  const [remoteOutcome, setRemoteOutcome] = useState<BasketOutcome>();
  const [backendReady, setBackendReady] = useState(false);
  const [backendStatus, setBackendStatus] = useState("Demo calculation");

  const localOutcome = useMemo(
    () =>
      optimizeBasket({
        items,
        products: demoProducts,
        offers: demoOffers,
        stores: demoStores,
        includeRebates,
        verifiedOnly,
        maxStores,
        now: DEMO_NOW,
      }),
    [includeRebates, items, maxStores, verifiedOnly],
  );
  const outcome = user && remoteOutcome ? remoteOutcome : localOutcome;

  useEffect(() => {
    const token = session?.access_token;
    if (!token) {
      setListId(undefined);
      setRemoteOutcome(undefined);
      setBackendReady(false);
      setBackendStatus("Demo calculation");
      return;
    }
    let cancelled = false;
    setBackendStatus("Loading saved list…");
    void fetch("/api/lists", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error ?? "Could not load list.");
        return response.json() as Promise<SavedListResponse>;
      })
      .then(({ list }) => {
        if (cancelled) return;
        setListId(list.id);
        setItems(list.items);
        setIncludeRebates(list.includeRebates);
        setVerifiedOnly(list.verifiedOffersOnly);
        setMaxStores(list.maxStores);
        setBackendReady(true);
        setBackendStatus("Saved to your account");
      })
      .catch((error: unknown) => {
        if (!cancelled) setBackendStatus(error instanceof Error ? error.message : "Backend unavailable");
      });
    return () => { cancelled = true; };
  }, [session?.access_token]);

  useEffect(() => {
    const token = session?.access_token;
    if (!token || !listId || !backendReady) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setBackendStatus("Saving and calculating on server…");
      void fetch("/api/lists", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          id: listId,
          title: "My grocery list",
          items,
          includeRebates,
          verifiedOffersOnly: verifiedOnly,
          maxStores,
        }),
      }).then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error ?? "Could not save list.");
        const idempotencyKey = `web-${globalThis.crypto.randomUUID()}`;
        const calculation = await fetch("/api/recommendations/calculate", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ groceryListId: listId, idempotencyKey }),
        });
        const body = await calculation.json();
        if (!calculation.ok) throw new Error(body.error ?? "Could not calculate basket.");
        if (!cancelled) {
          setRemoteOutcome(body.outcome as BasketOutcome);
          setBackendStatus("Saved · server calculation stored");
        }
      }).catch((error: unknown) => {
        if (!cancelled) setBackendStatus(error instanceof Error ? error.message : "Backend unavailable");
      });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [backendReady, includeRebates, items, listId, maxStores, session?.access_token, verifiedOnly]);

  const recommended = outcome.plans[0];
  const suggestions = DEMO_SUGGESTIONS.filter(
    (suggestion) =>
      !items.some((item) => item.name.toLowerCase() === suggestion.toLowerCase()),
  );

  function addItem(name: string) {
    const cleanName = name.trim();
    if (!cleanName) return;
    setItems((current) => [
      ...current,
      { id: newItemId(), name: cleanName, quantity: 1, purchased: false },
    ]);
  }

  function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addItem(draft);
    setDraft("");
  }

  function resetDemo() {
    setItems(cloneDemoItems());
    setIncludeRebates(true);
    setVerifiedOnly(true);
    setMaxStores(2);
  }

  return (
    <main className="consumer-shell">
      <section className="hero card">
        <div className="hero-copy">
          <p className="eyebrow">
            {verifiedOnly ? "Build your basket once" : "Exploratory · unverified offers included"}
          </p>
          <h1>
            {verifiedOnly
              ? "Find the lowest verified grocery total."
              : "Explore totals that may include unverified offers."}
          </h1>
          <p>
            {verifiedOnly
              ? "Compare store prices, legitimate coupons, promotional codes, and cashback without blurring what you pay now with what arrives later."
              : "These scenarios are not trusted recommendations or checkout guarantees. Checkout and post-purchase totals remain separate."}
          </p>
        </div>
        <div className="hero-stat" aria-live="polite">
          <span>{verifiedOnly ? "Potential savings" : "Exploratory savings"}</span>
          <strong>{formatCents(recommended?.savingsCents ?? 0)}</strong>
          <small>
            {verifiedOnly ? "Across the recommended plan" : "Across the lowest scenario"}
          </small>
        </div>
      </section>

      <div className="consumer-grid">
        <section className="card" aria-labelledby="list-title">
          <SectionHeading eyebrow="Step 1" title="Your grocery list" id="list-title">
            <span className="pill">{items.length} items</span>
          </SectionHeading>
          <p className="sync-status" aria-live="polite">{backendStatus}</p>

          <form className="add-form" onSubmit={submitItem}>
            <label className="sr-only" htmlFor="item-input">Add a grocery item</label>
            <input
              autoComplete="off"
              id="item-input"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Try milk, eggs, Tide, strawberries…"
              value={draft}
            />
            <button className="button primary" type="submit">Add</button>
          </form>

          {suggestions.length > 0 && (
            <div aria-label="Suggested grocery items" className="chips">
              {suggestions.map((suggestion) => (
                <button className="chip" key={suggestion} onClick={() => addItem(suggestion)} type="button">
                  + {suggestion}
                </button>
              ))}
            </div>
          )}

          <ul className="grocery-list">
            {items.map((item) => (
              <li className={item.purchased ? "grocery-item purchased" : "grocery-item"} key={item.id}>
                <label>
                  <input
                    checked={item.purchased}
                    onChange={() =>
                      setItems((current) =>
                        current.map((candidate) =>
                          candidate.id === item.id
                            ? { ...candidate, purchased: !candidate.purchased }
                            : candidate,
                        ),
                      )
                    }
                    type="checkbox"
                  />
                  <span>{item.name}</span>
                </label>
                <button
                  aria-label={`Remove ${item.name}`}
                  className="remove-button"
                  onClick={() =>
                    setItems((current) => current.filter((candidate) => candidate.id !== item.id))
                  }
                  type="button"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-labelledby="controls-title">
          <SectionHeading eyebrow="Step 2" title="Offer controls" id="controls-title" />
          <Toggle
            checked={includeRebates}
            description="Show net cost after cashback, separate from checkout."
            label="Include post-purchase rebates"
            onChange={setIncludeRebates}
          />
          <Toggle
            checked={verifiedOnly}
            description="Count only offers marked verified or recently redeemed."
            label="Only count trusted-status offers"
            onChange={setVerifiedOnly}
          />
          {!verifiedOnly && (
            <p className="exploratory-note" role="status">
              <strong>Exploratory scenario.</strong> Unverified offers may affect the totals below;
              do not treat them as a recommendation or checkout guarantee.
            </p>
          )}
          <label className="select-control" htmlFor="store-limit">
            <strong>Maximum stores</strong>
            <select
              id="store-limit"
              onChange={(event) => setMaxStores(Number(event.target.value))}
              value={maxStores}
            >
              <option value={1}>One store</option>
              <option value={2}>Up to two stores</option>
              <option value={3}>Up to three stores</option>
            </select>
          </label>
          <div className="status-legend" aria-label="Offer status legend">
            {(["verified", "recently_redeemed", "unverified", "failed", "expired"] as const).map(
              (status) => (
                <span key={status}>
                  <i className={`status-dot status-${status}`} /> {formatStatus(status)}
                </span>
              ),
            )}
          </div>
          <button className="button secondary wide" onClick={resetDemo} type="button">
            Reset demo
          </button>
        </section>
      </div>

      <section className="card" aria-labelledby="plans-title">
        <SectionHeading
          eyebrow={verifiedOnly ? "Step 3" : "Unverified scenario"}
          title={verifiedOnly ? "Best trusted basket plans" : "Exploratory basket plans"}
          id="plans-title"
        />
        {outcome.plans.length === 0 ? (
          <div className="empty-state">Add an active item to compare grocery totals.</div>
        ) : (
          <div className="results-grid">
            {outcome.plans.map((plan, index) => (
              <article
                className={
                  index === 0
                    ? verifiedOnly
                      ? "plan-card recommended"
                      : "plan-card exploratory"
                    : "plan-card"
                }
                key={`${plan.label}-${index}`}
              >
                {index === 0 && (
                  <span className={verifiedOnly ? "badge" : "badge exploratory-badge"}>
                    {verifiedOnly ? "Recommended" : "Exploratory · unverified"}
                  </span>
                )}
                <h3>{plan.label}</h3>
                <p className="subtle">{plan.stores.map((store) => store.name).join(" + ")}</p>
                <div className="dual-totals">
                  <div>
                    <span>Net after rebates</span>
                    <strong>{formatCents(plan.netTotalCents)}</strong>
                  </div>
                  <div>
                    <span>Pay at checkout</span>
                    <b>{formatCents(plan.checkoutTotalCents)}</b>
                  </div>
                </div>
                <dl className="plan-metrics">
                  <Metric label="Regular basket" cents={plan.subtotalCents} />
                  <Metric
                    label="Checkout savings"
                    cents={plan.itemCheckoutDiscountsCents + plan.basketDiscountCents}
                    negative
                  />
                  <Metric label="Cashback later" cents={plan.rebateTotalCents} negative />
                  <Metric label="Total savings" cents={plan.savingsCents} />
                </dl>
                <details>
                  <summary>View item plan and calculation trace</summary>
                  <ul className="item-plan">
                    {plan.lines.map((line, lineIndex) => (
                      <li key={`${line.product.id}-${lineIndex}`}>
                        <span>{line.product.name}</span>
                        <strong>{formatCents(readCents(line, "netPriceCents"))}</strong>
                      </li>
                    ))}
                  </ul>
                  <ol className="trace-list">
                    {plan.calculationTrace.map((entry, traceIndex) => (
                      <li key={traceIndex}>{describeTraceEntry(entry)}</li>
                    ))}
                  </ol>
                </details>
              </article>
            ))}
          </div>
        )}
        {outcome.unmatched.length > 0 && (
          <p className="unmatched">No exact demo match: {outcome.unmatched.join(", ")}</p>
        )}
      </section>

      <section className="card" aria-labelledby="offers-title">
        <SectionHeading
          eyebrow="Transparency"
          title={verifiedOnly ? "Matched trusted-status offers" : "Matched scenario offers"}
          id="offers-title"
        />
        {outcome.matchedOffers.length === 0 ? (
          <div className="empty-state">
            {verifiedOnly
              ? "No eligible trusted-status offers matched this basket."
              : "No eligible offers matched this exploratory scenario."}
          </div>
        ) : (
          <div className="offer-feed">
            {outcome.matchedOffers.map((offer) => <OfferRow key={offer.id} offer={offer} />)}
          </div>
        )}
      </section>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  id,
  children,
}: {
  eyebrow: string;
  title: string;
  id: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="switch">
        <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
        <i />
      </span>
    </label>
  );
}

function Metric({ label, cents, negative = false }: { label: string; cents: number; negative?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{negative ? "−" : ""}{formatCents(cents)}</dd>
    </div>
  );
}

function OfferRow({ offer }: { offer: Offer }) {
  return (
    <article className="offer-row">
      <div>
        <h3>{offer.title}</h3>
        <p>
          {offer.provider} <span aria-hidden="true">•</span>{" "}
          {offer.redemptionMode === "rebate" ? "After purchase" : "At checkout"}{" "}
          <span aria-hidden="true">•</span> Expires {String(offer.expiresAt)}
        </p>
      </div>
      <span className={`offer-status status-${offer.status}`}>{formatStatus(offer.status)}</span>
    </article>
  );
}
