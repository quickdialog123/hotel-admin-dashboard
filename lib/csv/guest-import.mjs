import { z } from "zod"

const FIELD_ALIASES = {
  firstName: new Set(["firstname", "givenname"]),
  lastName: new Set(["lastname", "surname", "familyname"]),
  email: new Set(["email", "emailaddress"]),
  phoneNumber: new Set(["phone", "phonenumber", "mobile", "mobilenumber", "telephone", "tel", "whatsapp", "whatsappnumber"]),
  checkInDate: new Set(["checkin", "checkindate", "arrivaldate"]),
  checkOutDate: new Set(["checkout", "checkoutdate", "departuredate"]),
  roomNumber: new Set(["room", "roomnumber"]),
  floorNumber: new Set(["floor", "floornumber"]),
}

const FIELD_LABELS = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phoneNumber: "Phone",
  checkInDate: "Check-in date",
  checkOutDate: "Check-out date",
  roomNumber: "Room number",
  floorNumber: "Floor number",
}

const GUEST_FIELDS = Object.keys(FIELD_LABELS)

/** @typedef {{ firstName: number | null, lastName: number | null, email: number | null, phoneNumber: number | null, checkInDate: number | null, checkOutDate: number | null, roomNumber: number | null, floorNumber: number | null }} GuestColumnMapping */

/**
 * Auto-assign columns whose headers clearly match a guest field.
 * @param {string[]} headers
 * @returns {GuestColumnMapping}
 */
export function autoMapGuestColumns(headers) {
  const mapping = Object.fromEntries(GUEST_FIELDS.map((field) => [field, null]))
  const usedColumns = new Set()

  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "")
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (mapping[field] === null && !usedColumns.has(index) && aliases.has(normalized)) {
        mapping[field] = index
        usedColumns.add(index)
        break
      }
    }
  })

  return mapping
}

/**
 * Map CSV values to the backend guest schema and validate every row.
 * @param {string[][]} rows
 * @param {GuestColumnMapping} mapping
 * @param {number} [firstRowNumber]
 * @returns {Array<{ rowNumber: number, values: Record<string, string | number>, guest: Record<string, string | number> | null, errors: Record<string, string> }>}
 */
export function buildGuestPreview(rows, mapping, firstRowNumber = 2) {
  return rows.map((row, index) => {
    const values = Object.fromEntries(GUEST_FIELDS.map((field) => [
      field,
      mapping[field] === null ? "" : (row[mapping[field]] ?? "").trim(),
    ]))
    const errors = {}

    for (const field of Object.keys(FIELD_LABELS)) {
      if (mapping[field] === null) errors[field] = `Map a CSV column to ${FIELD_LABELS[field].toLowerCase()}.`
    }

    for (const field of ["firstName", "lastName"]) {
      if (mapping[field] !== null && (!values[field] || values[field].length > 100)) {
        errors[field] = `Enter a ${field === "firstName" ? "first" : "last"} name (up to 100 characters).`
      }
    }
    if (mapping.email !== null && !z.email().safeParse(values.email).success) {
      errors.email = "Enter a valid email address."
    }
    if (mapping.phoneNumber !== null && (!values.phoneNumber || values.phoneNumber.length > 32)) {
      errors.phoneNumber = "Enter a phone number (up to 32 characters)."
    }

    for (const field of ["checkInDate", "checkOutDate"]) {
      if (mapping[field] !== null && !/^\d{4}-\d{2}-\d{2}$/.test(values[field])) {
        errors[field] = `Enter ${FIELD_LABELS[field].toLowerCase()} as YYYY-MM-DD.`
      } else if (mapping[field] !== null) {
        const parsed = new Date(`${values[field]}T00:00:00Z`)
        if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== values[field]) {
          errors[field] = `Enter a valid ${FIELD_LABELS[field].toLowerCase()}.`
        }
      }
    }

    for (const field of ["roomNumber", "floorNumber"]) {
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
      guest: valid ? values : null,
      errors,
    }
  })
}
