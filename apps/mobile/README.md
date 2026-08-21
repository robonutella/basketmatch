# BasketMatch mobile

Expo Router consumer app for iOS, Android, and development web. It supports Supabase email magic-link sessions and calls the authenticated BasketMatch web API to sync lists and request server calculations. Without environment variables it remains in deterministic demo mode. No provider credentials or retailer passwords are read by the client.

## Local setup

1. Install workspace dependencies from the repository root.
2. Copy `.env.example` to `.env.local`, set the public Supabase values, and point `EXPO_PUBLIC_API_URL` at the BasketMatch API. A physical device needs the development computer's LAN address rather than `localhost`.
3. Run the root mobile script or `npm run start` in this directory.

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` create only a least-privilege user session. Provider OAuth client secrets, refresh-token encryption keys, and Supabase service-role keys belong on the server and must never use the `EXPO_PUBLIC_` prefix.
