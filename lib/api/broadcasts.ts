import { clone, delay, isoAgo, newId } from "./_mock"

// ---------------------------------------------------------------------------
// Message templates — modelled on Meta's WhatsApp message template schema
// (name / category / language / components[HEADER, BODY, FOOTER, BUTTONS]).
// ---------------------------------------------------------------------------

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION"
export type TemplateStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"
export type HeaderType = "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT"
export type ButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER"

export type TemplateHeader = {
  type: HeaderType
  /** Text headers only */
  text?: string
  /** Media headers: sample file name (Meta requires a sample handle on submit) */
  mediaSample?: string
}

export type TemplateButton = {
  type: ButtonType
  text: string
  /** URL buttons */
  url?: string
  /** Phone buttons, E.164 */
  phoneNumber?: string
}

export type MessageTemplate = {
  id: string
  /** lowercase_snake_case, per Meta's naming rules */
  name: string
  category: TemplateCategory
  /** BCP-47-ish locale, e.g. "en_GB" */
  language: string
  header: TemplateHeader | null
  /** Supports {{variable}} placeholders, e.g. {{firstname}} */
  body: string
  footer: string | null
  /** All buttons on a template must share the same type */
  buttons: TemplateButton[]
  status: TemplateStatus
  /** Present when status === "REJECTED" */
  rejectionReason?: string
  updatedAt: string
}

export type TemplateInput = Omit<MessageTemplate, "id" | "status" | "updatedAt" | "rejectionReason">

/** Appended by the platform to every MARKETING template. Not editable. */
export const MARKETING_OPT_OUT_LINE = "To unsubscribe, reply STOP"

export function extractVariables(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) found.add(m[1])
  return [...found]
}

export function renderTemplateText(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k: string) => values[k]?.trim() || `{{${k}}}`)
}

let templates: MessageTemplate[] = [
  { id: "tpl_1", name: "welcome_pre_arrival", category: "UTILITY", language: "en_GB", header: { type: "TEXT", text: "Welcome to The Harbour House" }, body: "Hi {{firstname}}, we're looking forward to welcoming you on {{arrival_date}}. Reply to this chat any time if you need anything before you arrive.", footer: "The Harbour House", buttons: [{ type: "QUICK_REPLY", text: "Request early check-in" }, { type: "QUICK_REPLY", text: "Airport transfer" }], status: "APPROVED", updatedAt: isoAgo(60 * 24 * 20) },
  { id: "tpl_2", name: "spa_weekend_offer", category: "MARKETING", language: "en_GB", header: { type: "IMAGE", mediaSample: "spa-banner.jpg" }, body: "Hi {{firstname}}, treat yourself this weekend: 20% off all spa treatments booked before Friday.", footer: "Offer ends Sunday", buttons: [{ type: "URL", text: "Book now", url: "https://harbourhouse.example/spa" }], status: "APPROVED", updatedAt: isoAgo(60 * 24 * 6) },
  { id: "tpl_3", name: "checkout_reminder", category: "UTILITY", language: "en_GB", header: null, body: "Hi {{firstname}}, a quick reminder that checkout is at 11:00 tomorrow. Need a late checkout? Just reply and we'll do our best.", footer: null, buttons: [], status: "APPROVED", updatedAt: isoAgo(60 * 24 * 14) },
  { id: "tpl_4", name: "summer_dinner_menu", category: "MARKETING", language: "en_GB", header: { type: "TEXT", text: "New summer menu" }, body: "Our new summer tasting menu launches on {{launch_date}}. Reserve your table for {{firstname}} today.", footer: null, buttons: [{ type: "PHONE_NUMBER", text: "Call restaurant", phoneNumber: "+442079460958" }], status: "PENDING", updatedAt: isoAgo(60 * 20) },
  { id: "tpl_5", name: "loyalty_gold_upgrade", category: "MARKETING", language: "en_GB", header: null, body: "Congratulations {{firstname}}! You've reached Gold status.", footer: null, buttons: [], status: "REJECTED", rejectionReason: "Body must describe the benefit or action for the guest more clearly (Meta reason: INVALID_FORMAT).", updatedAt: isoAgo(60 * 24 * 3) },
  { id: "tpl_6", name: "post_stay_feedback", category: "UTILITY", language: "en_GB", header: null, body: "Thank you for staying with us, {{firstname}}. We'd love your feedback.", footer: null, buttons: [{ type: "URL", text: "Leave feedback", url: "https://harbourhouse.example/feedback" }], status: "DRAFT", updatedAt: isoAgo(60 * 2) },
]

export async function listTemplates(): Promise<MessageTemplate[]> {
  return delay(clone(templates))
}

export async function getTemplate(id: string): Promise<MessageTemplate | null> {
  const t = templates.find((x) => x.id === id)
  return delay(t ? clone(t) : null)
}

