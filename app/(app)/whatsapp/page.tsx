"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, MessageCircle, RefreshCw, Unplug } from "lucide-react"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { ConnectionPill } from "@/components/app/connection-pill"
import { PageHeader } from "@/components/app/page-header"
import { StatusPill } from "@/components/app/status-pill"
import { ErrorState } from "@/components/app/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { connectWaba, disconnectWaba, getWabaConnection, simulateWabaError } from "@/lib/api/waba"
import { useAsync } from "@/lib/hooks/use-async"
import { formatDate } from "@/lib/format"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  )
}

export default function WhatsAppPage() {
  const { data, error, loading, reload, setData } = useAsync(getWabaConnection)
  const [connecting, setConnecting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  async function connect() {
    setConnecting(true)
    try {
      // TODO(backend): launch Meta's Embedded Signup and pass the returned code to the backend.
      const next = await connectWaba()
      setData(() => next)
      toast.success("WhatsApp connected")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't connect WhatsApp")
    } finally {
      setConnecting(false)
    }
  }

  return (
    <>
      <PageHeader title="WhatsApp Connection" description="Your receptionist only works while your WhatsApp Business Account is connected." />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="space-y-6">
          <div className={`rounded-2xl border p-8 ${data.status === "error" ? "border-red-200 bg-red-50/50" : "bg-white"}`}>
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <MessageCircle className="size-7" aria-hidden />
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1" role="status" aria-live="polite">
                    <ConnectionPill status={data.status} size="lg" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {data.status === "connected" ? (
                  <>
                    <Button variant="outline" onClick={connect} disabled={connecting}>
                      {connecting ? <Loader2 className="animate-spin" /> : <RefreshCw />} Reconnect
                    </Button>
                    <Button variant="outline" onClick={() => setConfirmDisconnect(true)}>
                      <Unplug /> Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="lg" className="h-10 rounded-xl px-5" onClick={connect} disabled={connecting}>
                    {connecting ? <Loader2 className="animate-spin" /> : <MessageCircle />}
                    {connecting ? "Connecting…" : data.status === "error" ? "Reconnect WhatsApp" : "Connect WhatsApp"}
                  </Button>
                )}
              </div>
            </div>

            {data.status === "error" && (
              <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-800">
                {data.errorMessage}
              </p>
            )}
            {data.status === "not_connected" && (
              <p className="mt-6 max-w-xl text-sm text-muted-foreground">
                Connect your WhatsApp Business Account through Meta&apos;s signup flow. Guests will be able to scan your QR code and chat with your AI receptionist as soon as it&apos;s connected.
              </p>
            )}
            {connecting && <p className="mt-6 text-sm text-muted-foreground">Waiting for Meta signup to complete…</p>}

            {data.status === "connected" && (
              <dl className="mt-8 grid gap-6 border-t pt-6 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="WhatsApp number">{data.phoneNumber}</Field>
                <Field label="Display name">{data.displayName}</Field>
                <Field label="WABA status">
                  <StatusPill tone={data.wabaStatus === "APPROVED" ? "solid" : "warning"}>{data.wabaStatus === "APPROVED" ? "Approved" : data.wabaStatus === "PENDING" ? "Pending" : "Restricted"}</StatusPill>
                </Field>
                <Field label="Connected since">{data.connectedAt && formatDate(data.connectedAt)}</Field>
                <Field label="WABA ID">
                  <span className="font-mono text-sm">{data.wabaId}</span>
                </Field>
                <Field label="Quality rating">
                  <StatusPill tone="neutral">{data.qualityRating === "GREEN" ? "High" : data.qualityRating === "YELLOW" ? "Medium" : "Low"}</StatusPill>
                </Field>
              </dl>
            )}
          </div>

          {data.status === "connected" && (
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-dashed bg-white p-5 text-sm">
              <div>
                <p className="font-medium">Demo tools</p>
                <p className="text-muted-foreground">Preview the error treatment staff would see if Meta rejects the connection.</p>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  const next = await simulateWabaError()
                  setData(() => next)
                }}
              >
                Simulate error
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Disconnect WhatsApp?"
        description="Your AI receptionist will stop replying to guests until you reconnect."
        confirmLabel="Disconnect"
        onConfirm={async () => {
          const next = await disconnectWaba()
          setData(() => next)
          toast.success("WhatsApp disconnected")
        }}
      />
    </>
  )
}
