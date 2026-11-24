import type { Guest } from "@/lib/api/guests"

export function dateInTimeZone(timeZone: string, now = new Date()): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function isInHouseOn(guest: Pick<Guest, "checkInDate" | "checkOutDate">, referenceDate: string): boolean {
  return guest.checkInDate < referenceDate && guest.checkOutDate > referenceDate
}

export function recipientIneligibility(guest: Guest, category: string): string | null {
  if (!guest.phoneNumber.trim()) return "Phone number missing"
  // The current guest API has no marketing consent field. Unknown consent cannot qualify.
  if (category === "MARKETING") return "Marketing consent unavailable"
  return null
}

export function audienceIssues(guests: Guest[], guestIds: string[], category: string, referenceDate: string, inHouse: boolean): string[] {
  const byId = new Map(guests.map((guest) => [guest.id, guest]))
  const phones = new Set<string>()
  const issues: string[] = []
  if (!guestIds.length) issues.push("Select at least one guest.")
  for (const id of guestIds) {
    const guest = byId.get(id)
    if (!guest) { issues.push(`Guest ${id} is no longer available.`); continue }
    const reason = recipientIneligibility(guest, category)
    if (reason) issues.push(`${guest.firstName} ${guest.lastName}: ${reason}.`)
    if (inHouse && (!referenceDate || !isInHouseOn(guest, referenceDate))) issues.push(`${guest.firstName} ${guest.lastName} is not in-house on the reference date.`)
    const phone = guest.phoneNumber.replace(/\D/g, "")
    if (phone && phones.has(phone)) issues.push(`${guest.firstName} ${guest.lastName} shares a selected phone number.`)
    if (phone) phones.add(phone)
  }
  return issues
}
