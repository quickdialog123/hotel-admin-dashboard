import { signOut } from "@/auth"
import { endBackendSession } from "@/lib/server/refresh-manager"
import { backendCredentialsFromRequest } from "@/lib/server/auth-session"
import { getServerEnv } from "@/lib/server/env"
import { NestApiError } from "@/lib/server/nest-api"

export const runtime = "nodejs"

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("origin") !== getServerEnv().FRONTEND_ORIGIN) {
    return Response.json(
      { statusCode: 403, code: "FORBIDDEN", message: "Forbidden" },
      { status: 403 },
    )
  }

  const credentials = await backendCredentialsFromRequest(request)
  if (credentials) {
    try {
      if (!await endBackendSession(credentials)) {
        await signOut({ redirect: false })
        return Response.json(
          { statusCode: 409, code: "SESSION_REPLACED", message: "Session changed" },
          { status: 409 },
        )
      }
    } catch (error) {
      if (!(error instanceof NestApiError && error.status === 401)) {
        // Remote revocation is uncertain, but local credentials must not survive.
        await signOut({ redirect: false })
        console.error("Backend logout could not be confirmed", {
          status: error instanceof NestApiError ? error.status : undefined,
        })

        return Response.json(
          {
            statusCode: 503,
            code: "LOGOUT_UNCONFIRMED",
            message: "Could not confirm sign out. Please try again.",
          },
          { status: 503 },
        )
      }
    }
  }

  await signOut({ redirect: false })
  return new Response(null, { status: 204 })
}
