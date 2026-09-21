"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { BookOpen, FileText, Globe, Loader2, Pencil, Sparkles, Trash2, Upload, Wand2 } from "lucide-react"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { PageHeader } from "@/components/app/page-header"
import { StatusPill } from "@/components/app/status-pill"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  addWebsiteUrl,
  deleteKnowledgeSource,
  listKnowledgeSources,
  updateKnowledgeSource,
  uploadDocument,
  type KnowledgeSource,
} from "@/lib/api/knowledgeBase"
import { useAsync } from "@/lib/hooks/use-async"
import { formatDate } from "@/lib/format"

const statusTone = { processed: "solid", processing: "progress", failed: "error" } as const
const statusLabel = { processed: "Processed", processing: "Processing", failed: "Failed" } as const
const typeLabel = { document: "Word document", website: "Website", assistant: "AI-drafted" } as const

function isValidUrl(v: string) {
  try {
    const u = new URL(v.startsWith("http") ? v : `https://${v}`)
    return u.hostname.includes(".")
  } catch {
    return false
  }
}

export default function KnowledgeBasePage() {
  const { data, error, loading, reload } = useAsync(listKnowledgeSources)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [urlOpen, setUrlOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [urlBusy, setUrlBusy] = useState(false)
  const [toDelete, setToDelete] = useState<KnowledgeSource | null>(null)
  const [editing, setEditing] = useState<KnowledgeSource | null>(null)
  const [editText, setEditText] = useState("")

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast.error("Only .docx Word documents are supported")
      return
    }
    setUploading(true)
    try {
      await uploadDocument(file.name)
      toast.success(`Uploaded ${file.name}`)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function submitUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidUrl(url.trim())) return
    setUrlBusy(true)
    try {
      const full = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`
      await addWebsiteUrl(full)
      toast.success("Website added")
      setUrl("")
      setUrlOpen(false)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add website")
    } finally {
      setUrlBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Knowledge Base"
        description="Everything your AI receptionist knows about your property. Upload documents, add web pages, or let the setup assistant interview you."
        actions={
          <>
            <Link href="/knowledge-base/assistant" className={buttonVariants({ variant: "outline", className: "h-9 rounded-xl" })}>
              <Sparkles /> AI Setup Assistant
            </Link>
            <Button variant="outline" className="h-9 rounded-xl" onClick={() => setUrlOpen(true)}>
              <Globe /> Add website URL
            </Button>
            <Button className="h-9 rounded-xl" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Upload document
            </Button>
            <input ref={fileRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" tabIndex={-1} aria-label="Upload Word document" onChange={onFile} />
          </>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <ListSkeleton />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" />}
          title="Nothing here yet"
          description="Your receptionist doesn't know anything about your property. Upload a guest handbook, add your website, or try the AI Setup Assistant."
          action={
            <Link href="/knowledge-base/assistant" className={buttonVariants({ className: "rounded-xl" })}>
              <Wand2 /> Start AI Setup Assistant
            </Link>
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-3xl border bg-white">
          {data.map((s) => (
            <li key={s.id} className="flex items-center gap-4 border-b px-5 py-4 last:border-b-0">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                {s.type === "website" ? <Globe className="size-5" /> : s.type === "assistant" ? <Sparkles className="size-5" /> : <FileText className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {typeLabel[s.type]} · Added {formatDate(s.addedAt)}
                </p>
              </div>
              <StatusPill tone={statusTone[s.status]}>
                {s.status === "processing" && <Loader2 className="size-3 animate-spin" aria-hidden />}
                {statusLabel[s.status]}
              </StatusPill>
              {s.type === "assistant" && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${s.name}`}
                  onClick={() => {
                    setEditing(s)
                    setEditText(s.content ?? "")
                  }}
                >
                  <Pencil />
                </Button>
              )}
              <Button variant="ghost" size="icon" aria-label={`Delete ${s.name}`} onClick={() => setToDelete(s)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={urlOpen} onOpenChange={setUrlOpen}>
        <DialogContent>
          <form onSubmit={submitUrl} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add website URL</DialogTitle>
              <DialogDescription>We&apos;ll read the page and add it to your receptionist&apos;s knowledge.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="kb-url">Website address</Label>
              <Input id="kb-url" placeholder="https://yourhotel.com/dining" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus aria-invalid={url.length > 0 && !isValidUrl(url.trim())} />
              {url.length > 0 && !isValidUrl(url.trim()) && <p className="text-sm text-destructive">Enter a valid web address.</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUrlOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={urlBusy || !isValidUrl(url.trim())}>
                {urlBusy ? "Adding…" : "Add website"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
            <DialogDescription>Review and edit what the AI drafted from your answers.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="kb-edit" className="sr-only">
            Content
          </Label>
          <Textarea id="kb-edit" rows={10} value={editText} onChange={(e) => setEditText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!editing) return
                await updateKnowledgeSource(editing.id, { content: editText })
                toast.success("Saved")
                setEditing(null)
                reload()
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this source?"
        description={`"${toDelete?.name}" will be removed and your receptionist will no longer use it.`}
        onConfirm={async () => {
          if (!toDelete) return
          await deleteKnowledgeSource(toDelete.id)
          toast.success("Source deleted")
          reload()
        }}
      />
    </>
  )
}
