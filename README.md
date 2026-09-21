# Concierge — Hotel Admin Dashboard (frontend MVP)

Admin dashboard for a hotel's AI-powered WhatsApp receptionist. Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui (Base UI) + lucide-react. **All data is mocked** — see `lib/api/`.

```bash
npm install && npm run dev   # http://localhost:3000  (any email/password works)
```

## Folder structure

```
app/
  login/                 mocked login
  (app)/                 authenticated shell (top nav) + every section
    dashboard/ whatsapp/ settings/
    receptionist/ (nav: "AI Agent")  knowledge-base/ (+ assistant/)
    broadcasts/ (+ new/, [id]/)  campaigns/ (+ new/)  catalogue/      (nav: "Marketing")
    conversations/ (+ [id]/) (nav: "Inbox")  guests/ (+ [id]/)         (nav: "Conversations")
components/
  ui/                    shadcn primitives
  app/                   shared app components (top nav, pills, states, search bar, stepper, phone frame…)
  catalogue/ guests/ receptionist/ broadcasts/ conversations/   feature components
lib/
  api/                   ← the mock data layer (the ONLY place data comes from)
  hooks/use-async.ts     loading / error / reload wrapper around any lib/api call
  format.ts              price / date helpers
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

Error handling already works: any thrown `Error` from an API function surfaces in the UI's error state (or a toast for mutations). Search for `TODO(backend)` for the places that need real integration (auth, Meta Embedded Signup, AI assistant, conversation hand-off, file storage, template submission).

## Demo aids

- Latency is simulated at 300–600 ms per call so loading states are visible.
- To see error states, run `window.__MOCK_FAIL__ = true` in the browser console, then retry / navigate. Set it back to `false` to recover.
- WhatsApp page → "Simulate error" shows the error treatment for a broken connection.
- Mock data lives in memory and resets on a full page reload.

## Design notes

Monochrome (near-black `#111` as the only accent). Colour is used only for errors (red), "needs attention" / out-of-stock (amber) and the light indigo "in progress" pill.
