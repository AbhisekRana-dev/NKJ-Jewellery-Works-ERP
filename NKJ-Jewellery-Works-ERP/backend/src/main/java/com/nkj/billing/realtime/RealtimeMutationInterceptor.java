package com.nkj.billing.realtime;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Runs after a controller has completed. Transactional service/controller
 * proxies have committed successfully before this callback is reached.
 */
@Component
public class RealtimeMutationInterceptor implements HandlerInterceptor {

    private final RealtimeEventBroadcaster broadcaster;

    public RealtimeMutationInterceptor(RealtimeEventBroadcaster broadcaster) {
        this.broadcaster = broadcaster;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception exception) {

        if (exception != null || response.getStatus() < 200 || response.getStatus() >= 300) {
            return;
        }

        String method = request.getMethod();
        if (!("POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method)
                || "DELETE".equalsIgnoreCase(method))) {
            return;
        }

        String path = request.getRequestURI();
        if (path == null
                || path.startsWith("/api/events")
                || path.endsWith("/verify-pin")
                || path.endsWith("/consume-print-ticket")) {
            return;
        }

        String clientId = request.getHeader("X-NKJ-Client-Id");
        broadcaster.publishForRequest(path, method.toUpperCase(), clientId);
    }
}
