# BasketMatch mobile

Expo Router consumer app for iOS, Android, and development web. The checked-in experience uses the deterministic shared demo seed; no provider credentials or retailer passwords are read by the client.

## Local setup

1. Install workspace dependencies from the repository root.
2. Copy `.env.example` to `.env.local` and point `EXPO_PUBLIC_API_URL` at the approved BasketMatch API.
3. Run the root mobile script or `npm run start` in this directory.

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are intended only for a future least-privilege client session. Provider OAuth client secrets, refresh-token encryption keys, and Supabase service-role keys belong on the server and must never use the `EXPO_PUBLIC_` prefix.
