import { initials } from "@/lib/format"

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 ${size === "lg" ? "size-16 text-xl" : "size-9 text-xs"}`} aria-hidden>
      {initials(name)}
    </span>
  )
}
