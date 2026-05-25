#!/usr/bin/env ts-node
/**
 * Echo Global Logistics - LTL Quote Automation
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/echo-automation.ts --quote-id=<uuid>
 *
 * Environment variables required:
 *   ECHO_USERNAME, ECHO_PASSWORD, ECHO_PORTAL_URL
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_APP_URL, AUTOMATION_SECRET
 */

import { chromium, Browser, Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const quoteIdArg = args.find(a => a.startsWith('--quote-id='))
const QUOTE_ID: string = quoteIdArg?.split('=')[1] ?? ''

if (!QUOTE_ID) {
  console.error('ERROR  Usage: ts-node scripts/echo-automation.ts --quote-id=<uuid>')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Environment variables
// ---------------------------------------------------------------------------
const ECHO_USERNAME = process.env.ECHO_USERNAME!
const ECHO_PASSWORD = process.env.ECHO_PASSWORD!
const ECHO_PORTAL_URL = process.env.ECHO_PORTAL_URL || 'https://login.echo.com'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const AUTOMATION_SECRET = process.env.AUTOMATION_SECRET!

const REQUIRED_ENV = ['ECHO_USERNAME', 'ECHO_PASSWORD', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AUTOMATION_SECRET']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`ERROR  Missing required environment variable: ${key}`)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Supabase service client (bypasses RLS)
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Fixed freight constants for Forest Coffee shipments
// ---------------------------------------------------------------------------
const FREIGHT = {
  itemDescription: 'Coffee in bags',
  handlingUnit: 'Pallet',
  length: '48',
  width: '40',
  height: '48',
  freightClass: '65',
  nmfc: '073260',
  nmfcSub: '10',
} as const

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------
interface QuoteData {
  id: string
  customer_name: string
  origin_address: string | null
  origin_city: string | null
  origin_state: string | null
  origin_zip: string | null
  destination_address: string
  destination_city: string
  destination_state: string
  destination_zip: string
  pickup_date: string
  total_pallets: number
  total_weight: number
  liftgate_required: boolean
  warehouse?: {
    name: string
    address: string
    city: string
    state: string
    zip: string
    phone: string | null
    contact_person: string | null
  } | null
}

interface CarrierResult {
  carrier_name: string
  price: number
  transit_days: number | null
  estimated_delivery_date: string | null
  echo_quote_id: string | null
}

interface ExtractedRow {
  carrier: string
  price: number
  transit: number | null
  deliveryDate: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Returns the next valid LTL pickup date in MM/DD/YYYY format.
 * Skips weekends and a basic list of US federal holidays.
 * @param dateInput  ISO date (YYYY-MM-DD) or MM/DD/YYYY
 * @param extraDays  Additional days to add before validation (default 0)
 */
function getNextValidPickupDate(dateInput: string, extraDays = 0): string {
  // Parse the input — handle both YYYY-MM-DD and MM/DD/YYYY
  let d: Date
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, day] = dateInput.split('-').map(Number)
    d = new Date(y, m - 1, day)
  } else {
    const [m, day, y] = dateInput.split('/').map(Number)
    d = new Date(y, m - 1, day)
  }

  d.setDate(d.getDate() + extraDays)

  // US federal holidays (month is 0-based)
  const isHoliday = (dt: Date): boolean => {
    const m = dt.getMonth() + 1 // 1-based
    const day = dt.getDate()
    const dow = dt.getDay() // 0=Sun
    // New Year's Day Jan 1
    if (m === 1 && day === 1) return true
    // MLK Day: 3rd Monday of January
    if (m === 1 && dow === 1 && day >= 15 && day <= 21) return true
    // Presidents' Day: 3rd Monday of February
    if (m === 2 && dow === 1 && day >= 15 && day <= 21) return true
    // Memorial Day: last Monday of May
    if (m === 5 && dow === 1 && day >= 25) return true
    // Juneteenth Jun 19
    if (m === 6 && day === 19) return true
    // Independence Day Jul 4
    if (m === 7 && day === 4) return true
    // Labor Day: 1st Monday of September
    if (m === 9 && dow === 1 && day <= 7) return true
    // Thanksgiving: 4th Thursday of November
    if (m === 11 && dow === 4 && day >= 22 && day <= 28) return true
    // Christmas Dec 25
    if (m === 12 && day === 25) return true
    return false
  }

  // Advance until we find a weekday that's not a holiday
  let safety = 0
  while (d.getDay() === 0 || d.getDay() === 6 || isHoliday(d)) {
    d.setDate(d.getDate() + 1)
    if (++safety > 14) break // never loop forever
  }

  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

function resolveOriginZip(quote: QuoteData): string {
  return quote.origin_zip || quote.warehouse?.zip || ''
}

function resolveOriginCity(quote: QuoteData): string {
  return quote.origin_city || quote.warehouse?.city || ''
}

// ---------------------------------------------------------------------------
// Screenshot upload
// ---------------------------------------------------------------------------
async function uploadScreenshot(screenshotPath: string, quoteId: string): Promise<string | null> {
  try {
    const fileContent = fs.readFileSync(screenshotPath)
    const fileName = `quotes/${quoteId}/${Date.now()}.png`

    const { error } = await supabase.storage
      .from('screenshots')
      .upload(fileName, fileContent, { contentType: 'image/png', upsert: true })

    if (error) {
      console.error('Screenshot upload error:', error.message)
      return null
    }

    const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(fileName)
    return urlData.publicUrl
  } catch (err) {
    console.error('Upload failed:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Save results back to application API
// ---------------------------------------------------------------------------
async function saveResults(params: {
  quoteId: string
  results: CarrierResult[]
  echoQuoteId: string | null
  screenshotUrl: string | null
  error?: string
}): Promise<void> {
  const { quoteId, results, echoQuoteId, screenshotUrl, error } = params

  const response = await fetch(`${APP_URL}/api/automation`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-automation-secret': AUTOMATION_SECRET,
    },
    body: JSON.stringify({
      quote_id: quoteId,
      results,
      echo_quote_id: echoQuoteId,
      screenshot_url: screenshotUrl,
      error: error ?? null,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Failed to save results: HTTP ${response.status} — ${body}`)
  }

  console.log('Results saved to database')
}

// ---------------------------------------------------------------------------
// Step 1 — Login
// ---------------------------------------------------------------------------
async function loginToEcho(page: Page): Promise<void> {
  console.log('Logging into Echo portal...')

  // Load the portal — use domcontentloaded so we don't wait forever on SPA background requests
  await page.goto(ECHO_PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(2000) // let SPA hydrate

  console.log('Page loaded, current URL:', page.url())

  // Wait for any username/email input
  await page.waitForSelector(
    'input[type="email"], input[name="username"], input[id*="user"], input[placeholder*="email" i], input[placeholder*="username" i], input[type="text"]',
    { timeout: 15000 },
  )

  console.log('Login form found, filling credentials...')

  const emailInput = page
    .locator('input[type="email"], input[name="username"], input[id*="username"], input[placeholder*="email" i], input[type="text"]')
    .first()
  await emailInput.fill(ECHO_USERNAME)
  await sleep(300)

  const passwordInput = page.locator('input[type="password"]').first()
  await passwordInput.fill(ECHO_PASSWORD)
  await sleep(300)

  console.log('Credentials filled, clicking sign in...')

  const signInBtn = page
    .locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login"), input[type="submit"]')
    .first()
  await signInBtn.click()

  // Echo uses a SPA — don't use waitForNavigation.
  // Instead wait up to 30 s for the URL to move away from the login page
  // OR for a post-login element to appear.
  console.log('Waiting for login to complete...')
  try {
    await page.waitForFunction(
      () => !window.location.href.includes('login') && !window.location.href.includes('signin'),
      { timeout: 30000, polling: 500 }
    )
  } catch {
    // URL still contains login — check if there's an error message
    const pageText = await page.textContent('body').catch(() => '')
    if (pageText?.toLowerCase().includes('invalid') || pageText?.toLowerCase().includes('incorrect')) {
      throw new Error('Login failed — invalid credentials. Check ECHO_USERNAME and ECHO_PASSWORD.')
    }
    throw new Error(`Login timed out. URL: ${page.url()}`)
  }

  console.log('Logged in successfully — URL:', page.url())
}

// ---------------------------------------------------------------------------
// Step 2 — Navigate to LTL Quote page
// ---------------------------------------------------------------------------
async function navigateToLTLQuote(page: Page): Promise<void> {
  console.log('Navigating to LTL Quote page...')

  const baseUrl = new URL(page.url()).origin

  // Selectors that indicate we're on the LTL quote form.
  // EchoShip uses Angular — the origin wrapper has id="ltl-quote-origin-entry".
  const formIndicators = [
    '#ltl-quote-origin-entry',        // EchoShip Angular wrapper (known from DOM inspection)
    '#ltl-quote-destination-entry',   // EchoShip Angular wrapper (destination)
    '[id*="ltl-quote"]',
    '[placeholder*="origin" i]',
    '[placeholder*="shipper" i]',
    '[placeholder*="Pickup" i]',
    '[aria-label*="origin" i]',
  ].join(', ')

  // Check if we're already on the LTL form (login often redirects here)
  const alreadyOnForm = await page.locator(formIndicators).isVisible({ timeout: 4000 }).catch(() => false)
  if (alreadyOnForm) {
    console.log(`Already on LTL form at ${page.url()}`)
    return
  }

  // Try direct paths in priority order
  const ltlPaths = [
    '/new-quote/ltl',      // EchoShip — known exact URL after login
    '/shipper/get-a-rate',
    '/quote/ltl',
    '/ltl/quote',
    '/rates/ltl',
    '/shipper/ltl',
    '/get-a-rate',
  ]

  for (const ltlPath of ltlPaths) {
    try {
      // Echo is a SPA — use domcontentloaded, never networkidle
      await page.goto(baseUrl + ltlPath, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await sleep(2000)

      const url = page.url()
      if (url.includes('login') || url.includes('404') || url.includes('not-found')) continue

      // Confirm form elements exist
      const hasForm = await page.locator(formIndicators).isVisible({ timeout: 4000 }).catch(() => false)
      if (hasForm) {
        console.log(`Navigated to LTL form at ${url}`)
        return
      }
      console.log(`Path ${ltlPath} loaded (${url}) but form not detected`)
    } catch {
      // continue to next path
    }
  }

  // Fallback — look for navigation links in the rendered page
  const navSelectors = [
    'a:has-text("Get a Rate")',
    'a:has-text("LTL Quote")',
    'a:has-text("Rate Quote")',
    'a:has-text("Get Rate")',
    'a:has-text("Quick Quote")',
    '[data-testid*="quote"]',
    '[href*="get-a-rate"]',
    '[href*="ltl"]',
  ]

  for (const selector of navSelectors) {
    try {
      const link = page.locator(selector).first()
      if (await link.isVisible({ timeout: 2000 })) {
        await link.click()
        // SPA — wait for form elements, NOT waitForNavigation
        await page.waitForSelector(formIndicators, { timeout: 12000 })
        console.log(`Clicked nav link "${selector}", form detected at ${page.url()}`)
        return
      }
    } catch {
      // continue
    }
  }

  // Last resort: screenshot so we know what's on screen
  console.warn('Could not locate LTL form — dumping page URL and text for diagnosis')
  console.warn('Current URL:', page.url())
  const bodyText = await page.textContent('body').catch(() => '').then(t => (t ?? '').slice(0, 400))
  console.warn('Page snippet:', bodyText)

  throw new Error('Could not navigate to the LTL quote page. Verify Echo portal URL and structure.')
}

// ---------------------------------------------------------------------------
// Shared helper: type a query into an Echo location field, wait for the
// autocomplete dropdown, then click the first real result.
//
// Strategies (in order):
//   1. Find dropdown via multiple selector patterns, log all options, click first valid
//   2. Keyboard ArrowDown × N + Enter fallback
// ---------------------------------------------------------------------------
async function fillEchoLocationField(
  page: Page,
  fieldLocator: import('playwright').Locator,
  query: string,
  label: string,
  opts: { screenshotDir?: string; quoteId?: string } = {}
): Promise<boolean> {
  // Click to focus, then clear and type.
  // If fieldLocator is an Angular wrapper div (not an <input>), .fill() will throw —
  // in that case fall back to keyboard-only mode.
  await fieldLocator.click()
  await sleep(300)

  let usedKeyboardMode = false
  try {
    await fieldLocator.fill('')
    await sleep(200)
    await fieldLocator.type(query, { delay: 120 })
  } catch {
    // Not a fillable element (Angular wrapper div) — use raw keyboard
    console.log(`${label}: fill() failed, switching to keyboard-only mode`)
    await page.keyboard.press('Control+a')
    await sleep(100)
    await page.keyboard.press('Backspace')
    await sleep(100)
    await page.keyboard.type(query, { delay: 120 })
    usedKeyboardMode = true
  }

  console.log(`${label}: typed "${query}" — waiting 2.5 s for dropdown...`)
  await sleep(2500)   // give the SPA time to fetch and render results

  // Optional debug screenshot right after typing
  if (opts.screenshotDir && opts.quoteId) {
    const fname = `${opts.quoteId.slice(0,8)}-debug-${label.replace(/[^a-z0-9]/gi,'_')}.png`
    await page.screenshot({ path: path.join(opts.screenshotDir, fname) }).catch(() => {})
    console.log(`${label}: debug screenshot saved`)
  }

  // Helper: read field value safely (won't return "on" from a checkbox)
  const getFieldVal = async (): Promise<string> => {
    // 1. Try the locator directly (works for <input>, <textarea>, <select>)
    const direct = await fieldLocator.inputValue().catch(() => null)
    if (direct !== null && direct.length > 4) return direct

    // 2. Look specifically for a text-type input inside the locator
    //    (avoids checkboxes and hidden inputs returning spurious "on" / "")
    const textInput = fieldLocator.locator(
      'input[type="text"], input[type="search"], input:not([type]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'
    ).first()
    const inner = await textInput.inputValue().catch(() => '')
    if (inner.length > 4) return inner

    return direct ?? ''
  }

  // Helper: try to click a list of candidate items, returning true on success.
  // Success is detected by: (a) item disappearing from DOM after click  OR
  //                          (b) field value becoming meaningful text.
  const tryClickItems = async (items: import('playwright').Locator, selLabel: string): Promise<boolean> => {
    const count = await items.count()
    if (count === 0) return false

    // Log candidates
    console.log(`${label}: [${selLabel}] found ${count} item(s):`)
    for (let i = 0; i < Math.min(count, 10); i++) {
      const t = ((await items.nth(i).textContent().catch(() => '')) ?? '').trim()
      console.log(`  [${i}] "${t.slice(0, 100)}"`)
    }

    for (let i = 0; i < Math.min(count, 15); i++) {
      const item = items.nth(i)
      const text = ((await item.textContent().catch(() => '')) ?? '').trim()

      // ── Skip non-location items ────────────────────────────────────────
      if (text.length < 3) continue
      if (/^(zip\s*locations|saved\s*(locations)?|recent|suggested|results|manage|add\s+new)/i.test(text)) continue
      if (/no\s+(zip|location|result|match|record|address|option)/i.test(text)) continue
      if (/not\s+found/i.test(text)) continue
      if (/^(loading|searching|please\s+wait)/i.test(text)) continue
      if (/diamond|points|rewards|loyalty/i.test(text)) continue
      // Navigation-only items lack 4+ consecutive digits (ZIP / house numbers)
      if (!/\d{4,}/.test(text)) continue
      // ──────────────────────────────────────────────────────────────────

      console.log(`${label}: clicking "${text.slice(0, 80)}"`)
      await item.click()
      await sleep(900)

      // ── Primary success signal: did THIS item disappear? ──────────────
      // When a dropdown selection is accepted, the autocomplete closes and
      // the clicked item is removed from the DOM.
      const itemGone = !(await item.isVisible({ timeout: 600 }).catch(() => true))
      if (itemGone) {
        console.log(`${label}: ✓ item disappeared after click — selection confirmed`)
        return true
      }

      // ── Fallback signal: check the text field value ───────────────────
      const val = await getFieldVal()
      if (val.length > 4) {
        console.log(`${label}: ✓ confirmed, field = "${val}"`)
        return true
      }

      console.log(`${label}: item still visible + field = "${val}", trying next item...`)
    }
    return false
  }

  // ── Strategy 1: for ZIP queries, search specifically for li containing the ZIP ──
  // This avoids accidentally clicking navigation items that use the same dropdown class
  const zip5 = query.match(/\d{5}/)?.[0]
  if (zip5) {
    const zipItems = page.locator(`li:has-text("${zip5}")`).filter({ visible: true })
    const zipCount = await zipItems.count()
    console.log(`${label}: ZIP-specific li:has-text("${zip5}") → ${zipCount} item(s)`)
    if (zipCount > 0 && await tryClickItems(zipItems, `li:has-text("${zip5}")`)) return true
  }

  // ── Strategy 2: ARIA-standard selectors ──────────────────────────────────────
  const ariaCandidates = [
    'li[role="option"]',
    '[role="option"]',
    '[role="listbox"] li',
    '[role="listbox"] [role="option"]',
    'ul[role="listbox"] > li',
  ]
  for (const sel of ariaCandidates) {
    try {
      const items = page.locator(sel)
      if (await items.count() > 0 && await tryClickItems(items, sel)) return true
    } catch { }
  }

  // ── Strategy 3: generic class-based (filter carefully by content) ────────────
  const genericCandidates = [
    '[class*="autocomplete"] li',
    '[class*="suggestion"] li',
    '[class*="typeahead"] li',
    '[class*="options"] li',
    '[class*="dropdown"] li',
    '[class*="menu"] li',
  ]
  for (const sel of genericCandidates) {
    try {
      const items = page.locator(sel)
      if (await items.count() > 0 && await tryClickItems(items, sel)) return true
    } catch { }
  }

  // ── Keyboard fallback ─────────────────────────────────────────────────────
  console.log(`${label}: trying keyboard ArrowDown × 4 + Enter fallback...`)
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowDown')
    await sleep(250)
  }
  await page.keyboard.press('Enter')
  await sleep(800)

  const val = await getFieldVal()
  if (val.length > 4) {
    console.log(`${label}: ✓ keyboard succeeded, field = "${val}"`)
    return true
  }

  console.warn(`${label}: ✗ all strategies failed, field = "${val}"`)
  return false
}

// ---------------------------------------------------------------------------
// Step 3 — Fill origin
// ---------------------------------------------------------------------------
async function fillOriginDetails(
  page: Page,
  quote: QuoteData,
  screenshotDir: string
): Promise<void> {
  console.log('Filling origin details...')
  await sleep(1000)

  const originZip   = resolveOriginZip(quote)                       // e.g. "94501"
  const originCity  = resolveOriginCity(quote)                      // e.g. "Alameda"
  const originState = quote.origin_state || quote.warehouse?.state || ''

  // EchoShip Angular form: the origin wrapper is visible immediately,
  // but the actual <input> inside it only becomes visible AFTER you click the wrapper.
  // Strategy: click the wrapper → wait for inner input → fill & select.
  const originWrapper = page.locator('#ltl-quote-origin-entry, [id*="origin-entry"]').first()
  const wrapperVisible = await originWrapper.isVisible({ timeout: 5000 }).catch(() => false)

  if (!wrapperVisible) {
    await page.screenshot({ path: path.join(screenshotDir, `${QUOTE_ID.slice(0,8)}-origin-not-found.png`) }).catch(() => {})
    console.warn('Origin wrapper not found — skipping (check screenshot)')
    return
  }

  // Click the wrapper to activate the Angular input
  await originWrapper.click()
  await sleep(600)

  // Now wait for the inner input to appear
  let originInput: import('playwright').Locator
  try {
    await page.waitForSelector(
      '#ltl-quote-origin-entry input:not([type="hidden"]), #ltl-quote-origin-entry [contenteditable="true"]',
      { timeout: 4000, state: 'visible' }
    )
    originInput = originWrapper.locator('input:not([type="hidden"]), [contenteditable="true"]').first()
    console.log('Origin: inner input appeared after click')
  } catch {
    // Angular didn't render an input — type directly via keyboard (focus stays on wrapper)
    console.log('Origin: no inner input appeared, will use keyboard.type() directly')
    // We'll use a special approach below
    originInput = originWrapper // placeholder — will be replaced by keyboard flow
  }

  const dbgOpts = { screenshotDir, quoteId: QUOTE_ID }

  // FC Elias has no saved locations in Echo.
  // Try several query strategies until one produces a dropdown selection.
  const queries: string[] = []
  if (originZip)                        queries.push(originZip)                              // "94501"
  if (originCity)                       queries.push(originCity)                             // "Alameda"
  if (originCity && originState)        queries.push(`${originCity}, ${originState}`)        // "Alameda, CA"
  if (originCity && originZip)          queries.push(`${originCity} ${originZip}`)           // "Alameda 94501"
  if (originCity && originState && originZip) {
    queries.push(`${originCity}, ${originState} ${originZip}`)                               // "Alameda, CA 94501"
  }

  for (const q of queries) {
    console.log(`\nOrigin: trying query "${q}"...`)
    const selected = await fillEchoLocationField(page, originInput, q, `Origin[${q}]`, dbgOpts)
    if (selected) {
      console.log(`Origin: ✓ succeeded with query "${q}"`)
      return
    }
  }

  console.warn('Origin: ✗ all queries failed — form may reject submission')
}

// ---------------------------------------------------------------------------
// Step 4 — Fill destination
// ---------------------------------------------------------------------------
async function fillDestinationDetails(
  page: Page,
  quote: QuoteData,
  screenshotDir: string
): Promise<void> {
  console.log('Filling destination details...')

  // EchoShip Angular wrapper for destination: id="ltl-quote-destination-entry"
  const destWrapper = page.locator('#ltl-quote-destination-entry, [id*="destination-entry"]').first()
  const destWrapperVisible = await destWrapper.isVisible({ timeout: 5000 }).catch(() => false)

  if (!destWrapperVisible) {
    await page.screenshot({ path: path.join(screenshotDir, `${QUOTE_ID.slice(0,8)}-dest-not-found.png`) }).catch(() => {})
    console.warn('Destination wrapper not found — skipping (check screenshot)')
    return
  }

  // Click wrapper to activate Angular input
  await destWrapper.click()
  await sleep(600)

  let destInput: import('playwright').Locator
  try {
    await page.waitForSelector(
      '#ltl-quote-destination-entry input:not([type="hidden"]), #ltl-quote-destination-entry [contenteditable="true"]',
      { timeout: 4000, state: 'visible' }
    )
    destInput = destWrapper.locator('input:not([type="hidden"]), [contenteditable="true"]').first()
    console.log('Destination: inner input appeared after click')
  } catch {
    console.log('Destination: no inner input appeared, will use keyboard.type() directly')
    destInput = destWrapper
  }

  const dbgOpts = { screenshotDir, quoteId: QUOTE_ID }
  const zip  = quote.destination_zip
  const city = quote.destination_city
  const st   = quote.destination_state

  const queries: string[] = []
  if (zip)             queries.push(zip)                          // "90001"
  if (city)            queries.push(city)                         // "Los Angeles"
  if (city && st)      queries.push(`${city}, ${st}`)             // "Los Angeles, CA"
  if (city && zip)     queries.push(`${city} ${zip}`)             // "Los Angeles 90001"
  if (city && st && zip) queries.push(`${city}, ${st} ${zip}`)   // "Los Angeles, CA 90001"

  for (const q of queries) {
    console.log(`\nDestination: trying query "${q}"...`)
    const selected = await fillEchoLocationField(page, destInput, q, `Dest[${q}]`, dbgOpts)
    if (selected) {
      console.log(`Destination: ✓ succeeded with query "${q}"`)
      return
    }
  }

  console.warn('Destination: ✗ all queries failed — form may reject submission')
}

// ---------------------------------------------------------------------------
// Step 5 — Fill commodity / freight details
// ---------------------------------------------------------------------------
async function fillFreightDetails(page: Page, quote: QuoteData): Promise<void> {
  console.log('Filling freight details...')
  await sleep(500)

  // --- Pallet count / quantity ---
  const palletSelectors = [
    '[id*="pallet"][id*="count"]',
    '[name*="pallet"][name*="count"]',
    '[id*="qty"]',
    '[name*="quantity"]',
    '[name*="pallets"]',
    '[placeholder*="Number of Pallets" i]',
    '[placeholder*="Pallets" i]',
    '[aria-label*="Quantity" i]',
    '[aria-label*="Pallets" i]',
    '[aria-label*="Handling Units" i]',
  ]
  let palletFilled = false
  for (const sel of palletSelectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 1500 })) {
        await el.fill(String(quote.total_pallets))
        palletFilled = true
        break
      }
    } catch { /* continue */ }
  }

  if (!palletFilled) {
    // Echo's form: Quantity column is the first input in the item details row
    // Use getByLabel or find input right before the Handling Unit dropdown
    try {
      const qtyInput = page.getByLabel(/quantity/i).first()
      if (await qtyInput.isVisible({ timeout: 1500 })) {
        await qtyInput.fill(String(quote.total_pallets))
        palletFilled = true
      }
    } catch { /* continue */ }
  }

  if (!palletFilled) {
    // Last resort: find the first empty number input in the shipment details section
    try {
      const allInputs = page.locator('input[type="number"], input[inputmode="numeric"]')
      const count = await allInputs.count()
      for (let i = 0; i < count; i++) {
        const inp = allInputs.nth(i)
        const val = await inp.inputValue().catch(() => '0')
        if (!val || val === '0') {
          await inp.fill(String(quote.total_pallets))
          palletFilled = true
          break
        }
      }
    } catch { /* continue */ }
  }

  console.log(`Pallet count ${palletFilled ? 'filled' : 'NOT filled — check selector'}: ${quote.total_pallets}`)

  // --- Weight ---
  const weightSelectors = [
    '[id*="weight"]',
    '[name*="weight"]',
    '[placeholder*="Weight" i]',
    '[aria-label*="Weight" i]',
  ]
  for (const sel of weightSelectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 2000 })) {
        await el.fill(String(Math.ceil(quote.total_weight)))
        break
      }
    } catch {
      // continue
    }
  }

  // --- Freight class ---
  const classSelectors = [
    'select[id*="class"]',
    'select[name*="class"]',
    '[placeholder*="Freight Class" i]',
    '[aria-label*="Freight Class" i]',
    '[id*="freight-class"]',
  ]
  for (const sel of classSelectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 2000 })) {
        const tag = await el.evaluate((e: Element) => e.tagName.toLowerCase())
        if (tag === 'select') {
          await (el as ReturnType<Page['locator']>).selectOption({ value: FREIGHT.freightClass })
        } else {
          await el.fill(FREIGHT.freightClass)
        }
        break
      }
    } catch {
      // continue
    }
  }

  // --- Item description ---
  const descSelectors = [
    '[id*="description"]',
    '[name*="description"]',
    '[placeholder*="Description" i]',
    '[placeholder*="Commodity" i]',
    '[aria-label*="Description" i]',
    '[aria-label*="Commodity" i]',
  ]
  for (const sel of descSelectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 2000 })) {
        await el.fill(FREIGHT.itemDescription)
        break
      }
    } catch {
      // continue
    }
  }

  // --- Dimensions (L × W × H) ---
  const dimFields: { selectors: string[]; value: string }[] = [
    {
      selectors: ['[id*="length"]', '[name*="length"]', '[placeholder*="Length" i]'],
      value: FREIGHT.length,
    },
    {
      selectors: ['[id*="width"]', '[name*="width"]', '[placeholder*="Width" i]'],
      value: FREIGHT.width,
    },
    {
      selectors: ['[id*="height"]', '[name*="height"]', '[placeholder*="Height" i]'],
      value: FREIGHT.height,
    },
  ]
  for (const dim of dimFields) {
    for (const sel of dim.selectors) {
      try {
        const el = page.locator(sel).first()
        if (await el.isVisible({ timeout: 1000 })) {
          await el.fill(dim.value)
          break
        }
      } catch {
        // continue
      }
    }
  }

  // --- Pickup date ---
  // Echo expects MM/DD/YYYY. Also must skip weekends and US federal holidays.
  const pickupDateFormatted = getNextValidPickupDate(quote.pickup_date)
  console.log(`Pickup date: ${quote.pickup_date} → using ${pickupDateFormatted}`)

  const pickupDateSelectors = [
    '[id*="pickup"][id*="date"]',
    '[name*="pickup"][name*="date"]',
    '[placeholder*="Pickup Date" i]',
    '[aria-label*="Pickup Date" i]',
    '[data-testid*="pickup-date"]',
  ]
  for (const sel of pickupDateSelectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click({ clickCount: 3 })
        await el.fill(pickupDateFormatted)
        await el.press('Tab')
        await sleep(500)
        // Check for holiday error and advance date if needed
        const holidayErr = await page.locator(':text("holiday"), :text("Holiday")').isVisible({ timeout: 800 }).catch(() => false)
        if (holidayErr) {
          const nextDay = getNextValidPickupDate(pickupDateFormatted, 1)
          console.log(`Holiday detected, advancing to ${nextDay}`)
          await el.fill(nextDay)
          await el.press('Tab')
        }
        break
      }
    } catch {
      // continue
    }
  }

  // --- NMFC (optional — fill if visible) ---
  const nmfcSelectors = ['[id*="nmfc"]', '[name*="nmfc"]', '[placeholder*="NMFC" i]', '[aria-label*="NMFC" i]']
  for (const sel of nmfcSelectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 1000 })) {
        await el.fill(FREIGHT.nmfc)
        break
      }
    } catch {
      // continue
    }
  }

  console.log('Freight details filled')
}

// ---------------------------------------------------------------------------
// Step 6 — Select liftgate accessorial (delivery only)
// ---------------------------------------------------------------------------
async function selectLiftgateOptions(page: Page, liftgateRequired: boolean): Promise<void> {
  // Warehouse pickups never require liftgate — only delivery side
  if (!liftgateRequired) {
    console.log('No delivery liftgate required')
    return
  }

  console.log('Selecting delivery liftgate accessorial...')

  const liftgateSelectors = [
    'input[type="checkbox"][id*="delivery"][id*="liftgate"]',
    'input[type="checkbox"][name*="delivery"][name*="liftgate"]',
    'input[type="checkbox"][aria-label*="Lift-Gate Delivery" i]',
    'input[type="checkbox"][aria-label*="Liftgate Delivery" i]',
    'label:has-text("Lift-Gate Delivery") input[type="checkbox"]',
    'label:has-text("Liftgate Delivery") input[type="checkbox"]',
    'label:has-text("Lift Gate Delivery") input[type="checkbox"]',
    'label:has-text("Delivery Liftgate") input[type="checkbox"]',
  ]

  for (const sel of liftgateSelectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 2000 })) {
        if (!(await el.isChecked())) await el.check()
        console.log('Delivery liftgate accessorial selected')
        return
      }
    } catch {
      // continue
    }
  }

  // Fallback — click any label/button containing delivery liftgate text
  const textSelectors = [
    'text=Lift-Gate Delivery',
    'text=Liftgate Delivery',
    'text=Lift Gate Delivery',
  ]
  for (const sel of textSelectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click()
        console.log('Delivery liftgate selected via text click')
        return
      }
    } catch {
      // continue
    }
  }

  console.warn('WARNING  Could not locate delivery liftgate checkbox — skipping')
}

// ---------------------------------------------------------------------------
// Step 7 — Submit the quote form
// ---------------------------------------------------------------------------
async function submitQuoteForm(page: Page): Promise<void> {
  console.log('Submitting quote form...')

  const submitSelectors = [
    'button[type="submit"]:has-text("Get Rate")',
    'button[type="submit"]:has-text("Get Quote")',
    'button[type="submit"]:has-text("Submit")',
    'button:has-text("Get Rate")',
    'button:has-text("Get Quote")',
    'button:has-text("Calculate Rate")',
    'button:has-text("Request Quote")',
    'button:has-text("Search Rates")',
    'input[type="submit"]',
    '[data-testid*="submit"]',
    '[data-testid*="get-rate"]',
  ]

  for (const sel of submitSelectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click()
        console.log(`Submit button clicked: ${sel}`)
        return
      }
    } catch {
      // continue
    }
  }

  throw new Error('Could not find submit button. Check quote form selectors for current Echo portal version.')
}

// ---------------------------------------------------------------------------
// Step 8 — Wait for results to populate
// ---------------------------------------------------------------------------
async function waitForResults(page: Page): Promise<void> {
  console.log('Waiting for quote results...')

  const resultSelectors = [
    '[class*="carrier-result"]',
    '[class*="rate-result"]',
    '[data-testid*="carrier"]',
    '[data-testid*="result"]',
    'table[class*="result"]',
    'table[class*="rate"]',
    '.carrier-list',
    '.rate-list',
    '.results-table',
    'tr:has-text("USD")',
    'tr:has-text("$")',
    '[class*="quote-result"]',
    '[class*="pricing-result"]',
  ]

  const deadline = Date.now() + 60_000 // 60 second timeout
  let found = false

  while (Date.now() < deadline) {
    for (const sel of resultSelectors) {
      try {
        if ((await page.locator(sel).count()) > 0) {
          found = true
          break
        }
      } catch {
        // continue
      }
    }
    if (found) break
    await sleep(2000)
  }

  if (!found) {
    // Check for an explicit error banner before assuming a problem
    try {
      const errorEl = page.locator('[class*="error"], [role="alert"], .alert-danger, .alert-error').first()
      if (await errorEl.isVisible({ timeout: 2000 })) {
        const errorText = await errorEl.textContent()
        throw new Error(`Echo portal returned an error: ${errorText?.trim()}`)
      }
    } catch (e) {
      if ((e as Error).message.startsWith('Echo portal')) throw e
    }
    console.warn('WARNING  Could not detect results container — attempting extraction anyway')
  } else {
    console.log('Results loaded')
    await sleep(2000) // Allow any lazy-loaded rows to finish rendering
  }
}

// ---------------------------------------------------------------------------
// Step 9 — Extract top 3 carrier results
// ---------------------------------------------------------------------------
async function extractResults(
  page: Page,
): Promise<{ results: CarrierResult[]; echoQuoteId: string | null }> {
  console.log('Extracting carrier results...')

  let echoQuoteId: string | null = null
  const rows: ExtractedRow[] = []

  // Try to capture the Echo quote / reference number
  const quoteIdSelectors = [
    '[class*="quote-id"]',
    '[class*="reference-id"]',
    '[data-testid*="quote-id"]',
    'span:has-text("Quote #")',
    'span:has-text("Ref #")',
    'strong:has-text("#")',
    '[class*="confirmation"]',
  ]
  for (const sel of quoteIdSelectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 2000 })) {
        const text = await el.textContent()
        const match = text?.match(/[A-Z0-9]{6,20}/)
        if (match) {
          echoQuoteId = match[0]
          break
        }
      }
    } catch {
      // continue
    }
  }

  // Carrier row extraction — try several result container patterns
  const rowSelectors = [
    'tr[class*="carrier"]',
    'tr[class*="rate-row"]',
    '[class*="carrier-item"]',
    '[class*="rate-item"]',
    '[data-testid*="carrier-row"]',
    '[class*="quote-result-row"]',
    'tbody tr',
  ]

  for (const sel of rowSelectors) {
    try {
      const elements = page.locator(sel)
      const count = await elements.count()
      if (count === 0) continue

      for (let i = 0; i < Math.min(count, 15); i++) {
        const row = elements.nth(i)
        const text = await row.textContent()
        if (!text) continue

        // Row must contain a price marker
        if (!text.includes('$') && !text.includes('USD')) continue

        // Extract price — handle formats like $1,234.56 or 1234.56 USD
        const priceMatch = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)|(\d[\d,]+(?:\.\d{1,2})?)\s*USD/)
        if (!priceMatch) continue
        const raw = (priceMatch[1] || priceMatch[2]).replace(/,/g, '')
        const price = parseFloat(raw)
        if (isNaN(price) || price <= 0) continue

        // Extract carrier name
        let carrier = 'Unknown Carrier'
        try {
          const nameEl = row
            .locator('[class*="carrier-name"], [class*="carrier"], td:first-child, th:first-child')
            .first()
          const nameText = await nameEl.textContent()
          if (nameText && nameText.trim().length > 1 && nameText.trim().length < 60) {
            carrier = nameText.trim()
          }
        } catch {
          // Parse from full row text — take tokens before the price
          const tokens = text.trim().split(/\s{2,}|\t/)
          const priceIdx = tokens.findIndex(t => t.includes('$') || t.includes('USD'))
          if (priceIdx > 0) {
            carrier = tokens.slice(0, Math.min(priceIdx, 3)).join(' ').trim()
          }
        }

        // Extract transit days (e.g. "3 business days", "2-4 days")
        let transitDays: number | null = null
        const transitMatch = text.match(/(\d+)(?:-\d+)?\s*(?:business\s+)?days?/i)
        if (transitMatch) transitDays = parseInt(transitMatch[1], 10)

        // Extract delivery date
        let deliveryDate: string | null = null
        const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/)
        if (dateMatch) {
          try {
            deliveryDate = new Date(dateMatch[1]).toISOString().split('T')[0]
          } catch {
            // ignore bad dates
          }
        }

        rows.push({ carrier, price, transit: transitDays, deliveryDate })
      }

      if (rows.length > 0) break // Stop once we have data from a successful selector
    } catch {
      // try next selector
    }
  }

  // Sort ascending by price, take cheapest 3
  rows.sort((a, b) => a.price - b.price)

  const results: CarrierResult[] = rows.slice(0, 3).map(r => ({
    carrier_name: r.carrier,
    price: r.price,
    transit_days: r.transit,
    estimated_delivery_date: r.deliveryDate,
    echo_quote_id: echoQuoteId,
  }))

  console.log(`Extracted ${results.length} carrier result(s)`)
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.carrier_name}: $${r.price.toFixed(2)}${r.transit_days ? ` (${r.transit_days} days)` : ''}`)
  })

  return { results, echoQuoteId }
}

// ---------------------------------------------------------------------------
// Main orchestration — with retry on transient failures
// ---------------------------------------------------------------------------
async function runAutomation(): Promise<void> {
  console.log('\nForest Coffee Logistics - Echo Automation')
  console.log(`Quote ID: ${QUOTE_ID}\n`)

  // Fetch quote + joined warehouse from Supabase
  const { data: quote, error: fetchError } = await supabase
    .from('quotes')
    .select('*, warehouse:warehouses(*)')
    .eq('id', QUOTE_ID)
    .single()

  if (fetchError || !quote) {
    const msg = fetchError?.message ?? 'Quote not found'
    console.error(`ERROR  Could not fetch quote: ${msg}`)
    process.exit(1)
  }

  const typedQuote = quote as QuoteData

  console.log(`Customer : ${typedQuote.customer_name}`)
  console.log(`Shipment : ${typedQuote.total_pallets} pallets | ${typedQuote.total_weight} lbs`)
  console.log(`Route    : ${resolveOriginZip(typedQuote)} -> ${typedQuote.destination_zip}`)
  console.log(`Liftgate : ${typedQuote.liftgate_required ? 'YES (delivery)' : 'No'}`)

  // Canadian postal code — skip automation, mark as unsupported
  if (/^[A-Za-z]\d[A-Za-z]/i.test(typedQuote.destination_zip)) {
    console.log('Canadian destination detected — automation not supported')
    await saveResults({
      quoteId: QUOTE_ID,
      results: [],
      echoQuoteId: null,
      screenshotUrl: null,
      error: 'Canadian shipments are not automated. Please quote manually.',
    })
    return
  }

  const screenshotDir = path.join(__dirname, '..', 'temp-screenshots')
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true })

  const MAX_RETRIES = 2
  let attempt = 0
  let lastError: Error | null = null

  while (attempt <= MAX_RETRIES) {
    if (attempt > 0) {
      console.log(`\nRetry attempt ${attempt}/${MAX_RETRIES}...`)
      await sleep(5000)
    }
    attempt++

    let browser: Browser | null = null

    try {
      // --------------- Launch browser ---------------
      browser = await chromium.launch({
        headless: true,  // no visible window — much lighter on CPU/RAM
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      })

      const context = await browser.newContext({
        viewport: { width: 1400, height: 900 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        acceptDownloads: false,
        ignoreHTTPSErrors: false,
      })

      const page = await context.newPage()

      // Log browser console errors for debugging
      page.on('console', msg => {
        if (msg.type() === 'error') console.log(`[browser:error] ${msg.text()}`)
      })
      page.on('pageerror', err => console.log(`[browser:pageerror] ${err.message}`))

      // --- Step 1: Login ---
      await loginToEcho(page)
      await page.screenshot({ path: path.join(screenshotDir, `${QUOTE_ID}-1-login.png`) })

      // --- Step 2: Navigate to LTL quote form ---
      await navigateToLTLQuote(page)
      await sleep(2000)
      await page.screenshot({ path: path.join(screenshotDir, `${QUOTE_ID}-2-quote-form.png`) })

      // --- Step 3: Origin ---
      await fillOriginDetails(page, typedQuote, screenshotDir)
      await sleep(500)

      // --- Step 4: Destination ---
      await fillDestinationDetails(page, typedQuote, screenshotDir)
      await sleep(500)

      // --- Step 5: Freight details ---
      await fillFreightDetails(page, typedQuote)
      await sleep(500)

      // --- Step 6: Liftgate accessorial ---
      await selectLiftgateOptions(page, typedQuote.liftgate_required)
      await sleep(300)

      await page.screenshot({ path: path.join(screenshotDir, `${QUOTE_ID}-3-filled-form.png`) })

      // --- Step 7: Submit ---
      await submitQuoteForm(page)

      // --- Step 8: Wait for results ---
      await waitForResults(page)

      // --- Step 9: Screenshot results ---
      const resultsPath = path.join(screenshotDir, `${QUOTE_ID}-4-results.png`)
      await page.screenshot({ path: resultsPath, fullPage: true })
      console.log('Results screenshot captured')

      // --- Step 10: Extract carrier data ---
      const { results, echoQuoteId } = await extractResults(page)

      if (results.length === 0) {
        throw new Error('No carrier results could be extracted from the Echo portal response page.')
      }

      // --- Step 11: Upload screenshot ---
      const screenshotUrl = await uploadScreenshot(resultsPath, QUOTE_ID)
      if (screenshotUrl) console.log(`Screenshot URL: ${screenshotUrl}`)

      // --- Step 12: Persist results ---
      await saveResults({ quoteId: QUOTE_ID, results, echoQuoteId, screenshotUrl })

      console.log(`\nAutomation complete!`)
      console.log(`Best rate : ${results[0].carrier_name} at $${results[0].price.toFixed(2)}`)

      // Success — exit retry loop
      return
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.error(`Attempt ${attempt} failed: ${lastError.message}`)
    } finally {
      if (browser) {
        await browser.close()
        console.log('Browser closed')
      }

      // Clean up this attempt's temp screenshots
      try {
        const files = fs.readdirSync(screenshotDir).filter(f => f.startsWith(QUOTE_ID))
        files.forEach(f => {
          try { fs.unlinkSync(path.join(screenshotDir, f)) } catch { /* ignore */ }
        })
      } catch { /* cleanup is best-effort */ }
    }
  }

  // All retries exhausted
  const errorMessage = lastError?.message ?? 'Unknown automation error'
  console.error(`All ${MAX_RETRIES + 1} attempts failed. Saving error state.`)

  try {
    await saveResults({
      quoteId: QUOTE_ID,
      results: [],
      echoQuoteId: null,
      screenshotUrl: null,
      error: errorMessage,
    })
  } catch (saveErr) {
    console.error('Could not save error state:', saveErr)
  }

  throw new Error(errorMessage)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
runAutomation()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch(err => {
    console.error('Fatal error:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
