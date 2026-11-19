import { getSession } from "next-auth/react"
import type { TemplateInput } from "./broadcasts"

async function key() {
  const session = await getSession()
  if (!session?.user.hotelId) throw new Error("Select a hotel before saving a draft")
  return `qd-template-drafts:${session.user.hotelId}:${session.user.userId}`
}

export type TemplateDraft = TemplateInput & { localId: string }
export async function listTemplateDrafts(): Promise<TemplateDraft[]> {
  const stored = localStorage.getItem(await key())
  return stored ? JSON.parse(stored) as TemplateDraft[] : []
}
export async function saveTemplateDraft(input: TemplateInput, localId = crypto.randomUUID()) {
  const drafts = await listTemplateDrafts()
  localStorage.setItem(await key(), JSON.stringify([{ ...input, localId }, ...drafts.filter((draft) => draft.localId !== localId)]))
  return localId
}
export async function deleteTemplateDraft(localId: string) {
  localStorage.setItem(await key(), JSON.stringify((await listTemplateDrafts()).filter((draft) => draft.localId !== localId)))
}
export async function getTemplateDraft(localId: string) {
  return (await listTemplateDrafts()).find((draft) => draft.localId === localId) ?? null
}
