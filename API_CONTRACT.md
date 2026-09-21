# API Contract
Every function the UI calls lives in `lib/api/`. **The TypeScript types in those files are the contract** — the backend should return exactly these shapes (JSON; ISO-8601 strings for timestamps, `YYYY-MM-DD` for dates). All functions are async; a thrown `Error` is shown to the user via the UI's error state or a toast.
Where a shape mirrors Meta's WhatsApp Business Platform (message templates, catalogue products, WABA), it is modelled on Meta's field names/semantics so wiring is a mapping exercise, not a redesign.

## `broadcasts.ts`
### Types
```ts
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
```
### Functions
- `listTemplates(): Promise<MessageTemplate[]>`
- `getTemplate(id: string): Promise<MessageTemplate | null>`
- `saveTemplate(input: TemplateInput, options: { id?: string; submit?: boolean } = {}): Promise<MessageTemplate>`
- `deleteTemplate(id: string): Promise<void>`
- `listSegments(): Promise<RecipientSegment[]>`
- `listBroadcasts(params: { search?: string } = {}): Promise<Broadcast[]>`
- `getBroadcast(id: string): Promise<Broadcast | null>`
- `sendBroadcast(input: { templateId: string; segmentId: string; variables: Record<string, string> }): Promise<Broadcast>` — TODO(backend): only APPROVED templates may be sent; backend must enforce this too.

## `catalogue.ts`
### Types
```ts
export type CatalogueStatus = "active" | "draft" | "out_of_stock"

export type CatalogueItem = {
  id: string
  name: string
  description: string
  priceCents: number
  category: string
  photoUrl: string | null
  /** Free-form metadata labels, e.g. dietary info (Vegetarian, Gluten-free) or merchandising (Chef's pick). */
  tags: string[]
  status: CatalogueStatus
  /** ISO timestamp */
  updatedAt: string
}
```
### Functions
- `listCatalogueItems(): Promise<CatalogueItem[]>`
- `createCatalogueItem(input: Omit<CatalogueItem, "id" | "updatedAt">): Promise<CatalogueItem>` — TODO(backend): photo upload should go to real storage; photoUrl becomes a CDN URL.
- `updateCatalogueItem(id: string, input: Partial<Omit<CatalogueItem, "id">>): Promise<CatalogueItem>`
- `deleteCatalogueItem(id: string): Promise<void>`
- `deleteCatalogueItems(ids: string[]): Promise<void>`
- `updateCatalogueItemsCategory(ids: string[], category: string): Promise<void>`

## `conversations.ts`
### Types
```ts
export type ConversationStatus = "ai_handling" | "needs_attention" | "staff_handling"
export type MessageSender = "guest" | "ai" | "staff"

export type Message = {
  id: string
  sender: MessageSender
  text: string
  /** ISO timestamp */
  sentAt: string
}

export type Conversation = {
  id: string
  guestId: string
  /** Room number or guest name — whichever identifies the guest best */
  guestLabel: string
  guestName: string
  roomNumber: string | null
  status: ConversationStatus
  lastMessagePreview: string
  lastMessageAt: string
}

export type ConversationDetail = Conversation & { messages: Message[] }
```
### Functions
- `listConversations(params: { search?: string } = {}): Promise<Conversation[]>`
- `getConversation(id: string): Promise<ConversationDetail | null>`
- `findConversationByGuest(guestId: string): Promise<Conversation | null>`
- `takeOverConversation(id: string): Promise<ConversationDetail>` — TODO(backend): confirm hand-off mechanism exists / define API
- `handBackToAi(id: string): Promise<ConversationDetail>` — TODO(backend): confirm hand-off mechanism exists / define API
- `sendStaffMessage(id: string, text: string): Promise<Message>`

## `guests.ts`
### Types
```ts
export type GuestStatus = "in_house" | "checked_out" | "vip"

export type Guest = {
  id: string
  name: string
  /** E.164 WhatsApp number */
  whatsappNumber: string
  roomNumber: string | null
  status: GuestStatus
  /** ISO timestamp of last inbound/outbound message */
  lastContactAt: string
  preferences: string[]
  loyaltyTier: "Silver" | "Gold" | "Platinum" | null
  /** YYYY-MM-DD */
  checkIn: string | null
  checkOut: string | null
  notes: string
  blocked: boolean
  optedInMarketing: boolean
}

export type ListGuestsParams = {
  search?: string
  page?: number
  pageSize?: number
  sortBy?: "name" | "roomNumber" | "status" | "lastContactAt"
  sortDir?: "asc" | "desc"
}

export type ListGuestsResult = { items: Guest[]; total: number; page: number; pageSize: number }
```
### Functions
- `listGuests(params: ListGuestsParams = {}): Promise<ListGuestsResult>`
- `getGuest(id: string): Promise<Guest | null>`
- `listAllGuestsCount(): Promise<number>`
- `createGuest(input: Pick<Guest, "name" | "whatsappNumber" | "roomNumber">): Promise<Guest>`
- `updateGuest(id: string, input: Partial<Omit<Guest, "id">>): Promise<Guest>`
- `blockGuest(id: string): Promise<void>`
- `exportGuestConversation(id: string): Promise<` — TODO(backend): return a real export (CSV/PDF) URL for a guest's conversation history.

