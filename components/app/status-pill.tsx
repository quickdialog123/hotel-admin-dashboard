import { cn } from "@/lib/utils"

export type PillTone = "neutral" | "outline" | "progress" | "solid" | "warning" | "error"

const tones: Record<PillTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  outline: "border border-slate-300 bg-white text-slate-700",
  progress: "bg-indigo-50 text-indigo-700",
  solid: "bg-slate-900 text-white",
  warning: "bg-amber-50 text-amber-800",
  error: "bg-red-50 text-red-700",
}

/** Fully-rounded status/tag pill. Solid black is reserved for the "final/positive" state of a flow. */
export function StatusPill({ tone = "neutral", className, children }: { tone?: PillTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  )
}
