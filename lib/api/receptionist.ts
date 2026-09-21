import { clone, delay, newId } from "./_mock"

/**
 * TODO(backend): confirm whether multiple named receptionist personas will
 * ever be supported, or whether this stays single-agent-per-property.
 * The UI enforces one receptionist per property for v1.
 */
export type Receptionist = {
  id: string
  name: string
  description: string
  /** System prompt. May contain {{hotel_name}}-style placeholders. */
  systemPrompt: string
  model: string
  /** LLM temperature, 0.0–1.0 (labelled "Creativity" in the UI) */
  temperature: number
  active: boolean
  /** IDs of KnowledgeSource records this receptionist draws on */
  knowledgeSourceIds: string[]
}

export type ReceptionistInput = Omit<Receptionist, "id" | "model" | "active"> & { model?: string; active?: boolean }

export const DEFAULT_SYSTEM_PROMPT =
  "You are the AI receptionist for {{hotel_name}}. Be warm, concise, and offer to connect the guest with the front desk whenever you're unsure."

let current: Receptionist | null = {
  id: "rec_1",
  name: "Harbour House Receptionist",
  description: "Friendly, concise concierge for in-house guests.",
  systemPrompt: DEFAULT_SYSTEM_PROMPT + " Always confirm room service orders back to the guest before placing them.",
  model: "claude-sonnet-5",
  temperature: 0.4,
  active: true,
  knowledgeSourceIds: ["kb_1", "kb_2", "kb_3"],
}

export async function listReceptionists(): Promise<Receptionist[]> {
  return delay(clone(current ? [current] : []))
}

export async function createReceptionist(input: ReceptionistInput): Promise<Receptionist> {
  if (current) throw new Error("This property already has a receptionist. Disable or delete it first.")
  current = { model: "claude-sonnet-5", active: true, ...input, id: newId("rec") }
  return delay(clone(current))
}

export async function updateReceptionist(id: string, input: Partial<Omit<Receptionist, "id">>): Promise<Receptionist> {
  if (!current || current.id !== id) throw new Error("Receptionist not found")
  current = { ...current, ...input }
  return delay(clone(current))
}

export async function deleteReceptionist(id: string): Promise<void> {
  if (current?.id === id) current = null
  return delay(undefined)
}
