export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatStatus(status: string): string {
  return status.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

export function readCents(value: unknown, key: string): number {
  if (!value || typeof value !== "object") return 0;
  const candidate = Reflect.get(value, key);
  return typeof candidate === "number" && Number.isInteger(candidate) ? candidate : 0;
}

export function describeTraceEntry(entry: unknown): string {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return "Pricing decision recorded.";

  const offerTitle = readText(entry, "offerTitle");
  const offerId = readText(entry, "offerId");
  const reasonCode = readText(entry, "reasonCode");
  const decision = readText(entry, "decision");
  const identity = offerTitle
    ? `${offerTitle}${offerId ? ` [${offerId}]` : ""}`
    : (offerId ?? "Offer");
  const reason = formatStatus(reasonCode ?? decision ?? "decision");

  for (const key of ["message", "reason", "description", "detail"]) {
    const detail = readText(entry, key);
    if (detail) return `${identity} · ${reason} — ${detail}`;
  }

  return `${identity} · ${reason} — Pricing decision recorded.`;
}

function readText(value: object, key: string): string | undefined {
  const candidate = Reflect.get(value, key);
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}
