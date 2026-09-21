import { ChevronLeft, Phone, Video } from "lucide-react"
import { cn } from "@/lib/utils"

/** Simple phone-frame illustration with a WhatsApp-style header, used for live previews. */
export function PhoneFrame({ title = "Hotel", subtitle = "Business account", children, className }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[300px] rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-900 shadow-sm", className)}>
      <div className="overflow-hidden rounded-[2rem] bg-[#ece5dd]">
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-2.5 text-white">
          <ChevronLeft className="size-4" aria-hidden />
          <span className="flex size-7 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold">{title[0]}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-semibold">{title}</p>
            <p className="truncate text-[10px] text-slate-400">{subtitle}</p>
          </div>
          <Video className="size-4 text-slate-300" aria-hidden />
          <Phone className="size-3.5 text-slate-300" aria-hidden />
        </div>
        <div className="min-h-[300px] space-y-2 p-3">{children}</div>
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
