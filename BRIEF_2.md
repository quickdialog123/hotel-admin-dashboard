# Build Brief: Hotel Admin Dashboard (Frontend MVP)

Paste this entire document as your first message to Claude Code (or save it in your
project as `BRIEF.md` and say "read BRIEF.md and build this"). It is self-contained —
Claude Code doesn't need any other context to get started.

---

## 1. Product context

We're building a SaaS product for hospitality businesses (boutique hotels, luxury
resorts, serviced apartments) that gives each property an AI-powered WhatsApp
receptionist. Guests connect by scanning a QR code, which opens a WhatsApp chat with
the hotel's AI receptionist. Hotels train the AI by uploading Word docs and website
URLs, and (soon) a structured room-service catalogue. Staff manage all of this from
a web admin dashboard — **that dashboard is what you're building.**

**Important correction to how this brief should be read:** this is not a greenfield
product. A working backend already exists (currently running behind an admin tool
called Quickdialog) and it already correctly integrates with Meta's real WhatsApp
Business Platform APIs — including WhatsApp message templates (the thing that makes
broadcasts and marketing messages possible) and the underlying messaging/conversation
plumbing. That hard part — real Meta API integration, template approval compliance —
is already solved and working today. What this project is building is a **new,
better front end** on top of that existing capability, not a rebuild of the backend
logic.

Because the actual backend endpoints are internal and not documented here, build
against a mock data layer (Section 5) whose data shapes mirror Meta's real,
publicly-documented WhatsApp Business Platform objects (message templates, catalog
items, etc.) rather than made-up generic shapes. That way, when the dev team points
this new UI at the real backend, it's a mechanical wiring change — matching shapes,
not a redesign — because the mock already speaks the same "language" as the real
Meta-backed API underneath.

There's a second design reference alongside Quickdialog: a separate internal tool
called Marketing Ops (also built with Claude Code) whose look is closer to what we
want visually going forward — a minimal black/white/grey aesthetic rather than
Quickdialog's indigo theme. Section 6 covers exactly how the two references split:
Quickdialog for a couple of proven functional patterns, Marketing Ops for the actual
color/typography/surface language.

## 2. What to build

A responsive, desktop-first web admin dashboard with the pages below. Use a
top-nav-led layout (see Section 6 for the exact shell pattern) rather than a
primary left sidebar — a slim sidebar is fine for in-page sub-navigation only.

### 2.1 Login (mocked)
Simple email/password form. No real auth — accept any input and redirect to the
dashboard. Leave a clear `// TODO(backend): replace with real auth` comment.

### 2.2 Dashboard / Overview
Landing page after login. Shows:
- WhatsApp connection status card (Connected / Not Connected / Error), with the
  hotel's WhatsApp number if connected
- A few quick stats as cards: conversations this week, messages this week, active
  guests, orders today (mocked numbers)
- Quick links into the other sections below

### 2.3 WhatsApp Connection
Where staff connect (or reconnect) their WhatsApp Business Account.
- If not connected: a "Connect WhatsApp" button that would kick off Meta's Embedded
  Signup flow (mock this — a button that simulates a loading state then shows
  "Connected" is fine for now)
- If connected: show phone number, WABA status, a "Disconnect / Reconnect" action
- This page matters because WhatsApp connection is currently the #1 known bug in the
  real product — the UI here should make connection status very legible (don't bury
  it), since staff need to be able to tell at a glance whether their receptionist is
  actually working

### 2.4 Knowledge Base
Where staff upload what the AI receptionist knows.
- List of uploaded sources: Word docs and website URLs, each with a name, type,
  date added, and status (Processed / Processing / Failed)
- "Upload document" (file picker, accepts .docx) and "Add website URL" (text input)
  actions
- Delete action per item, with a confirm dialog

**AI Setup Assistant (creative addition — optional entry point into this page)**
A conversational alternative to manually uploading files, inspired by a
"briefing assistant" pattern staff have used elsewhere: a chat panel on the left
where a scripted assistant asks a few short questions about the property
("What's the name of your hotel?", "What are your check-in/check-out times?",
"Do you offer room service, a spa, a pool?"), and a live-building panel on the
right titled something like "Knowledge Profile — X of 6 captured" that fills in
as each question is answered (Property basics / Amenities / Policies / Local
recommendations / Contact & escalation / Tone of voice). Finishing the chat
creates a set of draft Knowledge Base entries the same shape as an uploaded
document, which staff can review and edit like any other source.
This is entirely scripted UI + mock data — canned assistant questions and
fake "capturing your profile..." delays, no real AI call. Leave a
`// TODO(backend): wire to real content-generation/AI service` comment.
Treat this as optional polish: build the manual upload flow first since it's
the simpler, more essential path; add the assistant afterward if time allows.

