/**
 * Parse comma-separated values, including quoted separators, escaped quotes,
 * CRLF line endings, and newlines inside quoted cells.
 * @param {string} input
 * @returns {string[][]}
 */
export function parseCsv(input) {
  const text = input.replace(/^\uFEFF/, "")
  if (!text) return []

  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  let justEndedRow = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += character
      }
      continue
    }

    if (character === '"') {
      if (field.length > 0) throw new SyntaxError("Unexpected quote inside an unquoted CSV field")
      inQuotes = true
      justEndedRow = false
    } else if (character === ",") {
      row.push(field)
      field = ""
      justEndedRow = false
    } else if (character === "\n" || character === "\r") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      if (character === "\r" && text[index + 1] === "\n") index += 1
      justEndedRow = true
    } else {
      field += character
      justEndedRow = false
    }
  }

  if (inQuotes) throw new SyntaxError("Unclosed quoted field in CSV")
  if (!justEndedRow || row.length > 0 || field.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}
