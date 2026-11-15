"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { getWabaConnection, registerWaba } from "@/lib/api/waba"

const whatsappConnectionKey = ["whatsapp", "connection"] as const

export function WabaVerificationGate() {
  const [pin, setPin] = useState("")
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: whatsappConnectionKey,
    queryFn: getWabaConnection,
  })

  const registerMutation = useMutation({
    mutationFn: registerWaba,
    onSuccess: (connection) => {
      queryClient.setQueryData(whatsappConnectionKey, connection)
      setPin("")

      if (connection.status === "CONNECTED") {
        toast.success("WhatsApp connected")
      } else if (connection.status === "NOT_CONNECTED") {
        toast.error("That PIN could not verify your WhatsApp account. Try again.")
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Couldn't verify WhatsApp")
    },
  })

  return (
    <Dialog open={data?.status === "UNVERIFIED"}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Verify your WhatsApp account</DialogTitle>
          <DialogDescription>
            Enter the six-digit WhatsApp PIN for this account. No SMS or voice code is needed.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (/^\d{6}$/.test(pin) && !registerMutation.isPending) {
              registerMutation.mutate(pin)
            }
          }}
          className="space-y-4"
        >
          <Input
            autoFocus
            aria-label="Six-digit WhatsApp PIN"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            className="h-12 text-center font-mono text-xl tracking-[0.5em]"
            disabled={registerMutation.isPending}
            required
          />
          <DialogFooter className="-mx-4 -mb-4">
            <Button type="submit" disabled={pin.length !== 6 || registerMutation.isPending}>
              {registerMutation.isPending ? <Loader2 className="animate-spin" /> : null}
              {registerMutation.isPending ? "Verifying…" : "Verify PIN"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
