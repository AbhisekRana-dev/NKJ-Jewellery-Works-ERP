package com.nkj.billing.service;

import com.nkj.billing.model.Customer;
import com.nkj.billing.repo.CustomerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

/**
 * Single customer identity policy for invoice synchronization:
 * normalized phone only. A missing phone deliberately produces no customer.
 */
@Service
public class CustomerService {
    private final CustomerRepository customers;

    public CustomerService(CustomerRepository customers) {
        this.customers = customers;
    }

    @Transactional
    public Customer registerOrReuseFromInvoice(
            String customerName, String phone, String email, String address) {
        String normalizedPhone = normalizePhone(phone);
        if (normalizedPhone == null) {
            // Do not manufacture customer rows that cannot be identified
            // reliably or safely deduplicated.
            return null;
        }

        String name = customerName == null ? "" : customerName.trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Customer name is required to register an invoice customer.");
        }

        return customers.upsertByNormalizedPhone(
                name, normalizedPhone, clean(email), clean(address));
    }

    @Transactional(readOnly = true)
    public boolean phoneBelongsToAnotherCustomer(String phone, long customerId) {
        String normalizedPhone = normalizePhone(phone);
        return normalizedPhone != null
                && customers.phoneBelongsToAnotherCustomer(normalizedPhone, customerId);
    }

    /**
     * Strip visual separators and support common Indian formats (+91 and 0
     * prefix). The normalized customer key is always the 10-digit number.
     */
    public String normalizePhone(String value) {
        if (value == null || value.isBlank()) return null;
        String digits = value.replaceAll("[^0-9]", "");
        if (digits.length() == 12 && digits.startsWith("91")) {
            digits = digits.substring(2);
        } else if (digits.length() == 11 && digits.startsWith("0")) {
            digits = digits.substring(1);
        }
        if (digits.isEmpty()) return null;
        if (!digits.matches("[0-9]{10}")) {
            throw new IllegalArgumentException(
                    "Customer phone must resolve to exactly 10 digits after removing formatting and an optional +91/0 prefix.");
        }
        return digits;
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}