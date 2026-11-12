# Nandikishor Jewellery Works ERP

React 18 + Vite frontend, Spring Boot 3.5 backend, PostgreSQL persistence and Flyway migrations.

## Project layout

The source is organized by responsibility: `app/` routes, `core/` API and owner authentication, `features/` business modules, and `shared/` components/layouts/styles/utilities. The backend uses controller → service → repository/model layers. See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for the full tree and edit guide. Every page stylesheet sits beside its same-named JSX component. `frontend/src/shared/styles/common.css` contains shared design tokens, resets and reusable primitives; the Home and invoice/A4 rules live beside their respective pages. See [CSS_ARCHITECTURE.md](CSS_ARCHITECTURE.md) for the stylesheet ownership map and editing rules.

## Local development

1. Install Node.js 20+ and Java 21, plus PostgreSQL.
2. Copy `backend/.env.example` to `backend/.env` and provide your local database and owner-authentication settings.
3. Run the backend from `backend/` with `mvn spring-boot:run`.
4. Run `npm ci` and `npm run dev` from `frontend/`.
5. Before deployment, configure HTTPS, production CORS origins, secrets, SMTP delivery and a database backup policy.

## Production build

```bash
cd frontend && npm ci && npm run build
cd ../backend && mvn clean package
```

## Gold & silver rates

The public rate board shows 24K gold, 22K gold and 999 silver per 10 grams. The database continues to store each rate per gram so the existing invoice calculations remain compatible. Manual edits are owner-authenticated and recorded with previous/new values, timestamp and Admin identity. The fixed daily scheduler runs once at 06:15 in the `Asia/Kolkata` timezone and retains the previous verified values/date when today's feed is unavailable.

**Newspaper integration needs an authorized feed adapter.** This project does not claim that Anandabazar Patrika exposes a public rate API or scrape subscriber-only content. The scheduled adapter is disabled until its authorized endpoint and API key are configured. Refer to [RATE_SOURCE_SETUP.md](RATE_SOURCE_SETUP.md). Build verification limitations and local test steps are documented in [BUILD_VERIFICATION.md](BUILD_VERIFICATION.md).

## Security notes

- Never commit `backend/.env`, passwords, TOTP secrets, SMTP credentials or API keys.
- Owner-only routes are guarded in React and `/api/admin/**` is independently protected by the backend interceptor.
- Public read access to `/api/rates` does not permit editing or reading rate history.


## QR-based mobile jewellery design uploads

The owner catalogue's **QR Code Upload** action creates a five-minute, one-design upload session. The QR contains a cryptographically random capability token; PostgreSQL stores only its SHA-256 hash. Regenerating or closing the QR revokes the previous session. The mobile route does not receive an owner password or permanent JWT and cannot call design edit/delete/category-management APIs.

### Required deployment settings

- Set `DESIGNS_MOBILE_UPLOAD_BASE_URL` to the public frontend origin (for example, `https://erp.example.com`) when running behind a reverse proxy or when the backend cannot rely on the browser's `Origin` header. QR links must use HTTPS in production.
- Set `DESIGNS_UPLOAD_DIR` to a persistent disk/volume path. The backend stores three separate assets for every new upload: the untouched original, a high-quality display JPEG, and a thumbnail. A container filesystem that is discarded on redeploy is not persistent storage.
- Add the deployed frontend origin to `CORS_ALLOWED_ORIGINS` when the frontend and API are on different origins. Set the frontend `VITE_API_BASE_URL` to the API base (normally `https://api.example.com/api`).
- For more than one backend instance, all instances must share the same persistent upload volume (or an equivalent shared object store) and the same PostgreSQL database.

### Mobile upload flow

1. An owner-authenticated desktop request creates the QR session. Older active sessions for that owner are revoked.
2. Scanning the QR opens `/mobile-design-upload/{token}`. The backend validates the token hash and records the first scan.
3. The mobile page accepts up to 20 JPG/JPEG/PNG/WebP images (10 MB each), from the gallery or rear camera. It sends category and design information with the photographs.
4. The backend locks the session row, validates the unexpired/unrevoked/unconsumed token, generates the immutable category-scoped Design ID, stores original/display/thumbnail assets, writes image metadata, and consumes the session in one database transaction.
5. The backend publishes the existing `designs` real-time invalidation topic. The desktop catalogue also polls the QR session and has a 30-second refresh fallback.

Flyway migration `V37__track_qr_upload_scans.sql` adds the first-scan timestamp used by the desktop connection indicator. Existing design rows and image records are retained.
