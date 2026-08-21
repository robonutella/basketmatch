export async function basketmatchApi<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `BasketMatch API returned ${response.status}.`);
  return body;
}
