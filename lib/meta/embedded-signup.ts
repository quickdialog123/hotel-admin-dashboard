
export type EmbeddedSignupResult = {
  code: string
  wabaId: string
  phoneNumberId: string
}

type SignupEvent = {
  type: "WA_EMBEDDED_SIGNUP"
  event: string
  data?: {
    waba_id?: string
    phone_number_id?: string
    error_message?: string
  }
}

function parseEvent(value: unknown): SignupEvent | null {
  try {
    const data =
      typeof value === "string"
        ? JSON.parse(value)
        : value

    if (
      !data ||
      typeof data !== "object" ||
      data.type !== "WA_EMBEDDED_SIGNUP" ||
      typeof data.event !== "string"
    ) {
      return null
    }

    return data as SignupEvent
  } catch {
    return null
  }
}

function isMetaOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)

    return (
      url.protocol === "https:" &&
      (
        url.hostname === "facebook.com" ||
        url.hostname.endsWith(".facebook.com")
      )
    )
  } catch {
    return false
  }
}

let signupInProgress = false

export function launchEmbeddedSignup():
  Promise<EmbeddedSignupResult> {

  if (!window.FB) {
    return Promise.reject(
      new Error("Meta SDK is not ready")
    )
  }

  const configId =
    process.env.NEXT_PUBLIC_META_CONFIG_ID

  if (!configId) {
    return Promise.reject(
      new Error("Meta Config ID is missing")
    )
  }

  if (signupInProgress) {
    return Promise.reject(
      new Error("Signup is already in progress")
    )
  }

  signupInProgress = true

  return new Promise((resolve, reject) => {
    let code: string | null = null
    let wabaId: string | null = null
    let phoneNumberId: string | null = null
    let finished = false

    const timeout = window.setTimeout(() => {
      fail("Meta signup did not finish")
    }, 300_000)

    function cleanup() {
      clearTimeout(timeout)
      window.removeEventListener("message", onMessage)
      signupInProgress = false
    }

    function fail(message: string) {
      if (finished) return

      finished = true
      cleanup()
      reject(new Error(message))
    }

    function complete() {
      if (finished || !code || !wabaId || !phoneNumberId) {
        return
      }

      finished = true
      cleanup()

      resolve({ code, wabaId, phoneNumberId })
    }

    function onMessage(event: MessageEvent) {
      if (!isMetaOrigin(event.origin)) return

      const payload = parseEvent(event.data)
      if (!payload) return

      switch (payload.event) {
        case "FINISH":
          wabaId = payload.data?.waba_id ?? null
          phoneNumberId =
            payload.data?.phone_number_id ?? null

          if (!wabaId || !phoneNumberId) {
            fail("Missing WABA or phone number ID")
            return
          }

          complete()
          break

        case "CANCEL":
          fail("Signup cancelled")
          break

        case "ERROR":
          fail(
            payload.data?.error_message ??
              "Meta signup failed"
          )
          break
      }
    }

    window.addEventListener("message", onMessage)

    // Call FB.login synchronously from the button click.
    try {
      window.FB!.login(
        (response) => {
          const authCode = response.authResponse?.code

          if (!authCode) {
            fail("Authorization code not received")
            return
          }

          code = authCode
          complete()
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
          },
        }
      )
    } catch {
      fail("Unable to launch Embedded Signup")
    }
  })
}