/** `submit: true` sends it to Meta for review (status → PENDING), otherwise saves a draft. */
export async function saveTemplate(input: TemplateInput, options: { id?: string; submit?: boolean } = {}): Promise<MessageTemplate> {
  // TODO(backend): POST to Meta's message_templates endpoint via the backend when submit is true.
  const status: TemplateStatus = options.submit ? "PENDING" : "DRAFT"
  if (options.id) {
    templates = templates.map((t) => (t.id === options.id ? { ...t, ...input, status, updatedAt: new Date().toISOString() } : t))
    return delay(clone(templates.find((t) => t.id === options.id)!))
  }
  const created: MessageTemplate = { ...input, id: newId("tpl"), status, updatedAt: new Date().toISOString() }
  templates = [created, ...templates]
  return delay(clone(created))
}

export async function deleteTemplate(id: string): Promise<void> {
  templates = templates.filter((t) => t.id !== id)
  return delay(undefined)
}

// ---------------------------------------------------------------------------
// Broadcasts
// ---------------------------------------------------------------------------

export type BroadcastStatus = "SENT" | "SENDING" | "FAILED"

export type RecipientSegment = { id: string; name: string; description: string; recipientCount: number }

export type Broadcast = {
  id: string
  templateId: string
  templateName: string
  segmentId: string
  segmentName: string
  /** Values for the template's {{variables}} */
  variables: Record<string, string>
  status: BroadcastStatus
  sentAt: string
  recipientCount: number
  delivered: number
  failed: number
  /** Fully-rendered body text as sent */
  renderedBody: string
}

const segments: RecipientSegment[] = [
  { id: "seg_optin", name: "All opted-in guests", description: "Every guest who has opted in to marketing messages", recipientCount: 1284 },
  { id: "seg_inhouse", name: "Current in-house guests", description: "Guests currently checked in", recipientCount: 46 },
  { id: "seg_gold", name: "Gold & Platinum members", description: "Loyalty tiers Gold and above", recipientCount: 212 },
]

let broadcasts: Broadcast[] = [
  { id: "bc_1", templateId: "tpl_2", templateName: "spa_weekend_offer", segmentId: "seg_optin", segmentName: "All opted-in guests", variables: { firstname: "there" }, status: "SENT", sentAt: isoAgo(60 * 24 * 5), recipientCount: 1284, delivered: 1251, failed: 33, renderedBody: "Hi there, treat yourself this weekend: 20% off all spa treatments booked before Friday." },
  { id: "bc_2", templateId: "tpl_3", templateName: "checkout_reminder", segmentId: "seg_inhouse", segmentName: "Current in-house guests", variables: { firstname: "there" }, status: "SENT", sentAt: isoAgo(60 * 20), recipientCount: 46, delivered: 46, failed: 0, renderedBody: "Hi there, a quick reminder that checkout is at 11:00 tomorrow." },
  { id: "bc_3", templateId: "tpl_1", templateName: "welcome_pre_arrival", segmentId: "seg_gold", segmentName: "Gold & Platinum members", variables: { firstname: "there", arrival_date: "Friday 26 Sept" }, status: "SENDING", sentAt: isoAgo(4), recipientCount: 212, delivered: 142, failed: 3, renderedBody: "Hi there, we're looking forward to welcoming you on Friday 26 Sept." },
  { id: "bc_4", templateId: "tpl_1", templateName: "welcome_pre_arrival", segmentId: "seg_optin", segmentName: "All opted-in guests", variables: { firstname: "there", arrival_date: "tomorrow" }, status: "FAILED", sentAt: isoAgo(60 * 24 * 11), recipientCount: 1284, delivered: 0, failed: 1284, renderedBody: "Hi there, we're looking forward to welcoming you on tomorrow." },
]

export async function listSegments(): Promise<RecipientSegment[]> {
  return delay(clone(segments))
}

export async function listBroadcasts(params: { search?: string } = {}): Promise<Broadcast[]> {
  const q = (params.search ?? "").trim().toLowerCase()
  const rows = broadcasts.filter((b) => !q || b.templateName.toLowerCase().includes(q) || b.segmentName.toLowerCase().includes(q))
  return delay(clone(rows.sort((a, b) => b.sentAt.localeCompare(a.sentAt))))
}

export async function getBroadcast(id: string): Promise<Broadcast | null> {
  const b = broadcasts.find((x) => x.id === id)
  return delay(b ? clone(b) : null)
}

// TODO(backend): only APPROVED templates may be sent; backend must enforce this too.
export async function sendBroadcast(input: { templateId: string; segmentId: string; variables: Record<string, string> }): Promise<Broadcast> {
  const template = templates.find((t) => t.id === input.templateId)
  const segment = segments.find((s) => s.id === input.segmentId)
  if (!template || !segment) throw new Error("Template or segment not found")
  if (template.status !== "APPROVED") throw new Error("Only Approved templates can be sent")
  const b: Broadcast = {
    id: newId("bc"),
    templateId: template.id,
    templateName: template.name,
    segmentId: segment.id,
    segmentName: segment.name,
    variables: input.variables,
    status: "SENDING",
    sentAt: new Date().toISOString(),
    recipientCount: segment.recipientCount,
    delivered: 0,
    failed: 0,
    renderedBody: renderTemplateText(template.body, input.variables),
  }
  broadcasts = [b, ...broadcasts]
  return delay(clone(b))
}
