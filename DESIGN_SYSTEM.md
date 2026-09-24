# Design System — "Concierge" style

Extracted from this project's implementation (`app/globals.css`, `components/app/*`, `components/ui/*`) so it can be reused as the starting point for another product — in this case an agentic marketing-operations platform. Everything below reflects code that's actually in this repo, not aspirational guidance.

---

## 1. Brand personality

A **calm, professional, back-office SaaS tool** — built for staff who use it daily, not for prospects being sold to. The tone is:

- **Quiet confidence, not flash.** One accent color, generous whitespace, no gradients-on-buttons or decorative iconography. The product should feel like infrastructure a team trusts, not a marketing site.
- **Legible over clever.** Status is never ambiguous — connection state, approval state, delivery state are always a pill, never just a color or an icon alone.
- **Human copy, not system copy.** Empty states, confirms and descriptions are written like a colleague explaining something, not like error codes. See §6.
- **Restraint as a feature.** The one deliberate rule worth carrying to a new product: pick a single accent, and spend color only on states that are earned (success/approved, and true errors). Everything else is neutral.

For an agentic marketing-ops platform specifically, this personality translates to: the *agent's* work (drafts, sends, generated content) should look calm and reviewable, not chatty or AI-flavored — the chrome around it stays as sober as the rest of the app even where the content inside is AI-generated.

---

## 2. Color

### Core palette (light theme, the only theme shipped)

| Token | Value | Used for |
|---|---|---|
| `background` | `#ffffff` | page background under the gradient |
| `foreground` | `#0f172a` (slate-900) | body text |
| `primary` | `#0f172a` (slate-900) | primary buttons, active nav pill, filled stepper circles, solid status pills |
| `muted` | `#f1f5f9` (slate-100) | subtle fills (neutral pills, hover backgrounds) |
| `muted-foreground` | `#64748b` (slate-500) | secondary/help text |
| `border` / `input` | `#e2e8f0` (slate-200) | all hairline borders, card edges, input borders |
| `ring` (focus) | `#6366f1` (indigo-500) | focus rings only — the one place indigo is a functional, not decorative, color |
| `destructive` | `oklch(0.577 0.245 27.325)` (~red-600) | destructive buttons/actions |

**Rule of one accent:** `primary` (near-black slate) is the only color used for *emphasis* — primary buttons, the active nav pill, filled stepper steps, and the "final/positive" status pill (Approved, Sent, Resolved). Nothing else competes with it for attention.

### Status/semantic colors (used only inside pills, never as button or nav fills)

| Meaning | Fill | Text | Example |
|---|---|---|---|
| Neutral / open | `slate-100` | `slate-700` | Draft, "—" tags |
| In progress | `indigo-50` | `indigo-700` | Pending approval, Sending |
| Final / positive | `slate-900` (solid) | white | Approved, Sent, Connected, VIP |
| Warning | `amber-50` | `amber-800` | Out of stock, restricted |
| Error | `red-50` | `red-700` | Failed, rejected, blocked |
| Outline | white + `slate-300` border | `slate-700` | Not-connected, loyalty tier |

This is a **closed set** — six tones, defined once in a shared `StatusPill` component (`tone: neutral | outline | progress | solid | warning | error`), never a one-off color picked per screen.

### Background treatment

The one moment of visual richness: a soft, large-radius radial gradient sits behind the whole authenticated app and the login screen (not behind cards, which stay white).

```css
.app-bg {
  background:
    radial-gradient(75% 320px at 0% 0%, #bfc8fb 0%, rgba(191, 200, 251, 0) 100%),
    radial-gradient(35% 60% at 100% 25%, #c6cdfb 0%, rgba(198, 205, 251, 0) 100%),
    linear-gradient(180deg, #dde2fc 0%, #f0f2fc 100%);
}
```

