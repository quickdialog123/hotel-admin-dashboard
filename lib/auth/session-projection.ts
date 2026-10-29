type BackendIdentity = {
  userId: string
  hotelId: string | null
  role: "SUPER_ADMIN" | "OWNER" | "STAFF" | "CLIENT" | "AUTHORITY"
}

export function publicSessionUser(identity: BackendIdentity) {
  return {
    id: identity.userId,
    userId: identity.userId,
    hotelId: identity.hotelId,
    role: identity.role,
  }
}
