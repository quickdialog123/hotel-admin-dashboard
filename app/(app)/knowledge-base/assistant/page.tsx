"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, ArrowUp, Check, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { createSourcesFromProfile } from "@/lib/api/knowledgeBase"
import { cn } from "@/lib/utils"

// TODO(backend): wire to real content-generation/AI service
// The questions, replies and "capturing…" delays below are all scripted.
const SECTIONS = [
  {
    key: "basics",
    title: "Property basics",
    questions: ["Hi! I'll help set up your receptionist's knowledge. What's the name of your hotel, and where is it?", "Great. What are your check-in and check-out times?"],
  },
  { key: "amenities", title: "Amenities", questions: ["Do you offer room service, a spa, a pool or a gym? Tell me about what's available and the opening hours."] },
  { key: "policies", title: "Policies", questions: ["What are your main policies — cancellation, pets, smoking, children, late checkout?"] },
  { key: "local", title: "Local recommendations", questions: ["What would you recommend guests do nearby? Restaurants, sights, transport…"] },
  { key: "contact", title: "Contact & escalation", questions: ["When should the receptionist hand a guest over to your team, and who should they contact (name, phone or email)?"] },
  { key: "tone", title: "Tone of voice", questions: ["Last one: how should the receptionist sound? (e.g. warm and playful, polished and formal)"] },
]

// Flatten into a question queue with the section each answer belongs to.
const QUEUE = SECTIONS.flatMap((s) => s.questions.map((q) => ({ section: s.key, q })))

type Bubble = { from: "ai" | "user"; text: string }

export default function AssistantPage() {
  const router = useRouter()
  const [bubbles, setBubbles] = useState<Bubble[]>([{ from: "ai", text: QUEUE[0].q }])
  const [step, setStep] = useState(0) // index into QUEUE of the question being answered
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const [saving, setSaving] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const done = step >= QUEUE.length
  const currentSection = done ? null : QUEUE[step].section
  const capturedCount = SECTIONS.filter((s) => (answers[s.key]?.length ?? 0) >= s.questions.length).length

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [bubbles, thinking])

  function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || thinking || done) return
    const section = QUEUE[step].section
    setBubbles((b) => [...b, { from: "user", text }])
    setAnswers((a) => ({ ...a, [section]: [...(a[section] ?? []), text] }))
    setInput("")
    setThinking(true)
    setTimeout(() => {
      const next = step + 1
      setStep(next)
      setThinking(false)
      setBubbles((b) => [
        ...b,
        {
          from: "ai",
          text: next < QUEUE.length ? QUEUE[next].q : "Thanks — that's everything I need. Review the profile on the right, then create your draft Knowledge Base entries.",
        },
      ])
    }, 900)
  }

  async function finish() {
    setSaving(true)
    try {
      const created = await createSourcesFromProfile(SECTIONS.map((s) => ({ key: s.key, title: s.title, content: (answers[s.key] ?? []).join("\n\n") })))
      toast.success(`${created.length} draft entries added to your Knowledge Base`)
      router.push("/knowledge-base")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create entries")
      setSaving(false)
    }
  }

  return (
    <>
      <Link href="/knowledge-base" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Knowledge Base
      </Link>
      <PageHeader title="AI Setup Assistant" description="Answer a few short questions and we'll draft your Knowledge Base for you." />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-label="Chat" className="flex h-[600px] flex-col rounded-3xl border bg-white">
          <div className="flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">
            {bubbles.map((b, i) => (
              <div key={i} className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm", b.from === "ai" ? "rounded-bl-md bg-zinc-100" : "ml-auto rounded-br-md bg-zinc-900 text-white")}>
                {b.text}
              </div>
            ))}
            {thinking && (
              <div className="flex max-w-[80%] items-center gap-2 rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Capturing your profile…
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t p-4">
            <label htmlFor="assistant-input" className="sr-only">
              Your answer
            </label>
            <input
              id="assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={done || thinking}
              placeholder={done ? "All done!" : "Type your answer…"}
              className="h-11 flex-1 rounded-full border px-4 text-sm outline-none focus-visible:border-zinc-900 focus-visible:ring-3 focus-visible:ring-zinc-900/15 disabled:bg-zinc-50"
            />
            <button type="submit" aria-label="Send" disabled={!input.trim() || thinking || done} className="flex size-11 items-center justify-center rounded-full bg-zinc-900 text-white transition-opacity disabled:opacity-40">
              <ArrowUp className="size-4" />
            </button>
          </form>
        </section>

        <aside aria-label="Knowledge profile" className="h-fit rounded-3xl border bg-white p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Knowledge Profile</h2>
            <span className="text-sm text-muted-foreground">
              {capturedCount} of {SECTIONS.length} captured
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={capturedCount} aria-valuemin={0} aria-valuemax={SECTIONS.length}>
            <div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${(capturedCount / SECTIONS.length) * 100}%` }} />
          </div>
          <ul className="mt-5 space-y-2">
            {SECTIONS.map((s) => {
              const captured = (answers[s.key]?.length ?? 0) >= s.questions.length
              const current = currentSection === s.key
              return (
                <li key={s.key} className={cn("rounded-2xl border p-3 transition-colors", current && "border-zinc-900 bg-zinc-50")}>
                  <div className="flex items-center gap-2.5">
                    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", captured ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300")}>{captured && <Check className="size-3" />}</span>
                    <span className={cn("text-sm", captured || current ? "font-medium" : "text-muted-foreground")}>{s.title}</span>
                    {current && <span className="ml-auto text-xs text-muted-foreground">Answering…</span>}
                  </div>
                  {answers[s.key] && <p className="mt-2 line-clamp-2 pl-7 text-xs text-muted-foreground">{answers[s.key].join(" · ")}</p>}
                </li>
              )
            })}
          </ul>
          <Button className="mt-5 h-10 w-full rounded-xl" disabled={!done || thinking || saving} onClick={finish}>
            {saving ? <Loader2 className="animate-spin" /> : null} Create draft entries
          </Button>
        </aside>
      </div>
    </>
  )
}