### 2.5 Catalogue (room service menu) (nav placement: under "Marketing ▾", alongside Broadcasts and Campaigns)
CRUD management of room service items that will eventually sync to a WhatsApp
Catalogue. This should look and feel like a media/asset library rather than a
plain admin table, since these are visual items staff browse by photo — think a
DAM-style asset grid, restyled into the monochrome Marketing Ops language from
Section 6 (no blue accents, no green checkmarks):

- **Filter row** above the grid: three dropdown pills — "All categories ▾" (Mains
  / Drinks / Desserts / etc.), "All statuses ▾" (Active / Draft / Out of stock),
  "Last updated ▾" for sort — plus a grid/list view-toggle icon aligned right.
  Same pill-with-chevron styling as the rest of the app, not native `<select>`
  chrome.
- **Grid of item cards**: each card is a square-ish photo thumbnail (light grey
  placeholder background if no photo yet) with the item name in bold beneath it
  and a secondary line showing price + category (e.g. "$14.00 · Mains"). On
  hover/selection, a circular checkmark badge appears in the top-right corner of
  the thumbnail (solid black fill, white check — not green) to support bulk
  actions (bulk delete, bulk category change) via a small action bar that appears
  once one or more items are selected.
- **Status indicator on the card**: an "Out of stock" or "Draft" item gets a small
  pill badge overlaid on the thumbnail's bottom-left corner (matching the
  monochrome pill style — grey fill for Draft, a muted red/amber tint for Out of
  stock as one of the few allowed color departures, consistent with the error-state
  exception in Section 6).
- **"Add item" tile**: the last cell in the grid is a dashed-border tile with a
  plus icon and "Add item" label, rather than a separate button floating above
  the grid — clicking it opens the Add/Edit form.
- **Add / Edit item form**: name, description, price, category (dropdown), photo
  upload (with the same thumbnail preview treatment as the grid cards). Include a
  small live preview of how the item will appear inside a WhatsApp catalogue
  browse screen (reuse the phone-frame illustration style from the earlier
  handover mockup) so staff can see the guest-facing result while editing.
- Delete with confirm dialog (single item, or bulk via the selection action bar)

### 2.6 Guests (nav placement: under "Conversations ▾", alongside Inbox)
A directory of every guest who has messaged the AI receptionist, modeled on a
CRM-style contact table (the kind of dense, sortable table that's the right call
here — unlike the list-row pattern used elsewhere, a guest directory benefits from
scanning many records/columns at once):

- **Toolbar**: a pill-shaped search input ("Search by name, room number, phone...")
  on the left, a solid black "Add Guest" button beside it, and "Show [10 ▾] Entries"
  aligned right.
- **Table columns**: Profile (avatar placeholder circle with initials), Name,
  WhatsApp Number, Room Number, Status (a pill: In-house / Checked-out / VIP),
  Last Contact (relative timestamp, e.g. "2h ago"), and a couple of
  hotel-specific tag columns — Preferences (e.g. "Vegetarian", "High floor",
  "Late checkout" as small pill tags) and Loyalty Tier (e.g. "Gold", "—" if none).
  These last two mirror the idea of custom/extensible fields, but with real
  hospitality meaning rather than arbitrary test columns.
- **Row actions**: a "⋯" menu per row — View guest profile, Open conversation
  (deep-links into 2.9 Conversations for that guest), Export conversation history,
  Block guest (with confirm dialog).
- **Pagination**: numbered page controls at the bottom, current page as a solid
  black pill, matching the monochrome palette in Section 6.
- **Guest profile view** (opened from a row): contact details, room number, stay
  dates (check-in/check-out), the Preferences/Loyalty tags as editable fields, a
  free-text notes field for staff, and a link straight into that guest's
  conversation thread.
- Loading/empty/error states apply here too — an empty state before any guest has
  ever messaged in should say so plainly rather than showing a blank table.

