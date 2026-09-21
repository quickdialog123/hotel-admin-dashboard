"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Bot, HandHelping, Send, User } from "lucide-react"
import { ErrorState } from "@/components/app/states"
import { ConversationStatusPill } from "@/components/conversations/status"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getConversation, handBackToAi, sendStaffMessage, takeOverConversation, type ConversationDetail, type MessageSender } from "@/lib/api/conversations"
import { useAsync } from "@/lib/hooks/use-async"
import { formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const senderLabel: Record<MessageSender, string> = { guest: "Guest", ai: "AI receptionist", staff: "Staff" }
const bubble: Record<MessageSender, string> = {
  guest: "mr-auto rounded-bl-md bg-slate-100",
  ai: "ml-auto rounded-br-md border bg-white",
  staff: "ml-auto rounded-br-md bg-slate-900 text-white",
}

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, error, loading, reload, setData } = useAsync(() => getConversation(id), [id])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [data?.messages.length])

  const back = (
    <Link href="/conversations" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Inbox
    </Link>
  )
  if (error) return <>{back}<ErrorState message={error} onRetry={reload} /></>
  if (loading && !data) return <>{back}<Skeleton className="h-[560px] rounded-2xl" /></>
  if (!data) return <>{back}<p className="rounded-2xl border bg-white p-10 text-center font-medium">Conversation not found</p></>

  const staff = data.status === "staff_handling"

  async function run(fn: () => Promise<ConversationDetail>, ok: string) {
    setBusy(true)
    try {
      // TODO(backend): confirm hand-off mechanism exists / define API
      const next = await fn()
      setData(() => next)
      toast.success(ok)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText("")
    try {
      const m = await sendStaffMessage(id, t)
      setData((prev) => prev && { ...prev, messages: [...prev.messages, m] })
    } catch (err) {
      setText(t)
      toast.error(err instanceof Error ? err.message : "Message failed to send")
    }
  }

  return (
    <>
      {back}
      <div className="flex h-[calc(100vh-11rem)] min-h-[480px] flex-col rounded-2xl border bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{data.guestLabel}</h1>
            <Link href={`/guests/${data.guestId}`} className="text-sm text-muted-foreground hover:underline">View guest profile</Link>
          </div>
          <ConversationStatusPill status={data.status} />
          {staff ? (
            <Button variant="outline" className="rounded-xl" disabled={busy} onClick={() => run(() => handBackToAi(id), "Handed back to AI")}>
              <Bot /> Hand back to AI
            </Button>
          ) : (
            <Button className="rounded-xl" disabled={busy} onClick={() => run(() => takeOverConversation(id), "You're now handling this conversation")}>
              <HandHelping /> Take over from AI
            </Button>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
          {data.messages.map((m) => (
            <div key={m.id} className={cn("flex max-w-[78%] flex-col gap-1", m.sender === "guest" ? "mr-auto items-start" : "ml-auto items-end")}>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {m.sender === "guest" ? <User className="size-3" /> : m.sender === "ai" ? <Bot className="size-3" /> : <HandHelping className="size-3" />}
                {senderLabel[m.sender]} · {formatTime(m.sentAt)}
              </span>
              <p className={cn("rounded-2xl px-4 py-2.5 text-sm", bubble[m.sender])}>{m.text}</p>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {staff ? (
          <form onSubmit={send} className="flex gap-2 border-t p-4">
            <label htmlFor="reply" className="sr-only">Reply to guest</label>
            <input id="reply" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a reply as staff…" className="h-11 flex-1 rounded-full border px-4 text-sm outline-none focus-visible:border-slate-900 focus-visible:ring-3 focus-visible:ring-slate-900/15" />
            <button type="submit" aria-label="Send reply" disabled={!text.trim()} className="flex size-11 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-40"><Send className="size-4" /></button>
          </form>
        ) : (
          <p className="border-t px-5 py-4 text-center text-sm text-muted-foreground">
            {data.status === "needs_attention" ? "The AI has flagged this conversation for a human. Take over to reply." : "The AI receptionist is handling this conversation. Take over to reply yourself."}
          </p>
        )}
      </div>
    </>
  )
}
