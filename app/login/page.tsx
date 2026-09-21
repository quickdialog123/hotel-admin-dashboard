"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    // TODO(backend): replace with real auth
    setTimeout(() => router.push("/dashboard"), 500)
  }

  return (
    <div className="app-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white"><Sparkles className="size-6" aria-hidden /></span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your AI receptionist</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-white p-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@yourhotel.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <Button type="submit" disabled={busy} className="h-10 w-full rounded-xl">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Demo build — any email and password will work.</p>
        </form>
      </div>
    </div>
  )
}
