# NKJ Jewellery Works ERP — Developer Structure

This repository follows a feature-first React structure and a layered Spring Boot backend. Each page/component owns a same-named colocated stylesheet. Shared design tokens and cross-page primitives are centralized in `frontend/src/shared/styles/common.css`.

```text
NKJ-Jewellery-Works/
├── backend/
│   ├── src/main/java/com/nkj/billing/
│   │   ├── config/                 # Authentication interceptor, CORS, application config
│   │   ├── controller/             # REST API boundary and request records
│   │   ├── model/                  # JPA entities
│   │   ├── repo/                   # Spring Data repositories
│   │   └── service/                # Business rules, authentication, daily rate scheduler
│   ├── src/main/resources/
│   │   ├── db/migration/           # Ordered Flyway migrations (V1, V2, ...)
│   │   └── application.properties
│   ├── .env.example                # Safe configuration template; no real secrets
│   └── pom.xml
├── database/                       # Database setup and reference SQL
├── design-references/              # Approved design reference assets
├── frontend/
│   ├── public/                     # Static brand/jewellery images
│   ├── src/
│   │   ├── app/                    # Route composition and route guards
│   │   ├── core/                   # Shared API client and owner authentication
│   │   ├── features/
│   │   │   ├── auth/               # AuthPages.jsx + AuthPages.css
│   │   │   ├── admin/              # ErpModulePage.jsx/CSS, AdminToolsPage.jsx/CSS
│   │   │   ├── customers/          # Customers.jsx + Customers.css (delegates to ErpModulePage)
│   │   │   ├── dashboard/          # AdminHome.jsx + AdminHome.css
│   │   │   ├── home/               # Home.jsx + Home.css
│   │   │   ├── installments/      # InstallmentManagementPage.jsx + same-name CSS
│   │   │   ├── inventory/          # InventoryPage.jsx + InventoryPage.css
│   │   │   ├── invoices/           # InvoicePages.jsx + InvoicePages.css (screen and A4 print rules)
│   │   │   ├── karigars/           # KarigarsPage.jsx + KarigarsPage.css
│   │   │   ├── profile/            # Profile.jsx + Profile.css
│   │   │   ├── rates/              # MetalRatesPage.jsx/CSS + MetalRatesShared.css
│   │   │   ├── reports/            # ReportsDashboard.jsx + ReportsDashboard.css
│   │   │   └── staff/              # StaffDetailsPage.jsx + StaffDetailsPage.css
│   │   ├── shared/
│   │   │   ├── components/         # Reusable dialogs, each with a same-name CSS file
│   │   │   ├── layouts/            # OwnerShell.jsx/CSS and Footer.jsx/CSS
│   │   │   ├── styles/              # common.css: global defaults, tokens and shared primitives
│   │   │   └── utils/               # Shared formatters
│   │   └── main.jsx                # Vite entry point; imports common.css once
│   ├── package.json
│   └── vite.config.js
├── CSS_ARCHITECTURE.md
├── PROJECT_STRUCTURE.md
├── RATE_SOURCE_SETUP.md
├── BUILD_VERIFICATION.md
└── README.md
```

## Editing guide

| Task | File/folder |
|---|---|
| Add/change application routes | `frontend/src/app/App.jsx` |
| Change shared API URL, bearer token or 401 handling | `frontend/src/core/api/client.js` |
| Change owner session restore/login/logout state | `frontend/src/core/auth/AuthProvider.jsx` |
| Change login or first-time setup UI | `frontend/src/features/auth/AuthPages.jsx` and `AuthPages.css` |
| Change public homepage or its rate card | `frontend/src/features/home/Home.jsx` and `Home.css` |
| Change metal-rate editor/history screen | `frontend/src/features/rates/MetalRatesPage.jsx` and `MetalRatesPage.css` |
| Change shared public/owner rate-card presentation | `frontend/src/features/rates/MetalRatesShared.css` |
| Change invoice content/calculation/print | `frontend/src/features/invoices/InvoicePages.jsx` and `InvoicePages.css` |
| Change owner profile | `frontend/src/features/profile/Profile.jsx` and `Profile.css` |
| Change owner sidebar/layout/collapse behavior | `frontend/src/shared/layouts/OwnerShell.jsx` and `OwnerShell.css` |
| Change public footer/developer attribution | `frontend/src/shared/layouts/Footer.jsx` and `Footer.css` |
| Change reusable invoice PIN dialog | `frontend/src/shared/components/InvoicePinDialog.jsx` and `InvoicePinDialog.css` |
| Change global design tokens and shared defaults | `frontend/src/shared/styles/common.css` |
| Change a business page | Edit its JSX and same-named CSS file in the same feature folder |
| Change shared currency formatting | `frontend/src/shared/utils/formatters.js` |
| Change API request/authorization contract | matching class in `backend/.../controller/` |
| Change business logic | matching class in `backend/.../service/` |
| Change data model | `backend/.../model/` plus a new Flyway migration |
| Add a database change | create the next `Vn__description.sql`; never edit an already-applied migration |

## Frontend conventions

- Keep each page stylesheet beside its page component, use the same base name and import it at the top of the JSX file.
- Put cross-page tokens, resets, generic controls, tables and reusable primitives in `shared/styles/common.css` only when more than one independent page uses them.
- Keep owner navigation/layout rules in `shared/layouts/OwnerShell.css`; keep public footer rules in `shared/layouts/Footer.css`.
- `Customers.jsx` delegates its visible UI to `ErpModulePage.jsx`, so the actual customer form/table rules are in `features/admin/ErpModulePage.css`.
- `MetalRatesShared.css` is intentionally shared by Home and the owner Rates page.
- Keep all invoice screen and A4/print rules in `features/invoices/InvoicePages.css`. Do not move invoice-specific rules into `common.css`.
- Keep route guards in `app/` and API/session behavior in `core/`.

## Build commands

```bash
# Frontend production bundle
cd frontend
npm ci
npm run build

# Backend package (requires Java 21 and Maven)
cd backend
mvn clean package
```

See `CSS_ARCHITECTURE.md` for the page-to-stylesheet ownership map and `RATE_SOURCE_SETUP.md` for the scheduled, authorized newspaper feed integration and environment variables.
