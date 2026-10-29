import { signOut } from "@/auth"
import { refreshManager } from "@/lib/server/refresh-manager"
import { backendCredentialsFromRequest } from "@/lib/server/auth-session"
import { getServerEnv } from "@/lib/server/env"
import { logoutWithNest, NestApiError } from "@/lib/server/nest-api"

export const runtime = "nodejs"

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("origin") !== getServerEnv().FRONTEND_ORIGIN) {
    return Response.json(
      { statusCode: 403, code: "FORBIDDEN", message: "Forbidden" },
      { status: 403 },
    )
  }

  const credentials = await backendCredentialsFromRequest(request)
  let backendSessionRejected = false

  if (credentials) {
    try {
      await refreshManager.runSessionTransition(
        credentials.authSessionId,
        async (latest) => {
          let current = latest ?? credentials

          if (current.accessTokenExpiresAt <= Date.now() + 30_000) {
            current = await refreshManager.refresh(current, true)
          }

          try {
            await logoutWithNest(current)
          } catch (error) {
            if (!(error instanceof NestApiError) || error.status !== 401) {
              throw error
            }

            try {
              current = await refreshManager.refresh(current, true)
            } catch (refreshError) {
              if (refreshError instanceof NestApiError && refreshError.status === 401) {
                backendSessionRejected = true
                return
              }

              throw refreshError
            }

            await logoutWithNest(current)
          }

          refreshManager.invalidate(
            credentials.authSessionId,
            current.accessTokenExpiresAt + 60_000,
          )
        },
        credentials,
      )
    } catch (error) {
      if (!(error instanceof NestApiError && error.status === 401)) {
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

      backendSessionRejected = true
    }

    if (
      backendSessionRejected &&
      !refreshManager.isInvalidated(credentials.authSessionId)
    ) {
      refreshManager.invalidate(
        credentials.authSessionId,
        credentials.accessTokenExpiresAt + 60_000,
      )
    }
  }

  await signOut({ redirect: false })
  return new Response(null, { status: 204 })
}
