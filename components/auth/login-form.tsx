"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginCredentialsSchema } from "@/lib/api/auth-schemas"
import { useLogin } from "@/lib/auth/auth.hooks"

function getLoginErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    switch (error.code) {
      case "INVALID_CREDENTIALS":
        return "Email or password is incorrect."
      case "LOGIN_CLEANUP_FAILED":
        return "Sign-in could not be completed and session cleanup could not be confirmed. Please contact support before retrying."
      default:
        return "Unable to sign in. Check your connection and try again."
    }
  }

  return "Unable to sign in. Check your connection and try again."
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const loginMutation = useLogin()

  const login = useLogin();

async function onSubmit(e: React.FormEvent) {
  e.preventDefault();

  try {
    await login.mutateAsync({ email, password });

    router.replace("/dashboard");
    router.refresh();
  } catch {
    // React Query exposes the error through login.isError.
  }
}



  useEffect(() => {
    if (loginMutation.isSuccess) router.replace("/dashboard")
  }, [loginMutation.isSuccess, router])

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
            <Input id="email" type="email" autoComplete="email" placeholder="you@yourhotel.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 rounded-xl" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 rounded-xl" required />
          </div>
          {login.isError && (
  <p role="alert" className="text-sm text-red-600">
    Unable to sign in. Check your credentials.
  </p>
)}
          <Button
  type="submit"
  disabled={login.isPending}
  className="h-10 w-full rounded-xl"
>
  {login.isPending ? "Signing in…" : "Sign in"}
</Button>
        </form>
      </div>
    </div>
  )
}
