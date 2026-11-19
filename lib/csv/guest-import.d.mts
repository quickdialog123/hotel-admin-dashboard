export type GuestColumnMapping = {
  firstName: number | null
  lastName: number | null
  email: number | null
  phoneNumber: number | null
  checkInDate: number | null
  checkOutDate: number | null
  roomNumber: number | null
  floorNumber: number | null
}

export type GuestImportInput = {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  checkInDate: string
  checkOutDate: string
  roomNumber: number
  floorNumber: number
}

export type GuestImportValues = Omit<GuestImportInput, "roomNumber" | "floorNumber"> & {
  roomNumber: string | number
  floorNumber: string | number
}

export type GuestPreviewRow = {
  rowNumber: number
  values: GuestImportValues
  guest: GuestImportInput | null
  errors: Partial<Record<keyof GuestImportInput, string>>
}

export function autoMapGuestColumns(headers: string[]): GuestColumnMapping
export function buildGuestPreview(
  rows: string[][],
  mapping: GuestColumnMapping,
  firstRowNumber?: number,
): GuestPreviewRow[]
