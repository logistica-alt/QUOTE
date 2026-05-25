export interface ParsedAddress {
  street: string
  city: string
  state: string
  zip: string
  country: string
}

// Canadian province codes
const CA_PROVINCES = new Set(['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'NT', 'YT', 'NU'])

// US state codes
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV',
  'NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN',
  'TX','UT','VT','VA','WA','WV','WI','WY','DC',
])

function detectCountry(raw: string): string {
  const upper = raw.toUpperCase()
  if (/\bCANADA\b/.test(upper)) return 'CA'
  if (/\bAUSTRALIA\b|\bNSW\b|\bVIC\b|\bQLD\b|\bWA\b|\bSA\b|\bTAS\b|\bACT\b|\bNT\b/.test(upper) && !/\bNV\b|\bTX\b/.test(upper)) {
    // rough heuristic: AU postal codes are 4 digits
    if (/\b\d{4}\b/.test(upper) && !/\b\d{5}\b/.test(upper)) return 'AU'
  }
  if (/\bUNITED KINGDOM\b|\bENGLAND\b|\bSCOTLAND\b|\bWALES\b/.test(upper)) return 'UK'
  // Canadian postal code pattern A1A 1A1 or A1A1A1
  if (/\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/.test(upper)) return 'CA'
  return 'US'
}

function parseCanadianAddress(str: string): ParsedAddress {
  // e.g. "802 COCHRANE Dr, MARKHAM, ON L3R 8C9"
  const zipMatch = str.match(/\b([A-Z]\d[A-Z][ -]?\d[A-Z]\d)\b/i)
  const zip = zipMatch ? zipMatch[1].toUpperCase().replace(/\s/, '') : ''

  const provinceMatch = str.match(new RegExp(`\\b(${[...CA_PROVINCES].join('|')})\\b`, 'i'))
  const state = provinceMatch ? provinceMatch[1].toUpperCase() : ''

  // Remove province + postal code from end
  const cleaned = str
    .replace(/,?\s*[A-Z]{2}[ -]?[A-Z]\d[A-Z][ -]?\d[A-Z]\d\s*$/i, '')
    .replace(/,?\s*CANADA\s*$/i, '')
    .trim()

  const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean)
  return {
    street: parts[0] ?? '',
    city:   parts[1] ?? '',
    state,
    zip,
    country: 'CA',
  }
}

function parseUSAddress(str: string): ParsedAddress {
  // Clean country suffix
  let s = str
    .replace(/,?\s*\bUSA\b\s*$/i, '')
    .replace(/,?\s*\bU\.S\.A\.?\b\s*$/i, '')
    .replace(/,?\s*\bUnited States\b\s*$/i, '')
    .trim()

  // Extract 5-digit zip
  const zipMatch = s.match(/\b(\d{5})(-\d{4})?\b/)
  const zip = zipMatch ? zipMatch[1] : ''

  // Extract state code (2 uppercase letters adjacent to zip, or known US state)
  let state = ''
  const stateBeforeZip = s.match(/\b([A-Z]{2})\s*,?\s*\d{5}/)
  if (stateBeforeZip && US_STATES.has(stateBeforeZip[1])) {
    state = stateBeforeZip[1]
  } else {
    // Try to find a US state code standing alone
    const stateAlone = s.match(/\b([A-Z]{2})\b/)
    if (stateAlone && US_STATES.has(stateAlone[1])) state = stateAlone[1]
  }

  // Remove "STATE ZIP" or "STATE, ZIP" block from end to isolate street + city
  let remainder = s
  if (state && zip) {
    remainder = s.replace(new RegExp(`,?\\s*${state}\\s*,?\\s*${zip}(-\\d{4})?`), '').trim()
  } else if (zip) {
    remainder = s.replace(new RegExp(`,?\\s*${zip}(-\\d{4})?`), '').trim()
  } else if (state) {
    remainder = s.replace(new RegExp(`,?\\s*\\b${state}\\b`), '').trim()
  }
  remainder = remainder.replace(/,\s*$/, '').trim()

  const parts = remainder.split(',').map(p => p.trim()).filter(Boolean)

  if (parts.length >= 2) {
    return { street: parts[0], city: parts[1], state, zip, country: 'US' }
  }

  if (parts.length === 1) {
    // No comma — try to split street from city by finding where digits end
    // e.g. "7034 W Charleston Blvd Las Vegas" → hard to know where street ends
    // Best effort: keep whole string as street, leave city empty
    return { street: parts[0], city: '', state, zip, country: 'US' }
  }

  return { street: remainder, city: '', state, zip, country: 'US' }
}

export function parseAddress(raw: string | null | undefined): ParsedAddress {
  if (!raw || raw.trim() === '') {
    return { street: '', city: '', state: '', zip: '', country: 'US' }
  }

  const country = detectCountry(raw)

  if (country === 'CA') return parseCanadianAddress(raw.trim())
  if (country === 'US') return parseUSAddress(raw.trim())

  // Non-US/CA: store everything in street, flag country
  return { street: raw.trim(), city: '', state: '', zip: '', country }
}

export function isCanadianPostal(zip: string): boolean {
  return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(zip.trim())
}
