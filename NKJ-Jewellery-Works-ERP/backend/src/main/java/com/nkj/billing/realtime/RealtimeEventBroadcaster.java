package com.nkj.billing.realtime;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Sends small, non-sensitive invalidation events to authenticated ERP clients.
 * The frontend reloads only the data for the active page; no business data is
 * sent over this stream.
 */
@Component
public class RealtimeEventBroadcaster {

    private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<SseEmitter> publicEmitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> {
            emitters.remove(emitter);
            emitter.complete();
        });
        emitter.onError(error -> emitters.remove(emitter));
        emitters.add(emitter);

        try {
            emitter.send(SseEmitter.event().name("connected")
                    .data(Map.of("connected", true, "connectedAt", Instant.now().toString())));
        } catch (IOException | IllegalStateException error) {
            emitters.remove(emitter);
            emitter.completeWithError(error);
        }
        return emitter;
    }

    /**
     * Public clients receive only public-safe metal-rate and catalogue invalidation topics.
     * No owner, invoice, customer, payroll or transaction event is exposed.
     */
    public SseEmitter subscribePublicUpdates() {
        SseEmitter emitter = new SseEmitter(0L);
        emitter.onCompletion(() -> publicEmitters.remove(emitter));
        emitter.onTimeout(() -> {
            publicEmitters.remove(emitter);
            emitter.complete();
        });
        emitter.onError(error -> publicEmitters.remove(emitter));
        publicEmitters.add(emitter);
        try {
            emitter.send(SseEmitter.event().name("connected")
                    .data(Map.of("connected", true, "connectedAt", Instant.now().toString())));
        } catch (IOException | IllegalStateException error) {
            publicEmitters.remove(emitter);
            emitter.completeWithError(error);
        }
        return emitter;
    }

    public void publishForRequest(String path, String method, String originClientId) {
        List<String> topics = topicsFor(path);
        if (topics.isEmpty()) {
            return;
        }

        String eventId = UUID.randomUUID().toString();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventId", eventId);
        payload.put("occurredAt", Instant.now().toString());
        payload.put("method", method);
        payload.put("path", path);
        payload.put("topics", topics);
        payload.put("originClientId", originClientId == null ? "" : originClientId);

        sendTo(emitters, "data-changed", payload, eventId);

        List<String> publicTopics = topics.stream()
                .filter(topic -> "rates".equals(topic) || "designs".equals(topic))
                .toList();
        if (!publicTopics.isEmpty()) {
            Map<String, Object> publicPayload = new LinkedHashMap<>();
            publicPayload.put("eventId", eventId);
            publicPayload.put("occurredAt", payload.get("occurredAt"));
            publicPayload.put("topics", publicTopics);
            sendTo(publicEmitters, "data-changed", publicPayload, eventId);
        }
    }

    private void sendTo(
            CopyOnWriteArrayList<SseEmitter> targets,
            String eventName,
            Object data,
            String eventId) {
        for (SseEmitter emitter : targets) {
            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name(eventName)
                        .data(data);
                if (eventId != null && !eventId.isBlank()) {
                    event.id(eventId);
                }
                emitter.send(event);
            } catch (IOException | IllegalStateException error) {
                targets.remove(emitter);
                emitter.completeWithError(error);
            }
        }
    }

    /**
     * Keep idle HTTP connections alive through reverse proxies and browsers.
     */
    @Scheduled(fixedRate = 25000)
    public void heartbeat() {
        sendTo(emitters, "heartbeat", "keep-alive", null);
        sendTo(publicEmitters, "heartbeat", "keep-alive", null);
    }

    private List<String> topicsFor(String path) {
        if (path == null) {
            return List.of();
        }

        if (path.startsWith("/api/invoices")) {
            return List.of("invoices", "customers", "installments", "payments",
                    "transactions", "cashbook", "inventory", "dashboard", "reports");
        }
        if (path.startsWith("/api/admin/installments")) {
            return List.of("installments", "bookings", "invoices", "customers",
                    "payments", "transactions", "cashbook", "dashboard", "reports");
        }
        if (path.startsWith("/api/admin/rates")) {
            return List.of("rates", "invoices");
        }
        if (path.startsWith("/api/mobile-design-upload/") && path.endsWith("/design-id")) {
            return List.of();
        }
        if (path.startsWith("/api/admin/designs")
                || path.startsWith("/api/mobile-design-upload/")) {
            return List.of("designs");
        }
        if (path.startsWith("/api/admin/profile")) {
            return List.of("profile");
        }
        if (path.startsWith("/api/admin/audit-logs")) {
            return List.of("audit-logs");
        }
        if (!path.startsWith("/api/admin/modules/")) {
            return List.of();
        }

        String remainder = path.substring("/api/admin/modules/".length());
        String module = remainder.split("/", 2)[0];
        if (module.isBlank()) {
            return List.of();
        }

        return switch (module) {
            case "payments", "installment-payments", "salary-payments" ->
                    List.of(module, "transactions", "cashbook", "customers", "dashboard", "reports");
            case "expenses" ->
                    List.of("expenses", "transactions", "cashbook", "dashboard", "reports");
            case "purchases" ->
                    List.of("purchases", "suppliers", "inventory", "stock", "transactions",
                            "cashbook", "dashboard", "reports");
            case "inventory", "stock-movements", "old-gold" ->
                    List.of(module, "inventory", "stock", "transactions", "cashbook", "dashboard", "reports");
            case "bookings" ->
                    List.of("bookings", "customers", "transactions", "cashbook", "dashboard", "reports");
            case "installments" ->
                    List.of("installments", "bookings", "customers", "transactions", "cashbook", "dashboard", "reports");
            case "staff", "staff-notes", "attendance", "salary", "leaves" ->
                    List.of(module, "staff", "attendance", "salary", "dashboard", "reports");
            case "customers" ->
                    List.of("customers", "invoices", "dashboard", "reports");
            case "suppliers" ->
                    List.of("suppliers", "purchases", "transactions", "dashboard", "reports");
            case "karigars", "repairs" ->
                    List.of(module, "karigars", "repairs", "dashboard");
            default -> {
                List<String> topics = new ArrayList<>();
                topics.add(module);
                topics.add("dashboard");
                topics.add("reports");
                yield List.copyOf(topics);
            }
        };
    }
}
