import { z } from "zod"

const FIELD_ALIASES = {
  fullName: new Set(["name", "fullname", "guestname"]),
  email: new Set(["email", "emailaddress"]),
  phoneNumber: new Set(["phone", "phonenumber", "mobile", "mobilenumber", "telephone", "tel", "whatsapp", "whatsappnumber"]),
}

const FIELD_LABELS = {
  fullName: "Full name",
  email: "Email",
  phoneNumber: "Phone",
}

/** @typedef {{ fullName: number | null, email: number | null, phoneNumber: number | null }} GuestColumnMapping */

/**
 * Auto-assign columns whose headers clearly match a guest field.
 * @param {string[]} headers
 * @returns {GuestColumnMapping}
 */
export function autoMapGuestColumns(headers) {
  const mapping = { fullName: null, email: null, phoneNumber: null }
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
 * @returns {Array<{ rowNumber: number, values: { fullName: string, email: string, phoneNumber: string }, guest: { fullName: string, email: string, phoneNumber: string } | null, errors: Record<string, string> }>}
 */
export function buildGuestPreview(rows, mapping, firstRowNumber = 2) {
  return rows.map((row, index) => {
    const values = {
      fullName: mapping.fullName === null ? "" : (row[mapping.fullName] ?? "").trim(),
      email: mapping.email === null ? "" : (row[mapping.email] ?? "").trim(),
      phoneNumber: mapping.phoneNumber === null ? "" : (row[mapping.phoneNumber] ?? "").trim(),
    }
    const errors = {}

    for (const field of Object.keys(FIELD_LABELS)) {
      if (mapping[field] === null) errors[field] = `Map a CSV column to ${FIELD_LABELS[field].toLowerCase()}.`
    }

    if (mapping.fullName !== null && (!values.fullName || values.fullName.length > 200)) {
      errors.fullName = "Enter a name (up to 200 characters)."
    }
    if (mapping.email !== null && !z.email().safeParse(values.email).success) {
      errors.email = "Enter a valid email address."
    }
    if (mapping.phoneNumber !== null && (!values.phoneNumber || values.phoneNumber.length > 32)) {
      errors.phoneNumber = "Enter a phone number (up to 32 characters)."
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
