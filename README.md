# Concierge — Hotel Admin Dashboard (frontend MVP)

Admin dashboard for a hotel's AI-powered WhatsApp receptionist. Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui (Base UI) + lucide-react. Authentication is real (Auth.js Credentials + a NestJS BFF); all **feature** data (dashboard, guests, broadcasts…) is still mocked — see `lib/api/`.

```bash
# 1. create .env.local (see "Authentication integration" below)
# 2. start the NestJS backend on http://localhost:4099
npm install && npm run dev   # http://localhost:3000
```

Login requires the NestJS backend to be running; there is no fake-login bypass.

## Folder structure

```
app/
  login/                 real login (server page + client form + server action)
  api/
    auth/[...nextauth]/  Auth.js route handlers
    bff/[...path]/       same-origin proxy to the NestJS API (tokens stay server-side)
    session/signout/     backend logout + Auth.js sign-out
  (app)/                 authenticated shell (top nav) + every section
    dashboard/ whatsapp/ settings/
    receptionist/ (nav: "AI Agent")  knowledge-base/ (+ assistant/)
    broadcasts/ (+ new/, [id]/)  campaigns/ (+ new/)  catalogue/      (nav: "Marketing")
    conversations/ (+ [id]/) (nav: "Inbox")  guests/ (+ [id]/)         (nav: "Conversations")
auth.ts                  Auth.js config (Credentials provider, JWT/session callbacks)
components/
  ui/                    shadcn primitives
  app/                   shared app components (top nav, pills, states, search bar, stepper, phone frame…)
  catalogue/ guests/ receptionist/ broadcasts/ conversations/   feature components
lib/
  api/                   mock data layer for feature data + shared BFF client (client.ts) and auth schemas
  auth/                  refresh coordinator, signed token updates, session projection
  server/                Nest API client, server-only env, Auth.js session helpers
  query/auth-cache.ts    React Query cache cleanup on sign-out
  hooks/use-async.ts     loading / error / reload wrapper around any lib/api call
  format.ts              price / date helpers
tests/                   auth unit tests + HTTP integration test
API_CONTRACT.md          every function the UI calls, with types
```

## Navigation

Five top-level items: **Dashboard**, **WhatsApp**, and three grouped pills. Clicking a pill opens its default page; the chevron reveals siblings. The parent pill stays filled while you're on any page in its group. Settings and Sign out live in the account menu on the right. Config: `NAV_ITEMS` in `components/app/top-nav.tsx`.

| Pill | Default page | Dropdown |
| --- | --- | --- |
| AI Agent | `/receptionist` | Knowledge Base |
| Marketing | `/broadcasts` | Campaigns, Catalogue |
| Conversations | `/conversations` (labelled "Inbox") | Guests |

## Swapping the mock layer for the real backend

UI components never contain data; they call typed async functions from `lib/api/*.ts`. To wire up the real backend:

1. Open a resource file, e.g. `lib/api/catalogue.ts`.
2. Keep the exported **types and function signatures**; replace each function body with a `fetch` to the real endpoint, returning the same shape.
3. Delete the in-memory store and `delay()` calls from that file. When every file is converted, delete `lib/api/_mock.ts`.

Error handling already works: any thrown `Error` from an API function surfaces in the UI's error state (or a toast for mutations). Search for `TODO(backend)` for the places that need real integration (Meta Embedded Signup, AI assistant, conversation hand-off, file storage, template submission).

## Demo aids

Mock feature data is served *after* a real login — these aids apply only to the mock layer, not to authentication.

- Latency is simulated at 300–600 ms per call so loading states are visible.
- To see error states, run `window.__MOCK_FAIL__ = true` in the browser console, then retry / navigate. Set it back to `false` to recover.
- WhatsApp page → "Simulate error" shows the error treatment for a broken connection.
- Mock data lives in memory and resets on a full page reload.

## Authentication integration

Authentication uses Auth.js Credentials for the frontend session and the NestJS API as the credential and authorization authority. Browser feature requests use the same-origin `/api/bff` route; backend URLs and tokens stay server-side.

Configure these server-only variables in `.env.local` before running the real auth flow:

```text
AUTH_SECRET=<random secret with at least 32 characters>
BACKEND_API_URL=http://localhost:4099
API_PREFIX=api
FRONTEND_ORIGIN=http://localhost:3000
```

`BACKEND_API_URL` is the NestJS origin without the API prefix. In production, `FRONTEND_ORIGIN` must be included in NestJS `CORS_ORIGIN` because the backend's production `OriginGuard` checks the BFF request's configured origin.

The Meta WhatsApp signup feature additionally reads `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID` and `NEXT_PUBLIC_META_GRAPH_VERSION`; they are not required for login or the rest of the dashboard.

Auth.js session lifetime is set to 30 days to match Nest's default `AUTH_SESSION_MAX_TTL`; keep those settings aligned if the backend value is changed.

The initial deployment assumes one persistent Next.js Node process. Process-local refresh coordination does not coordinate horizontally scaled or serverless instances; deploy the BFF as a single process until shared refresh coordination is added. If a refresh outcome is uncertain, the frontend session fails closed and the user must sign in again; Nest may retain an unknown replacement refresh session until its configured expiry. Nest access JWTs are stateless and remain accepted until their short expiry, even after refresh-session logout. The process-local invalidation guard is lost on restart, so immediate revocation across restarts/instances requires backend session checks or shared state.

Run focused auth checks with `npm run test:auth` (needs Node ≥ 22.6 for `--experimental-strip-types`). The HTTP integration test starts the built Next.js app and a mock Nest API: build first with the auth environment above (`npm run build`), then run `npm run test:auth:integration`.

## Design notes

Monochrome (near-black `#111` as the only accent). Colour is used only for errors (red), "needs attention" / out-of-stock (amber) and the light indigo "in progress" pill.
