import { StatusPill } from "@/components/app/status-pill"

/** Compact row of metadata tags; shows the first `max` and a "+N" overflow pill. */
export function TagList({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (tags.length === 0) return null
  const shown = tags.slice(0, max)
  const extra = tags.length - shown.length
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Tags">
      {shown.map((t) => (
        <li key={t}>
          <StatusPill tone="neutral" className="px-2 py-0 text-[11px]">{t}</StatusPill>
        </li>
      ))}
      {extra > 0 && (
        <li>
          <StatusPill tone="outline" className="px-2 py-0 text-[11px]">+{extra}</StatusPill>
        </li>
      )}
    </ul>
  )
}