A pale periwinkle/lavender wash, present but never competing with content — cards are pure white on top of it. This is the one place brand color could be swapped in for a new product (e.g. the new platform's own accent hue at the same low saturation/high lightness) without touching anything else.

The full-width title band under the nav (`#f7f8fd`) is a slightly warmer/paler tint of the same family, used to separate the page header from body content without a hard rule.

---

## 3. Typography

- **Font:** Inter (via `next/font/google`), loaded as the sole sans-serif for the whole app — no serif, no display font, no per-section font switching.
- **Monospace:** system mono stack, used narrowly (IDs, template variable names) — not a branded mono font.
- **Scale actually used in the app** (Tailwind classes, not a formal type scale):
  - Page title: `text-2xl font-semibold tracking-tight` (~24px)
  - Section/card heading: `font-semibold` at base size
  - Body/UI text: `text-sm` (14px) is the workhorse size for tables, lists, forms
  - Page description under title: `text-[15px] text-muted-foreground`
  - Secondary/meta text (timestamps, subtitles in list rows): `text-sm text-muted-foreground`
  - Micro-labels (uppercase eyebrow labels like "KNOWLEDGE PROFILE SO FAR"): `text-xs font-medium tracking-[0.12em] uppercase`
- **Weight usage:** semibold for anything that's a name/title/primary line; regular for everything else. No light weights, no italics except for small illustrative hint text.

---

## 4. Shape & surface

- **Corner radius:** generous and consistent — `--radius: 0.75rem` (12px) as the base token, scaled up via `--radius-xl` / `--radius-2xl` for cards. In practice: buttons/inputs ~8–10px, cards/panels/dialogs 16px (`rounded-2xl`), avatars and small icon chips fully round.
- **Borders over shadows:** cards are `bg-white` with a **1px `slate-200` border**, not a drop shadow. Shadows are reserved for floating/overlay elements (dropdown menus, dialogs, the sticky bulk-action bar) where they signal "this is above the page," not for resting content.
- **Dropdown/menu chrome** (recently tightened): visible `slate-300` border + `shadow-xl` + generous item padding (`px-2.5 py-2`) — menus should read as clearly "lifted" above the page, more so than static cards.
- **Whitespace:** generous vertical rhythm (`py-6`/`py-8` section padding, `gap-4`/`gap-6` between cards). Density is deliberately low — this is a tool people live in, not a dashboard optimized for cramming data.

---

## 5. Layout patterns

- **Top-nav-led shell**, not a primary left sidebar. Height 60px, white, sticky, with a hairline bottom border.
  - Left: square rounded logo mark (solid `slate-900` fill, white icon) + wordmark.
  - Center: horizontal nav, grouped into a small number of top-level items to avoid overwhelming choice. **Pattern worth reusing:** group related pages under one pill with a chevron-triggered dropdown for siblings, and treat the *parent pill* as active whenever any child page is open — don't leave a child page with no active nav indicator.
  - Right: a single account/avatar affordance (circular, initials or icon) housing settings/sign-out — kept out of the main tab row entirely so the primary nav stays short.
- **Full-bleed page-title band:** every page opens with a full-width, slightly-tinted strip (breaks out of the content max-width via `left-1/2 / -translate-x-1/2 / w-screen`) holding the H1, one-line description, and right-aligned primary actions. This is what visually separates "page chrome" from "page content" instead of a bordered container.
- **Content max-width:** `1680px`, centered, with `px-4 sm:px-6` gutters — wide enough for dense tables, still with margin on large monitors.
- **Two dominant list patterns**, chosen deliberately per data shape rather than one generic table everywhere:
  1. **Row-list pattern** (search bar + vertical list of hairline-separated rows, each with bold title / grey subtitle / status pill / chevron) — for things people scan a handful at a time and drill into (broadcast history, conversations).
  2. **Dense table pattern** (toolbar + sortable columns + row-hover + "⋯" row menu + numbered pagination) — for CRM-style records people scan many-at-once across columns (guest directory).
  3. **Asset-grid pattern** (filter pills + square photo cards + selection checkmark + status badge overlay + dashed "add" tile as the last cell) — for anything visual/browsable (a catalogue/media library).
- **Wizard pattern:** one shared `Stepper` component (left-side vertical numbered steps, connected by a line, filled solid-black circle for completed steps) paired with a live preview panel on the right that updates as the user types. Reused verbatim across unrelated flows (template/campaign builder, agent-persona builder) — build the stepper once, let each flow own its own step content and validation.
- **Conversational/assisted-flow pattern:** two-panel layout — chat transcript left (assistant = light bubble + avatar, user = solid dark bubble right-aligned, input pinned to bottom), live-building summary card right (progress bar, "X of N captured," checklist that highlights the field currently being answered). This is the template to reuse for *any* agent-driven setup/intake flow in a marketing-ops product (e.g. "brief the agent on a campaign").

---

## 6. Components (shared, not-hand-rolled-per-page)

Built once in `components/app/`, reused everywhere — this is the actual "system" part of the design system:

- `StatusPill` — the six-tone pill described in §2. Every status anywhere in the product goes through this component.
- `PageHeader` — the title band in §5.
- `PillSelect` — pill-shaped dropdown-as-filter (chevron, not native `<select>` chrome) for category/status/sort filters.
- `SearchBar` — full-width pill input with leading search icon + placeholder showing a concrete example (`"Search by guest, room number..."`, not `"Search..."`) + a small dark rounded-square submit button.
- `Stepper` — §5.
- `RowList` / `ListRow` — the row-list pattern.
- `EmptyState` / `ErrorState` / `ListSkeleton` / `CardGridSkeleton` — every data view has all three states; empty states get an icon + one-sentence explanation + a primary action where one makes sense, not a bare "No data."
- `ConfirmDialog` — every destructive action (delete, block, disconnect) routes through one shared confirm component rather than ad hoc `window.confirm` or bespoke dialogs.
- `PhoneFrame` / `WaBubble` — a lightweight WhatsApp-chat-frame illustration used anywhere a live "what will the end user see" preview is useful (message previews, catalogue item preview, agent greeting preview).

**Base component layer:** shadcn/ui (Base UI flavor) for primitives — dialog, dropdown-menu, select, tabs, switch, slider, checkbox, alert-dialog, skeleton, sonner (toasts). Nothing hand-rolled that shadcn already provides.

**Icons:** lucide-react exclusively, generally at `size-4`/`size-5`, never mixed with another icon set.

---

## 7. Interaction & state conventions

- **Loading:** every async view shows a skeleton shaped like its eventual content (not a spinner-in-a-box) — table-row skeletons for tables, card-grid skeletons for grids.
- **Errors:** a dedicated `ErrorState` with a one-sentence plain-English message and a "Try again" button that re-runs the failed call — never a raw stack trace or a silently-blank screen.
- **Mutations:** optimistic-ish pattern — action fires, a toast confirms success/failure (`sonner`, bottom-right), and destructive actions always go through `ConfirmDialog` first.
- **Focus/accessibility:** every interactive element has a visible focus ring (`focus-visible:ring-3` in the accent-tinted ring color), form fields use real `<label htmlFor>` associations, icon-only buttons carry `aria-label`.
- **Simulated latency:** deliberately real (300–600ms) rather than instant, specifically so loading states are actually exercised and reviewable — worth carrying into any mock/demo layer for a new product.

---

## 8. Voice & microcopy

- **Buttons are verbs, specific ones:** "Connect WhatsApp," "Add item," "Take over from AI," "Send now" — never a bare "Submit" or "OK."
- **Empty states explain, don't just state:** e.g. *"Your receptionist doesn't know anything about your property. Upload a guest handbook, add your website, or try the AI Setup Assistant."* — always names the cause and the fix.
- **System constraints are explained, not just enforced:** where a real platform rule limits what the UI allows (e.g. "only Approved templates are selectable"), the UI surfaces *why* in a plain-language inline note rather than leaving the restriction to feel arbitrary.
- **Destructive confirms name the consequence, not just the action:** *"Your AI receptionist will stop replying to guests until you reconnect"* rather than "Are you sure?"
- **Uncertain/unbuilt backend behavior is flagged in-product, not hidden:** e.g. a banner noting a constraint "isn't confirmed for the new build." In code, every such gap is marked with a `// TODO(backend): ...` comment at the exact call site — useful convention to carry forward for any UI being built ahead of its real backend.

---

## 9. What to change vs. keep for a new (marketing-ops) product

**Keep as-is** (these are product-agnostic system decisions):
- Inter, the type scale, the radius/border/shadow rules, the six-tone status pill system, the shared component set in §6, the loading/error/empty/confirm conventions, the voice principles in §8.

**Reconsider per-product:**
- **Accent hue:** swap `#0f172a`-as-primary and the gradient's periwinkle for whatever the new product's brand color is, but **keep it to one accent** and keep the same low-saturation, high-lightness treatment for any background wash — don't add a second competing color.
- **Nav grouping:** the five-item grouped-pill nav was shaped by *this* product's information architecture (agent config vs. marketing vs. conversations). Re-derive groupings from the new product's actual top-level entities rather than copying the labels.
- **List-pattern choice:** re-decide row-list vs. dense-table vs. asset-grid per data type using the same reasoning in §5 (scan-a-few-and-drill-in vs. scan-many-at-once vs. browse-by-thumbnail) rather than defaulting to tables everywhere.
- **The conversational-assist pattern (§5)** is likely to be *more* central in an agentic marketing-ops product than it was here (where it was "optional polish") — worth promoting from a secondary entry point to a primary one if agent-driven setup is core to the new product.
