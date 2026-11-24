import { ChevronLeft, MoreVertical, Phone, Plus, Smile, Video } from "lucide-react"
import { cn } from "@/lib/utils"

/** Simple phone-frame illustration with a WhatsApp-style header, used for live previews. */
export function PhoneFrame({ title = "Hotel", subtitle = "Business account", children, className, mode = "mobile", showComposer = false }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string; mode?: "mobile" | "web"; showComposer?: boolean }) {
  const web = mode === "web"
  return (
    <div className={cn("mx-auto w-full shadow-sm", web ? "overflow-hidden rounded-xl border border-slate-200" : "max-w-[300px] rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-900", className)}>
      <div className={cn("overflow-hidden bg-[#ece5dd]", !web && "rounded-[2rem]")}>
        <div className={cn("flex items-center gap-2 px-3 py-2.5 text-white", web ? "bg-[#075e54]" : "bg-slate-900")}>
          {!web && <ChevronLeft className="size-4" aria-hidden />}
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold" aria-hidden>{title.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "B"}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-semibold">{title}</p>
            <p className="truncate text-[10px] text-slate-400">{subtitle}</p>
          </div>
          <Video className="size-4 text-white/70" aria-hidden />
          <Phone className="size-3.5 text-white/70" aria-hidden />
          {web && <MoreVertical className="size-4 text-white/70" aria-hidden />}
        </div>
        <div className={cn("min-h-[300px] space-y-2 bg-[radial-gradient(circle_at_15%_25%,rgba(255,255,255,.32)_0_1px,transparent_2px),radial-gradient(circle_at_78%_70%,rgba(147,130,105,.13)_0_1px,transparent_2px)] bg-size-[28px_28px,40px_40px] p-3", web && "min-h-[340px] p-5")}>{children}</div>
        {showComposer && <div className="flex items-center gap-2 bg-[#f0f2f5] px-3 py-2 text-slate-500" aria-label="Message input preview">
          <Smile className="size-4 shrink-0" aria-hidden />
          <Plus className="size-4 shrink-0" aria-hidden />
          <div className="flex-1 rounded-full bg-white px-3 py-2 text-xs text-slate-400">Message</div>
        </div>}
      </div>
    </div>
  )
}

export function WaBubble({ children, time = "09:41", className }: { children: React.ReactNode; time?: string; className?: string }) {
  return (
    <div className={cn("max-w-[92%] rounded-xl rounded-tl-none bg-white px-3 py-2 text-[13px] leading-snug text-slate-900 shadow-sm", className)}>
      {children}
      <p className="mt-1 text-right text-[10px] text-slate-400">{time}</p>
    </div>
  )
}
