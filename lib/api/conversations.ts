import { clone, delay, isoAgo, newId } from "./_mock"

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

function msgs(entries: Array<[MessageSender, string, number]>): Message[] {
  return entries.map(([sender, text, ago]) => ({ id: newId("m"), sender, text, sentAt: isoAgo(ago) }))
}

let threads: ConversationDetail[] = []

function seed() {
  const defs: Array<{ guestId: string; name: string; room: string | null; status: ConversationStatus; messages: Message[] }> = [
    {
      guestId: "g_1", name: "Amelia Hartley", room: "204", status: "ai_handling",
      messages: msgs([
        ["guest", "Hi, what time is breakfast served?", 30],
        ["ai", "Good morning Amelia! Breakfast is served from 7:00 to 10:30 in The Harbour Room. Would you like me to reserve a table?", 29],
        ["guest", "Yes please, for 2 at 9am", 14],
        ["ai", "Done — a table for 2 at 9:00am is booked under Room 204. Enjoy your stay!", 12],
      ]),
    },
    {
      guestId: "g_3", name: "Sofia Marchetti", room: "301", status: "needs_attention",
      messages: msgs([
        ["guest", "The air conditioning in my room isn't working and it's very warm", 150],
        ["ai", "I'm so sorry about that, Sofia. Let me get the front desk involved right away.", 149],
        ["guest", "Please hurry, I have guests arriving tonight", 132],
        ["ai", "I've flagged this as urgent for our team — someone will be with you shortly.", 131],
      ]),
    },
    {
      guestId: "g_2", name: "Marcus Feldman", room: "112", status: "staff_handling",
      messages: msgs([
        ["guest", "Can I get a late checkout on Thursday?", 300],
        ["ai", "I'll check availability with the front desk for you.", 299],
        ["staff", "Hi Marcus, this is Jamie from the front desk. We can offer 2pm at no charge — would that work?", 60],
        ["guest", "That's perfect, thank you!", 45],
      ]),
    },
    {
      guestId: "g_5", name: "Priya Nair", room: "405", status: "ai_handling",
      messages: msgs([
        ["guest", "Do you have vegetarian options on the room service menu?", 40],
        ["ai", "Yes! The Margherita Pizza and Truffle Fries are vegetarian. Would you like to place an order?", 39],
        ["guest", "One margherita please", 25],
      ]),
    },
    {
      guestId: "g_7", name: "Hannah Schmidt", room: "120", status: "ai_handling",
      messages: msgs([
        ["guest", "Where's the nearest pharmacy?", 9],
        ["ai", "There's a pharmacy about a 4-minute walk from the hotel: Harbour Pharmacy on Quay Street, open until 8pm.", 8],
      ]),
    },
    {
      guestId: "g_8", name: "Omar Haddad", room: "501", status: "needs_attention",
      messages: msgs([
        ["guest", "I'd like to speak to the manager about my booking", 320],
        ["ai", "Of course. I'm connecting you with the duty manager now.", 319],
      ]),
    },
    {
      guestId: "g_13", name: "Yuki Tanaka", room: "115", status: "ai_handling",
      messages: msgs([
        ["guest", "What's the wifi password?", 20],
        ["ai", "The wifi network is HarbourGuest and the password is on the card in your room — I can also read it out here if you'd like.", 19],
      ]),
    },
    {
      guestId: "g_6", name: "Lucas Moreau", room: null, status: "ai_handling",
      messages: msgs([
        ["guest", "Thank you for a lovely stay!", 60 * 26],
        ["ai", "Thank you Lucas — it was a pleasure hosting you. We hope to see you again soon!", 60 * 26 - 1],
      ]),
    },
  ]
  threads = defs.map((d, i) => {
    const last = d.messages[d.messages.length - 1]
    return {
      id: `c_${i + 1}`,
      guestId: d.guestId,
      guestName: d.name,
      roomNumber: d.room,
      guestLabel: d.room ? `Room ${d.room} · ${d.name}` : d.name,
      status: d.status,
      lastMessagePreview: last.text,
      lastMessageAt: last.sentAt,
      messages: d.messages,
    }
  })
}
seed()

function summary(t: ConversationDetail): Conversation {
  const { messages: _m, ...rest } = t
  void _m
  return rest
}

export async function listConversations(params: { search?: string } = {}): Promise<Conversation[]> {
  const q = (params.search ?? "").trim().toLowerCase()
  const rows = threads
    .filter((t) => !q || t.guestLabel.toLowerCase().includes(q) || t.lastMessagePreview.toLowerCase().includes(q))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
    .map(summary)
  return delay(clone(rows))
}

export async function getConversation(id: string): Promise<ConversationDetail | null> {
  const t = threads.find((x) => x.id === id)
  return delay(t ? clone(t) : null)
}

/** Finds the conversation for a guest (used by "Open conversation" deep links). */
export async function findConversationByGuest(guestId: string): Promise<Conversation | null> {
  const t = threads.find((x) => x.guestId === guestId)
  return delay(t ? clone(summary(t)) : null)
}

// TODO(backend): confirm hand-off mechanism exists / define API
export async function takeOverConversation(id: string): Promise<ConversationDetail> {
  threads = threads.map((t) => (t.id === id ? { ...t, status: "staff_handling" } : t))
  return delay(clone(threads.find((t) => t.id === id)!))
}

// TODO(backend): confirm hand-off mechanism exists / define API
export async function handBackToAi(id: string): Promise<ConversationDetail> {
  threads = threads.map((t) => (t.id === id ? { ...t, status: "ai_handling" } : t))
  return delay(clone(threads.find((t) => t.id === id)!))
}

export async function sendStaffMessage(id: string, text: string): Promise<Message> {
  const message: Message = { id: newId("m"), sender: "staff", text, sentAt: new Date().toISOString() }
  threads = threads.map((t) =>
    t.id === id ? { ...t, messages: [...t.messages, message], lastMessagePreview: text, lastMessageAt: message.sentAt } : t,
  )
  return delay(clone(message))
}
