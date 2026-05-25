import { parseAddress } from './address-parser'

export interface SheetCustomer {
  company_name: string
  full_address: string
  street: string
  city: string
  state: string
  zip: string
  country: string
  contact_name: string
  phone: string
  preferred_carrier: string
  notes: string
  sheets_row: number
}

// Column indexes in the Google Sheet (0-based)
const COL = {
  COMPANY:  0,
  ADDRESS:  1,
  CONTACT:  2,
  PHONE:    3,
  NOTES:    11, // last column with carrier/warehouse notes
} as const

function cleanContact(raw: string): string {
  return raw.replace(/^contact\s*/i, '').trim()
}

function cleanPhone(raw: string): string {
  return raw.replace(/^phone\s*/i, '').trim()
}

function extractPreferredCarrier(notes: string): string {
  if (!notes) return ''
  const match = notes.match(/carrier[:\s]+([^,\n]+)/i)
  return match ? match[1].trim() : ''
}

/**
 * Fetch all customers from a public Google Sheets CSV export.
 * The sheet must be publicly accessible (Anyone with link can view).
 */
export async function fetchSheetCustomers(
  spreadsheetId: string,
  gid: string
): Promise<SheetCustomer[]> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`

  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'Accept': 'text/csv' },
    next: { revalidate: 0 }, // always fresh in Next.js fetch
  })

  if (!response.ok) {
    throw new Error(`Google Sheets fetch failed: ${response.status} ${response.statusText}`)
  }

  const text = await response.text()
  return parseSheetCSV(text)
}

function cleanCompanyName(raw: string): string {
  let name = raw
    .replace(/,?\s*contact\s.*/i, '')
    .replace(/,?\s*phone[:\s].*/i, '')
    .replace(/,?\s*tel[:\s].*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Starts with digits → street address, not a company name
  if (/^\d+\s+[A-Za-z]/.test(name)) return ''

  // "Brunswick VIC 3056" or "North Sydney NSW 2060" → suburb/city, not a company
  if (/^[A-Za-z][A-Za-z\s\-]+ [A-Z]{2,3} \d{3,6}\.?$/.test(name)) return ''

  // Bare state + postcode leftover (e.g. "VIC 3056")
  if (/^[A-Z]{2,3} \d{3,6}$/.test(name)) return ''

  return name.slice(0, 120)
}

function detectCountryFromAddress(address: string, contact: string, phone: string, notes: string, company: string = ''): string {
  const all = `${address} ${contact} ${phone} ${notes} ${company}`.toUpperCase()

  if (/\bCANADA\b|,\s*ON\s+[A-Z]\d[A-Z]|,\s*BC\s+|,\s*QC\s+/.test(all)) return 'CA'
  if (/\bAUSTRALIA\b|\bNSW\b|\bVIC\b|\bQLD\b|\bWA\s+\d{4}\b|\bSA\s+\d{4}\b/.test(all)) return 'AU'
  if (/\bUNITED KINGDOM\b|\bENGLAND\b|\bLONDON\b/.test(all)) return 'UK'
  if (/\bGERMANY\b|\bFRANCE\b|\bITALY\b|\bSPAIN\b|\bNETHERLANDS\b|\bBELGIUM\b|\bPORTUGAL\b|\bLDA\b|\bGMBH\b|\bSRL\b/.test(all)) return 'EU'
  // Canadian postal code
  if (/\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/.test(all)) return 'CA'
  // AU postal code (4 digits, no 5-digit US zip)
  if (/\b\d{4}\b/.test(all) && !/\b\d{5}\b/.test(all) && (/VIC|NSW|QLD|WA|SA|TAS|ACT|NT/.test(all))) return 'AU'

  return 'US'
}

function parseSheetCSV(csv: string): SheetCustomer[] {
  const lines = csv.split('\n')
  const customers: SheetCustomer[] = []

  // Skip header row (row 0)
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVRow(lines[i])
    if (!cols.length) continue

    const companyRaw = cleanCompanyName((cols[COL.COMPANY] ?? '').trim())
    if (!companyRaw || companyRaw.length < 2) continue // skip empty/bad rows

    const addressRaw = (cols[COL.ADDRESS] ?? '').trim()
    const contactRaw = (cols[COL.CONTACT] ?? '').trim()
    const phoneRaw   = (cols[COL.PHONE]   ?? '').trim()
    const notesRaw   = (cols[COL.NOTES]   ?? '').trim()

    // Detect country using all available data including company name (catches LDA, GMBH, etc.)
    const country = detectCountryFromAddress(addressRaw, contactRaw, phoneRaw, notesRaw, companyRaw)

    // Parse address
    const parsed = parseAddress(addressRaw)
    // Override country with our smarter detection
    parsed.country = country

    // If address parsing failed to get street, use full address as street fallback
    const street = parsed.street || addressRaw.split(',')[0]?.trim() || addressRaw

    customers.push({
      company_name:       companyRaw,
      full_address:       addressRaw,
      street,
      city:               parsed.city,
      state:              parsed.state,
      zip:                parsed.zip,
      country,
      contact_name:       cleanContact(contactRaw),
      phone:              cleanPhone(phoneRaw),
      preferred_carrier:  extractPreferredCarrier(notesRaw),
      notes:              notesRaw,
      sheets_row:         i + 1,
    })
  }

  return customers
}

/**
 * Parse a single CSV row, handling quoted fields with commas inside them.
 */
function splitCSVRow(row: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }

  result.push(current)
  return result
}
