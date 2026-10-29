import { TopNav } from "@/components/app/top-nav"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect("/login")

  return (
    <div className="app-bg min-h-screen overflow-x-clip">
      <TopNav />
      <main className="mx-auto w-full max-w-[1680px] px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
