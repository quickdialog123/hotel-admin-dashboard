"use client"

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-lg font-semibold">We couldn’t load this page</h2>
      <p className="text-sm text-muted-foreground">
        Please try again. If your session expired, sign in again to continue.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Try again
      </button>
    </div>
  )
}
