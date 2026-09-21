import { clone, delay, isoAgo, newId } from "./_mock"

export type KnowledgeSourceType = "document" | "website" | "assistant"
export type KnowledgeSourceStatus = "processed" | "processing" | "failed"

export type KnowledgeSource = {
  id: string
  name: string
  type: KnowledgeSourceType
  /** ISO timestamp */
  addedAt: string
  status: KnowledgeSourceStatus
  /** Website URL, when type === "website" */
  url?: string
  /** Drafted text content, when type === "assistant" (editable by staff) */
  content?: string
}

export type ProfileSection = {
  key: string
  title: string
  content: string
}

let sources: KnowledgeSource[] = [
  { id: "kb_1", name: "Guest Handbook 2026.docx", type: "document", addedAt: isoAgo(60 * 24 * 12), status: "processed" },
  { id: "kb_2", name: "Spa & Wellness Menu.docx", type: "document", addedAt: isoAgo(60 * 24 * 9), status: "processed" },
  { id: "kb_3", name: "https://harbourhouse.example/dining", type: "website", url: "https://harbourhouse.example/dining", addedAt: isoAgo(60 * 24 * 4), status: "processed" },
  { id: "kb_4", name: "https://harbourhouse.example/local-guide", type: "website", url: "https://harbourhouse.example/local-guide", addedAt: isoAgo(35), status: "processing" },
  { id: "kb_5", name: "Cancellation Policy (scan).docx", type: "document", addedAt: isoAgo(60 * 3), status: "failed" },
]

export async function listKnowledgeSources(): Promise<KnowledgeSource[]> {
  return delay(clone(sources))
}

// TODO(backend): upload the file (multipart) and return the created source.
export async function uploadDocument(fileName: string): Promise<KnowledgeSource> {
  const item: KnowledgeSource = { id: newId("kb"), name: fileName, type: "document", addedAt: new Date().toISOString(), status: "processing" }
  sources = [item, ...sources]
  return delay(clone(item))
}

export async function addWebsiteUrl(url: string): Promise<KnowledgeSource> {
  const item: KnowledgeSource = { id: newId("kb"), name: url, url, type: "website", addedAt: new Date().toISOString(), status: "processing" }
  sources = [item, ...sources]
  return delay(clone(item))
}

export async function deleteKnowledgeSource(id: string): Promise<void> {
  sources = sources.filter((s) => s.id !== id)
  return delay(undefined)
}

export async function updateKnowledgeSource(id: string, input: Partial<Pick<KnowledgeSource, "name" | "content">>): Promise<KnowledgeSource> {
  sources = sources.map((s) => (s.id === id ? { ...s, ...input } : s))
  return delay(clone(sources.find((s) => s.id === id)!))
}

// TODO(backend): wire to real content-generation/AI service
export async function createSourcesFromProfile(sections: ProfileSection[]): Promise<KnowledgeSource[]> {
  const created: KnowledgeSource[] = sections
    .filter((s) => s.content.trim())
    .map((s) => ({
      id: newId("kb"),
      name: `${s.title} (AI Setup Assistant draft)`,
      type: "assistant" as const,
      addedAt: new Date().toISOString(),
      status: "processed" as const,
      content: s.content,
    }))
  sources = [...created, ...sources]
  return delay(clone(created))
}
