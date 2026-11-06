package com.nkj.billing.controller;

import com.nkj.billing.service.InvoicePinService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/invoices")
public class InvoicePinController {
    private final InvoicePinService pins;
    public InvoicePinController(InvoicePinService pins) { this.pins = pins; }
    public record PinRequest(String pin) {}

    @PostMapping("/verify-pin")
    public Map<String,Object> verify(@RequestBody PinRequest request, HttpServletRequest servletRequest) {
        String ticket = pins.verify(request == null ? null : request.pin(), servletRequest.getRemoteAddr());
        return Map.of("verified", true, "ticket", ticket, "expiresInSeconds", 90);
    }

    public record TicketRequest(String ticket) {}
    @PostMapping("/consume-print-ticket")
    public Map<String,Object> consumePrintTicket(@RequestBody TicketRequest request, HttpServletRequest servletRequest) {
        pins.consume(request == null ? null : request.ticket(), servletRequest.getRemoteAddr());
        return Map.of("authorized", true);
    }
}
