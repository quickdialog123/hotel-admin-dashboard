"use server"

import { AuthError } from "next-auth"

import { signIn } from "@/auth"

export async function loginAction(
  _previousError: string | null,
  formData: FormData,
): Promise<string | null> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return "Sign in failed. Check your credentials or try again later."
    }
    throw error
  }

  return null
}
