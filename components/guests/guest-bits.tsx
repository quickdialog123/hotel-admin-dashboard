import { initials } from "@/lib/format"
import type { Guest } from "@/lib/api/guests"

export function guestName(guest: Pick<Guest, "firstName" | "lastName">) {
  return `${guest.firstName} ${guest.lastName}`.trim()
}

export function formatGuestDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString()
}

export function dayAfterGuestDate(date: string): string | undefined {
  if (!date) return undefined
  const nextDate = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(nextDate.valueOf())) return undefined
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  return nextDate.toISOString().slice(0, 10)
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 ${size === "lg" ? "size-16 text-xl" : "size-9 text-xs"}`} aria-hidden>
      {initials(name)}
    </span>
  )
}
