# NKJ Jewellery Works ERP — Phase 1

React + Spring Boot + PostgreSQL source package. The original public homepage and A4 invoice print layout are retained. The owner workspace contains the ERP modules listed below.

## Required software

- **JDK 21 or JDK 25 (64-bit).** The Maven compiler targets Java 21 bytecode; Spring Boot 3.5.16 supports running on Java 21 through Java 25.
- **Apache Maven 3.6.3 or later** (Maven 3.10.x is suitable).
- **PostgreSQL 17** (PostgreSQL 15+ should also work).
- **Node.js 20+ and npm** for the React frontend.

## 1. Create the database

Start the PostgreSQL Windows service. In pgAdmin or psql, create the database once:

```sql
CREATE DATABASE nkj_billing;
```

If the database already exists and contains invoice data, do not drop it. Back it up first. Flyway creates the ERP tables and runs a `beforeMigrate.sql` compatibility callback to repair the legacy `shop_details`, `metal_rates` and `admin_profile` singleton tables before V1 seeds them. Existing non-null rate/profile values are retained; missing values receive development defaults.

## 2. Configure the backend

Open `backend` and copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Edit `backend/.env` and set at least:

```properties
DB_URL=jdbc:postgresql://localhost:5432/nkj_billing
DB_USERNAME=postgres
DB_PASSWORD=YOUR_REAL_POSTGRES_PASSWORD
SERVER_PORT=8086

ADMIN_USERNAME=admin2026
ADMIN_PASSWORD=YOUR_OWN_LONG_ADMIN_PASSWORD
TOTP_SECRET=YOUR_UNIQUE_BASE32_SECRET
```

Generate a fresh unpadded Base32 secret for this installation (Python 3 required):

```powershell
py -c "import base64,secrets; print(base64.b32encode(secrets.token_bytes(20)).decode().rstrip('='))"
```

Copy the output into `TOTP_SECRET` in `backend/.env`. Keep `.env` private. After the backend starts, request the provisioning URI and scan it in Google Authenticator (or another TOTP authenticator):

```powershell
$headers = @{
  'X-Setup-Username' = 'admin2026'
  'X-Setup-Password' = 'YOUR_OWN_LONG_ADMIN_PASSWORD'
}
Invoke-RestMethod -Uri 'http://localhost:8086/api/auth/setup-uri' -Headers $headers
```

The invoice PIN verifier in the example corresponds to the existing local PIN **770722**. Change the PIN verifier before public deployment; never put the PIN itself in frontend code.

## 3. Start the backend on Windows

Open PowerShell in the backend folder and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-backend.ps1
```

The script checks JDK 21–25, Maven, required `.env` values and starts Spring Boot with a modest local JVM heap. The Maven compiler targets Java 21 bytecode, and Spring Boot 3.5.16 supports running on JDK 21 through 25. If `.env` is missing, it copies `.env.example` and stops so that you can edit the credentials.

Expected local backend URL: `http://localhost:8086`

Database health check: `http://localhost:8086/api/health/db` (returns only CONNECTED/DISCONNECTED status).

To start manually after setting the environment variables yourself:

```powershell
mvn spring-boot:run
```

## 4. Start the React frontend

Open a second terminal in the `frontend` folder:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to `http://localhost:8086`. For a deployed frontend, set `CORS_ALLOWED_ORIGINS` in `backend/.env` to the exact origin(s), and set `VITE_API_BASE_URL` only if the frontend is not served through the same reverse proxy.

## Project structure

```text
NKJ-Jewellery-Works-Updated-v2/
  frontend/
    public/                 # Brand and visual reference assets
    src/
      components/           # Reusable invoice security dialogs
      modules/              # Owner ERP screens and module definitions
      App.jsx               # Application routes
      api.js                # Shared API client
      auth.jsx              # Browser authentication state
      pages.jsx              # Login, invoice and invoice history pages
      AdminHome.jsx          # Owner dashboard
      Home.jsx               # Public homepage
      styles.css             # Site and invoice styles
  backend/
    .env.example             # Copy to .env; never commit .env
    start-backend.ps1        # Validates environment and starts Spring Boot
    start-backend.cmd        # Windows double-click launcher
    src/main/java/com/nkj/billing/
      config/                # CORS and authentication interceptor
      controller/            # REST API controllers
      model/                 # JPA entities
      repo/                  # Spring Data repositories
      service/               # Auth, invoice PIN and ERP business services
    src/main/resources/
      application.properties
      db/migration/           # Flyway migration and beforeMigrate compatibility callback
  database/                  # Database creation notes
  design-references/         # Original visual references
```

## Included owner modules

Dashboard, All Invoices, Gold/Silver Rates, Customers, Old Gold Exchange, Suppliers, Purchases, Payments, Expenses, Bookings, Installments, Inventory, Stock Movements, Staff, Attendance, Leave, Salary, Salary Payments, Salary Advances, Karigars, Repair Orders, Reports, Database Status, Audit Logs, Backup History and Shop Settings.

The backend uses an allow-listed module registry and parameterized SQL values for CRUD forms. The invoice create endpoint requires a backend-verified six-digit PIN ticket; the PIN is PBKDF2-verified server-side and limited to five failed attempts per IP per 15-minute window. Owner API routes use the application's custom in-memory bearer session created after password + TOTP verification.

## Important Phase 1 limitations

This is not a completed production ERP. Spring Boot 3.5.16 is the final open-source 3.5.x release; for a long-lived internet-facing deployment, plan and test an upgrade to a supported Spring Boot 4.x line before production. JWT/Spring Security, authenticator recovery, booking-specific PDF receipts, automated attendance-to-payroll policy calculation, salary-slip PDF generation, full inventory posting for invoice sales/purchases, fully reconciled customer/supplier ledgers, scheduled encrypted backups, Google Drive OAuth/restore and Electron/Tauri packaging are not implemented end-to-end. Backup History is a read-only register. The Reports page labels sales less recorded expenses as **Operating Result Before COGS**, not net profit.

## Verification status

Static checks completed for this package: POM XML, `package.json` and lockfile consistency, Java package paths, all 22 frontend/backend module API names, and all 169 registered module field-to-table mappings. Node syntax checks passed for the frontend API/config/Vite files. A full Maven compile, Vite production build, callback execution and live PostgreSQL migration test could not be run in the packaging environment; run them on the Windows machine with Maven, npm dependencies and PostgreSQL available. Back up existing PostgreSQL data before starting the application for the first time.
