"use client"

import { ArrowRight, Search } from "lucide-react"
import { cn } from "@/lib/utils"

/** Full-width pill search input with a dark rounded-square submit button. */
export function SearchBar({
  value,
  onChange,
  placeholder,
  label = "Search",
  onSubmit,
  className,
  showSubmit = true,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label?: string
  onSubmit?: () => void
  className?: string
  showSubmit?: boolean
}) {
  return (
    <form
      role="search"
      className={cn("flex items-center gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border bg-white pr-4 pl-11 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-slate-900 focus-visible:ring-3 focus-visible:ring-slate-900/15"
        />
      </div>
      {showSubmit && (
        <button type="submit" aria-label={label} className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition-colors hover:bg-slate-700 focus-visible:ring-3 focus-visible:ring-slate-900/30 focus-visible:outline-none">
          <ArrowRight className="size-4" />
        </button>
      )}
    </form>
  )
}
