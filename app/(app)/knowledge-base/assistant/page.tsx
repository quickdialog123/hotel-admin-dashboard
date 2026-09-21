"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, ArrowUp, Loader2, Sparkles } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"
import { buttonVariants } from "@/components/ui/button"
import { createSourcesFromProfile } from "@/lib/api/knowledgeBase"
import { cn } from "@/lib/utils"

// TODO(backend): wire to real content-generation/AI service
// The questions, replies and "capturing…" delays below are all scripted.
const SECTIONS = [
  {
    key: "basics",
    hint: "Name, location & timings",
    title: "Property basics",
    questions: ["Hi! I'll help set up your receptionist's knowledge. What's the name of your hotel, and where is it?", "Great. What are your check-in and check-out times?"],
  },
  { key: "amenities",
    hint: "Room service, spa, pool", title: "Amenities", questions: ["Do you offer room service, a spa, a pool or a gym? Tell me about what's available and the opening hours."] },
  { key: "policies",
    hint: "Cancellation, pets, smoking", title: "Policies", questions: ["What are your main policies — cancellation, pets, smoking, children, late checkout?"] },
  { key: "local",
    hint: "Nearby places to visit", title: "Local recommendations", questions: ["What would you recommend guests do nearby? Restaurants, sights, transport…"] },
  { key: "contact",
    hint: "When to hand off to staff", title: "Contact & escalation", questions: ["When should the receptionist hand a guest over to your team, and who should they contact (name, phone or email)?"] },
  { key: "tone",
    hint: "How the receptionist sounds", title: "Tone of voice", questions: ["Last one: how should the receptionist sound? (e.g. warm and playful, polished and formal)"] },
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
      <PageHeader
        title="AI Setup Assistant"
        description="Describe your property and answer a few questions — I'll turn it into Knowledge Base entries."
        actions={
          <Link href="/knowledge-base" className={buttonVariants({ variant: "outline", className: "h-9 rounded-lg bg-white" })}>
            <ArrowLeft /> Knowledge Base
          </Link>
        }
      />

      <div className="grid gap-4 lg:h-[calc(100vh-15rem)] lg:min-h-[520px] lg:grid-cols-[1fr_420px]">
        <section aria-label="Chat" className="flex h-[560px] min-h-0 flex-col overflow-hidden rounded-2xl border bg-[#f1f4f9] lg:h-auto">
          <div className="flex-1 space-y-4 overflow-y-auto p-6" aria-live="polite">
            {bubbles.map((b, i) =>
              b.from === "ai" ? (
                <div key={i} className="flex max-w-[80%] items-start gap-3">
                  <Avatar />
                  <div className="rounded-2xl rounded-tl-md border bg-white px-4 py-2.5 text-[15px] shadow-sm">{b.text}</div>
                </div>
              ) : (
                <div key={i} className="ml-auto w-fit max-w-[80%] rounded-2xl bg-slate-900 px-5 py-3 text-[15px] text-white">
                  {b.text}
                </div>
              ),
            )}
            {thinking && (
              <div className="flex items-center gap-3" role="status" aria-label="Assistant is typing">
                <Avatar />
                <div className="flex items-center gap-1.5 rounded-full border bg-white px-4 py-3 shadow-sm">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="size-1.5 animate-pulse rounded-full bg-slate-400" style={{ animationDelay: `${d * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="flex gap-3 border-t bg-white p-4">
            <label htmlFor="assistant-input" className="sr-only">
              Your answer
            </label>
            <input
              id="assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={done || thinking}
              placeholder={done ? "All done!" : "Type your answer..."}
              className="h-12 flex-1 rounded-xl border bg-[#f6f8fb] px-4 text-[15px] outline-none placeholder:text-slate-400 focus-visible:border-slate-900 focus-visible:ring-3 focus-visible:ring-indigo-500/20 disabled:opacity-60"
            />
            <button type="submit" aria-label="Send" disabled={!input.trim() || thinking || done} className="flex size-12 items-center justify-center rounded-xl bg-slate-900 text-white transition-colors disabled:bg-slate-300">
              <ArrowUp className="size-5" />
            </button>
          </form>
        </section>

        <aside aria-label="Knowledge profile" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-white">
          <div className="p-6 pb-5">
            <p className="text-xs font-medium tracking-[0.12em] text-slate-500 uppercase">Knowledge profile so far</p>
            <h2 className="mt-2 text-xl font-semibold">New property profile</h2>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={capturedCount} aria-valuemin={0} aria-valuemax={SECTIONS.length} aria-label="Sections captured">
              <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${(capturedCount / SECTIONS.length) * 100}%` }} />
            </div>
            <p className="mt-3 text-sm text-slate-500">
              {capturedCount} of {SECTIONS.length} sections captured
            </p>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto border-t px-4 py-4">
            {SECTIONS.map((s) => {
              const captured = (answers[s.key]?.length ?? 0) >= s.questions.length
              const current = currentSection === s.key
              return (
                <li key={s.key} className={cn("flex gap-3 rounded-xl px-3 py-3 transition-colors", current && "bg-slate-50")}>
                  <span className={cn("mt-1 flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]", captured ? "border-slate-900 bg-slate-900" : current ? "border-slate-900" : "border-slate-300")}>
                    {captured && <span className="size-1.5 rounded-full bg-white" />}
                  </span>
                  <div className="min-w-0">
                    <p className={cn("text-[17px] leading-snug", captured || current ? "font-medium text-slate-900" : "text-slate-400")}>{s.title}</p>
                    <p className={cn("mt-0.5 text-sm italic", captured || current ? "text-slate-500" : "text-slate-400")}>{captured && answers[s.key] ? answers[s.key].join(" · ") : s.hint}</p>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="border-t p-4">
            <button type="button" disabled={!done || thinking || saving} onClick={finish} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-medium text-white transition-colors disabled:bg-slate-300">
              {saving && <Loader2 className="size-4 animate-spin" />} Create draft entries
            </button>
          </div>
        </aside>
      </div>
    </>
  )
}

function Avatar() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white" aria-hidden>
      <Sparkles className="size-[18px]" />
    </span>
  )
}
