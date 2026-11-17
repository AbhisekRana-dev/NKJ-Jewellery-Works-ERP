package com.nkj.billing.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.lang.reflect.Constructor;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

class AuthServiceIdleTimeoutTest {
    private static final long MINUTE = 60_000L;
    private AuthService auth;
    private JdbcTemplate jdbc;
    private Map<String, Object> sessions;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        ObjectProvider<JavaMailSender> mailProvider = mock(ObjectProvider.class);
        auth = new AuthService(mailProvider, new ObjectMapper(), jdbc);
        sessions = (Map<String, Object>) ReflectionTestUtils.getField(auth, "sessions");
    }

    @Test
    void backgroundSessionValidationDoesNotExtendInactivityWindow() throws Exception {
        String token = "background-poll-session-token";
        Object state = createSessionState(System.currentTimeMillis() - 11 * MINUTE);
        sessions.put(token, state);

        // The same validation path used by GET /auth/session and protected API
        // requests is read-only with respect to the idle deadline.
        assertFalse(auth.valid(token));
        assertFalse(sessions.containsKey(token));
    }

    @Test
    void explicitUserActivityExtendsAnOtherwiseActiveSession() throws Exception {
        String token = "human-activity-session-token";
        long lastActivity = System.currentTimeMillis() - 9 * MINUTE;
        Object state = createSessionState(lastActivity);
        sessions.put(token, state);

        assertTrue(auth.valid(token));
        long unchanged = (long) ReflectionTestUtils.getField(state, "lastActivityAt");
        assertTrue(unchanged <= lastActivity + 5_000L);

        assertTrue(auth.recordActivity(token));
        long refreshed = (long) ReflectionTestUtils.getField(state, "lastActivityAt");
        assertTrue(refreshed > unchanged);
        assertTrue(auth.valid(token));
    }

    private Object createSessionState(long lastActivityAt) throws Exception {
        Class<?> type = Class.forName("com.nkj.billing.service.AuthService$SessionState");
        Constructor<?> constructor = type.getDeclaredConstructor(String.class, long.class, long.class);
        constructor.setAccessible(true);
        long now = System.currentTimeMillis();
        Object state = constructor.newInstance(UUID.randomUUID().toString(), now + 60 * MINUTE, now);
        ReflectionTestUtils.setField(state, "lastActivityAt", lastActivityAt);
        return state;
    }
}
