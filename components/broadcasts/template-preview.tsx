"use client"

import { useState } from "react"
import { FileText, Phone, Reply, ExternalLink, ImageIcon, Video, ShoppingBag } from "lucide-react"
import { PhoneFrame, WaBubble } from "@/components/app/phone-frame"
import { extractVariables, renderTemplateText, type TemplateCategory, type TemplateHeader, type TemplateButton, type HeaderType } from "@/lib/api/broadcasts"
import type { CatalogueItem } from "@/lib/api/catalogue"

function formattedText(text: string) {
  return text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((part, index) => {
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <strong key={index}>{part.slice(1, -1)}</strong>
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>
    return part
  })
}

function ProductImage({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState(false)
  return url && /^https?:\/\//i.test(url) && !failed
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt="" className="size-12 shrink-0 rounded-md object-cover" onError={() => setFailed(true)} />
    : <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-slate-100"><ShoppingBag className="size-5 text-slate-400" aria-hidden /></span>
}

function previewSource(value: string | undefined, type: HeaderType) {
  if (!value) return false
  if (/^(https?:\/\/|\/(?!\/)|blob:)/i.test(value)) return true
  return type === "IMAGE" ? /^data:image\//i.test(value) : type === "VIDEO" ? /^data:video\//i.test(value) : false
}

function MediaHeader({ type, source }: { type: HeaderType; source?: string }) {
  const [failed, setFailed] = useState(false)
  const HeaderIcon = type === "IMAGE" ? ImageIcon : type === "VIDEO" ? Video : FileText

  return (
    <div className="mb-2 flex min-h-24 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-xs text-slate-500">
      {type === "IMAGE" && source && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} alt="Template header" className="max-h-60 max-w-full object-contain" onError={() => setFailed(true)} />
      ) : type === "VIDEO" && source && !failed ? (
        <video src={source} controls preload="metadata" className="max-h-60 max-w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="flex items-center gap-1.5 p-3"><HeaderIcon className="size-4" aria-hidden /> {type.toLowerCase()} preview unavailable</span>
      )}
    </div>
  )
}

export function TemplatePreview({ header, body, footer, buttons, values = {}, headerValues, bodyValues, buttonUrlValues, businessName = "Business account", mode = "mobile", showComposer = false, catalogProducts, catalogStatus, productMode = "catalog" }: { category: TemplateCategory; header: TemplateHeader | null; body: string; footer: string | null; buttons: TemplateButton[]; values?: Record<string, string>; headerValues?: Record<string, string>; bodyValues?: Record<string, string>; buttonUrlValues?: Record<number, Record<string, string>>; businessName?: string; mode?: "mobile" | "web"; showComposer?: boolean; catalogProducts?: CatalogueItem[]; catalogStatus?: "loading" | "error" | "ready"; productMode?: "catalog" | "selected" }) {
  const mediaSource = header ? [header.mediaUrl, header.mediaSample].find((value) => previewSource(value, header.type)) : undefined
  return (
    <PhoneFrame title={businessName} subtitle="Business account" mode={mode} showComposer={showComposer}>
      <div className={mode === "web" ? "max-w-[75%] min-w-0" : "max-w-[92%] min-w-0"}>
        <WaBubble>
          {header && (header.type === "TEXT" ? (
            header.text && <p className="mb-1 whitespace-pre-wrap font-semibold">{formattedText(renderTemplateText(header.text, headerValues ?? values))}</p>
          ) : (
            <MediaHeader key={`${header.type}:${mediaSource ?? ""}`} type={header.type} source={mediaSource} />
          ))}
          <p className="whitespace-pre-wrap break-words">{body.trim() ? formattedText(renderTemplateText(body, bodyValues ?? values)) : <span className="text-slate-400">Your message body…</span>}</p>
          {footer && <p className="mt-1 whitespace-pre-wrap text-[11px] text-slate-500">{footer}</p>}
          {catalogStatus && <div className="mt-3 border-t border-slate-100 pt-2">
            {catalogStatus === "ready" && catalogProducts?.length ? (
              <div className={productMode === "selected" ? "max-h-64 space-y-2 overflow-y-auto" : "space-y-2"}>
                {productMode === "selected" && <p className="text-[11px] font-medium text-slate-500">Selected products · {catalogProducts.length}</p>}
                {catalogProducts.slice(0, productMode === "selected" ? 30 : 2).map((product) => (
                <div key={product.productId} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-100 p-1.5">
                  <ProductImage url={product.imageUrl} />
                  <div className="min-w-0"><p className="truncate font-medium">{product.name}</p>{product.price && <p className="text-[11px] text-slate-500">{product.price} {product.currency}</p>}</div>
                </div>
              ))}</div>
            ) : <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><ShoppingBag className="size-3.5" aria-hidden />{catalogStatus === "loading" ? "Loading catalog products…" : catalogStatus === "error" ? "Catalog products unavailable" : productMode === "selected" ? "Select products to preview" : "No catalog products available"}</p>}
          </div>}
        </WaBubble>
        {buttons.map((b, i) => {
          if (!b.text.trim()) return null
          const Icon = b.type === "CATALOG" || b.type === "MPM" ? ShoppingBag : b.type === "URL" ? ExternalLink : b.type === "PHONE_NUMBER" ? Phone : Reply
          const previewUrl = buttonUrlValues && b.type === "URL" && b.url && extractVariables(b.url).length
            ? renderTemplateText(b.url, buttonUrlValues?.[i] ?? values)
            : null
          return (
            <div key={i}>
              <div className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-xs font-medium text-sky-700 shadow-sm">
                <Icon className="size-3.5" /> {b.text}
              </div>
              {previewUrl && <p className="mt-1 break-all px-2 text-[10px] text-slate-600">Preview URL: {previewUrl}</p>}
            </div>
          )
        })}
      </div>
    </PhoneFrame>
  )
}
