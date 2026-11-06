# PostgreSQL database setup

This project uses PostgreSQL.

1. Start the PostgreSQL service.
2. Create `nkj_billing` once by running `create_database.sql` as a PostgreSQL administrator (or execute `CREATE DATABASE nkj_billing;` in pgAdmin).
3. Copy `backend/.env.example` to `backend/.env` and enter the actual database username/password and owner credentials.
4. Start the backend with `backend/start-backend.ps1`. Flyway creates the ERP schema and runs the legacy singleton-table compatibility callback before migration V1.
5. Back up the database regularly. Do not drop an existing database to fix a migration error.

The source ZIP does not contain a PostgreSQL dump or historical customer/invoice records. The setup script creates an empty database only; existing records remain in the database already installed on your computer.
