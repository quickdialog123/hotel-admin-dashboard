"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertCircle, ArrowLeft, Check, FileSpreadsheet, GripVertical, LoaderCircle, Upload, UserRound, AtSign, Phone, CalendarDays, BedDouble, Building2, Megaphone } from "lucide-react"

import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/app/states"
import { createGuests, guestKeys } from "@/lib/api/guests"
import { autoMapGuestColumns, buildGuestPreview, type GuestColumnMapping } from "@/lib/csv/guest-import"
import { parseCsv } from "@/lib/csv/parse-csv"
import { cn } from "@/lib/utils"

const GUEST_FIELDS = [
  { key: "firstName", label: "First name", icon: UserRound },
  { key: "lastName", label: "Last name", icon: UserRound },
  { key: "email", label: "Email (optional)", icon: AtSign },
  { key: "address", label: "Address (optional)", icon: Building2 },
  { key: "phoneNumber", label: "Phone", icon: Phone },
  { key: "checkInDate", label: "Check-in date", icon: CalendarDays },
  { key: "checkOutDate", label: "Check-out date", icon: CalendarDays },
  { key: "roomNumber", label: "Room number", icon: BedDouble },
  { key: "floorNumber", label: "Floor number", icon: Building2 },
  { key: "marketingConsent", label: "Marketing consent (optional)", icon: Megaphone },
] as const

const REQUIRED_FIELDS = ["firstName", "lastName", "phoneNumber", "checkInDate", "checkOutDate", "roomNumber", "floorNumber"] as const
type GuestField = (typeof GUEST_FIELDS)[number]["key"]