### 2.7 AI Agent (nav label — page also referred to as "AI Receptionist" elsewhere in this brief and in `receptionist.ts`; nav placement: its own pill, opens this page directly, with Knowledge Base as its dropdown sibling)
Configuration for the AI persona itself — separate from Knowledge Base (2.4, which
is *what* the AI knows) and Catalogue (2.5, *what it can sell*), this page is about
*who the AI is and how it behaves*.

- **Landing state**: an info banner above the table explaining the constraint —
  "Add your AI receptionist: configure its name, tone, and behavior. Each
  property can have one active receptionist at a time — disable or delete the
  current one to configure a replacement." (This mirrors a real constraint from
  the existing product rather than inventing new backend capability — leave a
  `// TODO(backend): confirm whether multiple named receptionist personas will
  ever be supported, or whether this stays single-agent-per-property` comment,
  since this isn't confirmed for the new build.)
- **Table below the banner**: Name, Persona summary (truncated system prompt),
  Model, Creativity (the temperature value, labeled in friendlier terms for
  hotel staff), Active (toggle), Actions. Realistically at most one row for v1
  given the constraint above.
- **Empty state**: before any receptionist is configured, show a dashed-border
  "+ Add AI Receptionist" tile (reusing the same tile pattern as Catalogue's
  "+ Add item" in 2.5) rather than a bare table.
- **"Create AI Receptionist" flow**: a 3-step wizard using the same left-side
  stepper + live preview pattern as the Message Template builder in 2.8 (restyled
  monochrome per Section 6 — solid black filled step circles, not indigo):
  1. **Basic Details** — Receptionist name (e.g. "Oceanview Receptionist"), a
     short description, and a "Creativity" slider (0.0–1.0, this is the real
     LLM temperature parameter under a friendlier label) rendered with a black
     track/thumb.
  2. **Persona & Prompt** — a system-prompt textarea, pre-filled with helper
     placeholder text such as "You are the AI receptionist for {{hotel_name}}.
     Be warm, concise, and offer to connect the guest with the front desk
     whenever you're unsure." The live preview panel on the right renders a
     sample WhatsApp-style greeting bubble that updates as the name/prompt
     fields change, so staff can see the tone take shape.
  3. **Knowledge Base** — a checklist of existing Knowledge Base sources (from
     2.4) for staff to select which ones this receptionist should draw on,
     closing the loop between this page and 2.4 rather than treating them as
     unrelated.
  Back/Next buttons per step; the final step saves and returns to the table.

### 2.8 Broadcasts & Message Templates (nav placement: under "Marketing ▾" — Broadcasts is the pill's default landing page, Message Templates is relabeled "Campaigns" as the dropdown sibling)
This section replaces an existing, working feature (currently in Quickdialog) — the
goal is a better **front-end UI** for the same real capability, not a rebuild of the
backend logic behind it. Everything here is still UI + mock data, same as every
other page in this brief (see Section 5) — the difference is just that the mock
shapes below are modeled on the real thing so the visual/data design doesn't have to
be redone later. Two connected parts:

**Campaigns** (formerly "Message Templates" — list + create/edit)
WhatsApp requires every broadcast/marketing message to use a pre-approved template.
Model this on Meta's real template schema, not an arbitrary shape:
- `name`, `category` (Marketing / Utility / Authentication), `language`
- `header` (optional): type is Text, Image, Video, or Document
- `body`: the message text, supporting `{{variable}}` placeholders (e.g.
  `{{firstname}}`)
- `footer` (optional): short text line
- A compulsory opt-out line is auto-appended to marketing templates for compliance
  (e.g. "To unsubscribe, reply STOP") — show this in the preview but don't let it be
  edited or removed
- `buttons` (optional): Quick Reply, URL, or Phone Number type, consistent across
  the template
