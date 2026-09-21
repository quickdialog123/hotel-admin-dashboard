import Link from "next/link"
import { ChevronRight } from "lucide-react"

/** Card wrapper that holds a vertical list of rows separated by hairlines. */
export function RowList({ children }: { children: React.ReactNode }) {
  return <ul className="overflow-hidden rounded-3xl border bg-white">{children}</ul>
}

/** Bold title, grey subtitle, right-aligned status, trailing chevron. */
export function ListRow({ href, title, subtitle, right, leading }: { href: string; title: React.ReactNode; subtitle: React.ReactNode; right?: React.ReactNode; leading?: React.ReactNode }) {
  return (
    <li className="border-b last:border-b-0">
      <Link href={href} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900/20">
        {leading}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{title}</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {right}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  )
}
