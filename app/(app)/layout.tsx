import { TopNav } from "@/components/app/top-nav"

// TODO(backend): protect this route group with real auth (redirect to /login when unauthenticated).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