- Status: Draft / Pending Approval / Approved / Rejected (templates go through
  Meta's review process — surface this status clearly, since staff can't send a
  template until it's Approved)

Build this as **the Campaign creation wizard** — this is the actual multi-step
marketing wizard called out in Section 6's shared Stepper component: a live
message preview panel updating as fields are filled (Basic Details → Header →
Body → Footer → Buttons → Review), matching the pattern staff already know from
Quickdialog. List view (the Campaigns nav destination) shows existing
campaigns/templates with their status.

**Broadcasts** (send + history)
- "New broadcast": pick an **Approved** template, fill in any template variables,
  pick a recipient segment (e.g. "All opted-in guests", "Current in-house guests" —
  mock 2-3 segments), review the rendered preview, and send
- Broadcast history: past broadcasts with template used, segment, sent date, and a
  delivery summary (e.g. "142 delivered, 3 failed"). Style this as a clean searchable
  list rather than a dense spreadsheet-style table — a search/filter bar above,
  then rows each showing the template name (bold), a subtitle line (segment · sent
  date), a status pill on the right (Sent / Sending / Failed), and a chevron to open
  the detail view. See Section 6 for the exact visual pattern this borrows from.
- Inline note near the compose step: "Broadcasts sent outside a guest's 24-hour
  conversation window require an approved message template and marketing opt-in —
  that's why only Approved templates are selectable here." (This is a real WhatsApp
  platform rule; surfacing it helps staff understand the Approved-only restriction
  rather than it feeling arbitrary.)

### 2.9 Conversations (nav label: "Inbox")
List and view of guest conversations with the AI receptionist. Per the nav
grouping in Section 6, this page is labeled **"Inbox"** in the top nav — the same
term staff already know from Quickdialog — even though it's referred to as
Conversations here and in the mock API (`conversations.ts`).
- Conversation list: use the same clean searchable-list pattern as Broadcast
  history (Section 6) — a search bar at the top ("Search by guest, room number...")
  above a list of rows, each showing the guest identifier (room number or name if
  known, bold) with a subtitle line (last message preview, timestamp), a status
  pill on the right (AI handling / Needs attention / Staff handling — three
  distinct pill colors), and a chevron
- Conversation detail view: message thread (guest + AI + staff messages, visually
  distinct), with a **"Take over from AI"** button that hands the conversation to
  staff and lets staff type a reply
- This hand-off capability is currently an OPEN QUESTION on the backend side — build
  the full UI for it regardless, since the guest-facing use case depends on it, but
  leave a `// TODO(backend): confirm hand-off mechanism exists / define API` comment
  at the relevant point in the code

### 2.10 Settings
- Hotel profile (name, address, timezone, logo upload)
- Staff users list (name, email, role) with add/remove (mocked)
- Notification preferences (toggles)

## 3. Explicitly out of scope for this build

Don't build these — keep the MVP focused:
- Real WhatsApp API calls, real auth/JWT, real file storage (all mocked — see
  Section 5)
- Any guest-facing UI (guests only ever interact via WhatsApp itself, not a web UI)
- A WhatsApp Product Card Carousel feature — deferred to v2, not needed here
- Multi-hotel / super-admin views — assume a single logged-in hotel account context
- Payment/billing screens

## 4. Tech stack

Use this stack unless you have a strong reason not to — it's chosen for fast,
polished MVP output with Claude Code:

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** for styling
- **shadcn/ui** for components (buttons, tables, dialogs, forms, tabs, toasts, cards)
  — don't hand-roll components shadcn already provides
- Lightweight client state (React Context or Zustand) — no need for Redux
- **lucide-react** for icons

## 5. Mock data layer (important — this is how the backend team plugs in later)

Create a `lib/api/` directory with one file per resource:
`waba.ts`, `knowledgeBase.ts`, `catalogue.ts`, `guests.ts`, `receptionist.ts`,
`broadcasts.ts`, `conversations.ts`, `settings.ts`.

Each file exports typed async functions that currently return mock data (with a
simulated ~300-600ms delay to make loading states real), but are shaped exactly like
a real API call would be, e.g.:

```ts
// lib/api/catalogue.ts
export type CatalogueItem = {
  id: string
  name: string
  description: string
  priceCents: number
  category: string
  photoUrl: string | null
}

export async function listCatalogueItems(): Promise<CatalogueItem[]> { /* mock */ }
export async function createCatalogueItem(input: Omit<CatalogueItem, "id">): Promise<CatalogueItem> { /* mock */ }
export async function updateCatalogueItem(id: string, input: Partial<CatalogueItem>): Promise<CatalogueItem> { /* mock */ }
export async function deleteCatalogueItem(id: string): Promise<void> { /* mock */ }
```

UI components should only ever call these functions — never inline mock data
directly in a component. That way, swapping mocks for real `fetch` calls later is a
change confined to `lib/api/`, not a UI rewrite.

Also generate a short `API_CONTRACT.md` at the project root documenting every
function's inputs/outputs (types are basically the contract) so the backend team
knows exactly what to build against.

## 6. Design guidance

