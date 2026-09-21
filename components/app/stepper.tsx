import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

/** Left-side vertical stepper: numbered circles joined by a line; completed steps are solid black. */
export function Stepper({ steps, current, onStepClick }: { steps: string[]; current: number; onStepClick?: (index: number) => void }) {
  return (
    <ol className="space-y-0" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="relative flex gap-3 pb-7 last:pb-0" aria-current={active ? "step" : undefined}>
            {i < steps.length - 1 && <span className={cn("absolute top-8 left-4 -ml-px h-[calc(100%-2rem)] w-0.5", done ? "bg-slate-900" : "bg-slate-200")} aria-hidden />}
            <button
              type="button"
              disabled={!done || !onStepClick}
              onClick={() => onStepClick?.(i)}
              className="flex items-center gap-3 text-left outline-none disabled:cursor-default"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                  done && "border-slate-900 bg-slate-900 text-white",
                  active && "border-slate-900 bg-white text-slate-900",
                  !done && !active && "border-slate-200 bg-white text-slate-400",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn("text-sm", active ? "font-semibold" : done ? "font-medium" : "text-muted-foreground")}>{label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