export default function GuestImportPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()
  const importMutation = useMutation({
    mutationFn: createGuests,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guestKeys.all }),
  })
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState("")
  const [rawRows, setRawRows] = useState<string[][]>([])
  const emptyMapping = (): GuestColumnMapping => ({ firstName: null, lastName: null, email: null, address: null, phoneNumber: null, checkInDate: null, checkOutDate: null, roomNumber: null, floorNumber: null, marketingConsent: null })
  const [mapping, setMapping] = useState<GuestColumnMapping>(emptyMapping)
  const [skipFirstRow, setSkipFirstRow] = useState(true)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const headers = useMemo(() => {
    const source = rawRows[0] ?? []
    const columnCount = rawRows.reduce((max, row) => Math.max(max, row.length), source.length)
    return Array.from({ length: columnCount }, (_, index) => {
      const value = skipFirstRow ? source[index]?.trim() : ""
      return value || `Column ${index + 1}`
    })
  }, [rawRows, skipFirstRow])

  const dataRows = useMemo(() => {
    const rows = skipFirstRow ? rawRows.slice(1) : rawRows
    return rows.filter((row) => row.some((cell) => cell.trim() !== ""))
  }, [rawRows, skipFirstRow])

  const preview = useMemo(
    () => buildGuestPreview(dataRows, mapping, skipFirstRow ? 2 : 1),
    [dataRows, mapping, skipFirstRow],
  )
  const completeMapping = REQUIRED_FIELDS.every((key) => mapping[key] !== null)
  const tooManyRows = dataRows.length > 500
  const invalidPreviewRows = preview.filter((row) => row.guest === null)
  const invalidRows = invalidPreviewRows.length
  const canImport = Boolean(fileName) && !fileError && completeMapping && dataRows.length > 0 && !tooManyRows && invalidRows === 0 && !importMutation.isPending

  if (status === "loading") return <div className="h-80 animate-pulse rounded-2xl border bg-white" />
  if (!session?.user.hotelId) {
    return <ErrorState message="No hotel is assigned to your account. Contact your administrator to import guest records." />
  }

  function resetFile() {
    setFileName("")
    setRawRows([])
    setMapping(emptyMapping())
    setFileError(null)
    if (fileInput.current) fileInput.current.value = ""
  }

  function setSkipHeader(skip: boolean) {
    setSkipFirstRow(skip)
    const nextHeaders = skip
      ? (rawRows[0] ?? []).map((value, index) => value.trim() || `Column ${index + 1}`)
      : (rawRows[0] ?? []).map((_, index) => `Column ${index + 1}`)
    setMapping(autoMapGuestColumns(nextHeaders))
  }

  async function readFile(file?: File) {
    if (!file) return
    setFileError(null)
    setFileName(file.name)
    try {
      if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
        throw new Error("Choose a .csv file to continue.")
      }
      const parsed = parseCsv(await file.text())
      if (parsed.length === 0 || parsed.every((row) => row.every((cell) => !cell.trim()))) {
        throw new Error("This CSV has no guest rows to import.")
      }
      setRawRows(parsed)
      const headerValues = parsed[0].map((value, index) => value.trim() || `Column ${index + 1}`)
      setMapping(skipFirstRow ? autoMapGuestColumns(headerValues) : emptyMapping())
    } catch (cause) {
      setRawRows([])
      setMapping(emptyMapping())
      setFileError(cause instanceof Error ? cause.message : "Unable to read this CSV file.")
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  function mapColumn(columnIndex: number, field: GuestField | null) {
    setMapping((current) => {
      const next = { ...current }
      for (const key of Object.keys(next) as GuestField[]) {
        if (next[key] === columnIndex || key === field) next[key] = null
      }
      if (field) next[field] = columnIndex
      return next
    })
  }

  function onFieldDragStart(event: React.DragEvent<HTMLButtonElement>, field: GuestField) {
    event.dataTransfer.setData("text/plain", field)
    event.dataTransfer.effectAllowed = "move"
  }

  async function importGuests() {
    if (!canImport) return
    try {
      const guests = preview.flatMap((row) => row.guest ? [row.guest] : [])
      const result = await importMutation.mutateAsync(guests)
      toast.success(`Imported ${result.count} guest${result.count === 1 ? "" : "s"}`)
      router.replace("/guests")
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to import guests.")
    }
  }

  const fieldForColumn = (columnIndex: number): GuestField | "" => GUEST_FIELDS.find(({ key }) => mapping[key] === columnIndex)?.key ?? ""

  return (
    <>
      <Link href="/guests" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Guests
      </Link>
      <PageHeader title="Import guests" description="Upload a CSV and match its columns to your guest fields." />

      {!fileName || fileError ? (
        <section
          onDragOver={(event) => { event.preventDefault(); setIsDraggingFile(true) }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(event) => { event.preventDefault(); setIsDraggingFile(false); void readFile(event.dataTransfer.files[0]) }}
          className={cn("rounded-2xl border border-dashed bg-white px-6 py-14 text-center transition-colors", isDraggingFile ? "border-slate-900 bg-slate-50" : "border-slate-300")}
        >
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><FileSpreadsheet className="size-6" /></span>
          <h2 className="text-lg font-semibold">Choose a CSV file</h2>
          <p className="mt-1 text-sm text-muted-foreground">Drag and drop your file here, or browse your device.</p>
          <input ref={fileInput} className="sr-only" type="file" accept=".csv,text/csv" aria-label="Choose CSV file" onChange={(event) => void readFile(event.target.files?.[0])} />
          <Button className="mt-5 rounded-xl" onClick={() => fileInput.current?.click()}><Upload /> Browse CSV</Button>
          <p className="mt-3 text-xs text-muted-foreground">CSV files only · Up to 500 guest rows</p>
          {fileError && <p role="alert" className="mx-auto mt-4 max-w-xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{fileError}</p>}
        </section>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><FileSpreadsheet className="size-5" /></span>
              <div className="min-w-0"><p className="truncate text-sm font-medium">{fileName}</p><p className="text-xs text-muted-foreground">{dataRows.length} guest row{dataRows.length === 1 ? "" : "s"} detected</p></div>
            </div>
            <Button variant="outline" className="rounded-xl" onClick={resetFile}>Choose another file</Button>
          </div>

          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">Match CSV columns</h2>
              <p className="mt-1 text-sm text-muted-foreground">Drag a guest field onto a column, or use the menu above it. Only mapped columns are imported.</p>
            </div>
            <div className="space-y-3 border-b bg-slate-50/70 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guest fields</p>
              <div className="flex flex-wrap gap-2">
                {GUEST_FIELDS.map(({ key, label, icon: Icon }) => {
                  const columnIndex = mapping[key]
                  return <div key={key} className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm", columnIndex === null ? "border-slate-200 bg-white" : "border-emerald-200 bg-emerald-50 text-emerald-900")}>
                    <button type="button" draggable onDragStart={(event) => onFieldDragStart(event, key)} className="inline-flex cursor-grab items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30" aria-label={`Drag ${label} field`}>
                      <GripVertical className="size-3.5 text-muted-foreground" aria-hidden />
                      <Icon className="size-4" aria-hidden />{label}
                    </button>
                    {columnIndex !== null && <span className="text-xs text-emerald-700">Column {columnIndex + 1} <Check className="ml-1 inline size-3.5" aria-label="Mapped" /></span>}
                  </div>
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3 px-5 py-4">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={skipFirstRow} onChange={(event) => setSkipHeader(event.target.checked)} className="size-4 accent-slate-900" /> Skip the first row (column headers)</label>
              <span className="text-sm text-muted-foreground">{completeMapping ? "All required fields mapped" : "Map all seven required fields to continue. Email, address, and marketing consent are optional."}</span>
            </div>

            {tooManyRows && <div role="alert" className="mx-5 mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 size-4 shrink-0" />This file has {dataRows.length} guest rows. The bulk importer accepts up to 500 rows.</div>}
            {completeMapping && invalidRows > 0 && !tooManyRows && <div role="alert" className="mx-5 mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div><p>{invalidRows} row{invalidRows === 1 ? " needs" : "s need"} correction before import. Fix the CSV and upload it again.</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs">{invalidPreviewRows.slice(0, 5).map((row) => <li key={row.rowNumber}>CSV row {row.rowNumber}: {Object.values(row.errors).join(" ")}</li>)}</ul>
                {invalidRows > 5 && <p className="mt-1 text-xs">And {invalidRows - 5} more invalid rows.</p>}
              </div>
            </div>}

            <div className="overflow-x-auto border-t">
              {headers.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No columns found in this CSV.</p> : (
                <table className="w-full min-w-max text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-muted-foreground">
                    <tr>
                      {headers.map((header, columnIndex) => {
                        const field = fieldForColumn(columnIndex)
                        const fieldError = field ? preview.find((row) => row.errors[field])?.errors[field] : undefined
                        return <th key={columnIndex} scope="col" className="min-w-56 border-b px-3 py-3 align-top">
                          <label className="sr-only" htmlFor={`mapping-${columnIndex}`}>Map column {columnIndex + 1}: {header}</label>
                          <select id={`mapping-${columnIndex}`} value={field} onChange={(event) => mapColumn(columnIndex, event.target.value ? event.target.value as GuestField : null)} className="mb-2 h-9 w-full rounded-lg border bg-white px-2 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30">
                            <option value="">Don’t import this column</option>
                            {GUEST_FIELDS.map(({ key, label }) => <option key={key} value={key} disabled={mapping[key] !== null && mapping[key] !== columnIndex}>{label}</option>)}
                          </select>
                          <div onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move" }} onDrop={(event) => { event.preventDefault(); const fieldKey = event.dataTransfer.getData("text/plain") as GuestField; if (GUEST_FIELDS.some((item) => item.key === fieldKey)) mapColumn(columnIndex, fieldKey) }} className={cn("mb-2 flex min-h-9 items-center rounded-lg border border-dashed px-2 text-xs font-normal", field ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-300 text-muted-foreground", fieldError && "border-red-300 bg-red-50 text-red-800")}>
                            {field ? `${GUEST_FIELDS.find((item) => item.key === field)?.label} mapped` : "Drag a field here"}
                          </div>
                          <span className="block truncate font-medium text-foreground" title={header}>{header}</span>
                        </th>
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 8).map((row, rowIndex) => (
                      <tr key={`${row.rowNumber}-${rowIndex}`} className="border-b last:border-0">
                        {headers.map((_, columnIndex) => {
                          const field = fieldForColumn(columnIndex)
                          const error = field ? row.errors[field] : undefined
                          const value = row.values[field as GuestField] ?? dataRows[rowIndex]?.[columnIndex] ?? ""
                          return <td key={columnIndex} className={cn("max-w-80 px-3 py-3 align-top", error && "bg-red-50/70")}>
                            <span className={cn("block break-words", error && "text-red-800")}>{value || <span className="text-muted-foreground">—</span>}</span>
                            {error && <span className="mt-1 block text-xs font-normal text-red-700">{error}</span>}
                          </td>
                        })}
                      </tr>
                    ))}
                    {preview.length === 0 && <tr><td colSpan={Math.max(headers.length, 1)} className="px-4 py-10 text-center text-sm text-muted-foreground">No guest rows found.</td></tr>}
                  </tbody>
                </table>
              )}
              {preview.length > 8 && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Showing 8 of {preview.length} guest rows.</p>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50/60 px-5 py-4">
              <p className="text-sm text-muted-foreground">{invalidRows === 0 && completeMapping && dataRows.length > 0 && !tooManyRows ? `${dataRows.length} guests ready to import` : "Review mappings and fix validation issues to continue."}</p>
              <div className="flex items-center gap-2"><Button variant="outline" className="rounded-xl" onClick={() => router.push("/guests")}>Cancel</Button><Button className="rounded-xl" disabled={!canImport} onClick={() => void importGuests()}>{importMutation.isPending && <LoaderCircle className="animate-spin" />}Import {dataRows.length} guest{dataRows.length === 1 ? "" : "s"}</Button></div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
