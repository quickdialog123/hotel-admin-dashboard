"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Info, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { PageHeader } from "@/components/app/page-header"
import { ErrorState } from "@/components/app/states"
import { creativityLabel, ReceptionistWizard } from "@/components/receptionist/wizard"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { deleteReceptionist, listReceptionists, updateReceptionist, type Receptionist } from "@/lib/api/receptionist"
import { useAsync } from "@/lib/hooks/use-async"

export default function ReceptionistPage() {
  const { data, error, loading, reload, setData } = useAsync(listReceptionists)
  const [wizard, setWizard] = useState<{ existing: Receptionist | null } | null>(null)
  const [deleting, setDeleting] = useState<Receptionist | null>(null)

  if (wizard) {
    return (
      <ReceptionistWizard
        existing={wizard.existing}
        onCancel={() => setWizard(null)}
        onDone={() => {
          setWizard(null)
          reload()
        }}
      />
    )
  }

  const hasOne = (data?.length ?? 0) > 0

  return (
    <>
      <PageHeader title="AI Receptionist" description="Who your AI is and how it behaves." />

      {/* TODO(backend): confirm whether multiple named receptionist personas will ever be supported, or whether this stays single-agent-per-property */}
      <div className="mb-6 flex gap-3 rounded-2xl border bg-white p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p>
          <span className="font-medium">Add your AI receptionist:</span> configure its name, tone, and behavior. Each property can have one active receptionist at a time — disable or delete the current one to configure a replacement.
        </p>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : !hasOne ? (
        <button type="button" onClick={() => setWizard({ existing: null })} className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-white py-16 text-muted-foreground transition-colors outline-none hover:border-slate-900 hover:text-slate-900 focus-visible:border-slate-900 focus-visible:ring-3 focus-visible:ring-slate-900/20">
          <Plus className="size-6" />
          <span className="font-medium">Add AI Receptionist</span>
          <span className="text-sm">Set a name, tone and knowledge in three quick steps</span>
        </button>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                {["Name", "Persona summary", "Model", "Creativity", "Active"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
                <th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data!.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0 hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium">
                    {r.name}
                    {r.description && <p className="text-xs font-normal text-muted-foreground">{r.description}</p>}
                  </td>
                  <td className="max-w-xs px-4 py-4 text-muted-foreground"><p className="line-clamp-2">{r.systemPrompt}</p></td>
                  <td className="px-4 py-4 font-mono text-xs">{r.model}</td>
                  <td className="px-4 py-4">{creativityLabel(r.temperature)} <span className="text-muted-foreground tabular-nums">({r.temperature.toFixed(1)})</span></td>
                  <td className="px-4 py-4">
                    <Switch
                      aria-label={`${r.name} active`}
                      checked={r.active}
                      onCheckedChange={async (v) => {
                        setData((prev) => prev && prev.map((x) => (x.id === r.id ? { ...x, active: v } : x)))
                        try {
                          await updateReceptionist(r.id, { active: v })
                          toast.success(v ? "Receptionist enabled" : "Receptionist disabled — guests won't get AI replies")
                        } catch {
                          toast.error("Couldn't update")
                          reload()
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger aria-label={`Actions for ${r.name}`} className="flex size-8 items-center justify-center rounded-full outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-900/30">
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-2xl p-1.5">
                        <DropdownMenuItem className="rounded-xl" onClick={() => setWizard({ existing: r })}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" className="rounded-xl" onClick={() => setDeleting(r)}><Trash2 /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this receptionist?"
        description="Guests will stop receiving AI replies until you configure a new receptionist."
        onConfirm={async () => {
          if (!deleting) return
          await deleteReceptionist(deleting.id)
          toast.success("Receptionist deleted")
          reload()
        }}
      />
    </>
  )
}
