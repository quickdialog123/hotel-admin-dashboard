"use client"

import Link from "next/link"
import { ArrowUpRight, BookOpen, MessageSquare, Radio, ShoppingBag, Users, Utensils, Bot } from "lucide-react"
import { ConnectionPill } from "@/components/app/connection-pill"
import { PageHeader } from "@/components/app/page-header"
import { ErrorState } from "@/components/app/states"
import { Skeleton } from "@/components/ui/skeleton"
import { getDashboardStats, getWabaConnection } from "@/lib/api/waba"
import { useAsync } from "@/lib/hooks/use-async"
import { formatDate } from "@/lib/format"

const quickLinks = [
  { href: "/conversations", label: "Conversations", desc: "See what guests are asking", icon: MessageSquare },
  { href: "/knowledge-base", label: "Knowledge Base", desc: "Train your receptionist", icon: BookOpen },
  { href: "/catalogue", label: "Catalogue", desc: "Manage room service items", icon: Utensils },
  { href: "/guests", label: "Guests", desc: "Browse the guest directory", icon: Users },
  { href: "/receptionist", label: "AI Receptionist", desc: "Tone, persona and behaviour", icon: Bot },
  { href: "/broadcasts", label: "Broadcasts", desc: "Message templates & sends", icon: Radio },
]

export default function DashboardPage() {
  const conn = useAsync(getWabaConnection)
  const stats = useAsync(getDashboardStats)

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of your AI receptionist." />

      <section aria-labelledby="conn-heading" className="mb-6">
        {conn.error ? (
          <ErrorState message={conn.error} onRetry={conn.reload} />
        ) : conn.loading || !conn.data ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : (
          <Link
            href="/whatsapp"
            className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-6 transition-colors hover:border-slate-400 ${conn.data.status === "error" ? "border-red-200 bg-red-50/50" : "bg-white"}`}
          >
            <div>
              <h2 id="conn-heading" className="text-sm font-medium text-muted-foreground">
                WhatsApp connection
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <ConnectionPill status={conn.data.status} size="lg" />
                {conn.data.phoneNumber && <span className="text-lg font-semibold tabular-nums">{conn.data.phoneNumber}</span>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {conn.data.status === "connected" && `Your receptionist is live${conn.data.connectedAt ? ` · connected ${formatDate(conn.data.connectedAt)}` : ""}.`}
                {conn.data.status === "not_connected" && "Guests can't reach your receptionist until WhatsApp is connected."}
                {conn.data.status === "error" && conn.data.errorMessage}
              </p>
            </div>
            <span className="flex items-center gap-1 text-sm font-medium">
              Manage connection <ArrowUpRight className="size-4" />
            </span>
          </Link>
        )}
      </section>

      <section aria-label="Quick stats" className="mb-8">
        {stats.error ? (
          <ErrorState message={stats.error} onRetry={stats.reload} />
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Conversations this week", value: stats.data?.conversationsThisWeek, icon: MessageSquare },
              { label: "Messages this week", value: stats.data?.messagesThisWeek, icon: Radio },
              { label: "Active guests", value: stats.data?.activeGuests, icon: Users },
              { label: "Orders today", value: stats.data?.ordersToday, icon: ShoppingBag },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border bg-white p-5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-sm">{s.label}</span>
                  <s.icon className="size-4" aria-hidden />
                </div>
                {stats.loading ? <Skeleton className="mt-3 h-8 w-20" /> : <p className="mt-3 text-3xl font-semibold tabular-nums">{s.value?.toLocaleString()}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Quick links</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((l) => (
          <Link key={l.href} href={l.href} className="group flex items-center gap-4 rounded-2xl border bg-white p-5 transition-colors hover:border-slate-400">
            <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-slate-900 group-hover:text-white">
              <l.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{l.label}</span>
              <span className="block truncate text-sm text-muted-foreground">{l.desc}</span>
            </span>
            <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>
    </>
  )
}
