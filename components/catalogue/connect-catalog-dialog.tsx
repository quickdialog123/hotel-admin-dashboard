"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, ShoppingBag } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { connectWhatsAppCatalog, getAvailableCatalogs, getCatalogConnection } from "@/lib/api/catalogue"

const connectionKey = ["whatsapp", "catalog", "connection"] as const
const availableKey = ["whatsapp", "catalog", "available"] as const

export function ConnectCatalogDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const connection = useQuery({ queryKey: connectionKey, queryFn: getCatalogConnection, enabled: open })
  const available = useQuery({ queryKey: availableKey, queryFn: getAvailableCatalogs, enabled: open && connection.isSuccess && !connection.data.catalog })
  const connect = useMutation({
    mutationFn: connectWhatsAppCatalog,
    onSuccess: (result) => {
      queryClient.setQueryData(connectionKey, result)
      toast.success("Meta catalog connected")
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't connect catalog"),
  })

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Connect a catalog</DialogTitle>
        <DialogDescription>Select a Meta catalog for your WhatsApp Business Account.</DialogDescription>
      </DialogHeader>
      {connection.isPending ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Checking catalog connection…</p>
        : connection.isError ? <p role="alert" className="text-destructive">{connection.error.message}</p>
        : connection.data.catalog ? <p>Connected: <strong>{connection.data.catalog.name}</strong></p>
        : available.isPending ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading available catalogs…</p>
        : available.isError ? <p role="alert" className="text-destructive">{available.error.message}</p>
        : available.data.length === 0 ? <p className="text-muted-foreground">No catalogs available for this WhatsApp account.</p>
        : <div className="space-y-2">{available.data.map((catalog) => <div key={catalog.id} className="flex items-center gap-3 rounded-lg border p-3">
          <ShoppingBag className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1"><p className="truncate font-medium">{catalog.name}</p><p className="text-xs text-muted-foreground">{catalog.productCount} products</p></div>
          <Button type="button" disabled={connect.isPending} onClick={() => connect.mutate(catalog.id)}>{connect.isPending && connect.variables === catalog.id ? <Loader2 className="animate-spin" /> : null}Connect</Button>
        </div>)}</div>}
    </DialogContent>
  </Dialog>
}
