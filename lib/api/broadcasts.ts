import { clone, delay, isoAgo, newId } from "./_mock"
import { z } from "zod"
import { apiClient, getJson, postJson } from "./client"

// ---------------------------------------------------------------------------
// Message templates — modelled on Meta's WhatsApp message template schema
// (name / category / language / components[HEADER, BODY, FOOTER, BUTTONS]).
// ---------------------------------------------------------------------------

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION"
export type MarketingTemplateType = "DEFAULT" | "CATALOG"
export type CatalogFormat = "CATALOG_MESSAGE" | "MULTI_PRODUCT_MESSAGE"
export type VariableType = "NAME" | "NUMBER"
export type TemplateStatus = string
export type HeaderType = "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT"
export type ButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "CATALOG" | "MPM"

export type TemplateHeader = {
  type: HeaderType
  /** Text headers only */
  text?: string
  /** Media headers: sample file name (Meta requires a sample handle on submit) */
  mediaSample?: string
  /** Resolvable preview URL returned by the API for a submitted media header. */
  mediaUrl?: string
  mediaHandle?: string
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
  marketingType?: MarketingTemplateType
  catalogFormat?: CatalogFormat
  variableType?: VariableType
  /** BCP-47-ish locale, e.g. "en_GB" */
  language: string
  header: TemplateHeader | null
  /** Meta reads return positional placeholders, e.g. {{1}}. */
  body: string
  footer: string | null
  /** All buttons on a template must share the same type */
  buttons: TemplateButton[]
  status: TemplateStatus
  /** Present when status === "REJECTED" */
  rejectionReason?: string
  broadcastEligible: boolean
}

export type TemplateInput = Omit<MessageTemplate, "id" | "status" | "broadcastEligible" | "rejectionReason"> & { sampleValues: Record<string, string> }

export function extractVariables(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) found.add(m[1])
  return [...found]
}

export function renderTemplateText(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k: string) => values[k]?.trim() || `{{${k}}}`)
}

const templateSchema = z.object({ id: z.string(), name: z.string(), category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]), marketingType: z.enum(["DEFAULT", "CATALOG"]).optional().catch("DEFAULT"), catalogFormat: z.enum(["CATALOG_MESSAGE", "MULTI_PRODUCT_MESSAGE"]).optional(), variableType: z.enum(["NAME", "NUMBER"]).optional(), language: z.string(), header: z.union([z.object({ type: z.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"]), text: z.string().optional(), mediaSample: z.string().optional(), mediaUrl: z.string().optional(), mediaHandle: z.string().optional() }), z.null()]), body: z.string(), footer: z.string().nullable(), buttons: z.array(z.object({ type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER", "CATALOG", "MPM"]), text: z.string(), url: z.string().optional(), phoneNumber: z.string().optional() })), status: z.string(), broadcastEligible: z.boolean(), rejectionReason: z.string().optional() })
const pageSchema = z.object({ data: z.array(templateSchema), paging: z.object({ after: z.string().nullable() }) })
const templateInputSchema = z.object({
  name: z.string().regex(/^[a-z0-9_]+$/), category: z.enum(["MARKETING", "UTILITY"]),
  marketingType: z.enum(["DEFAULT", "CATALOG"]).optional(),
  catalogFormat: z.enum(["CATALOG_MESSAGE", "MULTI_PRODUCT_MESSAGE"]).optional(),
  variableType: z.literal("NAME").optional(),
  language: z.string().regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/),
  header: z.union([z.object({ type: z.literal("TEXT"), text: z.string().trim().min(1).max(60) }), z.object({ type: z.enum(["IMAGE", "VIDEO"]), mediaHandle: z.string().min(1), mediaSample: z.string().optional() }), z.null()]),
  body: z.string().trim().min(1).max(1024), footer: z.string().trim().max(60).nullable(),
  buttons: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("QUICK_REPLY"), text: z.string().trim().min(1).max(25) }),
    z.object({ type: z.literal("URL"), text: z.string().trim().min(1).max(25), url: z.url().startsWith("https://") }),
    z.object({ type: z.literal("PHONE_NUMBER"), text: z.string().trim().min(1).max(25), phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/) }),
    z.object({ type: z.literal("CATALOG"), text: z.literal("View catalog") }),
    z.object({ type: z.literal("MPM"), text: z.literal("View items") }),
  ])).max(3), sampleValues: z.record(z.string(), z.string().min(1)),
})

export async function listTemplates(): Promise<MessageTemplate[]> {
  const templates: MessageTemplate[] = []
  let after: string | null = null
  const seen = new Set<string>()
  do {
    const page: z.infer<typeof pageSchema> = await getJson("whatsapp/templates", pageSchema, after ? { after } : undefined)
    templates.push(...page.data)
    after = page.paging.after
    if (after && seen.has(after)) throw new Error("Repeated template pagination cursor")
    if (after) seen.add(after)
  } while (after)
  return templates
}

export async function getTemplate(id: string): Promise<MessageTemplate | null> {
  try { return await getJson(`whatsapp/templates/${encodeURIComponent(id)}`, templateSchema) }
  catch (error) { if (error instanceof Error && "response" in error && (error as { response?: Response }).response?.status === 404) return null; throw error }
}

export async function uploadTemplateMedia(file: File): Promise<string> {
  const result = await apiClient.post("whatsapp/templates/media", { body: file, headers: { "content-type": file.type, "x-file-name": file.name } }).json<{ mediaHandle: string }>()
  return result.mediaHandle
}

/** Submit a new Meta template. Local drafts use template-drafts.ts. */
export async function saveTemplate(input: TemplateInput): Promise<MessageTemplate> {
  const json = templateInputSchema.parse(input)
  if (json.header?.type === "IMAGE" || json.header?.type === "VIDEO") delete json.header.mediaSample
  return postJson("whatsapp/templates", json, templateSchema)
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiClient.delete(`whatsapp/templates/${encodeURIComponent(id)}`)
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
  const template = await getTemplate(input.templateId)
  const segment = segments.find((s) => s.id === input.segmentId)
  if (!template || !segment) throw new Error("Template or segment not found")
  if (!template.broadcastEligible || template.status !== "APPROVED") throw new Error("Only Approved templates can be sent")
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
