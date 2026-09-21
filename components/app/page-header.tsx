/** Full-bleed pale title band (Marketing Ops style) that sits directly under the top nav. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="relative left-1/2 -mt-8 mb-6 w-screen -translate-x-1/2 border-b bg-[#f7f8fd]">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-[15px] text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
