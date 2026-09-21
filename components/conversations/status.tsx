import { StatusPill } from "@/components/app/status-pill"
import type { ConversationStatus } from "@/lib/api/conversations"

export function ConversationStatusPill({ status }: { status: ConversationStatus }) {
  if (status === "needs_attention") return <StatusPill tone="warning">Needs attention</StatusPill>
  if (status === "staff_handling") return <StatusPill tone="progress">Staff handling</StatusPill>
  return <StatusPill tone="neutral">AI handling</StatusPill>
}