Two internal tools are visual/functional references (screenshots available if
needed), and they split cleanly: **Marketing Ops sets the actual look** (colors,
typography, surfaces, list style) and **Quickdialog contributes two specific
functional patterns** (the stepper+preview builder, and the sidebar+topbar shell
shape). Don't blend Quickdialog's indigo theme in — Marketing Ops' black/white/grey
look is the one to build.

**Visual language — from Marketing Ops:**
- **Palette**: near-black (`#111111`–`#18181B` range) as the single accent color,
  used for primary buttons, active nav/tab states, and focus rings — no blue or
  indigo. Everything else is white, near-white page background, and a scale of
  greys for borders, secondary text, and muted surfaces. This is a monochrome
  product; resist the urge to add a colored accent.
- **Top nav**: a simple horizontal bar — small square logo mark + product name on
  the left, a handful of top-level nav items inline (not a hamburger/sidebar for
  primary nav), each rendered as text that gets a filled black rounded-pill /
  dark-chip background when active. This replaces Quickdialog's left-sidebar-only
  pattern as the primary navigation; a slim left sidebar can still be used for
  in-section sub-navigation if a page needs it (e.g. Settings sub-tabs).

  **Nav item grouping — five items, not nine.** Two standalone pages, three
  grouped pills each with its own dropdown:
  - **Standalone tabs**: **Dashboard**, **WhatsApp** (2.3's connection page —
    kept standalone, not nested, because of the "don't bury connection status"
    requirement in 2.3).
  - **AI Agent ▾**: clicking the pill itself opens the AI Agent configuration
    page — this is 2.7's receptionist-persona builder, **renamed from "AI
    Receptionist" to "AI Agent"** to match the term staff already know from
    Quickdialog's own "AI Agent" nav item. (Keep `receptionist.ts` as the mock
    API filename from Section 5 — only the page title and nav label change.)
    The dropdown chevron reveals one sibling: **Knowledge Base** (2.4).
  - **Marketing ▾**: clicking the pill opens **Broadcasts** — the send-a-
    broadcast-and-view-history half of 2.8 — as the default landing page. The
    dropdown reveals two siblings: **Campaigns**, the renamed label for 2.8's
    Message Templates list/builder half, and **Catalogue** (2.5) — the room
    service menu moves here because it's the thing campaigns actually promote
    (a broadcast pushing tonight's specials points straight at Catalogue
    items), so it reads as marketing content rather than a disconnected
    standalone page. Broadcasts and Campaigns remain one functional unit (you
    pick an Approved template from Campaigns when composing in Broadcasts) —
    they're just separate nav destinations under one Marketing umbrella now
    instead of two panels on one page.
  - **Conversations ▾**: clicking the pill opens **Inbox** — 2.9's guest
    conversation list/detail, kept labeled "Inbox" per the reasoning below — as
    the default landing page. The dropdown reveals **Guests** (2.6). Careful:
    the nav *group* is named "Conversations" while the *page* inside it is
    labeled "Inbox" — two different labels for two different things, don't
    conflate them when wiring up routes/active-states.
  - **Settings** stays out of the tab row entirely, in an account/avatar icon
    on the far right (the same corner as the sign-out control already visible
    there) — opened as a small dropdown (Settings, Sign out).
  - Whichever pill's dropdown contains the current page takes the filled black
    active state on the parent pill itself (e.g. being on Knowledge Base shows
    "AI Agent" as active, not an orphaned page with no active nav indicator).
- **Surfaces**: white cards, thin light-grey 1px borders (not heavy shadows),
  generous rounded corners (larger radius than typical — soft, friendly rectangles)
  on cards, inputs, and buttons. Plenty of whitespace; avoid visual density.
- **Search/input bars**: a full-width pill-shaped input with a leading icon and
  placeholder copy that shows an example (e.g. `Search by guest, room number...`),
  paired with a small dark rounded-square submit/action button on the right rather
  than a plain text link.
- **Lists**: the primary way to show collections of records (broadcast history,
  conversations, diagnostics-style views) is a vertical list of rows, not a dense
  table — each row has a bold primary line, a lighter grey subtitle line beneath
  it, a status pill and/or date right-aligned, and a trailing chevron. Rows are
  separated by a hairline border, not alternating shading.
