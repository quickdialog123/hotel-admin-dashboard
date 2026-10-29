import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyBackendTokenUpdate,
  extractRefreshToken,
  signBackendTokenUpdate,
  verifyBackendTokenUpdate,
} from "../lib/auth/token-update.ts"
import { createRefreshCoordinator } from "../lib/auth/refresh-coordinator.ts"
import { publicSessionUser } from "../lib/auth/session-projection.ts"
import { clearAuthQueryCache } from "../lib/query/auth-cache.ts"
import { QueryClient } from "@tanstack/react-query"

const secret = "test-auth-secret-with-sufficient-entropy-123456"

function makeCredentials(authSessionId = "auth-session-1", tokenVersion = 0) {
  return {
    authSessionId,
    tokenVersion,
    backendSessionId: "4b510170-963b-4153-8357-eeb3dd8bc931",
    userId: "a334f34f-32ac-4d5d-91ae-e8fa7f6c80c4",
    hotelId: "bb008a62-b84b-4f8a-94d6-30847a09d1ef",
    role: "OWNER",
    accessToken: "access-old",
    refreshToken: "refresh-old",
    accessTokenExpiresAt: 1_900_000_000,
  }
}

function makeUpdate(credentials) {
  return {
    authSessionId: credentials.authSessionId,
    expectedVersion: credentials.tokenVersion,
    nextVersion: credentials.tokenVersion + 1,
    backendSessionId: "7b952453-a8f1-4331-9c48-6d57fd519461",
    userId: credentials.userId,
    hotelId: credentials.hotelId,
    role: credentials.role,
    accessToken: "access-new",
    refreshToken: "refresh-new",
    accessTokenExpiresAt: 1_900_000_100,
  }
}

test("extracts only the Nest refresh cookie value from Set-Cookie headers", () => {
  assert.equal(
    extractRefreshToken([
      "theme=dark; Path=/; SameSite=Lax",
      "refresh_token=opaque%3Dtoken; HttpOnly; Path=/api/auth; SameSite=Lax",
    ]),
    "opaque%3Dtoken",
  )
  assert.equal(extractRefreshToken(["theme=dark; Path=/"]), null)
  assert.equal(
    extractRefreshToken([
      "refresh_token=one; Path=/api/auth",
      "refresh_token=two; Path=/api/auth",
    ]),
    null,
  )
})

test("signed backend credential update is accepted only for its session and version", () => {
  const credentials = makeCredentials()
  const update = signBackendTokenUpdate(makeUpdate(credentials), secret)

  assert.deepEqual(
    verifyBackendTokenUpdate(update, secret, {
      authSessionId: credentials.authSessionId,
      tokenVersion: credentials.tokenVersion,
    }),
    makeUpdate(credentials),
  )
  assert.equal(
    verifyBackendTokenUpdate(update, secret, {
      authSessionId: "different-session",
      tokenVersion: 0,
    }),
    null,
  )
  assert.equal(
    verifyBackendTokenUpdate(update, secret, {
      authSessionId: credentials.authSessionId,
      tokenVersion: 1,
    }),
    null,
  )
})

test("tampered or unsigned update data is rejected", () => {
  const credentials = makeCredentials()
  const signed = signBackendTokenUpdate(makeUpdate(credentials), secret)

  assert.equal(
    verifyBackendTokenUpdate(
      { ...signed, update: { ...signed.update, accessToken: "attacker-token" } },
      secret,
      { authSessionId: credentials.authSessionId, tokenVersion: 0 },
    ),
    null,
  )
  assert.equal(
    verifyBackendTokenUpdate(
      { update: makeUpdate(credentials), signature: "0".repeat(64) },
      secret,
      { authSessionId: credentials.authSessionId, tokenVersion: 0 },
    ),
    null,
  )
})

test("Auth.js JWT update replaces only private backend claims and fails closed when invalidated", () => {
  const credentials = makeCredentials()
  const signed = signBackendTokenUpdate(makeUpdate(credentials), secret)
  const jwt = {
    sub: credentials.userId,
    authSessionId: credentials.authSessionId,
    backendTokenVersion: 0,
    backendAccessToken: credentials.accessToken,
    backendRefreshToken: credentials.refreshToken,
    userId: credentials.userId,
    hotelId: credentials.hotelId,
    role: credentials.role,
  }

  const updated = applyBackendTokenUpdate(jwt, signed, secret)
  assert.equal(updated.backendTokenVersion, 1)
  assert.equal(updated.backendAccessToken, "access-new")
  assert.equal(updated.backendRefreshToken, "refresh-new")
  assert.equal(updated.sub, credentials.userId)
  assert.equal(applyBackendTokenUpdate(jwt, signed, secret, true), null)
  assert.equal(applyBackendTokenUpdate(jwt, { ...signed, signature: "bad" }, secret), jwt)
})

