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

2A) SCAN JEWELLERY DESIGN QR FROM A PHONE ON THE SAME WI-FI
- Keep the PC and phone connected to the same trusted Wi-Fi network.
- On Windows, run `ipconfig` and find the PC's Wi-Fi adapter IPv4 Address (usually 192.168.x.x).
- Open the ERP on the PC using `http://YOUR-PC-WIFI-IP:5173` (example: `http://192.168.1.10:5173`), not localhost. Vite listens on the LAN interface.
- In backend/.env, set `NKJ_DESIGNS_MOBILE_UPLOAD_ALLOW_PRIVATE_HTTP=true`. When this is enabled, the backend automatically permits private Wi-Fi browser origins for CORS; no CORS variable edit is required.
- Leave `DESIGNS_MOBILE_UPLOAD_BASE_URL` blank so the QR uses the browser origin (the PC Wi-Fi IP).
- Restart backend and Vite after changing configuration, then open the ERP using the PC Wi-Fi IP and generate a NEW QR code.
- Scan with the phone camera. The phone opens the PC's Vite page; API calls are proxied to the backend on port 8086.
- If the phone cannot connect, allow Node.js/Vite on private networks in Windows Defender Firewall and verify both devices are on the same Wi-Fi. Do not expose backend port 8086 to the public internet.
- This private-HTTP option is for trusted local Wi-Fi development only. Keep it false in production; deployed QR uploads must use HTTPS.


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
