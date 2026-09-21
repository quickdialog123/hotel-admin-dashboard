import { clone, delay, isoAgo, isoDate, newId } from "./_mock"

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

const seed: Array<[string, string, string | null, GuestStatus, number, string[], Guest["loyaltyTier"], number, number]> = [
  // name, number, room, status, minutesAgo, prefs, tier, checkInOffset, checkOutOffset
  ["Amelia Hartley", "+44 7700 900101", "204", "in_house", 12, ["Vegetarian", "High floor"], "Gold", -2, 3],
  ["Marcus Feldman", "+1 415 555 0132", "112", "in_house", 45, ["Late checkout"], "Platinum", -1, 4],
  ["Sofia Marchetti", "+39 333 555 0194", "301", "vip", 130, ["Feather-free bedding", "Champagne on arrival"], "Platinum", -3, 2],
  ["Kenji Watanabe", "+81 90 5550 1122", "218", "in_house", 200, ["Quiet room"], "Silver", -1, 5],
  ["Priya Nair", "+91 98765 55012", "405", "in_house", 25, ["Vegetarian", "Extra pillows"], null, 0, 6],
  ["Lucas Moreau", "+33 6 55 01 23 45", null, "checked_out", 60 * 26, ["Late checkout"], "Gold", -6, -1],
  ["Hannah Schmidt", "+49 151 5550 4321", "120", "in_house", 8, [], null, -2, 1],
  ["Omar Haddad", "+971 50 555 0189", "501", "vip", 300, ["Halal", "High floor"], "Platinum", -4, 3],
  ["Chloe Bennett", "+44 7700 900224", null, "checked_out", 60 * 50, [], "Silver", -9, -4],
  ["Diego Alvarez", "+34 612 555 019", "310", "in_house", 75, ["Vegan"], null, -1, 2],
  ["Ingrid Larsen", "+47 912 55 012", "222", "in_house", 410, ["Quiet room", "Sea view"], "Gold", -3, 1],
  ["Thomas Okafor", "+44 7700 900317", null, "checked_out", 60 * 72, [], null, -12, -7],
  ["Yuki Tanaka", "+81 80 5550 9081", "115", "in_house", 18, ["Late checkout"], "Silver", 0, 2],
  ["Elena Petrova", "+7 912 555 01 22", "404", "vip", 95, ["Spa access", "High floor"], "Platinum", -2, 5],
  ["Noah Williams", "+1 212 555 0177", null, "checked_out", 60 * 120, [], "Gold", -15, -10],
  ["Fatima Al-Sayed", "+966 50 555 0166", "208", "in_house", 33, ["Halal"], null, -1, 3],
  ["Oliver Grant", "+44 7700 900445", "306", "in_house", 520, [], null, -2, 2],
  ["Zoe Papadakis", "+30 691 555 0123", null, "checked_out", 60 * 200, ["Vegetarian"], "Silver", -20, -16],
  ["Rafael Costa", "+55 11 95550 1234", "119", "in_house", 55, ["Late checkout", "Gluten-free"], "Gold", -1, 4],
  ["Isabella Rossi", "+39 340 555 0188", "412", "in_house", 140, ["High floor"], null, 0, 3],
  ["Ethan Brooks", "+1 646 555 0144", null, "checked_out", 60 * 30, [], null, -5, -1],
  ["Mei Lin Chen", "+86 138 5550 0199", "219", "in_house", 15, ["Tea selection", "Quiet room"], "Gold", -2, 2],
  ["Jonas Berg", "+46 70 555 01 33", "313", "in_house", 260, [], "Silver", -1, 1],
  ["Aisha Khan", "+44 7700 900588", null, "checked_out", 60 * 90, ["Halal"], null, -8, -3],
  ["William Turner", "+44 7700 900612", "107", "in_house", 610, [], null, -3, 0],
  ["Camille Dubois", "+33 7 55 50 12 34", "502", "vip", 20, ["Champagne on arrival", "High floor"], "Platinum", -1, 6],
  ["Arjun Mehta", "+91 99999 55033", null, "checked_out", 60 * 160, ["Vegetarian"], "Silver", -18, -14],
]

let guests: Guest[] = seed.map(([name, num, room, status, ago, prefs, tier, ci, co], i) => ({
  id: `g_${i + 1}`,
  name,
  whatsappNumber: num,
  roomNumber: room,
  status,
  lastContactAt: isoAgo(ago),
  preferences: prefs,
  loyaltyTier: tier,
  checkIn: isoDate(ci),
  checkOut: isoDate(co),
  notes: "",
  blocked: false,
  optedInMarketing: i % 4 !== 3,
}))
guests[2].notes = "Anniversary stay — arrange flowers in the room on Friday."

export async function listGuests(params: ListGuestsParams = {}): Promise<ListGuestsResult> {
  const { search = "", page = 1, pageSize = 10, sortBy = "lastContactAt", sortDir = "desc" } = params
  const q = search.trim().toLowerCase()
  let rows = guests.filter(
    (g) => !q || g.name.toLowerCase().includes(q) || (g.roomNumber ?? "").includes(q) || g.whatsappNumber.replace(/\s/g, "").includes(q.replace(/\s/g, "")),
  )
  rows = [...rows].sort((a, b) => {
    const av = String(a[sortBy] ?? "")
    const bv = String(b[sortBy] ?? "")
    const cmp = av.localeCompare(bv, undefined, { numeric: true })
    return sortDir === "asc" ? cmp : -cmp
  })
  const total = rows.length
  const start = (page - 1) * pageSize
  return delay({ items: clone(rows.slice(start, start + pageSize)), total, page, pageSize })
}

export async function getGuest(id: string): Promise<Guest | null> {
  const g = guests.find((x) => x.id === id)
  return delay(g ? clone(g) : null)
}

export async function listAllGuestsCount(): Promise<number> {
  return delay(guests.length)
}

export async function createGuest(input: Pick<Guest, "name" | "whatsappNumber" | "roomNumber">): Promise<Guest> {
  const g: Guest = {
    ...input,
    id: newId("g"),
    status: "in_house",
    lastContactAt: new Date().toISOString(),
    preferences: [],
    loyaltyTier: null,
    checkIn: isoDate(0),
    checkOut: isoDate(1),
    notes: "",
    blocked: false,
    optedInMarketing: false,
  }
  guests = [g, ...guests]
  return delay(clone(g))
}

export async function updateGuest(id: string, input: Partial<Omit<Guest, "id">>): Promise<Guest> {
  guests = guests.map((g) => (g.id === id ? { ...g, ...input } : g))
  return delay(clone(guests.find((g) => g.id === id)!))
}

export async function blockGuest(id: string): Promise<void> {
  guests = guests.map((g) => (g.id === id ? { ...g, blocked: true } : g))
  return delay(undefined)
}

// TODO(backend): return a real export (CSV/PDF) URL for a guest's conversation history.
export async function exportGuestConversation(id: string): Promise<{ fileName: string }> {
  const g = guests.find((x) => x.id === id)
  return delay({ fileName: `${(g?.name ?? "guest").toLowerCase().replace(/\s+/g, "-")}-conversation.csv` })
}
