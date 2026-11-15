-- Persistent audit trail for authenticated owner devices/sessions.
-- Never store the bearer token itself; only its one-way SHA-256 hash is retained.
CREATE TABLE IF NOT EXISTS owner_login_sessions (
    id UUID PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    username VARCHAR(120) NOT NULL,
    device_label VARCHAR(180) NOT NULL DEFAULT 'Unknown device',
    ip_address VARCHAR(64),
    user_agent VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    logged_out_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_owner_login_sessions_user_created
    ON owner_login_sessions (username, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_owner_login_sessions_user_active
    ON owner_login_sessions (username, logged_out_at, expires_at);
