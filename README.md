# Forest Coffee Logistics

Internal LTL freight quoting application for Forest Coffee. Automates the process of obtaining Less-than-Truckload shipping rates from Echo Global Logistics, calculates pallet counts and weights for coffee shipments, stores all quotes in a searchable database, and exposes a clean dashboard for the operations team.

When a new quote is submitted for a US destination, the app automatically triggers a Playwright browser automation that logs into the Echo portal, fills out the LTL quote form, extracts the top 3 cheapest carriers with pricing and transit times, takes a screenshot, and saves everything back to the database — all without manual data entry.

---

## Features

- Authenticated quote creation with per-user data isolation
- Automatic pallet and weight calculation for 70 kg bags, 35 kg bags, and 24 kg boxes
- Playwright automation for Echo Global Logistics LTL portal
- Top 3 cheapest carrier extraction per quote
- Screenshot capture and upload to Supabase Storage
- Quote history with full-text search, status filtering, and date range filters
- Dashboard with statistics: total quotes, monthly volume, average price, top carriers
- Liftgate delivery accessorial support (delivery side only — warehouses never require liftgate pickup)
- Canadian destination detection — saved to database but flagged as manual-quote-only
- GitHub Actions workflow for free cloud-based automation (no server required)
- Dark / light theme toggle
- Responsive sidebar layout

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Styling | Tailwind CSS + shadcn/ui |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Automation | Playwright (Chromium) |
| Script runner | ts-node |
| CI/CD | GitHub Actions |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm 10 or later
- A [Supabase](https://supabase.com) account (free tier is sufficient)
- A [Vercel](https://vercel.com) account (for deployment, free tier works)
- A GitHub account (for the free Actions-based automation)
- Echo Global Logistics portal credentials (username and password)

---

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd forest-coffee-logistics
npm install
```

---

### 2. Supabase Setup

#### 2a. Create a new Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and click **New project**.
2. Choose an organization, give it a name (e.g. `forest-coffee`), set a strong database password, and select the region closest to you.
3. Wait for the project to finish provisioning (about 60 seconds).

#### 2b. Run the database schema

1. In your Supabase project, open the **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `supabase/schema.sql` from this repo and paste the entire contents into the editor.
4. Click **Run**. This creates all tables, indexes, RLS policies, triggers, and seeds the 6 warehouses.

#### 2c. Create the screenshots storage bucket

The automation script uploads carrier result screenshots here.

**Option A — Dashboard (recommended for first-timers)**

1. In your Supabase project, click **Storage** in the left sidebar.
2. Click **New bucket**.
3. Set **Name** to `screenshots`.
4. Toggle **Public bucket** to ON (so screenshot URLs work without signed tokens).
5. Click **Save**.

**Option B — SQL Editor**

Paste and run this in the SQL editor:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true)
ON CONFLICT (id) DO NOTHING;
```

**Option C — Supabase CLI**

```bash
supabase storage create-bucket screenshots --public
```

#### 2d. Collect your API keys

In your Supabase project, go to **Settings > API**:

- **Project URL** — looks like `https://xyzxyz.supabase.co`
- **anon / public key** — long JWT starting with `eyJ...`
- **service_role key** — a second long JWT (keep this secret — it bypasses RLS)

---

### 3. Environment Variables

Copy the example file and fill in every value:

```bash
cp .env.example .env.local
```

Open `.env.local` and set the following:

```dotenv
# ── Supabase ────────────────────────────────────────────────────
# Found in: Supabase Dashboard > Settings > API

NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── Echo Global Logistics ───────────────────────────────────────
# Your Echo shipper portal login credentials

ECHO_USERNAME=your.echo@email.com
ECHO_PASSWORD=YourEchoPassword123!

# The Echo portal login URL (default is correct for most accounts)
ECHO_PORTAL_URL=https://login.echo.com

# ── Application ─────────────────────────────────────────────────
# Local development URL (change to your Vercel URL in production)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# A random secret string used to authenticate automation callbacks
# Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTOMATION_SECRET=replace-with-a-long-random-secret

# ── Storage ─────────────────────────────────────────────────────
# Must match the bucket name you created in step 2c
SUPABASE_STORAGE_BUCKET=screenshots
```

> **Security note:** Never commit `.env.local` to version control. It is already in `.gitignore`.

---

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

You will be redirected to the login page. Use Supabase Auth to create an account:
1. Click **Sign up** (or use **Sign in with Email** if you have Magic Link enabled in Supabase Auth settings).
2. Verify your email if required.
3. You will land on the Dashboard.

---

### 5. Deploy to Vercel

#### 5a. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

#### 5b. Connect to Vercel

1. Go to [https://vercel.com/new](https://vercel.com/new) and click **Import Git Repository**.
2. Authorize Vercel to access your GitHub account if prompted.
3. Select your `forest-coffee-logistics` repository.
4. Vercel will auto-detect Next.js — no build settings need to be changed.
5. Before clicking **Deploy**, click **Environment Variables** and add every variable from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ECHO_USERNAME`
   - `ECHO_PASSWORD`
   - `ECHO_PORTAL_URL`
   - `NEXT_PUBLIC_APP_URL` — set this to your Vercel production URL, e.g. `https://forest-coffee.vercel.app`
   - `AUTOMATION_SECRET`
   - `SUPABASE_STORAGE_BUCKET`
6. Click **Deploy**. Vercel will build and publish the app.

#### 5c. Update Supabase Auth redirect URL

After getting your production URL:

1. In Supabase, go to **Authentication > URL Configuration**.
2. Set **Site URL** to your Vercel URL (e.g. `https://forest-coffee.vercel.app`).
3. Add the same URL to the **Redirect URLs** list.

---

### 6. Playwright Automation Setup

The automation script (`scripts/echo-automation.ts`) is what logs into Echo, fills the LTL quote form, and extracts pricing. You can run it locally for testing or let GitHub Actions run it for free in the cloud on every new quote.

#### Option A — Run Locally

Install the Chromium browser used by Playwright:

```bash
npx playwright install chromium
```

Run the script against a specific quote UUID from your database:

```bash
npx ts-node --project tsconfig.scripts.json scripts/echo-automation.ts --quote-id=<uuid>
```

Or use the npm shortcut:

```bash
npm run automation -- --quote-id=<uuid>
```

The script will:
1. Read the quote from Supabase
2. Open a headless Chromium browser
3. Log into the Echo portal
4. Navigate to the LTL Get a Rate page
5. Fill all form fields (origin/destination ZIP, pallets, weight, freight class 65, dimensions 48×40×48, pickup date)
6. Select delivery liftgate if required
7. Submit the form and wait for results
8. Extract the top 3 cheapest carriers
9. Take a full-page screenshot
10. Upload the screenshot to Supabase Storage
11. POST results back to `/api/automation` (PUT method)
12. Mark the quote as `completed` in the database

#### Option B — GitHub Actions (Free Cloud Automation)

This is the recommended production setup. GitHub Actions provides 2,000 free minutes per month on public repos and 2,000 minutes on private repos for free accounts, which is more than enough for typical quoting volumes.

**How it works:**

1. User submits a new quote in the web app
2. `POST /api/quotes` creates the quote in Supabase, then calls `POST /api/automation`
3. `/api/automation` (POST) marks the quote as `processing`, then sends a `repository_dispatch` webhook to GitHub
4. GitHub Actions receives the webhook and runs `automation.yml`, passing the `quote_id` as a payload
5. The Actions runner installs dependencies, installs Chromium, and executes `scripts/echo-automation.ts`
6. The script sends results back to `PUT /api/automation` on your Vercel deployment
7. The quote is updated to `completed` with carrier pricing

**Setup steps:**

1. Fork this repository to your GitHub account (or push your own copy).

2. In your GitHub repository, go to **Settings > Secrets and variables > Actions > New repository secret** and add each of the following secrets:

   | Secret name | Value |
   |---|---|
   | `ECHO_USERNAME` | Your Echo portal email |
   | `ECHO_PASSWORD` | Your Echo portal password |
   | `ECHO_PORTAL_URL` | `https://login.echo.com` |
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
   | `NEXT_PUBLIC_APP_URL` | Your Vercel production URL |
   | `AUTOMATION_SECRET` | Same secret as in your Vercel env vars |

3. In your Vercel environment variables, update `NEXT_PUBLIC_APP_URL` to your production URL and add two additional variables for the GitHub dispatch:

   | Variable | Value |
   |---|---|
   | `GITHUB_ACTIONS_TOKEN` | A GitHub Personal Access Token with `repo` scope (or `actions:write` on fine-grained tokens) |
   | `GITHUB_REPO` | `your-username/forest-coffee-logistics` |

4. Update `app/api/automation/route.ts` POST handler to dispatch to GitHub instead of logging instructions. Replace the placeholder comment block with:

   ```typescript
   // Dispatch to GitHub Actions
   const ghResponse = await fetch(
     `https://api.github.com/repos/${process.env.GITHUB_REPO}/dispatches`,
     {
       method: 'POST',
       headers: {
         Authorization: `Bearer ${process.env.GITHUB_ACTIONS_TOKEN}`,
         Accept: 'application/vnd.github+json',
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         event_type: 'run-echo-automation',
         client_payload: { quote_id },
       }),
     }
   )
   if (!ghResponse.ok) {
     throw new Error(`GitHub dispatch failed: ${ghResponse.status}`)
   }
   ```

5. Test by submitting a new quote for a US destination. Watch the **Actions** tab in your GitHub repository for the workflow run.

---

## Database Schema

### `warehouses`

Stores all pickup warehouse locations. Pre-seeded via `schema.sql`.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | TEXT | Display name |
| `code` | TEXT | Unique short code (e.g. `ANNEX`) |
| `address` | TEXT | Street address |
| `city` | TEXT | City |
| `state` | TEXT | State/province abbreviation |
| `zip` | TEXT | ZIP or postal code |
| `phone` | TEXT | Contact phone (nullable) |
| `country` | TEXT | `US` or `CA` |
| `is_active` | BOOLEAN | Whether to show in the new quote form |

### `quotes`

One row per quote request.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `customer_name` | TEXT | Name of the customer being quoted |
| `origin_warehouse_id` | UUID | FK to `warehouses` |
| `origin_zip` | TEXT | Denormalized from warehouse at creation time |
| `destination_zip` | TEXT | Destination ZIP code |
| `destination_city/state` | TEXT | Destination city and state |
| `pickup_date` | DATE | Requested pickup date |
| `qty_70kg / qty_35kg / qty_24kg` | INTEGER | Bag/box quantities by size |
| `total_pallets` | INTEGER | Calculated pallet count |
| `total_weight` | DECIMAL | Total shipment weight in lbs |
| `liftgate_required` | BOOLEAN | Whether delivery liftgate is needed |
| `status` | TEXT | `pending`, `processing`, `completed`, `failed` |
| `cheapest_carrier` | TEXT | Name of the least-expensive carrier found |
| `cheapest_price` | DECIMAL | Price in USD |
| `cheapest_transit_days` | INTEGER | Transit time in business days |
| `echo_quote_id` | TEXT | Echo portal quote reference number |
| `screenshot_url` | TEXT | Public URL to the results screenshot |
| `automation_error` | TEXT | Error message if automation failed |
| `created_by` | UUID | FK to `auth.users` (RLS enforced) |

### `quote_results`

Up to 3 carrier rows per quote, ranked by price.

| Column | Type | Description |
|---|---|---|
| `quote_id` | UUID | FK to `quotes` |
| `carrier_name` | TEXT | Carrier name (e.g. `Estes Express`) |
| `price` | DECIMAL | USD price |
| `transit_days` | INTEGER | Business days to delivery |
| `estimated_delivery_date` | DATE | Estimated delivery date |
| `rank` | INTEGER | 1 = cheapest, 2 = second, 3 = third |

### `screenshots`

Metadata for uploaded screenshot files.

| Column | Type | Description |
|---|---|---|
| `quote_id` | UUID | FK to `quotes` |
| `storage_path` | TEXT | Path within the `screenshots` Supabase Storage bucket |
| `public_url` | TEXT | Full public HTTPS URL |

---

## Pallet Calculation Logic

Pallet count is calculated as the **ceiling of the sum of pallet fractions** across all three bag sizes. This ensures partial pallets always round up to a full pallet.

```
pallets_70kg = qty_70kg / 10
pallets_35kg = qty_35kg / 12
pallets_24kg = qty_24kg / 50

total_pallets = CEILING(pallets_70kg + pallets_35kg + pallets_24kg)
```

**Examples:**

| 70 kg | 35 kg | 24 kg | Calculation | Pallets |
|---|---|---|---|---|
| 10 | 0 | 0 | ceil(1.0) | 1 |
| 15 | 0 | 0 | ceil(1.5) | 2 |
| 6 | 6 | 0 | ceil(0.6 + 0.5) | 2 |
| 0 | 12 | 50 | ceil(1.0 + 1.0) | 2 |
| 20 | 24 | 100 | ceil(2.0 + 2.0 + 2.0) | 6 |

---

## Weight Calculation

Each bag/box size has a fixed lbs-per-unit conversion:

| Product | kg | lbs per unit |
|---|---|---|
| 70 kg bag | 70.0 | 154.32 lbs |
| 35 kg bag | 35.0 | 77.16 lbs |
| 24 kg box | 24.0 | 52.91 lbs |

```
total_weight = (qty_70kg × 154.32) + (qty_35kg × 77.16) + (qty_24kg × 52.91)
```

Result is rounded to 2 decimal places. The automation script always passes `CEILING(total_weight)` as the weight to Echo (whole number, rounding up).

---

## Warehouses

Six warehouse locations are pre-seeded into the database:

| Name | Code | Address | City | State | ZIP | Country |
|---|---|---|---|---|---|---|
| ANNEX CONSOLIDATION CENTER | ANNEX | 300 Mitchell Ave | Alameda | CA | 94501 | US |
| CONTINENTAL NJ | CONTINENTAL | 200 Middlesex Ave | Carteret | NJ | 07008 | US |
| GREEN ROOM | GREEN_ROOM | 1302 29th Street NW | Auburn | WA | 98001 | US |
| DUPUY STORAGE HOUSTON | DUPUY | 7703 Cannon Street | Houston | TX | 77021 | US |
| COSTA ORO INTL LLC | COSTA_ORO | 440 E 19th Street | Tacoma | WA | 98421 | US |
| GBH DEPOT INC - CANADA | GBH_CANADA | 55 Marie-Curie | Salaberry-de-Valleyfield | QC | J6T 0R8 | CA |

> **Canada note:** GBH DEPOT INC - CANADA is stored in the database and can be selected as an origin, but quotes from this warehouse are always routed to Canadian destinations (postal code format `A1A`) and are automatically skipped by the Echo automation. These quotes must be priced manually.

---

## Business Rules

1. **Liftgate pickup is never required.** All origin locations are freight warehouses with dock doors. The `liftgate_required` field in the database and form applies only to the delivery (destination) side.

2. **Liftgate delivery** — the user selects YES/NO on the new quote form. If YES, the automation checks the "Lift-Gate Delivery" accessorial on the Echo rate form before submitting.

3. **Canadian destinations** — any destination ZIP code matching the Canadian postal code pattern (`[A-Z][0-9][A-Z]...`) is detected automatically. The quote is saved to the database with status `pending` and an error message explaining that Canadian shipments are not automated. No browser automation is triggered.

4. **Freight class** is always 65 for coffee in bags (NMFC 073260-10). This is hardcoded in the automation script and does not vary.

5. **Dimensions** are always 48 × 40 × 48 inches (standard GMA pallet). This is hardcoded.

6. **Top 3 results** are always saved. The cheapest carrier price is also denormalized onto the parent `quotes` row for quick display without a join.

7. **Retry logic** — the automation script retries up to 2 times (3 total attempts) on any error before marking the quote as `failed`. A 5-second delay separates each retry.

---

## Troubleshooting

### Login failed — still on login page

- Verify `ECHO_USERNAME` and `ECHO_PASSWORD` in your environment variables.
- Check that the Echo portal is reachable from your server/runner. Some corporate accounts require specific IP ranges.
- The Echo portal URL may have changed. Try updating `ECHO_PORTAL_URL` to the actual URL you use to log in.

### Could not navigate to LTL quote page

- The automation tries several common paths (`/shipper/get-a-rate`, `/quote/ltl`, etc.) and then scans for nav links.
- Log into Echo manually, navigate to the LTL rate form, and check the URL. Add that path to the `ltlPaths` array in `scripts/echo-automation.ts`.

### No carrier results extracted

- The Echo portal may have updated its HTML structure. Open the results screenshot (uploaded to Supabase Storage, URL on the quote detail page) and compare the actual DOM to the selectors in `extractResults()`.
- Run the script locally with `headless: false` temporarily to watch the browser:
  ```typescript
  browser = await chromium.launch({ headless: false })
  ```

### Screenshot upload fails

- Confirm the `screenshots` Supabase Storage bucket exists and is set to **Public**.
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly — the anon key does not have storage write permissions.

### GitHub Actions workflow not triggering

- Confirm the `GITHUB_ACTIONS_TOKEN` has the `repo` scope (classic token) or `actions:write` permission (fine-grained token).
- Confirm the `GITHUB_REPO` variable matches the exact `owner/repo` format.
- Check the **Actions** tab in your GitHub repo for any disabled workflows (they can be disabled by default on forks).

### Quote stuck in `processing`

- This means the automation was triggered but never called back to `PUT /api/automation`.
- Check the GitHub Actions run logs for errors.
- Verify `NEXT_PUBLIC_APP_URL` points to your live Vercel URL (not `localhost`) in both Vercel env vars and GitHub secrets.
- Check that `AUTOMATION_SECRET` matches exactly between Vercel and GitHub secrets.

### Supabase RLS blocking automation results

- The automation script uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. If you see 403 errors from Supabase in the script logs, double-check that you are using the service role key and not the anon key.

### `ts-node` not found

```bash
npm install   # installs ts-node from devDependencies
```

If running globally:

```bash
npm install -g ts-node typescript
```