test("public session projection contains identity only, never backend tokens", () => {
  const projected = publicSessionUser({
    userId: "a334f34f-32ac-4d5d-91ae-e8fa7f6c80c4",
    hotelId: null,
    role: "SUPER_ADMIN",
  })

  assert.deepEqual(projected, {
    id: "a334f34f-32ac-4d5d-91ae-e8fa7f6c80c4",
    userId: "a334f34f-32ac-4d5d-91ae-e8fa7f6c80c4",
    hotelId: null,
    role: "SUPER_ADMIN",
  })
  assert.equal("accessToken" in projected, false)
  assert.equal("refreshToken" in projected, false)
})

test("logout cache cleanup removes cached backend data", () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData(["auth", "hotel"], { name: "Private hotel" })

  clearAuthQueryCache(queryClient)

  assert.equal(queryClient.getQueryData(["auth", "hotel"]), undefined)
  queryClient.clear()
})

test("concurrent refresh calls for one session and version share one operation", async () => {
  let calls = 0
  let resolveRefresh
  const coordinator = createRefreshCoordinator(async (credentials) => {
    calls += 1
    await new Promise((resolve) => {
      resolveRefresh = resolve
    })
    return { ...credentials, tokenVersion: 1, accessToken: "access-new", refreshToken: "refresh-new" }
  })
  const credentials = makeCredentials()
  const first = coordinator.refresh(credentials)
  const second = coordinator.refresh(credentials)

  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(calls, 1)
  resolveRefresh()

  const [firstResult, secondResult] = await Promise.all([first, second])
  assert.equal(firstResult.accessToken, "access-new")
  assert.deepEqual(secondResult, firstResult)
})

test("late requests using the consumed token reuse the recent rotated result", async () => {
  let calls = 0
  const coordinator = createRefreshCoordinator(async (credentials) => {
    calls += 1
    return { ...credentials, tokenVersion: 1, accessToken: "access-new", refreshToken: "refresh-new" }
  })
  const staleCredentials = makeCredentials()

  const first = await coordinator.refresh(staleCredentials)
  const late = await coordinator.refresh(staleCredentials)

  assert.equal(calls, 1)
  assert.deepEqual(late, first)
})

test("refresh operations for separate sessions do not share state", async () => {
  let calls = 0
  const coordinator = createRefreshCoordinator(async (credentials) => {
    calls += 1
    return { ...credentials, tokenVersion: 1, accessToken: `${credentials.authSessionId}-access` }
  })

  const [first, second] = await Promise.all([
    coordinator.refresh(makeCredentials("session-a")),
    coordinator.refresh(makeCredentials("session-b")),
  ])

  assert.equal(calls, 2)
  assert.equal(first.accessToken, "session-a-access")
  assert.equal(second.accessToken, "session-b-access")
})

test("session invalidation prevents a late refresh result from being accepted", async () => {
  let resolveRefresh
  const coordinator = createRefreshCoordinator(async (credentials) => {
    await new Promise((resolve) => {
      resolveRefresh = resolve
    })
    return { ...credentials, tokenVersion: 1, accessToken: "late-access" }
  })
  const credentials = makeCredentials()
  const pending = coordinator.refresh(credentials)

  await new Promise((resolve) => setImmediate(resolve))
  coordinator.invalidate(credentials.authSessionId)
  resolveRefresh()

  await assert.rejects(pending, /invalidated during refresh/i)
  assert.equal(coordinator.getRecent(credentials.authSessionId, 0), null)
})

test("logout transitions wait for refresh and receive the latest credentials", async () => {
  let resolveRefresh
  const coordinator = createRefreshCoordinator(async (credentials) => {
    await new Promise((resolve) => {
      resolveRefresh = resolve
    })
    return {
      ...credentials,
      tokenVersion: credentials.tokenVersion + 1,
      accessToken: "rotated-access",
      refreshToken: "rotated-refresh",
    }
  })
  const credentials = makeCredentials()
  const refresh = coordinator.refresh(credentials)
  let logoutCredentials
  const logout = coordinator.runSessionTransition(
    credentials.authSessionId,
    async (latest) => {
      logoutCredentials = latest
    },
    credentials,
  )

  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(logoutCredentials, undefined)
  resolveRefresh()
  await refresh
  await logout

  assert.equal(logoutCredentials.tokenVersion, 1)
  assert.equal(logoutCredentials.refreshToken, "rotated-refresh")
})

test("failed refreshes are not cached and can fail closed", async () => {
  let calls = 0
  const coordinator = createRefreshCoordinator(async () => {
    calls += 1
    throw new Error("refresh outcome uncertain")
  })
  const credentials = makeCredentials()

  await assert.rejects(coordinator.refresh(credentials), /uncertain/)
  await assert.rejects(coordinator.refresh(credentials), /uncertain/)
  assert.equal(calls, 2)
})
