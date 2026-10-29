import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { once } from "node:events"
import { setTimeout as delay } from "node:timers/promises"
import { join } from "node:path"
import { test } from "node:test"

function listen(server) {
  server.listen(0, "127.0.0.1")
  return once(server, "listening").then(() => server.address().port)
}

async function freePort() {
  const server = createServer()
  const port = await listen(server)
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  return port
}

function responseJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" })
  response.end(JSON.stringify(body))
}

function makeAccessToken(sessionId, role = "OWNER") {
  const payload = Buffer.from(JSON.stringify({
    sub: sessionId,
    sid: sessionId,
    hotelId: "bb008a62-b84b-4f8a-94d6-30847a09d1ef",
    role,
    exp: Math.floor(Date.now() / 1000) + 900,
  })).toString("base64url")

  return `header.${payload}.signature`
}

function cookieValues(response) {
  const headers = response.headers
  const getSetCookie = headers.getSetCookie?.bind(headers)
  return getSetCookie ? getSetCookie() : [headers.get("set-cookie")].filter(Boolean)
}

function updateCookieJar(jar, response) {
  for (const cookie of cookieValues(response)) {
    const pair = cookie.split(";", 1)[0]
    const separator = pair.indexOf("=")
    if (separator < 0) continue

    const name = pair.slice(0, separator)
    const value = pair.slice(separator + 1)
    if (/max-age=0/i.test(cookie) || /expires=Thu, 01 Jan 1970/i.test(cookie)) {
      jar.delete(name)
    } else {
      jar.set(name, value)
    }
  }
}

function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
}

function authSessionCookie(jar) {
  return [...jar]
    .filter(([name]) => name.includes("session-token"))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join(";")
}

