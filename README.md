# KCERP frontend: Next.js web app

This is the web app for the KCERP Manufacturing Flow for Forgetech Engineering (Industrial). It covers seven stages:

**Sales → Purchase → Warehouse → Production → Quality → Dispatch → Finance**

It also has order and stage tracking, document tracking, approvals, purchase bills, debit and credit invoices, stock returns, a barcode generator, the sales invoice register, HR & payroll, masters, reports & analytics, and settings (company, users & roles, appearance).

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, SWR (data fetching), lucide-react (icons). Plain CSS design tokens give light and dark themes.
- **Backend:** the separate `kcerp-backend` package, a Node.js API on SQL Server Express. This app reads and writes everything through its REST API.

---

## 1. Start the backend first

Follow the README in `kcerp-backend`. It covers setting up SQL Server Express, `npm run db:migrate`, `npm run db:seed` and `npm run dev`. The API should be running at `http://localhost:4000`.

**Updating from the first release?** Run `npm run db:migrate` in the backend first: the new menus need its new tables and permissions.

In the backend's `.env`, `CORS_ORIGIN` must include this app's URL, for example `http://localhost:3000`.

## 2. Configure

```bash
cp .env.example .env.local
```

| Setting | Meaning |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | The API address including `/api/v1`, for example `http://localhost:4000/api/v1`. Use the server's address when the API runs on another machine. |

## 3. Install and run

```bash
npm install
npm run dev              # development → http://localhost:3002
npm run build && npm start   # production
```

Sign in with a demo user; the password for all of them is `Kcerp@2026`.

| User | Role |
| --- | --- |
| nivetha@forgetech.in | Manager: everything |
| gowtham@forgetech.in | Production Supervisor |
| sathish@forgetech.in | Store Keeper |
| prakash@forgetech.in | Purchase Officer |
| hema@forgetech.in | Accountant |
| kumaravel@forgetech.in | Auditor (read-only) |

The sidebar, pages and buttons follow the signed-in user's role. The API enforces the same rules.

---

## Pages

| Menu | Route | What it does |
| --- | --- | --- |
| Dashboard | `/` | Output, revenue, shortages, first-pass yield, order-to-cash pipeline, machines, work orders, needs attention |
| Tracking Center | `/tracking`, `/tracking/orders`, `/tracking/stages` | Stock ledger; one order through all 7 stages; every record in every stage with SLA |
| Document Tracking | `/documents` (+ `/[id]`) | Every file attached to every record: upload, preview, versions, verify, expiry, missing-document rules and activity. Each detail page also has an **Attachments** card |
| Approvals | `/approvals` | Purchase orders over the limit, work order releases, credit overrides, purchase bills on hold, debit / credit invoices, payroll |
| 1 · Sales | `/sales/orders` (+ `/new`, `/[id]`), `/sales/customers` | Customer orders: credit check → confirm → release to production. Also customers |
| 2 · Purchase | `/purchase/orders` (+ `/new`, `/[id]`), `/purchase/subcontracting`, `/purchase/vendors` | POs and job work: submit, approve, send, receive (GRN). Also vendors |
| | `/purchase/bills` (+ `/new`, `/[id]`) | **Purchase Bills:** vendor invoice against PO / GRN, 3-way match (rate ±1%, qty ≤ received), hold & release, TDS, ledger postings, vendor payments, A4 print |
| | `/purchase/debit-notes` (+ `/new`, `/[id]`) | **Debit Invoices:** return products to a vendor from a bill, per-line reason and condition, adjust / refund / replacement |
| 3 · Warehouse | `/warehouse/stock`, `/warehouse/grn` (+ `/[id]`), `/warehouse/lots` | Stock by warehouse, low stock, adjustments, GRNs, lot stock (FIFO) |
| | `/warehouse/returns` (+ `/new`, `/[id]`) | **Stock Returns:** move lots back between locations through In transit; damaged goods land in QC Hold |
| | `/warehouse/barcodes` | **Barcode Generator:** Code 128 labels for lots, a goods receipt or any item; price and lot under the barcode; prints on label rolls or A4 |
| 4 · Production | `/production/work-orders` (+ `/new`, `/[id]`), `/production/shop-floor` | Work orders: issue material, record production, partial completion / split, hold, complete, close. Also machine status |
| 5 · Quality | `/quality`, `/quality/inspections/[id]` | Inspection results, NCR & CAPA |
| 6 · Dispatch | `/dispatch` (+ `/new`, `/[id]`) | Pick → Pack → Challan → Loaded → In transit → Delivered → Acknowledged |
| 7 · Finance | `/finance`, `/finance/invoices/[id]` | Invoicing & Payments: invoices (A4 print view), payments, overdue |
| | `/finance/invoices` | **Sales Invoices:** GST register (CGST / SGST / IGST, e-way bill), raise invoices for dispatched shipments, CSV export |
| | `/finance/credit-notes` (+ `/new`, `/[id]`) | **Credit Invoices:** customer returns and corrections from an invoice, stock back to store or QC, adjust / refund / replace |
| People & Masters | `/hr` | **HR & Payroll:** employees (with documents), weekly attendance roster, monthly payroll (PF, ESI, PT, TDS, LOP), approval, bank transfer file |
| | `/masters` (+ `/items`, `/machines`, `/warehouses`, `/departments`, `/[kind]`) | **Masters:** hub of all master lists; items (with operations and materials), machines, locations, departments, and categories, units, payment terms, tax codes, banks, cost centres, designations, shifts, holidays, inspection plans, tools |
| Insights & Admin | `/reports` | **Reports & Analytics:** 11 reports (production vs plan, machine utilisation, scrap, vendor OTIF, inventory ageing, sales / purchase registers, GST summary, receivables / payables ageing, payroll), chart or table, CSV export |
| | `/settings/company`, `/settings/users`, `/settings/appearance` | **Settings:** company profile & numbering; users and the role × menu access matrix; appearance (theme, sidebar, compact tables, reduced motion, focus rings) |

