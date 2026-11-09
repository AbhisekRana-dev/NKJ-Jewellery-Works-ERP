package com.nkj.billing.repo;

import com.nkj.billing.model.Customer;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CustomerRepository {
    private static final BeanPropertyRowMapper<Customer> CUSTOMER_MAPPER =
            BeanPropertyRowMapper.newInstance(Customer.class);

    private final JdbcTemplate jdbc;

    public CustomerRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * PostgreSQL performs the find-or-create in one statement. The unique
     * partial index on normalized_phone arbitrates concurrent invoice saves.
     * Existing non-empty customer details are never overwritten by a sale.
     */
    public Customer upsertByNormalizedPhone(
            String name, String normalizedPhone, String email, String address) {
        Long id = jdbc.queryForObject("""
            INSERT INTO customers(name, phone, email, address)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (normalized_phone) WHERE normalized_phone IS NOT NULL
            DO UPDATE SET
                name = CASE
                    WHEN NULLIF(BTRIM(customers.name), '') IS NULL
                    THEN COALESCE(NULLIF(BTRIM(EXCLUDED.name), ''), customers.name)
                    ELSE customers.name
                END,
                email = CASE
                    WHEN NULLIF(BTRIM(customers.email), '') IS NULL
                    THEN COALESCE(NULLIF(BTRIM(EXCLUDED.email), ''), customers.email)
                    ELSE customers.email
                END,
                address = CASE
                    WHEN NULLIF(BTRIM(customers.address), '') IS NULL
                    THEN COALESCE(NULLIF(BTRIM(EXCLUDED.address), ''), customers.address)
                    ELSE customers.address
                END,
                updated_at = NOW()
            RETURNING id
            """, Long.class,
            name, normalizedPhone, emptyToNull(email), emptyToNull(address));

        String generatedCode = "NKJ-CUS-" + String.format(java.util.Locale.ROOT, "%06d", id);
        jdbc.update("""
            UPDATE customers
               SET customer_code = COALESCE(NULLIF(BTRIM(customer_code), ''), ?)
             WHERE id = ?
            """, generatedCode, id);

        return jdbc.queryForObject("""
            SELECT id, customer_code, name, phone, normalized_phone, email, address,
                   notes, created_at, updated_at
              FROM customers
             WHERE id = ?
            """, CUSTOMER_MAPPER, id);
    }

    public boolean phoneBelongsToAnotherCustomer(String normalizedPhone, long customerId) {
        Boolean exists = jdbc.queryForObject("""
            SELECT EXISTS (
                SELECT 1 FROM customers
                 WHERE normalized_phone = ? AND id <> ?
            )
            """, Boolean.class, normalizedPhone, customerId);
        return Boolean.TRUE.equals(exists);
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}