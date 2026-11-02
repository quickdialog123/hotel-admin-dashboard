"use server"

import { AuthError } from "next-auth"

import { signIn } from "@/auth"

export async function loginAction(
  formData: FormData,
): Promise<{ redirectTo: string } | { error: string }> {
  try {
    const redirectTo = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
      redirect: false,
    })

    return {
      redirectTo: typeof redirectTo === "string" ? redirectTo : "/dashboard",
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Sign in failed. Check your credentials or try again later." }
    }
    throw error
  }
}
