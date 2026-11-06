# NKJ Jewellery Works ERP — Update notes

For the authoritative source structure and build status, read `PROJECT_STRUCTURE.md` and `IMPLEMENTATION_STATUS.txt`.

## Structural improvements
- Moved login and first-time email OTP/TOTP setup to `features/auth/` with colocated CSS.
- Moved owner navigation, Page and Stat primitives to `shared/layouts/OwnerShell.jsx` and `OwnerShell.css`.
- Moved common currency/date formatting to `shared/utils/formatters.js`.
- Moved public/admin rate-board presentation rules to the rates feature folder.
- Separated operational module styles from the global/invoice stylesheet.

## Daily rate rules
- Fixed daily import at 06:15 Asia/Kolkata, once per day.
- Accept only a current-day issue with a complete validated payload.
- Retain the last verified rates and original rate date when today's feed is unavailable.
- Admin editing and rate history are protected at the backend API level.
- Manual history records previous/new prices, timestamp, source, rate date and Admin account.
- Invoice rates remain stored per gram; the public board/editor show per 10 grams.

## Important limitation
Anandabazar Patrika automatic import requires a configured authorized feed adapter. This project does not claim a public rate API is available and does not scrape or bypass subscriber-only e-paper access. See `RATE_SOURCE_SETUP.md`.

## Verification limitation
Source syntax/import checks were completed. Full Vite and Maven production builds and PostgreSQL integration tests could not run in the preparation environment because npm registry access was unavailable, Vite was not installed, Maven was not installed, and no PostgreSQL server was available. See `IMPLEMENTATION_STATUS.txt` for exact command results.

## Final responsive/workflow pass — 4 November 2026
- Rebuilt the owner shell around a single 264px expanded / 82px collapsed width variable. The header, content and footer now share this width instead of maintaining conflicting offsets.
- Sidebar top identity and bottom actions stay pinned; menu scrolling and manual collapsed/expanded state persist between owner pages.
- Removed the duplicate owner-header hamburger control and added missing navigation links for Purchases, Payments and Old Gold Exchange.
- Added responsive dashboard KPI wrapping and mobile sidebar overlay behavior.
- Added `NKJ-*` business-facing identifiers and Flyway V5 backfill for existing staff/customer/item/karigar/supplier/repair data. Numeric database primary keys and foreign keys remain unchanged.
- Attendance, salary and leave creation now selects an active staff member by readable code and name; historic inactive staff remain selectable only when editing their existing record.
- Added the developer attribution to the shared responsive footer.
- The Home page source, invoice page source and legacy A4 invoice stylesheet remain byte-for-byte identical to the uploaded source archive. See `FINAL_REVISION_NOTES.md` and `BUILD_VERIFICATION.md`.
