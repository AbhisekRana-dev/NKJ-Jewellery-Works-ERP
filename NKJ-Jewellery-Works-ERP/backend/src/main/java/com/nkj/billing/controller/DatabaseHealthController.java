package com.nkj.billing.controller;

import java.sql.Connection;
import java.sql.Statement;
import java.util.Map;

import javax.sql.DataSource;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class DatabaseHealthController {

    private final DataSource dataSource;

    public DatabaseHealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /** A minimal public health response; internal database names and usernames stay private. */
    @GetMapping("/db")
    public ResponseEntity<Map<String, String>> checkDatabase() {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("SELECT 1");
            return ResponseEntity.ok(Map.of("status", "CONNECTED"));
        } catch (Exception ex) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("status", "DISCONNECTED", "message", "Database connection unavailable."));
        }
    }
}
