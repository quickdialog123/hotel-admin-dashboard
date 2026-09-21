import type { PillTone } from "@/components/app/status-pill"
import type { BroadcastStatus } from "@/lib/api/broadcasts"

export const BROADCAST_TONE: Record<BroadcastStatus, PillTone> = { SENT: "solid", SENDING: "progress", FAILED: "error" }
export const BROADCAST_LABEL: Record<BroadcastStatus, string> = { SENT: "Sent", SENDING: "Sending", FAILED: "Failed" }
