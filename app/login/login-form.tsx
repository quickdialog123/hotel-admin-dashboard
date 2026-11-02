"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction } from "@/app/login/actions"

export function LoginForm() {
  const router = useRouter()
  const loginMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const result = await loginAction(formData)
      if ("error" in result) throw new Error(result.error)
      return result.redirectTo
    },
    onSuccess: (redirectTo) => router.replace(redirectTo),
  })

  return (
    <div className="app-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to manage your AI receptionist
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            loginMutation.mutate(new FormData(event.currentTarget))
          }}
          className="space-y-4 rounded-2xl border bg-white p-6"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@yourhotel.com"
              required
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              className="h-10 rounded-xl"
            />
          </div>
          {loginMutation.error && (
            <p role="alert" className="text-sm text-red-600">
              {loginMutation.error.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={loginMutation.isPending || loginMutation.isSuccess}
            className="h-10 w-full rounded-xl"
          >
            {loginMutation.isPending || loginMutation.isSuccess ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  )
}
