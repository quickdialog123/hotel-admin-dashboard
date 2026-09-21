import { clone, delay, newId } from "./_mock"

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

export const TIMEZONES = ["Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney"]

let profile: HotelProfile = {
  name: "The Harbour House",
  address: "14 Quay Street, Bristol BS1 4ST, United Kingdom",
  timezone: "Europe/London",
  logoUrl: null,
}

let staff: StaffUser[] = [
  { id: "u_1", name: "Alex Wallis", email: "alex@harbourhouse.example", role: "Admin" },
  { id: "u_2", name: "Jamie Reyes", email: "jamie@harbourhouse.example", role: "Front desk" },
  { id: "u_3", name: "Dana Kim", email: "dana@harbourhouse.example", role: "Manager" },
]

let prefs: NotificationPreferences = {
  needsAttention: true,
  newGuestConversation: false,
  broadcastFinished: true,
  templateStatusChange: true,
  whatsappDisconnected: true,
  dailyDigest: false,
}

export async function getHotelProfile(): Promise<HotelProfile> {
  return delay(clone(profile))
}
export async function updateHotelProfile(input: Partial<HotelProfile>): Promise<HotelProfile> {
  profile = { ...profile, ...input }
  return delay(clone(profile))
}
export async function listStaff(): Promise<StaffUser[]> {
  return delay(clone(staff))
}
export async function addStaff(input: Omit<StaffUser, "id">): Promise<StaffUser> {
  const u = { ...input, id: newId("u") }
  staff = [...staff, u]
  return delay(clone(u))
}
export async function removeStaff(id: string): Promise<void> {
  staff = staff.filter((u) => u.id !== id)
  return delay(undefined)
}
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return delay(clone(prefs))
}
export async function updateNotificationPreferences(input: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  prefs = { ...prefs, ...input }
  return delay(clone(prefs))
}
