# Staging deployment

Staging targets a hosted Supabase project, a Vercel preview deployment for `apps/web`, and EAS internal builds for `apps/mobile`. The repository contains configuration only; no production or staging credential is committed.

## Required GitHub environment secrets

Create a protected GitHub environment named `staging` and add:

| Secret | Purpose |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI account token |
| `SUPABASE_PROJECT_ID` | Hosted staging project reference |
| `SUPABASE_DB_PASSWORD` | Staging database password used by `supabase db push` |
| `NEXT_PUBLIC_SUPABASE_URL` | Staging project URL exposed to the web client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging publishable/anon key exposed to the web client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only staging service key |
| `VERCEL_TOKEN` | Vercel deployment token |
| `VERCEL_ORG_ID` | Vercel team/account ID |
| `VERCEL_PROJECT_ID` | Vercel project linked to `apps/web` |
| `EXPO_TOKEN` | Expo account token for EAS builds |

Set these EAS `preview` environment variables with `eas env:create`; they are referenced by the `staging` build profile and are not stored in `eas.json`:

```dotenv
EXPO_PUBLIC_API_URL=https://<staging-web-host>/api
EXPO_PUBLIC_SUPABASE_URL=https://<staging-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<staging-publishable-or-anon-key>
```

In Vercel staging/preview settings, add the three web variables from `apps/web/.env.example`. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.

## Authentication onboarding

1. In Supabase Auth, enable email and leave passwordless OTP/magic-link signup enabled.
2. Set Site URL to the staging web origin.
3. Allow `https://<staging-web-host>/auth/callback`, `basketmatch://auth-callback`, and the EAS development/preview deep-link origins.
4. Configure a real SMTP provider and branded templates before external testing; Supabase's default mail service is for development only.
5. Keep Apple and Google disabled initially. Later, configure them in Supabase Auth and reuse the existing user/session clients; no application-table migration is required.

## Deploy

Push the `staging` branch or run the `Staging` workflow manually. It runs application tests, database tests, TypeScript checks, the web build, and Expo export before applying migrations. Vercel and EAS deployment steps run only when their tokens are present.

The provider adapter mode remains `mock`. Safeway onboarding and all other commercial steps remain exactly as documented in `docs/INTEGRATIONS.md`; never replace missing official access with scraping.
