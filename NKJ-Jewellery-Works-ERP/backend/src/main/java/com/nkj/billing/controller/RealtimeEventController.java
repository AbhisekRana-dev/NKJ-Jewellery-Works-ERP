package com.nkj.billing.controller;

import com.nkj.billing.realtime.RealtimeEventBroadcaster;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/events")
public class RealtimeEventController {

    private final RealtimeEventBroadcaster broadcaster;

    public RealtimeEventController(RealtimeEventBroadcaster broadcaster) {
        this.broadcaster = broadcaster;
    }

    /**
     * Owner-authenticated event stream. Events contain invalidation topics only;
     * callers must continue using the existing protected REST endpoints to
     * retrieve records.
     */
    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe() {
        return broadcaster.subscribe();
    }
}
