# Build and Verification Report

Revision checked: 4 November 2026

## Source-level checks completed

- 23 JavaScript/JSX source files parsed with the installed TypeScript parser: **0 syntax diagnostics**.
- Relative frontend import resolution: **0 missing imports**.
- 19 CSS files parsed with PostCSS and `tinycss2`: **0 syntax/parse errors**.
- 23 Java source files parsed with the JDK 21 compiler parser: **0 Java parser errors**.
- `Home.jsx` and `InvoicePages.jsx` were compared with the source archive; both components are unchanged (the invoice file only receives a colocated CSS import, which was removed for the content comparison). The original A4 invoice declarations were moved into `features/invoices/InvoicePages.css`. Footer and Profile inline CSS were moved into colocated stylesheets.
- The final ZIP archive is checked with `unzip -t` after packaging.

These checks validate source syntax, stylesheet parsing and local import paths. The latest CSS organization guide is in `CSS_ARCHITECTURE.md`. They are not substitutes for bundling, Java type-checking, database migrations or runtime tests.

## Full build status in the preparation environment

**Frontend production bundle: not verified.** `npm run build` was attempted but could not start because Vite was not present in `frontend/node_modules` (`vite: not found`). `npm ci --offline` was attempted, but the required packages were not available in the npm cache (`ENOTCACHED`), so dependency installation did not complete in this environment. The source package therefore does not include a built `dist` folder or installed `node_modules`.

**Backend Maven package: not verified.** Maven is not installed in the preparation environment. Java syntax parsing passed, but that does not type-check the Spring dependencies or build the executable JAR.

**Database/integration tests: not run.** No PostgreSQL server was available for Flyway migration execution, API integration, authentication testing, or invoice regression tests.

## Run the full build on your development machine

Install Node.js 20+, Java 21, Maven 3.9+ and PostgreSQL. Back up the existing `nkj_billing` database before starting the revised backend, because Flyway migration V5 adds and populates business-facing ID columns.

```bash
# Frontend
cd frontend
npm ci
npm run build

# Backend (new terminal)
cd backend
mvn clean package
```

Before launching the application, copy `backend/.env.example` to `backend/.env`, enter your actual PostgreSQL, admin, TOTP and SMTP settings, and keep that `.env` file private. Do not deploy using the example credentials or placeholder values.

After the backend starts, verify that Flyway applies migration V5 successfully. Then test a public `GET /api/rates`, unauthenticated admin requests, authorized manual rate update/history, logout/session expiry, staff creation and active-staff dropdowns on attendance/salary/leave, customer/karigar/item/supplier/repair/booking code generation, and invoice calculation/print regression using a copy of your database.

## Newspaper feed prerequisite

The daily job is implemented for an authorized Anandabazar Patrika data adapter and runs once at 06:15 Asia/Kolkata. The feed is disabled by default. This package does not claim to have direct publisher credentials or a public Anandabazar rates API. Obtain authorized feed/data access and configure `ABP_RATE_FEED_ENABLED`, `ABP_RATE_FEED_URL`, and `ABP_RATE_FEED_API_KEY` before expecting automatic newspaper updates.
