"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Check, ChevronDown, LogOut, Settings, Sparkles, User } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type NavLink = { href: string; label: string }
type NavItem = NavLink & {
  /** Sibling pages revealed by the pill's dropdown chevron. */
  children?: NavLink[]
}

// Five top-level items: two standalone tabs and three grouped pills.
// Clicking a grouped pill opens its default page (its own href); the chevron reveals the siblings.
// Note the group "Conversations" lands on the page labelled "Inbox".
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/whatsapp", label: "WhatsApp" },
  { href: "/receptionist", label: "AI Agent", children: [{ href: "/knowledge-base", label: "Knowledge Base" }] },
  {
    href: "/broadcasts",
    label: "Marketing",
    children: [
      { href: "/campaigns", label: "Campaigns" },
      { href: "/catalogue", label: "Catalogue" },
    ],
  },
  { href: "/conversations", label: "Conversations", children: [{ href: "/guests", label: "Guests" }] },
]

const isWithin = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/")

const pillBase = "text-[15px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-slate-900/25"

export function TopNav() {
  const pathname = usePathname()
  const settingsActive = isWithin(pathname, "/settings")

  return (
    <header className="sticky top-0 z-40 border-b bg-white">
      <div className="mx-auto flex h-[60px] max-w-[1680px] items-center gap-8 px-4 sm:px-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-slate-900/20">
          <span className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Sparkles className="size-[18px]" aria-hidden />
          </span>
          <span className="hidden text-[15px] font-semibold sm:inline">Concierge</span>
        </Link>

        <nav aria-label="Main" className="flex min-w-0 flex-1 items-center gap-1">
          {NAV_ITEMS.map((item) => {
            // The parent pill is active whenever the current page is the pill itself or any page in its dropdown.
            const active = isWithin(pathname, item.href) || !!item.children?.some((c) => isWithin(pathname, c.href))
            const tone = active ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"

            if (!item.children) {
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(pillBase, "shrink-0 rounded-lg px-3 py-1.5", tone)}>
                  {item.label}
                </Link>
              )
            }

            return (
              <div key={item.href} className={cn("flex shrink-0 items-center rounded-lg", tone)}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(pillBase, "rounded-l-lg py-1.5 pr-1 pl-3")}>
                  {item.label}
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label={`More in ${item.label}`} className={cn(pillBase, "my-1.5 flex items-center rounded-r-lg border-l border-current/20 py-0 pr-2 pl-1.5 aria-expanded:opacity-70")}>
                    <ChevronDown className="size-3.5" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-48">
                    {item.children.map((c) => (
                      <DropdownMenuItem key={c.href} render={<Link href={c.href} />} className={cn(isWithin(pathname, c.href) && "bg-slate-100 font-semibold")}>
                        {c.label}
                        {isWithin(pathname, c.href) && <Check className="ml-auto size-4" aria-hidden />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account menu"
            className={cn("flex size-9 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-slate-900/25", settingsActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
          >
            <User className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/login" />}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
