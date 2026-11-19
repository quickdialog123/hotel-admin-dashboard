import { z } from "zod"

export type GuestColumnMapping = {
  firstName: number | null
  lastName: number | null
  email: number | null
  address: number | null
  phoneNumber: number | null
  checkInDate: number | null
  checkOutDate: number | null
  roomNumber: number | null
  floorNumber: number | null
}

export type GuestImportInput = {
  firstName: string
  lastName: string
  email: string | null
  address: string | null
  phoneNumber: string
  checkInDate: string
  checkOutDate: string
  roomNumber: number
  floorNumber: number
}

type GuestField = keyof GuestColumnMapping

export type GuestImportValues = Omit<GuestImportInput, "email" | "address" | "roomNumber" | "floorNumber"> & {
  email: string
  address: string
  roomNumber: string | number
  floorNumber: string | number
}

export type GuestPreviewRow = {
  rowNumber: number
  values: GuestImportValues
  guest: GuestImportInput | null
  errors: Partial<Record<GuestField, string>>
}

const FIELD_ALIASES: Record<GuestField, Set<string>> = {
  firstName: new Set(["firstname", "givenname"]),
  lastName: new Set(["lastname", "surname", "familyname"]),
  email: new Set(["email", "emailaddress"]),
  address: new Set(["address", "streetaddress", "mailingaddress"]),
  phoneNumber: new Set(["phone", "phonenumber", "mobile", "mobilenumber", "telephone", "tel", "whatsapp", "whatsappnumber"]),
  checkInDate: new Set(["checkin", "checkindate", "arrivaldate"]),
  checkOutDate: new Set(["checkout", "checkoutdate", "departuredate"]),
  roomNumber: new Set(["room", "roomnumber"]),
  floorNumber: new Set(["floor", "floornumber"]),
}

const FIELD_LABELS: Record<GuestField, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  address: "Address",
  phoneNumber: "Phone",
  checkInDate: "Check-in date",
  checkOutDate: "Check-out date",
  roomNumber: "Room number",
  floorNumber: "Floor number",
}

const GUEST_FIELDS = Object.keys(FIELD_LABELS) as GuestField[]
const REQUIRED_FIELDS: GuestField[] = ["firstName", "lastName", "phoneNumber", "checkInDate", "checkOutDate", "roomNumber", "floorNumber"]

/** Auto-assign columns whose headers clearly match a guest field. */
export function autoMapGuestColumns(headers: string[]): GuestColumnMapping {
  const mapping: GuestColumnMapping = Object.fromEntries(GUEST_FIELDS.map((field) => [field, null])) as GuestColumnMapping
  const usedColumns = new Set<number>()

  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "")
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [GuestField, Set<string>][]) {
      if (mapping[field] === null && !usedColumns.has(index) && aliases.has(normalized)) {
        mapping[field] = index
        usedColumns.add(index)
        break
      }
    }
  })

  return mapping
}

/** Map CSV values to the backend guest schema and validate every row. */
export function buildGuestPreview(rows: string[][], mapping: GuestColumnMapping, firstRowNumber = 2): GuestPreviewRow[] {
  return rows.map((row, index) => {
    const values: GuestImportValues = Object.fromEntries(GUEST_FIELDS.map((field) => [
      field,
      mapping[field] === null ? "" : (row[mapping[field]!] ?? "").trim(),
    ])) as GuestImportValues
    const errors: Partial<Record<GuestField, string>> = {}

    for (const field of REQUIRED_FIELDS) {
      if (mapping[field] === null) errors[field] = `Map a CSV column to ${FIELD_LABELS[field].toLowerCase()}.`
    }

    for (const field of ["firstName", "lastName"] as const) {
      if (mapping[field] !== null && (!values[field] || values[field].length > 100)) {
        errors[field] = `Enter a ${field === "firstName" ? "first" : "last"} name (up to 100 characters).`
      }
    }
    if (values.email && !z.email().safeParse(values.email).success) {
      errors.email = "Enter a valid email address."
    }
    if (mapping.phoneNumber !== null && (!values.phoneNumber || values.phoneNumber.length > 32)) {
      errors.phoneNumber = "Enter a phone number (up to 32 characters)."
    }

    for (const field of ["checkInDate", "checkOutDate"] as const) {
      if (mapping[field] !== null && !/^\d{4}-\d{2}-\d{2}$/.test(values[field])) {
        errors[field] = `Enter ${FIELD_LABELS[field].toLowerCase()} as YYYY-MM-DD.`
      } else if (mapping[field] !== null) {
        const parsed = new Date(`${values[field]}T00:00:00Z`)
        if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== values[field]) {
          errors[field] = `Enter a valid ${FIELD_LABELS[field].toLowerCase()}.`
        }
      }
    }

    for (const field of ["roomNumber", "floorNumber"] as const) {
      const value = Number(values[field])
      if (mapping[field] !== null && (!values[field] || !Number.isInteger(value) || (field === "roomNumber" && value <= 0))) {
        errors[field] = field === "roomNumber" ? "Enter a positive whole room number." : "Enter a whole floor number."
      } else if (mapping[field] !== null) {
        values[field] = value
      }
    }

    if (mapping.checkInDate !== null && mapping.checkOutDate !== null && !errors.checkInDate && !errors.checkOutDate && values.checkOutDate <= values.checkInDate) {
      errors.checkOutDate = "Check-out must be after check-in."
    }

    const valid = Object.keys(errors).length === 0
    return {
      rowNumber: firstRowNumber + index,
      values,
      guest: valid ? {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || null,
        address: values.address || null,
        phoneNumber: values.phoneNumber,
        checkInDate: values.checkInDate,
        checkOutDate: values.checkOutDate,
        roomNumber: Number(values.roomNumber),
        floorNumber: Number(values.floorNumber),
      } : null,
      errors,
    }
  })
}
