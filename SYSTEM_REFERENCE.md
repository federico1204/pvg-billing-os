# PVG Billing OS — System Reference

> Living document. Update when features are added, removed, or changed.
> Use this as context when working with other AI models or continuing development.

---

## What This Is

A private, password-protected billing management platform for **Pura Vida Growth** (Federico Rojas), a marketing agency based in Costa Rica. Built as a Next.js 14 app deployed on Vercel with Supabase as the database. All management happens in this single web app — no Google Sheets, no separate tools.

Live URL: **https://pvg-billing-os.vercel.app**
Password: `pvgbilling2026`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| DB Client | `@supabase/supabase-js` with anon key (RLS disabled) |
| Auth | `jose` JWT, cookie-based (`pvg_billing_session`) |
| Email | Resend (`billing@puravidagrowth.com`) |
| AI | Anthropic Claude (`claude-haiku-4-5-20251001`) |
| Drive | `googleapis` with service account |
| Deployment | Vercel (team: `federico-8343s-projects`) |
| Repo | `github.com/federico1204/pvg-billing-os` |

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://ujzrlmucuavqspnpzdsk.supabase.co
SUPABASE_SERVICE_KEY=<anon key>
JWT_SECRET=pvg-billing-jwt-secret-2026
ADMIN_PASSWORD=pvgbilling2026
RESEND_API_KEY=<resend key>
ANTHROPIC_API_KEY=<anthropic key>
GOOGLE_SERVICE_ACCOUNT_JSON=<service account JSON, minified>
GOOGLE_DRIVE_FOLDER_ID=1AfAEaAjHYvzjaLTeG5jii0OrW2eVyLbD
```

---

## Database Schema

### `invoices`
Additional columns added in v2:
- `invoice_recipient_entity_id` INT FK → client_entities
- `has_payment_schedule` BOOLEAN
- `direction` VARCHAR(20) — 'outbound' (default) | 'inbound'
- `client_llc_name`, `client_commercial_name`, `line_items`, `invoice_date`, `preferred_language`

### `invoices` (original)
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| invoice_ref | VARCHAR(30) UNIQUE | Auto-generated: `PVG-YYYY-NNN` |
| client_name | VARCHAR | |
| client_email | VARCHAR | |
| client_company | VARCHAR | |
| project_name | VARCHAR | |
| total_amount | DECIMAL(12,2) | |
| paid_amount | DECIMAL(12,2) | Default 0 |
| currency | VARCHAR(3) | USD / CRC / EUR |
| invoice_type | VARCHAR(20) | standard / cr_iva / credit_note |
| due_date | DATE | |
| invoice_date | DATE | |
| status | VARCHAR(20) | pending / paid |
| billing_status | VARCHAR(30) | See 12 statuses below |
| follow_up_count | INTEGER | |
| last_follow_up_at | TIMESTAMPTZ | |
| sent_at | TIMESTAMPTZ | |
| sinpe_number | VARCHAR(20) | |
| notes | TEXT | |
| line_items | JSONB | `[{description, category, quantity, rate, amount}]` |
| preferred_language | VARCHAR(5) | en / es |
| created_at / updated_at | TIMESTAMPTZ | |

### `payments`
| Column | Type |
|---|---|
| id | SERIAL PK |
| invoice_id | FK → invoices |
| amount | DECIMAL(12,2) |
| currency | VARCHAR(3) |
| method | VARCHAR | bank_transfer / sinpe / card / cash |
| reference | TEXT |
| paid_at | TIMESTAMPTZ |

### `billing_activity`
| Column | Type |
|---|---|
| id | SERIAL PK |
| invoice_id | FK → invoices |
| action | VARCHAR | created / sent / follow_up_sent / payment_recorded / status_updated / imported |
| description | TEXT |
| performed_by | VARCHAR | admin / system / drive_import |
| created_at | TIMESTAMPTZ |

### `clients`
| Column | Type |
|---|---|
| id | SERIAL PK |
| name | VARCHAR |
| email | VARCHAR |
| company | VARCHAR |
| phone | VARCHAR |
| country | VARCHAR | Default: Costa Rica |
| sinpe_number | VARCHAR |
| preferred_language | VARCHAR(5) | en / es |
| notes | TEXT |
| created_at / updated_at | TIMESTAMPTZ |

### `expenses`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| date | DATE | |
| description | TEXT | |
| amount | DECIMAL(12,2) | |
| currency | VARCHAR(3) | |
| category | VARCHAR | QuickBooks-style (see categories below) |
| vendor | VARCHAR | |
| notes | TEXT | Contains "Ingreso · filename" for bank credits, "Gasto · filename" for debits |
| created_at | TIMESTAMPTZ | |

### `client_entities` (new in v2)
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| client_id | FK → clients | |
| entity_name | VARCHAR(300) | Legal name as it appears on bank transfers |
| entity_type | VARCHAR(30) | invoice_recipient / payer / both / llc_primary / llc_secondary |
| entity_email | VARCHAR(200) | |
| entity_phone | VARCHAR(50) | |
| is_invoice_recipient | BOOLEAN | Does this entity receive invoices? |
| is_payer | BOOLEAN | Does this entity send payments? |
| billing_split_percentage | DECIMAL(5,2) | % of invoice this entity pays (default 100) |
| split_order | INTEGER | Order in which entities pay |
| notes | TEXT | |
| created_at | TIMESTAMP | |

Pre-seeded: RE-LAB (Monica Morandi = invoice_recipient, Ricardo Montero Castro = payer)

### `payment_schedules` (new in v2)
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| invoice_id | FK → invoices | |
| installment_number | INTEGER | 1 = first payment |
| due_date | DATE | |
| amount | DECIMAL(12,2) | |
| percentage | DECIMAL(5,2) | e.g. 50.00 for 50% |
| entity_id | FK → client_entities | Who pays this installment |
| status | VARCHAR(30) | pending / paid / overdue / waived |
| paid_at | TIMESTAMP | |
| notes | TEXT | |

### `financial_snapshots` (new in v2)
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| snapshot_date | DATE UNIQUE | One row per day |
| total_outstanding_usd | DECIMAL(12,2) | |
| total_overdue_usd | DECIMAL(12,2) | |
| collected_this_month_usd | DECIMAL(12,2) | |
| total_expenses_this_month_usd | DECIMAL(12,2) | |
| net_cash_position_usd | DECIMAL(12,2) | |
| open_invoice_count | INTEGER | |
| overdue_invoice_count | INTEGER | |
| report_json | JSONB | Full Claude Opus analysis report |

### `vendors` (new in v2)
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR(200) | |
| email | VARCHAR(200) | |
| domain | VARCHAR(100) | e.g. resend.com — match by email domain |
| default_category | VARCHAR(100) | |
| default_currency | VARCHAR(3) | |
| is_recurring | BOOLEAN | |
| typical_amount | DECIMAL(12,2) | |
| notes | TEXT | |

Pre-seeded: Resend, Vercel, Supabase, Anthropic, ClickUp, Canva, Google Workspace, Meta Ads, Google Ads, BAC Costa Rica, Accountant

### `clients` (extended in v2)
New columns: `commercial_name`, `llc_name`, `preferred_language`, `billing_notes`, `payment_pattern`, `avg_days_late`, `last_price_increase`, `upsell_opportunity`, `client_health_score`, `churn_risk`, `revenue_rank`, `payment_terms_days`

### `settings`
Key-value store. Default keys:
- `company_name`, `sender_name`, `sender_email`
- `default_currency`, `default_payment_terms_days`
- `sinpe_number`
- `follow_up_interval_days` (default: 7)
- `due_soon_window_days` (default: 3)

### `email_templates`
IDs: `TPL-001` through `TPL-007` (English) + `TPL-001-ES` through `TPL-007-ES` (Spanish)
- 001: Invoice Initial Send
- 002: Follow-up Friendly
- 003: Follow-up Urgent
- 004: Payment Confirmed
- 005: Dispute Acknowledgment
- 006: Partial Payment Received
- 007: Invoice Cancelled

---

## Billing Statuses (12 total)

| Status | Description | Auto or Manual |
|---|---|---|
| DRAFT | Created, not sent | Auto |
| SENT | Email sent to client | Auto (on send) |
| DUE_SOON | Due within 3 days | Auto |
| DUE_TODAY | Due today | Auto |
| OVERDUE | Past due date | Auto |
| CLIENT_REPLIED | Client responded | Manual |
| PROOF_RECEIVED | Payment proof sent | Manual |
| WAITING_BANK | Awaiting bank confirmation | Manual |
| PARTIALLY_PAID | Partial payment recorded | Auto (on payment) |
| PAID | Fully paid | Auto (on payment) |
| DISPUTED | Invoice disputed | Manual |
| CANCELLED | Cancelled | Manual |

"Sticky" statuses (CLIENT_REPLIED, PROOF_RECEIVED, WAITING_BANK, DISPUTED, PARTIALLY_PAID) are not overridden by auto-computation.

---

## Pages

| Route | Description |
|---|---|
| `/login` | Password login |
| `/dashboard` | Overview: metrics + needs-attention queue |
| `/dashboard/invoices` | Invoice list + new invoice form (line items, QuickBooks service categories) |
| `/dashboard/invoices/[id]` | Invoice detail: payments, activity, send email, record payment, change status |
| `/dashboard/clients` | Client list with billed/outstanding stats |
| `/dashboard/clients/[id]` | Client detail: info, invoice history, preferred language, **payment entities section** |
| `/dashboard/expenses` | Expense log with QuickBooks-style categories |
| `/dashboard/bank` | Bank statement view: Income (credits) and Expense (debits) tabs, month filter, matched invoice cross-reference |
| `/dashboard/vendors` | Vendor directory: manage known vendors with default categories for auto-classification |
| `/dashboard/drive` | Google Drive import: lists folder PDFs, Claude extracts data, creates invoices |
| `/dashboard/monitor` | AI Monitor: Claude analyzes all open invoices, returns prioritized action list |
| `/dashboard/intelligence` | **Financial Intelligence**: Claude Opus CFO analysis — health score, cash flow forecast, revenue opportunities, risk flags, pricing insights |
| `/dashboard/activity` | Global activity log, grouped by day |
| `/dashboard/templates` | Edit all 14 email templates (EN + ES) |
| `/dashboard/settings` | Configure company, billing defaults, follow-up intervals |

---

## API Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Password auth → JWT cookie |
| POST | `/api/auth/logout` | Clear cookie |
| GET | `/api/invoices` | List all invoices (enriched) |
| POST | `/api/invoices` | Create invoice |
| GET | `/api/invoices/[id]` | Invoice detail + payments + activity |
| PATCH | `/api/invoices/[id]` | Update invoice fields |
| POST | `/api/invoices/[id]/email` | Send invoice or follow-up (bilingual) |
| POST | `/api/invoices/[id]/pay` | Record payment |
| POST | `/api/invoices/[id]/status` | Manual status override |
| GET | `/api/invoices/[id]/activity` | Invoice activity log |
| POST | `/api/invoices/follow-ups` | Batch send follow-ups to all eligible |
| GET | `/api/clients` | List clients (with invoice stats) |
| POST | `/api/clients` | Create client |
| GET | `/api/clients/[id]` | Client detail + invoice history |
| PATCH | `/api/clients/[id]` | Update client |
| DELETE | `/api/clients/[id]` | Delete client |
| GET | `/api/expenses` | List expenses (filterable by category/date) |
| POST | `/api/expenses` | Log expense |
| PATCH | `/api/expenses/[id]` | Edit expense |
| DELETE | `/api/expenses/[id]` | Delete expense |
| GET | `/api/settings` | Get all settings as key-value map |
| POST | `/api/settings` | Upsert settings |
| GET | `/api/templates` | List email templates |
| PATCH | `/api/templates/[id]` | Update template |
| GET | `/api/activity` | Global activity log |
| POST | `/api/monitor` | Run AI invoice monitor |
| GET | `/api/drive/import` | List files in Google Drive folder |
| POST | `/api/drive/import` | Import selected files (Claude PDF extraction) |
| GET | `/api/bank` | Return income + expense entries from bank statements |
| GET | `/api/vendors` | List all vendors |
| POST | `/api/vendors` | Create vendor |
| PATCH | `/api/vendors/[id]` | Update vendor |
| DELETE | `/api/vendors/[id]` | Delete vendor |
| GET | `/api/clients/[id]/entities` | List payment entities for a client |
| POST | `/api/clients/[id]/entities` | Add payment entity |
| PATCH | `/api/clients/[id]/entities/[entityId]` | Update entity |
| DELETE | `/api/clients/[id]/entities/[entityId]` | Delete entity |
| POST | `/api/intelligence/analyze` | Run Claude Opus financial analysis, save snapshot |
| GET | `/api/intelligence/latest` | Get most recent financial snapshot + report |

---

## QuickBooks-Style Categories

### Invoice Service Categories (line items)
- Social Media Management
- SEO & Content Marketing
- Paid Advertising (Google / Meta)
- Web Design & Development
- Email Marketing
- Brand Strategy & Consulting
- Monthly Retainer
- One-time Project Fee
- Account Management
- Analytics & Reporting
- Creative Production
- Credit Note / Adjustment
- Other

### Expense Categories
- Advertising & Marketing
- Contractors & Freelancers
- Software & Subscriptions
- Office Supplies
- Professional Services
- Travel & Transportation
- Meals & Entertainment
- Equipment & Hardware
- Rent & Utilities
- Insurance
- Taxes & Licenses
- Payroll & Salaries
- Training & Education
- Other

---

## Bilingual Support

- Each client has `preferred_language`: `en` (English) or `es` (Spanish)
- Invoice emails (send + follow-up + payment confirmation) are sent in the client's language
- Email subject lines switch language automatically
- 14 email templates total: 7 EN + 7 ES (TPL-001 through TPL-007-ES)
- Drive import auto-detects document language and sets `preferred_language` on the invoice

---

## Google Drive Integration

**Service account**: `pvg-mission-control@pvg-mission-control.iam.gserviceaccount.com`
**Drive folder**: `1AfAEaAjHYvzjaLTeG5jii0OrW2eVyLbD`

**Setup required**: The Drive folder must be shared with the service account email.

**Flow**:
1. User opens Drive Import page
2. App lists all files in the folder via Drive API v3
3. User selects PDFs to import (all selected by default)
4. App downloads each PDF and sends to Claude Haiku with a structured extraction prompt
5. Claude returns JSON with: invoiceRef, clientName, clientEmail, totalAmount, currency, dueDate, lineItems, preferredLanguage
6. App creates invoice records, skipping duplicates (matched by invoiceRef)
7. All imports logged to `billing_activity`

---

## Key Files

```
src/
  lib/
    db.ts           — Supabase client (lazy Proxy pattern to avoid build-time init)
    auth.ts         — JWT auth, getSession(), signToken()
    email.ts        — Resend email sending (bilingual: EN/ES)
    ai.ts           — Claude invoice monitor
    gdrive.ts       — Google Drive client (service account)
    utils.ts        — computeBillingStatus(), fmt(), nextInvoiceRef(), 12 statuses
  app/
    api/            — All API routes (see table above)
    dashboard/      — All pages
    login/          — Login page
  components/
    nav.tsx         — Sidebar navigation
    status-badge.tsx — Colored billing status badge
    ui/             — button, input, label, card
