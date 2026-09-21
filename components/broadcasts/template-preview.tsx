import { FileText, Phone, Reply, ExternalLink, ImageIcon, Video } from "lucide-react"
import { PhoneFrame, WaBubble } from "@/components/app/phone-frame"
import { MARKETING_OPT_OUT_LINE, renderTemplateText, type TemplateCategory, type TemplateHeader, type TemplateButton } from "@/lib/api/broadcasts"

export function TemplatePreview({ category, header, body, footer, buttons, values = {} }: { category: TemplateCategory; header: TemplateHeader | null; body: string; footer: string | null; buttons: TemplateButton[]; values?: Record<string, string> }) {
  const HeaderIcon = header?.type === "IMAGE" ? ImageIcon : header?.type === "VIDEO" ? Video : FileText
  return (
    <PhoneFrame title="The Harbour House" subtitle="Business account">
      <div className="max-w-[92%]">
        <WaBubble>
          {header && (header.type === "TEXT" ? (
            header.text && <p className="mb-1 font-semibold">{renderTemplateText(header.text, values)}</p>
          ) : (
            <div className="mb-2 flex h-24 items-center justify-center gap-1.5 rounded-lg bg-slate-100 text-xs text-slate-500">
              <HeaderIcon className="size-4" /> {header.mediaSample || `${header.type.toLowerCase()} header`}
            </div>
          ))}
          <p className="whitespace-pre-wrap">{body.trim() ? renderTemplateText(body, values) : <span className="text-slate-400">Your message body…</span>}</p>
          {footer && <p className="mt-1 text-[11px] text-slate-500">{footer}</p>}
          {category === "MARKETING" && <p className="mt-1 text-[11px] text-slate-500 italic">{MARKETING_OPT_OUT_LINE}</p>}
        </WaBubble>
        {buttons.filter((b) => b.text.trim()).map((b, i) => {
          const Icon = b.type === "URL" ? ExternalLink : b.type === "PHONE_NUMBER" ? Phone : Reply
          return (
            <div key={i} className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-xs font-medium text-sky-700 shadow-sm">
              <Icon className="size-3.5" /> {b.text}
            </div>
          )
        })}
      </div>
    </PhoneFrame>
  )
}
