import type { CurrentUser } from "@/lib/api/auth-schemas"

declare module "next-auth" {
  interface User extends CurrentUser {
    accessToken: string
  }

  interface Session {
    accessToken: string
    user: CurrentUser
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    backendAuth?: {
      accessToken: string
      user: CurrentUser
    }
  }
}
