export type ApiError = {
  message: string
  status: number
  code?: string
  details?: unknown
}

export function isApiError(
  error: unknown,
): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "status" in error
  )
}

export function toApiError(
  error: unknown,
): ApiError {
  if (isApiError(error)) {
    return error
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      status: 0,
    }
  }

  return {
    message: "Unexpected error",
    status: 0,
    details: error,
  }
}