
"use client"

import Script from "next/script"

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string
        version: string
        cookie: boolean
        xfbml: boolean
      }) => void

      login: (
        callback: (response: {
          authResponse?: { code?: string }
          status?: string
        }) => void,
        options: Record<string, unknown>
      ) => void
    }
  }
}

type Props = {
  onReady: () => void
}

export function MetaSdk({ onReady }: Props) {
  return (
    <Script
      src="https://connect.facebook.net/en_US/sdk.js"
      strategy="afterInteractive"
      onReady={() => {
        const appId = process.env.NEXT_PUBLIC_META_APP_ID
        const version =
          process.env.NEXT_PUBLIC_META_GRAPH_VERSION

        if (!window.FB || !appId || !version) return

        window.FB.init({
          appId,
          version,
          cookie: true,
          xfbml: false,
        })

        onReady()
      }}
    />
  )
}
