package com.nkj.billing.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;

@RestControllerAdvice
public class RestExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(RestExceptionHandler.class);
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,String>> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage() == null ? "Invalid request" : e.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String,String>> conflict(DataIntegrityViolationException e, HttpServletRequest request) {
        log.warn("Database integrity conflict for {} {}: {}", request.getMethod(), request.getRequestURI(), e.getMostSpecificCause().getMessage(), e);
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "This change conflicts with existing records. Check required fields, duplicate IDs and linked records."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,String>> internal(Exception e, HttpServletRequest request) {
        Throwable root = e;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        String rootMessage = root.getMessage() == null ? "" : root.getMessage().replaceAll("[\\r\\n\\t]+", " ").trim();
        log.error("Unhandled API exception for {} {}. Root cause: {}",
                request.getMethod(), request.getRequestURI(),
                rootMessage.isBlank() ? root.getClass().getSimpleName() : rootMessage, e);

        // This path is protected by AuthInterceptor (/api/admin/**). Give the
        // signed-in owner a useful diagnostic for QR creation failures instead
        // of hiding every database/configuration failure behind a generic 500.
        if ("POST".equalsIgnoreCase(request.getMethod())
                && "/api/admin/design-upload-sessions".equals(request.getRequestURI())) {
            String detail = root.getClass().getSimpleName();
            if (!rootMessage.isBlank()) {
                detail += ": " + rootMessage.substring(0, Math.min(rootMessage.length(), 320));
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "message", "QR upload session creation failed. " + detail
                            + ". Check the backend console for the full stack trace."
            ));
        }

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "message", "The server could not complete the request. Check the backend log for details."
        ));
    }
}
