"use client"

import { Check, ChevronDown } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type PillOption<T extends string> = { value: T; label: string }

/** Pill-shaped dropdown with a chevron — replaces native <select> chrome. */
export function PillSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  prefix,
}: {
  value: T
  onChange: (v: T) => void
  options: PillOption<T>[]
  label: string
  className?: string
  prefix?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn("inline-flex h-9 items-center gap-2 rounded-full border bg-white px-4 text-sm font-medium transition-colors outline-none hover:bg-zinc-50 focus-visible:border-zinc-900 focus-visible:ring-3 focus-visible:ring-zinc-900/15 aria-expanded:bg-zinc-50", className)}
      >
        {prefix}
        {current?.label}
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44 rounded-2xl p-1.5">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)} className="rounded-xl">
            <span className="flex-1">{o.label}</span>
            {o.value === value && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
