import type { Metadata } from "next";

import { demoOffers, demoProducts, demoStores } from "@/lib/demo";
import { formatCents, formatStatus } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };

const statuses = ["verified", "recently_redeemed", "unverified", "failed", "expired"] as const;

const providers = [
  { name: "Retailer catalog", scope: "Product, store, and price ingestion" },
  { name: "Retailer loyalty", scope: "OAuth-scoped account offers" },
  { name: "Manufacturer coupons", scope: "UPC, brand, and category eligibility" },
  { name: "Promo validation", scope: "Cart test and minimum spend" },
  { name: "Rebates", scope: "Post-purchase cashback" },
  { name: "Receipts", scope: "Predicted-versus-paid confirmation" },
] as const;

export default function AdminPage() {
  return (
    <main className="admin-shell">
      <header className="admin-hero">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>Offer states and provider health</h1>
          <p>
            Demo-only control plane for reviewing trust states, catalog coverage, and integration
            readiness before live credentials are approved.
          </p>
        </div>
        <span className="environment-badge">Demo environment</span>
      </header>

      <section className="admin-stats" aria-label="Demo inventory">
        <AdminStat label="Stores" value={demoStores.length} />
        <AdminStat label="Products" value={demoProducts.length} />
        <AdminStat label="Offers" value={demoOffers.length} />
        <AdminStat
          label="Trusted-status offers"
          value={demoOffers.filter((offer) => ["verified", "recently_redeemed"].includes(offer.status)).length}
        />
      </section>

      <section className="admin-grid">
        <article className="card admin-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Trust pipeline</p>
              <h2>Offer states</h2>
            </div>
          </div>
          <div className="status-breakdown">
            {statuses.map((status) => {
              const count = demoOffers.filter((offer) => offer.status === status).length;
              return (
                <div key={status}>
                  <span><i className={`status-dot status-${status}`} /> {formatStatus(status)}</span>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
        </article>

        <article className="card admin-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Security boundary</p>
              <h2>Retailer connections</h2>
            </div>
          </div>
          <p className="admin-note">
            Zero password collection. Production connections must redirect to provider OAuth and
            store encrypted tokens only on the server.
          </p>
          <dl className="connection-facts">
            <div><dt>Live credentials</dt><dd>Not configured</dd></div>
            <div><dt>Unofficial scraping</dt><dd>Disabled</dd></div>
            <div><dt>Current adapters</dt><dd>Typed mocks</dd></div>
          </dl>
        </article>
      </section>

      <section className="card admin-panel table-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Offer inventory</p>
            <h2>Demo offers</h2>
          </div>
          <span className="pill">Read only</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Offer</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Value</th>
                <th>Minimum</th>
                <th>Expiration</th>
              </tr>
            </thead>
            <tbody>
              {demoOffers.map((offer) => (
                <tr key={offer.id}>
                  <td><strong>{offer.title}</strong><small>{offer.id}</small></td>
                  <td>{offer.provider}</td>
                  <td><span className={`offer-status status-${offer.status}`}>{formatStatus(offer.status)}</span></td>
                  <td>{offerValue(offer)}</td>
                  <td>{offer.minimumSpendCents ? formatCents(offer.minimumSpendCents) : "—"}</td>
                  <td>{String(offer.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card admin-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Integration boundary</p>
            <h2>Provider adapters</h2>
          </div>
          <span className="pill">6 mock adapters</span>
        </div>
        <div className="provider-grid">
          {providers.map((provider) => (
            <article key={provider.name}>
              <span className="mock-badge">Mock</span>
              <h3>{provider.name}</h3>
              <p>{provider.scope}</p>
              <small>Credentials + commercial onboarding required</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function AdminStat({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function offerValue(offer: (typeof demoOffers)[number]): string {
  if (offer.amountOffCents) return `${formatCents(offer.amountOffCents)} off`;
  if (offer.percentOffBasisPoints) return `${offer.percentOffBasisPoints / 100}% off`;
  return "Eligibility based";
}
