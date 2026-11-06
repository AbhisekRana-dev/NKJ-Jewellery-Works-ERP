package com.nkj.billing.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.RestController;

import com.nkj.billing.service.AuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    public AuthController(AuthService auth) { this.auth = auth; }

    record Login(String username, String password) {}
    record Verify(String challengeId, String code) {}
    record SetupEmailStart(String username, String password) {}
    record SetupEmailVerify(String challengeId, String code) {}

    @PostMapping("/login")
    public Map<String,Object> login(@RequestBody Login x) {
        return Map.of("challengeId", auth.login(x.username(), x.password()), "requiresTotp", true);
    }
    @PostMapping("/verify")
    public Map<String,Object> verify(@RequestBody Verify x) {
        return Map.of("token", auth.verify(x.challengeId(), x.code()), "username", auth.getUsername());
    }
    @PostMapping("/logout")
    public Map<String,Object> logout(@RequestHeader(value="Authorization", required=false) String h) {
        if (h != null && h.startsWith("Bearer ")) auth.logout(h.substring(7));
        return Map.of("success", true);
    }

    /** Password verification only starts the email OTP challenge; it does not create a session. */
    @GetMapping("/session")
    public Map<String,String> session(@RequestHeader(value="Authorization", required=false) String header) {
        String token = header != null && header.startsWith("Bearer ") ? header.substring(7) : "";
        if (!auth.valid(token)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Administrator session is not valid.");
        return Map.of("username", auth.getUsername());
    }

    @PostMapping("/setup-email/start")
    public Map<String,String> startSetupEmail(@RequestBody SetupEmailStart x) {
        return auth.sendSetupEmailOtp(x.username(), x.password());
    }
    @PostMapping("/setup-email/verify")
    public Map<String,String> verifySetupEmail(@RequestBody SetupEmailVerify x) {
        return Map.of("setupToken", auth.verifySetupEmailOtp(x.challengeId(), x.code()));
    }
    @GetMapping("/setup-uri")
    public Map<String,String> setup(@RequestHeader(value="X-Setup-Token", required=false) String token) {
        return Map.of("otpauthUri", auth.setupUri(token));
    }
}
