package com.nkj.billing.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Maintains the owner login audit retention policy without requiring a user
 * to open Profile. Active sessions are never deleted.
 */
@Component
public class OwnerLoginHistoryCleanup {
    private final JdbcTemplate jdbc;

    public OwnerLoginHistoryCleanup(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Scheduled(fixedDelay = 300_000L, initialDelay = 60_000L)
    public void expireIdleSessionsAndDeleteOldHistory() {
        // Persist idle timeout even when no browser remains open.
        jdbc.update("""
            UPDATE owner_login_sessions
               SET logged_out_at = last_active_at + INTERVAL '30 minutes',
                   logout_reason = COALESCE(logout_reason, 'INACTIVITY_TIMEOUT')
             WHERE logged_out_at IS NULL
               AND expires_at > NOW()
               AND last_active_at <= NOW() - INTERVAL '30 minutes'
            """);

        // The absolute session lifetime is still enforced independently.
        jdbc.update("""
            UPDATE owner_login_sessions
               SET logged_out_at = expires_at,
                   logout_reason = COALESCE(logout_reason, 'SESSION_EXPIRED')
             WHERE logged_out_at IS NULL
               AND expires_at <= NOW()
            """);

        // Retain each audit record for 24 hours from its login-created_at.
        // Do not delete any session that is still active.
        jdbc.update("""
            DELETE FROM owner_login_sessions
             WHERE created_at <= NOW() - INTERVAL '24 hours'
               AND logged_out_at IS NOT NULL
            """);
    }
}