```

---

## Real Data (as of April 2026)

- **55 invoices** imported from Google Drive (JRC folder — CR facturas electrónicas)
- **16 clients** — 15 auto-created from invoices + Grupo AVA added manually
- **133 bank transactions** imported from BAC Costa Rica XLS statements (Jan–Apr 2026)
- **31 invoices auto-marked PAID** via bank reconciliation script
- **136 expense PDFs** imported from `/Pagos` folder via Claude Haiku vision
- **12 vendors** seeded in vendor directory
- **RE-LAB entities** seeded: Monica Morandi (invoice_recipient), Ricardo Montero Castro (payer)
- **Grupo AVA entities** seeded: VIDA DEPORTIVA S.A (llc_primary), AUXILIO EMPRESARIAL S.A (llc_secondary), Hazel Fallas (payer)

## Client Commercial Name Mappings

| LLC / Legal Name | Commercial Name (brand) | Notes |
|---|---|---|
| VIDA DEPORTIVA S.A | Grupo AVA | LLC entity |
| AUXILIO EMPRESARIAL SOCIEDAD ANONIMA | Grupo AVA | LLC entity |
| Electroaire de CR S.A. | Beeche Hotels | Holding of Nammbu and El Establo |
| DECORACIONES AVANZADAS DEKORA SOCIEDAD ANONIMA | DEKORA | |
| TECH MARINE LOGISTICS SRL | TM&L | |
| TURISMO Y EXPEDICIONES LOS JAGUARES DEL ITSMO SRL | Puma Expeditions | |
| EMPRENDIMIENTOS CONSCIENTES RB SOCIEDAD ANONIMA | Wo Kapi | |
| DAPHNA RUJMAN PRILUTZKY | Daphys Cafe | |
| MONICA CARLA MORANDI | RE-LAB | |

## Import Scripts (run from project root)

```bash
node scripts/import-drive.mjs    # Import all JRC PDFs from Drive → invoices
node scripts/import-bank.mjs     # Import PVG bank statements → expenses (BAC XLS format)
node scripts/reconcile-payments.mjs  # Match income entries to invoices → mark PAID
```

## AI Model Usage

| Feature | Model | When |
|---|---|---|
| Invoice extraction (Drive) | claude-haiku-4-5-20251001 | On Drive import |
| AI Monitor | claude-haiku-4-5-20251001 | On demand |
| Transaction categorization | claude-haiku-4-5-20251001 | During bank import |
| Financial Intelligence | claude-opus-4-5 | Manual, weekly |

## Payment Entity System

The `client_entities` table models real-world billing complexity:
- **RE-LAB** (stored as MONICA CARLA MORANDI, commercial_name=RE-LAB): invoice goes to Monica, Ricardo Montero Castro sends payment
- **Grupo AVA**: not yet in system — add when second LLC name is confirmed
- Other clients with split billing or installments can be configured in Client Detail → Payment Entities

## Known Limitations / Future Work

- **Grupo AVA** — second LLC name needed before entity seed can run
- **Gmail inbox scanning** — inbound vendor invoice detection not yet implemented
- **Invoice PDF generation** — currently sends email with data only, no PDF attachment  
- **Multi-user** — single admin password, no role-based access
- **Recurring invoices** — not yet implemented (recurring template engine planned)
- **Stripe/payment gateway** — no online payment link, manual recording only
- **Client portal** — clients cannot log in to view/pay invoices
- **Smart reconciliation v2** — entity-aware matching not yet wired into bank page UI

---

## Development

```bash
cd /Users/fedepvg/Documents/A-PVG/pvg-billing-os
npm run dev          # local dev on :3000
npm run build        # type check + build
vercel --prod        # deploy to production
```
