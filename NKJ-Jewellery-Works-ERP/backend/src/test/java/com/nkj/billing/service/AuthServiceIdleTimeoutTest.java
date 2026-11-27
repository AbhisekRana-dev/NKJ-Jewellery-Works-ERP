package com.nkj.billing.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

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
    private JdbcTemplate jdbc;
    private AuthService service;
    private Map<String, Object> sessions;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        ObjectProvider<JavaMailSender> mailSenderProvider = mock(ObjectProvider.class);
        service = new AuthService(mailSenderProvider, new ObjectMapper(), jdbc);
        ReflectionTestUtils.setField(service, "sessionIdleTimeoutMillis", 5_000L);
        sessions = (Map<String, Object>) ReflectionTestUtils.getField(service, "sessions");
    }

    @Test
    void defaultIdleTimeoutIsFifteenMinutes() {
        ObjectProvider<JavaMailSender> mailSenderProvider = mock(ObjectProvider.class);
        AuthService defaults = new AuthService(mailSenderProvider, new ObjectMapper(), mock(JdbcTemplate.class));
        assertEquals(900_000L, (long) ReflectionTestUtils.getField(defaults, "sessionIdleTimeoutMillis"));
    }

    @Test
    void ordinarySessionValidationDoesNotExtendIdleWindowOrWriteActivity() throws Exception {
        long lastActivity = System.currentTimeMillis() - 2_000L;
        String token = addSession(lastActivity, System.currentTimeMillis() + 60_000L);

        assertTrue(service.valid(token));
        assertEquals(lastActivity, ReflectionTestUtils.getField(sessions.get(token), "lastActivityAt"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void explicitActivityRefreshesTheIdleWindow() throws Exception {
        long now = System.currentTimeMillis();
        String token = addSession(now - 2_000L, now + 60_000L);
        Object state = sessions.get(token);

        assertTrue(service.recordActivity(token));
        long refreshedAt = (long) ReflectionTestUtils.getField(state, "lastActivityAt");
        assertTrue(refreshedAt >= now);
        assertTrue(service.valid(token));
        verifyNoInteractions(jdbc);
    }

    @Test
    void idleSessionIsRejectedAndRevokedServerSide() throws Exception {
        ReflectionTestUtils.setField(service, "sessionIdleTimeoutMillis", 100L);
        String token = addSession(System.currentTimeMillis() - 500L, System.currentTimeMillis() + 60_000L);

        assertFalse(service.valid(token));
        assertFalse(sessions.containsKey(token));
        assertTrue(service.wasIdleExpired(token));
        assertTrue(service.wasIdleExpired(token),
                "Concurrent 401 responses must retain the same inactivity expiry reason.");
        verify(jdbc).update(anyString(), any(Object[].class));
    }

    @Test
    void absoluteSessionExpiryStillAppliesEvenAfterRecentActivity() throws Exception {
        long now = System.currentTimeMillis();
        String token = addSession(now, now - 1L);

        assertFalse(service.valid(token));
        assertFalse(sessions.containsKey(token));
        assertFalse(service.wasIdleExpired(token));
        verify(jdbc).update(anyString(), any(Object[].class));
    }

    private String addSession(long lastActivityAt, long expiresAt) throws Exception {
        String token = "test-bearer-" + UUID.randomUUID();
        Class<?> stateClass = Class.forName("com.nkj.billing.service.AuthService$SessionState");
        Constructor<?> constructor = stateClass.getDeclaredConstructor(String.class, long.class, long.class);
        constructor.setAccessible(true);
        Object state = constructor.newInstance(UUID.randomUUID().toString(), expiresAt, lastActivityAt);
        sessions.put(token, state);
        return token;
    }
}
