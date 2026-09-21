import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WabaConnectionStatus } from "@/lib/api/waba"

const config = {
  connected: { label: "Connected", icon: CheckCircle2, cls: "bg-slate-900 text-white" },
  not_connected: { label: "Not connected", icon: CircleDashed, cls: "border-2 border-slate-300 bg-white text-slate-700" },
  error: { label: "Connection error", icon: AlertTriangle, cls: "bg-red-50 text-red-700 border border-red-200" },
} as const

export function ConnectionPill({ status, size = "md" }: { status: WabaConnectionStatus; size?: "md" | "lg" }) {
  const c = config[status]
  const Icon = c.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full font-semibold", size === "lg" ? "px-4 py-1.5 text-base" : "px-3 py-1 text-sm", c.cls)}>
      <Icon className={size === "lg" ? "size-5" : "size-4"} aria-hidden />
      {c.label}
    </span>
  )
}
