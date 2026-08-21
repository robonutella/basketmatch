export type ProviderAdapterMode = "mock" | "sandbox" | "production";

export const PROVIDER_MODE_ENVIRONMENT_KEYS = [
  "ALBERTSONS_ADAPTER_MODE",
  "WALMART_ADAPTER_MODE",
  "TARGET_ADAPTER_MODE",
  "MFR_COUPON_NETWORK_ADAPTER_MODE",
  "PROMO_VALIDATION_ADAPTER_MODE",
  "REBATE_NETWORK_ADAPTER_MODE",
  "RECEIPT_PROVIDER_ADAPTER_MODE"
] as const;

export type ProviderModeEnvironmentKey = typeof PROVIDER_MODE_ENVIRONMENT_KEYS[number];

export type ProviderAdapterModes = Readonly<Record<ProviderModeEnvironmentKey, ProviderAdapterMode>>;

/**
 * Resolve the server-side adapter selection contract documented in
 * docs/INTEGRATIONS.md. An unset provider inherits PROVIDER_ADAPTER_MODE, which
 * itself defaults to `mock`. This function selects modes only; a server
 * composition root must still instantiate the corresponding approved adapter.
 */
export function resolveProviderAdapterModes(
  environment: Readonly<Record<string, string | undefined>>
): ProviderAdapterModes {
  const fallback = parseMode(environment.PROVIDER_ADAPTER_MODE, "PROVIDER_ADAPTER_MODE");
  return Object.fromEntries(
    PROVIDER_MODE_ENVIRONMENT_KEYS.map(key => [
      key,
      environment[key] === undefined ? fallback : parseMode(environment[key], key)
    ])
  ) as ProviderAdapterModes;
}

function parseMode(value: string | undefined, key: string): ProviderAdapterMode {
  const mode = value?.trim().toLowerCase() || "mock";
  if (mode === "mock" || mode === "sandbox" || mode === "production") return mode;
  throw new TypeError(`${key} must be mock, sandbox, or production`);
}
