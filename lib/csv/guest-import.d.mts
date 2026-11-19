export type GuestColumnMapping = {
  fullName: number | null
  email: number | null
  phoneNumber: number | null
}

export type GuestPreviewRow = {
  rowNumber: number
  values: { fullName: string; email: string; phoneNumber: string }
  guest: { fullName: string; email: string; phoneNumber: string } | null
  errors: Partial<Record<"fullName" | "email" | "phoneNumber", string>>
}

export function autoMapGuestColumns(headers: string[]): GuestColumnMapping
export function buildGuestPreview(
  rows: string[][],
  mapping: GuestColumnMapping,
  firstRowNumber?: number,
): GuestPreviewRow[]