## `knowledgeBase.ts`
### Types
```ts
export type KnowledgeSourceType = "document" | "website" | "assistant"
export type KnowledgeSourceStatus = "processed" | "processing" | "failed"

export type KnowledgeSource = {
  id: string
  name: string
  type: KnowledgeSourceType
  /** ISO timestamp */
  addedAt: string
  status: KnowledgeSourceStatus
  /** Website URL, when type === "website" */
  url?: string
  /** Drafted text content, when type === "assistant" (editable by staff) */
  content?: string
}

export type ProfileSection = {
  key: string
  title: string
  content: string
}
```
### Functions
- `listKnowledgeSources(): Promise<KnowledgeSource[]>`
- `uploadDocument(fileName: string): Promise<KnowledgeSource>` — TODO(backend): upload the file (multipart) and return the created source.
- `addWebsiteUrl(url: string): Promise<KnowledgeSource>`
- `deleteKnowledgeSource(id: string): Promise<void>`
- `updateKnowledgeSource(id: string, input: Partial<Pick<KnowledgeSource, "name" | "content">>): Promise<KnowledgeSource>`
- `createSourcesFromProfile(sections: ProfileSection[]): Promise<KnowledgeSource[]>` — TODO(backend): wire to real content-generation/AI service

## `receptionist.ts`
### Types
```ts
export type Receptionist = {
  id: string
  name: string
  description: string
  /** System prompt. May contain {{hotel_name}}-style placeholders. */
  systemPrompt: string
  model: string
  /** LLM temperature, 0.0–1.0 (labelled "Creativity" in the UI) */
  temperature: number
  active: boolean
  /** IDs of KnowledgeSource records this receptionist draws on */
  knowledgeSourceIds: string[]
}

export type ReceptionistInput = Omit<Receptionist, "id" | "model" | "active"> & { model?: string; active?: boolean }
```
### Functions
- `listReceptionists(): Promise<Receptionist[]>`
- `createReceptionist(input: ReceptionistInput): Promise<Receptionist>`
- `updateReceptionist(id: string, input: Partial<Omit<Receptionist, "id">>): Promise<Receptionist>`
- `deleteReceptionist(id: string): Promise<void>`

## `settings.ts`
### Types
```ts
export type HotelProfile = {
  name: string
  address: string
  /** IANA timezone */
  timezone: string
  logoUrl: string | null
}

export type StaffRole = "Admin" | "Manager" | "Front desk"
export type StaffUser = { id: string; name: string; email: string; role: StaffRole }

export type NotificationPreferences = {
  needsAttention: boolean
  newGuestConversation: boolean
  broadcastFinished: boolean
  templateStatusChange: boolean
  whatsappDisconnected: boolean
  dailyDigest: boolean
}
```
### Functions
- `getHotelProfile(): Promise<HotelProfile>`
- `updateHotelProfile(input: Partial<HotelProfile>): Promise<HotelProfile>`
- `listStaff(): Promise<StaffUser[]>`
- `addStaff(input: Omit<StaffUser, "id">): Promise<StaffUser>`
- `removeStaff(id: string): Promise<void>`
- `getNotificationPreferences(): Promise<NotificationPreferences>`
- `updateNotificationPreferences(input: Partial<NotificationPreferences>): Promise<NotificationPreferences>`

## `waba.ts`
### Types
```ts
export type WabaConnectionStatus = "connected" | "not_connected" | "error"

export type WabaConnection = {
  status: WabaConnectionStatus
  /** WhatsApp Business Account ID (Meta `waba_id`) */
  wabaId: string | null
  /** Display phone number, E.164 formatted */
  phoneNumber: string | null
  displayName: string | null
  /** Meta account review status */
  wabaStatus: "APPROVED" | "PENDING" | "RESTRICTED" | null
  qualityRating: "GREEN" | "YELLOW" | "RED" | null
  connectedAt: string | null
  /** Human-readable reason when status === "error" */
  errorMessage: string | null
}

export type WabaDashboardStats = {
  conversationsThisWeek: number
  messagesThisWeek: number
  activeGuests: number
  ordersToday: number
}
```
### Functions
- `getWabaConnection(): Promise<WabaConnection>`
- `connectWaba(): Promise<WabaConnection>` — TODO(backend): replace with Meta Embedded Signup — the real flow returns a code that the backend exchanges for a WABA + phone number.
- `disconnectWaba(): Promise<WabaConnection>`
- `simulateWabaError(): Promise<WabaConnection>`
- `getDashboardStats(): Promise<WabaDashboardStats>`
