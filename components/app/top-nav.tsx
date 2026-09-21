"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/whatsapp", label: "WhatsApp" },
  { href: "/knowledge-base", label: "Knowledge Base" },
  { href: "/catalogue", label: "Catalogue" },
  { href: "/guests", label: "Guests" },
  { href: "/receptionist", label: "AI Receptionist" },
  { href: "/broadcasts", label: "Broadcasts" },
  { href: "/conversations", label: "Conversations" },
  { href: "/settings", label: "Settings" },
]

export function TopNav() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-zinc-900/20">
          <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white">C</span>
          <span className="hidden font-semibold tracking-tight sm:inline">Concierge</span>
        </Link>
        <nav aria-label="Main" className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 py-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-zinc-900/25",
                  active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <Link href="/login" aria-label="Sign out" title="Sign out" className="flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-zinc-900/25 focus-visible:outline-none">
          <LogOut className="size-4" />
        </Link>
      </div>
    </header>
  )
}
