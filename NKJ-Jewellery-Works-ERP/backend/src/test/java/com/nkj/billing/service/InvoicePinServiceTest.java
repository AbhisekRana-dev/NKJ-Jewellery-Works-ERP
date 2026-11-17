package com.nkj.billing.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

class InvoicePinServiceTest {
    private static final String TEST_PIN = "123456";
    private static final String CLIENT_IP = "192.0.2.10";
    private static final String IDEMPOTENCY_KEY = "nkj-test-request-001";
    private static final Long EXISTING_INVOICE_ID = 42L;

    private JdbcTemplate jdbc;
    private InvoicePinService service;

    @BeforeEach
    void setUp() throws Exception {
        jdbc = mock(JdbcTemplate.class);
        service = new InvoicePinService(jdbc);

        byte[] salt = "nkj-unit-test-pin-salt".getBytes(StandardCharsets.UTF_8);
        ReflectionTestUtils.setField(service, "configuredSalt", Base64.getEncoder().encodeToString(salt));
        ReflectionTestUtils.setField(service, "configuredPinHash",
                Base64.getEncoder().encodeToString(deriveHash(TEST_PIN, salt)));

        when(jdbc.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
                .thenReturn(Boolean.TRUE);
    }

    @Test
    void newInvoiceSaveTicketIsBoundToItsIdempotencyKeyAndSingleUse() {
        String ticket = service.verify(TEST_PIN, CLIENT_IP, null, "SAVE", IDEMPOTENCY_KEY);

        assertDoesNotThrow(() -> service.consumeForSave(ticket, CLIENT_IP, null, IDEMPOTENCY_KEY));
        assertThrows(IllegalArgumentException.class,
                () -> service.consumeForSave(ticket, CLIENT_IP, null, IDEMPOTENCY_KEY));
    }

    @Test
    void newInvoiceSaveTicketCannotAuthorizeAnotherIdempotencyKey() {
        String ticket = service.verify(TEST_PIN, CLIENT_IP, null, "SAVE", IDEMPOTENCY_KEY);

        assertThrows(IllegalArgumentException.class,
                () -> service.consumeForSave(ticket, CLIENT_IP, null, "different-request-key"));
    }

    @Test
    void saveTicketCannotBeUsedForPrinting() {
        String ticket = service.verify(TEST_PIN, CLIENT_IP, null, "SAVE", IDEMPOTENCY_KEY);

        assertThrows(IllegalArgumentException.class,
                () -> service.consume(ticket, CLIENT_IP, EXISTING_INVOICE_ID));
    }

    @Test
    void printTicketCannotBeUsedToSaveAnInvoice() {
        String ticket = service.verify(TEST_PIN, CLIENT_IP, EXISTING_INVOICE_ID);

        assertThrows(IllegalArgumentException.class,
                () -> service.consumeForSave(ticket, CLIENT_IP, EXISTING_INVOICE_ID, null));
    }

    @Test
    void savedInvoiceEditTicketIsBoundToTheSpecificInvoice() {
        String ticket = service.verify(TEST_PIN, CLIENT_IP, EXISTING_INVOICE_ID, "SAVE", null);

        assertThrows(IllegalArgumentException.class,
                () -> service.consumeForSave(ticket, CLIENT_IP, EXISTING_INVOICE_ID + 1, null));
    }

    @Test
    void legacyThreeArgumentVerificationStillCreatesPrintOnlyTicket() {
        String ticket = service.verify(TEST_PIN, CLIENT_IP, EXISTING_INVOICE_ID);

        assertDoesNotThrow(() -> service.consume(ticket, CLIENT_IP, EXISTING_INVOICE_ID));
    }

    @Test
    void savePurposeRequiresIdempotencyKeyForNewInvoice() {
        assertThrows(IllegalArgumentException.class,
                () -> service.verify(TEST_PIN, CLIENT_IP, null, "SAVE", null));
    }

    private static byte[] deriveHash(String pin, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(pin.toCharArray(), salt, 210_000, 256);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded();
        } finally {
            spec.clearPassword();
        }
    }
}