Every stage page shows its **stage tracker**. The **stage ribbon** at the top links all 7 stages. The top bar has global search (Ctrl K), branch, financial year, theme toggle and approvals.

## Project layout

```
src/app/layout.tsx          root layout: fonts, theme (applied before first paint), providers
src/app/login/              sign-in
src/app/(app)/layout.tsx    signed-in shell (sidebar, top bar, stage ribbon)
src/app/(app)/…             one folder per menu, as in the table above
src/components/ui/          design system: Button, Badge, Card, Kpi, DataTable, Tabs, Modal, form fields, steppers
src/components/shell/       Sidebar (role-filtered drawers), Topbar, GlobalSearch, StageRibbon
src/components/             StageTracker, LinesEditor (order lines), charts, PrintSheet (A4 documents)
src/components/docs/        Attachments card, upload dialog, record picker (Document Tracking)
src/components/notes/       debit / credit invoice list, form and view (one engine, two menus)
src/lib/api.ts              API client (token, errors, sign-out on 401)
src/lib/auth.tsx            signed-in user, role permissions → can(module, action)
src/lib/nav.ts              menu and 7-stage configuration
src/lib/format.ts           ₹ and date formats (en-IN)
src/lib/status.ts           status → colour for every document type
src/lib/appearance.ts       per-browser appearance settings
src/lib/code128.tsx         Code 128 barcode (SVG, no library)
src/app/globals.css         colour tokens (light/dark) and component styles
```

## Notes
- **Sign-in token:** the token is kept in the browser (`localStorage`) and sent as `Authorization: Bearer …`. When the API returns 401, the user goes back to sign-in.
- **Rendering:** all pages are client components that fetch with SWR. `npm run build` output can be served with `npm start`, or on any Node.js host.
- **Files:** uploads go straight to the API (`POST /documents`, multipart); previews and downloads are fetched with the sign-in token, so files are never public links.
- **Access:** a page whose menu the role cannot view shows a short notice instead of the page. Appearance is open to every user (also from the account menu).
- **Printing:** bills, debit / credit notes, invoices and barcode labels print from the browser (Print → choose the printer or Save as PDF).
