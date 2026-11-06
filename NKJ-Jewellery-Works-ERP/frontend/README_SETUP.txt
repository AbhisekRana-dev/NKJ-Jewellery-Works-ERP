NKJ JEWELLERY WORKS ERP — LOCAL SETUP
=====================================

REQUIREMENTS
- Node.js 18+ and npm
- Java 21
- Maven 3.9+
- PostgreSQL (use a fresh development database or restore a verified backup first)

1) BACKEND
- Copy backend/.env.example to backend/.env.
- Enter DB_URL, DB_USERNAME and DB_PASSWORD for your PostgreSQL database.
- Set a unique ADMIN_PASSWORD and a unique 16–64 character Base32 TOTP_SECRET.
- For first-time owner setup email OTP, configure SMTP_USERNAME and SMTP_PASSWORD with an email-provider app password. The default destination is rabhisek2030@gmail.com (FIRST_SETUP_EMAIL).
- Replace the example invoice PIN verifier before deployment.
- Run `mvn clean test` and `mvn spring-boot:run` from backend/.
- Flyway runs V1 and the additive V2 schema migration at startup.

2) FRONTEND
- Open a second terminal in frontend/.
- Run `npm ci`, then `npm run dev`.
- Open http://localhost:5173.

3) FIRST OWNER SECURITY SETUP
- Open /setup-totp.
- Enter the configured owner username and password.
- The backend sends a one-time email code to FIRST_SETUP_EMAIL.
- Verify the six-digit code within five minutes.
- Scan the returned TOTP QR in Google Authenticator.
- Sign in through Owner Login using password and the six-digit authenticator code.

4) RATE MANAGEMENT
- The public homepage shows rates, but public visitors cannot see/edit the Edit Rate control.
- Sign in as owner; the Edit Rate control becomes available on the homepage and the full manager is under /rates.
- Prices are entered/displayed per 10 grams; database rates remain per gram for backward compatibility.
- Legacy example prices are marked unverified; save correct manual rates before using the public display or switching AUTO mode.
- AUTO remains pending until an authorized Anandabazar Patrika feed/importer is configured. The package does not scrape subscription-only pages or invent live data.

5) IMPORTANT
- Keep invoice content and A4 print flow unchanged; still test them against your existing data before release.
- Use HTTPS in deployment; store secrets in environment variables, not source control.
- Do not run V2 on a production database without a tested backup.
