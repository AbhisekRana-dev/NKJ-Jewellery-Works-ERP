ALTER TABLE owner_login_sessions
    ADD COLUMN IF NOT EXISTS logout_reason VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_owner_login_sessions_cleanup
    ON owner_login_sessions (created_at)
    WHERE logged_out_at IS NOT NULL;