test("Auth.js Credentials + Nest BFF login, refresh, concurrency, protection, and logout", {
  timeout: 120_000,
}, async (t) => {
  let loginCount = 0
  let refreshCount = 0
  let logoutCount = 0
  let protectedRequestCount = 0
  let failRefresh = false
  let forceUnauthorizedAfterRefresh = false
  let nextHotelResponseGate = null
  const sessionsByAccess = new Map()
  const sessionsByRefresh = new Map()
  const frontendPort = await freePort()
  const frontendOrigin = `http://localhost:${frontendPort}`

  const backend = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost")
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString("utf8")

    if (request.headers.origin !== frontendOrigin) {
      response.writeHead(403)
      response.end()
      return
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const credentials = JSON.parse(body)
      if (credentials.email === "invalid@example.com") {
        responseJson(response, 401, {
          statusCode: 401,
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        })
        return
      }

      loginCount += 1
      const userId = `10000000-0000-4000-8000-${String(loginCount).padStart(12, "0")}`
      const sessionId = `20000000-0000-4000-8000-${String(loginCount).padStart(12, "0")}`
      const session = {
        userId,
        sessionId,
        hotelId: "bb008a62-b84b-4f8a-94d6-30847a09d1ef",
        role: "OWNER",
        generation: 0,
        accessToken: makeAccessToken(sessionId),
        refreshToken: `refresh-${loginCount}-0`,
        usedRefreshTokens: new Set(),
        postForced: false,
      }
      sessionsByAccess.set(session.accessToken, session)
      sessionsByRefresh.set(session.refreshToken, session)
      response.setHeader(
        "Set-Cookie",
        `refresh_token=${session.refreshToken}; HttpOnly; SameSite=Lax; Path=/api/auth`,
      )
      responseJson(response, 201, { accessToken: session.accessToken })
      return
    }

    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const token = request.headers.authorization?.replace(/^Bearer /, "")
      const session = sessionsByAccess.get(token)
      if (!session) {
        responseJson(response, 401, { statusCode: 401, code: "UNAUTHORIZED", message: "Unauthorized" })
        return
      }
      responseJson(response, 200, {
        userId: session.userId,
        sessionId: session.sessionId,
        hotelId: session.hotelId,
        role: session.role,
      })
      return
    }

    if (url.pathname === "/api/auth/refresh" && request.method === "POST") {
      refreshCount += 1
      const refreshToken = request.headers.cookie
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("refresh_token="))
        ?.slice("refresh_token=".length)
      const session = refreshToken ? sessionsByRefresh.get(refreshToken) : undefined

      if (failRefresh || !session || session.refreshToken !== refreshToken) {
        if (session && refreshToken) {
          for (const oldToken of session.usedRefreshTokens) {
            sessionsByRefresh.delete(oldToken)
          }
          sessionsByRefresh.delete(session.refreshToken)
        }
        responseJson(response, 401, { statusCode: 401, code: "UNAUTHORIZED", message: "Invalid refresh token" })
        return
      }

      session.usedRefreshTokens.add(session.refreshToken)
      session.generation += 1
      session.sessionId = `30000000-0000-4000-8000-${String(loginCount).padStart(12, "0")}`
      session.accessToken = makeAccessToken(session.sessionId)
      session.refreshToken = `refresh-${loginCount}-${session.generation}`
      sessionsByAccess.set(session.accessToken, session)
      sessionsByRefresh.set(session.refreshToken, session)
      response.setHeader(
        "Set-Cookie",
        `refresh_token=${session.refreshToken}; HttpOnly; SameSite=Lax; Path=/api/auth`,
      )
      responseJson(response, 201, { accessToken: session.accessToken })
      return
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      const token = request.headers.authorization?.replace(/^Bearer /, "")
      const refreshToken = request.headers.cookie
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("refresh_token="))
        ?.slice("refresh_token=".length)
      const session = token ? sessionsByAccess.get(token) : undefined

      if (!session || session.refreshToken !== refreshToken) {
        response.writeHead(401)
        response.end()
        return
      }

      logoutCount += 1
      sessionsByRefresh.delete(session.refreshToken)
      response.setHeader("Set-Cookie", "refresh_token=; HttpOnly; Max-Age=0; Path=/api/auth")
      response.writeHead(204)
      response.end()
      return
    }

    if (url.pathname === "/api/hotels" && request.method === "POST") {
      const token = request.headers.authorization?.replace(/^Bearer /, "")
      const session = sessionsByAccess.get(token)
      if (!session || session.generation === 0) {
        responseJson(response, 401, { statusCode: 401, code: "UNAUTHORIZED", message: "Expired access token" })
        return
      }

      if (!session.postForced) {
        session.postForced = true
        responseJson(response, 401, { statusCode: 401, code: "UNAUTHORIZED", message: "Expired access token" })
        return
      }

      responseJson(response, 201, { accepted: JSON.parse(body) })
      return
    }

    if (url.pathname === "/api/hotels" && request.method === "GET") {
      if (url.searchParams.get("forbidden") === "1") {
        responseJson(response, 403, { statusCode: 403, code: "FORBIDDEN", message: "Forbidden" })
        return
      }

      if (nextHotelResponseGate) {
        const gate = nextHotelResponseGate
        nextHotelResponseGate = null
        gate.started()
        await gate.wait
      }

      protectedRequestCount += 1
      const token = request.headers.authorization?.replace(/^Bearer /, "")
      const session = sessionsByAccess.get(token)
      if (
        !session ||
        session.generation === 0 ||
        forceUnauthorizedAfterRefresh
      ) {
        responseJson(response, 401, { statusCode: 401, code: "UNAUTHORIZED", message: "Expired access token" })
        return
      }
      responseJson(response, 200, [{ id: "hotel-1", name: "Test hotel" }])
      return
    }

    responseJson(response, 404, { message: "Not found" })
  })

  const backendPort = await listen(backend)
  const nextBin = join(process.cwd(), "node_modules", "next", "dist", "bin", "next")
  const app = spawn(process.execPath, [nextBin, "start", "-p", String(frontendPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      AUTH_SECRET: "local-test-secret-with-more-than-32-characters",
      BACKEND_API_URL: `http://127.0.0.1:${backendPort}`,
      API_PREFIX: "api",
      FRONTEND_ORIGIN: frontendOrigin,
      NEXT_PUBLIC_META_APP_ID: "test-app",
      NEXT_PUBLIC_META_CONFIG_ID: "test-config",
      NEXT_PUBLIC_META_GRAPH_VERSION: "v26.0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
  let appOutput = ""
  app.stdout.on("data", (chunk) => { appOutput += chunk.toString() })
  app.stderr.on("data", (chunk) => { appOutput += chunk.toString() })

  async function waitForApp() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (app.exitCode !== null) throw new Error(`Next server exited early: ${appOutput}`)
      try {
        const response = await fetch(`${frontendOrigin}/api/auth/csrf`)
        if (response.ok) return
      } catch {
        // Wait for the production server to bind its port.
      }
      await delay(200)
    }
    throw new Error(`Next server did not start: ${appOutput}`)
  }

  await waitForApp()
  t.after(async () => {
    app.kill()
    await new Promise((resolve) => backend.close(resolve))
  })

  const appUrl = (path) => `${frontendOrigin}${path}`

  async function login(jar, email, password = "valid-password") {
    const csrfResponse = await fetch(appUrl("/api/auth/csrf"), { cache: "no-store" })
    updateCookieJar(jar, csrfResponse)
    const { csrfToken } = await csrfResponse.json()
    const form = new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${frontendOrigin}/dashboard`,
    })
    const response = await fetch(appUrl("/api/auth/callback/credentials"), {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader(jar),
        Origin: frontendOrigin,
      },
      body: form,
    })
    updateCookieJar(jar, response)
    return response
  }

  async function session(jar) {
    return fetch(appUrl("/api/auth/session"), {
      headers: { Cookie: cookieHeader(jar) },
      cache: "no-store",
    }).then((response) => response.json())
  }

  const failedLoginJar = new Map()
  const failedLogin = await login(failedLoginJar, "invalid@example.com")
  assert.ok(failedLogin.status >= 300 && failedLogin.status < 400)
  assert.equal((await session(failedLoginJar))?.user, undefined)

  const jar = new Map()
  const successfulLogin = await login(jar, "owner@example.com")
  assert.ok(successfulLogin.status >= 300 && successfulLogin.status < 400)
  assert.ok([...jar.keys()].some((name) => name.includes("session-token")))

  const publicSession = await session(jar)
  assert.equal(publicSession.user.role, "OWNER")
  assert.equal(publicSession.user.hotelId, "bb008a62-b84b-4f8a-94d6-30847a09d1ef")
  assert.equal("backendAccessToken" in publicSession, false)
  assert.equal("backendRefreshToken" in publicSession, false)
  assert.equal("backendSessionId" in publicSession, false)
  assert.equal("authSessionId" in publicSession, false)
  assert.equal("backendTokenVersion" in publicSession, false)
  assert.equal("backendAccessTokenExpiresAt" in publicSession, false)
  assert.equal(JSON.stringify(publicSession).includes("refresh-1-0"), false)
  assert.equal(cookieHeader(jar).includes("refresh-1-0"), false)

  const restoredJar = new Map(jar)
  assert.equal((await session(restoredJar)).user.userId, publicSession.user.userId)

  const unauthenticated = await fetch(appUrl("/api/bff/hotels"))
  assert.equal(unauthenticated.status, 401)
  assert.equal(protectedRequestCount, 0)
  const authBypass = await fetch(appUrl("/api/bff/auth/refresh"), {
    headers: { Cookie: cookieHeader(jar) },
  })
  assert.equal(authBypass.status, 404)
  assert.equal(refreshCount, 0)
  const unapprovedUpstreamPath = await fetch(appUrl("/api/bff/health"), {
    headers: { Cookie: cookieHeader(jar) },
  })
  assert.equal(unapprovedUpstreamPath.status, 404)
  const protectedDashboard = await fetch(appUrl("/dashboard"), { redirect: "manual" })
  assert.ok([302, 303, 307].includes(protectedDashboard.status))
  assert.equal(
    new URL(protectedDashboard.headers.get("location"), frontendOrigin).pathname,
    "/login",
  )

  const sessionCookieBeforeRefresh = authSessionCookie(jar)
  const firstProtected = await fetch(appUrl("/api/bff/hotels"), {
    headers: { Cookie: cookieHeader(jar) },
  })
  assert.equal(
    firstProtected.status,
    200,
    `${firstProtected.status} ${await firstProtected.clone().text()} (refreshes: ${refreshCount})`,
  )
  assert.equal(refreshCount, 1)

  const forbidden = await fetch(appUrl("/api/bff/hotels?forbidden=1"), {
    headers: { Cookie: cookieHeader(jar) },
  })
  assert.equal(forbidden.status, 403)
  assert.equal(refreshCount, 1)
  updateCookieJar(jar, firstProtected)
  assert.notEqual(authSessionCookie(jar), sessionCookieBeforeRefresh)
  assert.equal((await firstProtected.json())[0].name, "Test hotel")
  const authenticatedDashboard = await fetch(appUrl("/dashboard"))
  assert.equal(authenticatedDashboard.status, 200)

  const subsequentProtected = await fetch(appUrl("/api/bff/hotels"), {
    headers: { Cookie: cookieHeader(jar) },
  })
  assert.equal(subsequentProtected.status, 200)
  assert.equal(refreshCount, 1)

  const mutationResponse = await fetch(appUrl("/api/bff/hotels"), {
    method: "POST",
    headers: {
      Cookie: cookieHeader(jar),
      Origin: frontendOrigin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ operation: "preserve-body" }),
  })
  assert.equal(mutationResponse.status, 201)
  assert.deepEqual(await mutationResponse.json(), {
    accepted: { operation: "preserve-body" },
  })
  updateCookieJar(jar, mutationResponse)
  assert.equal(refreshCount, 2)

  let releaseDelayedResponse
  let startedDelayedResponse
  const delayedResponseStarted = new Promise((resolve) => {
    startedDelayedResponse = resolve
  })
  const delayedResponseWait = new Promise((resolve) => {
    releaseDelayedResponse = resolve
  })
  nextHotelResponseGate = {
    started: startedDelayedResponse,
    wait: delayedResponseWait,
  }
  const delayedRequest = fetch(appUrl("/api/bff/hotels"), {
    headers: { Cookie: cookieHeader(jar) },
  })
  await delayedResponseStarted

  const staleAccountJar = new Map(jar)
  const previousUserId = publicSession.user.userId
  const accountSwitch = await login(jar, "second-owner@example.com")
  assert.ok(accountSwitch.status >= 300 && accountSwitch.status < 400)
  assert.notEqual((await session(jar)).user.userId, previousUserId)
  releaseDelayedResponse()
  const delayedResponse = await delayedRequest
  assert.equal(delayedResponse.status, 409)

  const staleAccountRequest = await fetch(appUrl("/api/bff/hotels"), {
    headers: { Cookie: cookieHeader(staleAccountJar) },
  })
  assert.equal(staleAccountRequest.status, 409)

  const concurrentJar = new Map()
  const concurrentLogin = await login(concurrentJar, "staff@example.com")
  assert.ok(concurrentLogin.status >= 300 && concurrentLogin.status < 400)
  const concurrentResponses = await Promise.all([
    fetch(appUrl("/api/bff/hotels"), { headers: { Cookie: cookieHeader(concurrentJar) } }),
    fetch(appUrl("/api/bff/hotels"), { headers: { Cookie: cookieHeader(concurrentJar) } }),
  ])
  assert.deepEqual(concurrentResponses.map((response) => response.status), [200, 200])
  assert.equal(refreshCount, 3)
  for (const response of concurrentResponses) updateCookieJar(concurrentJar, response)

  const retryFailureJar = new Map()
  const retryFailureLogin = await login(retryFailureJar, "retry-failure@example.com")
  assert.ok(retryFailureLogin.status >= 300 && retryFailureLogin.status < 400)
  forceUnauthorizedAfterRefresh = true
  const retryFailure = await fetch(appUrl("/api/bff/hotels"), {
    headers: { Cookie: cookieHeader(retryFailureJar) },
  })
  assert.equal(retryFailure.status, 401)
  updateCookieJar(retryFailureJar, retryFailure)
  assert.equal((await session(retryFailureJar))?.user, undefined)
  assert.equal(refreshCount, 4)
  forceUnauthorizedAfterRefresh = false

  const failureJar = new Map()
  const failureLogin = await login(failureJar, "guest@example.com")
  assert.ok(failureLogin.status >= 300 && failureLogin.status < 400)
  failRefresh = true
  const failedRefresh = await fetch(appUrl("/api/bff/hotels"), {
    headers: { Cookie: cookieHeader(failureJar) },
  })
  assert.equal(failedRefresh.status, 401)
  updateCookieJar(failureJar, failedRefresh)
  assert.equal((await session(failureJar))?.user, undefined)
  failRefresh = false

  const logoutJar = new Map()
  const logoutLogin = await login(logoutJar, "logout@example.com")
  assert.ok(logoutLogin.status >= 300 && logoutLogin.status < 400)
  const prepareLogout = await fetch(appUrl("/api/bff/hotels"), {
    headers: { Cookie: cookieHeader(logoutJar) },
  })
  assert.equal(prepareLogout.status, 200)
  updateCookieJar(logoutJar, prepareLogout)
  const logoutResponse = await fetch(appUrl("/api/session/signout"), {
    method: "POST",
    headers: {
      Cookie: cookieHeader(logoutJar),
      Origin: frontendOrigin,
    },
  })
  assert.equal(logoutResponse.status, 204)
  updateCookieJar(logoutJar, logoutResponse)
  assert.equal((await session(logoutJar))?.user, undefined)
  assert.equal(logoutCount, 2)
})
