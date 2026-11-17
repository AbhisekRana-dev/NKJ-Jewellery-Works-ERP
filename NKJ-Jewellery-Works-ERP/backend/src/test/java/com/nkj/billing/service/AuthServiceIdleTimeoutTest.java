package com.nkj.billing.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;

class AuthServiceIdleTimeoutTest {
    private static final String TOKEN = "opaque-test-bearer-token";
    private static final String USERNAME = "owner";

    private JdbcTemplate jdbc;
    private AuthService auth;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        jdbc = org.mockito.Mockito.mock(JdbcTemplate.class);
        ObjectProvider<JavaMailSender> mailSenderProvider =
                org.mockito.Mockito.mock(ObjectProvider.class);
        auth = new AuthService(mailSenderProvider, new ObjectMapper(), jdbc);
        org.springframework.test.util.ReflectionTestUtils.setField(auth, "username", USERNAME);
    }

    @Test
    void activeSessionIsValidWithoutApiPollingExtendingItsIdleTimestamp() {
        doReturn(List.of(sessionRow(9)))
                .when(jdbc).queryForList(anyString(), any(Object[].class));

        assertTrue(auth.valid(TOKEN));
        verify(jdbc, never()).update(contains("SET last_active_at=NOW()"), any(Object[].class));
    }

    @Test
    void sessionPastTenMinutesOfRecordedUserActivityIsRejectedAndRevoked() {
        doReturn(List.of(sessionRow(11)))
                .when(jdbc).queryForList(anyString(), any(Object[].class));
        doReturn(1).when(jdbc).update(contains("SET logged_out_at"), any(Object[].class));

        assertTrue(auth.isIdleExpired(TOKEN));
        assertFalse(auth.valid(TOKEN));
        verify(jdbc).update(contains("SET logged_out_at"), any(Object[].class));
    }

    @Test
    void explicitActivityEndpointRefreshesLastActiveAtForAStillValidSession() {
        doReturn(List.of(sessionRow(2)))
                .when(jdbc).queryForList(anyString(), any(Object[].class));
        doReturn(1).when(jdbc).update(contains("SET last_active_at=NOW()"), any(Object[].class));

        auth.recordActivity(TOKEN);

        verify(jdbc).update(
                contains("SET last_active_at=NOW()"),
                org.mockito.ArgumentMatchers.eq(sha256(TOKEN)));
    }

    @Test
    void logoutRevokesThePersistedSessionEvenWhenTheCallerIsAlreadyIdle() {
        doReturn(List.of(sessionRow(12)))
                .when(jdbc).queryForList(anyString(), any(Object[].class));
        doReturn(1).when(jdbc).update(contains("SET logged_out_at"), any(Object[].class));

        assertTrue(auth.logout(TOKEN));
        verify(jdbc).update(
                contains("SET logged_out_at"),
                org.mockito.ArgumentMatchers.eq(sha256(TOKEN)));
    }

    private Map<String, Object> sessionRow(long minutesIdle) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", java.util.UUID.randomUUID());
        row.put("username", USERNAME);
        row.put("expires_at", Timestamp.from(Instant.now().plusSeconds(60 * 60)));
        row.put("last_active_at", Timestamp.from(Instant.now().minusSeconds(minutesIdle * 60)));
        row.put("logged_out_at", null);
        return row;
    }

    private String sha256(String value) {
        try {
            return Base64.getEncoder().encodeToString(
                    MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
