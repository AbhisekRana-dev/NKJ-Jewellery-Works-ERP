# Frontend CSS Architecture

The frontend follows a **one page/component, one same-named colocated stylesheet** convention. Page CSS is next to its JSX component and imported directly by that component. Shared design tokens, resets and cross-page utilities live in `src/shared/styles/common.css`.

## Where to edit

| JSX component | Stylesheet | What belongs there |
|---|---|---|
| `features/home/Home.jsx` | `features/home/Home.css` | Public Home hero, rate-board placement, service cards and Home-only responsive layout |
| `features/invoices/InvoicePages.jsx` | `features/invoices/InvoicePages.css` | New invoice, saved invoice, invoice sheet, print composition and A4 rules |
| `features/auth/AuthPages.jsx` | `features/auth/AuthPages.css` | Owner login and TOTP setup |
| `features/dashboard/AdminHome.jsx` | `features/dashboard/AdminHome.css` | Dashboard KPI cards, recent invoices and dashboard breakpoints |
| `features/profile/Profile.jsx` | `features/profile/Profile.css` | Owner profile page and profile layout |
| `features/rates/MetalRatesPage.jsx` | `features/rates/MetalRatesPage.css` | Owner rate editor/history page |
| Home + Rates | `features/rates/MetalRatesShared.css` | Rate board styles shared by both screens |
| `features/staff/StaffDetailsPage.jsx` | `features/staff/StaffDetailsPage.css` | Staff directory, profile, notes and staff form |
| `features/karigars/KarigarsPage.jsx` | `features/karigars/KarigarsPage.css` | Karigar editor, cards and table |
| `features/inventory/InventoryPage.jsx` | `features/inventory/InventoryPage.css` | Inventory editor, photos, stock cards and filters |
| `features/installments/InstallmentManagementPage.jsx` | `features/installments/InstallmentManagementPage.css` | Installment tabs, account forms, receipt and ledger |
| `features/reports/ReportsDashboard.jsx` | `features/reports/ReportsDashboard.css` | Report KPIs, charts and summaries |
| `features/admin/AdminToolsPage.jsx` | `features/admin/AdminToolsPage.css` | Database status/admin tools cards |
| `features/admin/ErpModulePage.jsx` | `features/admin/ErpModulePage.css` | Reusable customer, supplier, booking, attendance, salary, expense and other ERP module forms/tables |
| `features/customers/Customers.jsx` | `features/customers/Customers.css` | Route-wrapper note; Customers delegates its visible UI to `ErpModulePage.jsx` |
| `shared/layouts/OwnerShell.jsx` | `shared/layouts/OwnerShell.css` | Owner sidebar, sticky header, collapsed/expanded geometry and workspace shell |
| `shared/layouts/Footer.jsx` | `shared/layouts/Footer.css` | Public footer, responsive footer layout and developer credit |
| `shared/components/InvoicePinDialog.jsx` | `shared/components/InvoicePinDialog.css` | PIN dialog component |

## Shared stylesheet

`src/shared/styles/common.css` is imported once from `src/main.jsx`. Use it only for things genuinely shared across pages: CSS variables, font setup, reset rules, generic buttons/inputs, tables, reusable modal primitives and general spacing/accessibility utilities. Do not add a page-only selector there.

## Adding a page

1. Create `NewPage.jsx` and `NewPage.css` in the same feature folder.
2. Import `./NewPage.css` at the top of `NewPage.jsx`.
3. Scope selectors under a page root class such as `.nkj-new-page` to avoid leaking styles to other modules.
4. Move a rule to `common.css` only when multiple independent pages need the same reusable rule.
5. Keep print-specific invoice rules in `InvoicePages.css`; do not let page print rules alter the rest of the app.

## Existing page content

The Home component source was retained byte-for-byte. The Invoice component's JSX/content was retained byte-for-byte after removing the one new import line for comparison. The existing Home styles were kept with Home, and the legacy invoice stylesheet rules were moved into `InvoicePages.css` instead of being left in one mixed global file. Footer and Profile inline `<style>` blocks were moved into their colocated CSS files.

## Verification

All 23 frontend JS/JSX source files were syntax-parsed; all local relative imports resolved; and all 19 CSS files parsed successfully. A selector-coverage comparison also confirmed that all 1,940 selector occurrences from the former global bundles are present in the reorganized stylesheets. The production Vite build could not be run in the preparation environment because the available `node_modules` package directories do not contain the Vite executable and dependencies could not be installed from the offline npm cache. Run `npm ci` followed by `npm run build` locally.
