# NKJ Jewellery Works ERP — Final Layout & Workflow Revision

Revision date: 4 November 2026

## Owner workspace and responsive layout

- Replaced the duplicate/oversized owner header menu control with one compact chevron toggle on the sidebar.
- Added persistent manual sidebar expand/collapse state. On a first visit, narrower screens start collapsed; the owner's manual choice is remembered afterwards.
- Kept the brand/logo and owner account block at the top of the sidebar and Public Home/Logout at the bottom. Only the navigation list scrolls, and its scroll position is restored when changing pages.
- Used one shared sidebar width for the owner header, page content and footer. Dashboard KPI cards reflow from three columns to two and then one as the viewport narrows; long values wrap rather than clip the right edge.
- At phone widths, an expanded sidebar overlays the page instead of consuming most of the usable page width.
- Added missing sidebar links for Purchase Management, Payments and Old Gold Exchange, alongside Suppliers.
- Standardized the public navbar height across Home, Login and New Invoice. The footer is responsive and includes “Designed & Built with ❤️ by Abhisek Rana”.

## Business-facing IDs

The numeric PostgreSQL primary keys and foreign keys are retained so existing record relationships remain safe. Human-readable codes are used in the UI:

- Staff: `NKJ-STF-00001`
- Customers: `NKJ-CUS-000001`
- Karigars: `NKJ-KRG-000001`
- Jewellery items: `NKJ-ITM-000001`
- Suppliers: `NKJ-SUP-000001`
- Repair orders: `NKJ-RPR-YYYYMMDD-000001`
- Pre-bookings: `NKJ-BKG-DDMMYY-0001`

Blank optional identifiers on create are assigned by the backend. Clearing an assigned identifier while editing no longer erases it.

Flyway migration `V5__human_readable_business_ids.sql` adds the karigar/supplier code columns, fills missing codes for existing records and creates unique indexes for the new code columns. **Back up the `nkj_billing` database before starting the updated backend for the first time**, then check the backend startup log for successful Flyway migration `V5`.

## Attendance, salary and leave selection

- New attendance, salary and leave forms load the staff directory and show active staff in a dropdown containing the staff code and name.
- Inactive staff are excluded for new records. When editing a historical record, its current inactive staff member remains selectable so the record can still be reviewed or corrected.
- The form submits the numeric staff primary key internally; list rows display the staff name and readable staff code.
- Selecting a staff member on a new salary record pre-fills the basic salary from the staff profile when the value is blank.

## Protected page content

The subsequent CSS organization pass retained the Home component byte-for-byte and retained the Invoice component JSX/content with only a same-name CSS import added. Home styles are now in `features/home/Home.css`; invoice screen and A4/print rules are grouped in `features/invoices/InvoicePages.css`. The original invoice calculations, fields and content were not modified.

## Verification boundary

Frontend JavaScript/JSX, stylesheet syntax and Java source parsing were checked. Local relative imports were checked. The environment did not have a working Vite installation, Maven executable or PostgreSQL service, so a production bundle, Java dependency/type build, Flyway execution and live API/database/browser regression tests could not be completed here. Run the local build and migration checks in `BUILD_VERIFICATION.md` before deploying.
