"use client"

/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react"

type State<T> = { data: T | null; error: string | null; loading: boolean }

/**
 * Runs an async lib/api call and tracks loading / error state.
 * `reload()` re-runs it (used by error-state retry buttons and after mutations).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    fn().then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (e: unknown) => !cancelled && setState({ data: null, error: e instanceof Error ? e.message : "Something went wrong", loading: false }),
    )
    return () => {
      cancelled = true
    }
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const setData = useCallback((updater: (prev: T | null) => T | null) => setState((s) => ({ ...s, data: updater(s.data) })), [])
  return { ...state, reload, setData }
}
