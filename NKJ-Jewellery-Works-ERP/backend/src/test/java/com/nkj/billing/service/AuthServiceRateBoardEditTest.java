package com.nkj.billing.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

class AuthServiceRateBoardEditTest {
    private AuthService service;
    private Map<String, Object> sessions;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        ObjectProvider<JavaMailSender> mailSenderProvider = mock(ObjectProvider.class);
        service = new AuthService(mailSenderProvider, new ObjectMapper(), mock(JdbcTemplate.class));
        ReflectionTestUtils.setField(service, "username", "rate-board-owner");
        ReflectionTestUtils.setField(service, "password", "correct-admin-password");
        sessions = (Map<String, Object>) ReflectionTestUtils.getField(service, "sessions");
    }

    @Test
    void correctPasswordCreatesOnlyAShortLivedRateBoardGrantBoundToClientAddress() {
        String token = service.unlockRateBoard("correct-admin-password", "203.0.113.10");

        assertTrue(service.validRateBoardEditGrant(token, "203.0.113.10"));
        assertFalse(service.validRateBoardEditGrant(token, "203.0.113.11"));
        assertTrue(sessions.isEmpty(), "Rate Board password verification must not create an owner login session.");
    }

    @Test
    void incorrectPasswordDoesNotCreateARateBoardGrant() {
        assertThrows(IllegalArgumentException.class,
                () -> service.unlockRateBoard("incorrect-password", "203.0.113.10"));
        assertFalse(service.validRateBoardEditGrant("not-a-real-token", "203.0.113.10"));
        assertTrue(sessions.isEmpty());
    }

    @Test
    void fiveFailedPasswordAttemptsLockFurtherRateBoardUnlockAttempts() {
        for (int i = 0; i < 5; i++) {
            assertThrows(IllegalArgumentException.class,
                    () -> service.unlockRateBoard("incorrect-password", "203.0.113.10"));
        }

        assertThrows(IllegalArgumentException.class,
                () -> service.unlockRateBoard("correct-admin-password", "203.0.113.10"));
        assertTrue(sessions.isEmpty());
    }
}
