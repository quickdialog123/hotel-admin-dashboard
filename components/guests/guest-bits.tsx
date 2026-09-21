import { StatusPill } from "@/components/app/status-pill"
import { initials } from "@/lib/format"
import type { GuestStatus } from "@/lib/api/guests"

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-700 ${size === "lg" ? "size-16 text-xl" : "size-9 text-xs"}`} aria-hidden>
      {initials(name)}
    </span>
  )
}

export function GuestStatusPill({ status }: { status: GuestStatus }) {
  if (status === "vip") return <StatusPill tone="solid">VIP</StatusPill>
  if (status === "in_house") return <StatusPill tone="progress">In-house</StatusPill>
  return <StatusPill tone="neutral">Checked-out</StatusPill>
}

export const STATUS_OPTIONS: { value: GuestStatus; label: string }[] = [
  { value: "in_house", label: "In-house" },
  { value: "checked_out", label: "Checked-out" },
  { value: "vip", label: "VIP" },
]
