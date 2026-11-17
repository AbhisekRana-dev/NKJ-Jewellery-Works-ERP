package com.nkj.billing.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Constructor;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

class AuthServiceIdleTimeoutTest {
    private static final String TOKEN = "idle-timeout-test-token";
    private static final long TEN_MINUTES_MILLIS = 10 * 60 * 1000L;
    private static final long EIGHT_HOURS_MILLIS = 8 * 60 * 60 * 1000L;

    private AuthService service;
    private Object sessionState;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        service = new AuthService(mock(ObjectProvider.class), new ObjectMapper(), jdbc);

        long now = System.currentTimeMillis();
        Class<?> stateType = Class.forName(AuthService.class.getName() + "$SessionState");
        Constructor<?> constructor = stateType.getDeclaredConstructor(String.class, long.class, long.class);
        constructor.setAccessible(true);
        sessionState = constructor.newInstance(UUID.randomUUID().toString(), now + EIGHT_HOURS_MILLIS, now);

        Map<String, Object> sessions =
                (Map<String, Object>) ReflectionTestUtils.getField(service, "sessions");
        sessions.put(TOKEN, sessionState);
    }

    @Test
    void sessionIsRejectedAtTenMinutesWithoutUserInteraction() {
        long lastActivity = System.currentTimeMillis() - TEN_MINUTES_MILLIS;
        ReflectionTestUtils.setField(sessionState, "lastUserActivityAt", lastActivity);

        assertFalse(service.valid(TOKEN));
    }

    @Test
    void normalSessionValidationDoesNotRefreshUserActivity() {
        long lastActivity = System.currentTimeMillis() - (TEN_MINUTES_MILLIS - 1_000);
        ReflectionTestUtils.setField(sessionState, "lastUserActivityAt", lastActivity);

        assertTrue(service.valid(TOKEN));
        assertTrue(ReflectionTestUtils.getField(sessionState, "lastUserActivityAt").equals(lastActivity));
    }

    @Test
    void explicitUserActivityRefreshesTheIdleWindow() {
        long lastActivity = System.currentTimeMillis() - (TEN_MINUTES_MILLIS - 1_000);
        ReflectionTestUtils.setField(sessionState, "lastUserActivityAt", lastActivity);

        service.markUserActivity(TOKEN);

        long refreshedAt = (long) ReflectionTestUtils.getField(sessionState, "lastUserActivityAt");
        assertTrue(refreshedAt > lastActivity);
        assertTrue(service.valid(TOKEN));
    }

    @Test
    void idleTimeoutBoundaryIsExactlyTenMinutes() {
        long now = System.currentTimeMillis();

        assertFalse(AuthService.isIdleTimeoutReached(now, now - TEN_MINUTES_MILLIS + 1));
        assertTrue(AuthService.isIdleTimeoutReached(now, now - TEN_MINUTES_MILLIS));
    }
}