- **Status/tag pills**: small fully-rounded pills with a soft tint fill and
  matching darker text — e.g. light grey fill for a neutral/open state, light
  indigo-tint fill for an in-progress state, solid black fill with white text for
  a completed/resolved/approved state. Reserve solid black pills for the
  "final/positive" status in any given flow (Approved, Resolved, Sent) so they
  read as a deliberate accent against the otherwise monochrome palette.
- **Conversational / assisted flows** (like the Knowledge Base setup assistant in
  2.4): a two-panel layout — chat transcript on the left (assistant messages as
  light-grey rounded bubbles, user replies as solid dark bubbles aligned right, a
  plain text input pinned to the bottom), and a live-building summary panel on the
  right in a card with a small progress indicator ("X of N captured") and a
  checklist of fields that highlights the one currently being answered.

**Functional patterns — from Quickdialog, restyled into the above palette:**
- **Multi-step builder**: there are **two separate wizards** that should share
  **one reusable stepper component** — don't build the stepper twice, and don't
  merge the two wizards into one either. Build a single `Stepper` (or similar)
  component that takes a list of step labels and a current-step index and
  renders Quickdialog's left-side vertical stepper (numbered/circular steps
  connected by a line, filled for completed steps) with Back/Next buttons and a
  live preview panel on the right, restyled black/white/grey (filled step =
  solid black circle, not indigo). Then use that one component for both:
  - the **Campaign creation wizard** in 2.8 (nav: Marketing ▾ → Campaigns),
    with its own 6 steps (Basic Details → Header → Body → Footer → Buttons →
    Review) — this is the actual marketing wizard
  - the **AI Agent creation wizard** in 2.7 (nav: AI Agent ▾), with its own 3
    steps (Basic Details → Persona & Prompt → Knowledge Base)
  Each wizard owns its own step content and validation; only the stepper chrome
  and the preview-panel layout are shared.
- **Dense data tables** (2.6 Guests, and the AI Receptionist table in 2.7):
  Quickdialog's classic table-with-toolbar pattern — search input + primary action
  button above, sortable columns, row hover state, a "⋯" per-row action menu, and
  numbered pagination at the bottom — is the right call for these two pages
  specifically, where staff scan many records/columns at once. Restyle it
  monochrome (black pagination pill instead of indigo, black button instead of
  indigo) rather than replacing it with the list-row pattern used elsewhere.
- **Connection status legibility** (2.3 WhatsApp Connection, 2.2 Dashboard card):
  Quickdialog's pattern of making integration status impossible to miss — keep
  that emphasis, expressed through the new palette (e.g. a solid black "Connected"
  pill vs. a bordered/outline "Not Connected" pill vs. a distinct error treatment
  that's allowed to break the monochrome rule with a red/amber tint, since errors
  are the one place a color departure earns its keep).

General quality bar:
- Clean, modern, professional SaaS aesthetic — this is a tool hotel staff use daily,
  it should feel trustworthy and fast, not flashy
- Light theme by default
- Generous whitespace, clear type hierarchy, consistent spacing (stick to Tailwind's
  spacing scale)
- Every data view needs loading, empty, and error states — don't just build the
  happy path
- Keyboard-accessible forms, visible focus states, proper label associations
- Responsive down to tablet width; desktop-first is fine since this is a staff tool,
  but it shouldn't visually break on a smaller screen

## 7. Deliverable expectations

- Should run with `npm install && npm run dev` with zero manual setup
- Include a `README.md` explaining the folder structure and, specifically, how to
  swap the mock `lib/api/` layer for real endpoints later
- Reasonably organized component structure (`components/`, `app/`, `lib/`)
- Don't worry about automated tests for this MVP pass — focus on a working,
  polished UI

## 8. Suggested build order

Work through this incrementally and show progress rather than trying to generate
everything in one shot:

1. Scaffold the Next.js + TypeScript + Tailwind + shadcn/ui project, sidebar/top bar
   shell, and routing for all pages (empty placeholders are fine at this stage)
2. Build the mock `lib/api/` layer for all resources (Section 5)
3. Build Dashboard/Overview and WhatsApp Connection
4. Build Knowledge Base and Catalogue (both are list + create/edit/delete patterns)
5. Build Guests (table + toolbar + pagination + profile view)
6. Build AI Receptionist (table + empty state + the 3-step creation wizard)
7. Build Broadcasts (compose flow + history)
8. Build Conversations (list + detail + take-over-from-AI)
9. Build Settings and Login
10. Pass over everything for loading/empty/error states and responsive polish
