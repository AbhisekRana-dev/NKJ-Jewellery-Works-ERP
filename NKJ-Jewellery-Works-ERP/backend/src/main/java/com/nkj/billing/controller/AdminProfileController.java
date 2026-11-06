package com.nkj.billing.controller;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.nkj.billing.model.AdminProfile;
import com.nkj.billing.repo.AdminProfileRepository;
import com.nkj.billing.service.AuthService;

@RestController
@RequestMapping("/api/admin/profile")
public class AdminProfileController {

    private static final Long PROFILE_ID = 1L;

    private final AdminProfileRepository repository;
    private final AuthService auth;

    public AdminProfileController(AdminProfileRepository repository, AuthService auth) {
        this.repository = repository;
        this.auth = auth;
    }

    @GetMapping
    public Map<String, Object> getProfile() {
        return toResponse(getOrCreate());
    }

    @PutMapping
    public Map<String, Object> updateProfile(@RequestBody Map<String, Object> body) {
        if (body == null) {
            throw new IllegalArgumentException("Profile data is required.");
        }

        AdminProfile profile = getOrCreate();
        String fullName = clean(body.get("fullName"));
        if (fullName.isBlank()) {
            throw new IllegalArgumentException("Full name is required.");
        }

        profile.setFullName(fullName);
        profile.setUsername(auth.getUsername());
        profile.setEmail(clean(body.get("email")));
        profile.setPhone(clean(body.get("phone")));
        profile.setDesignation(defaultIfBlank(clean(body.get("designation")), "Administrator"));
        profile.setCompany(defaultIfBlank(clean(body.get("company")), "Nandikishor Jewellery Works"));
        profile.setAddress(clean(body.get("address")));
        profile.setAbout(clean(body.get("about")));

        String photo = clean(body.get("photoDataUrl"));
        if (!photo.isBlank()) {
            if (!photo.startsWith("data:image/") || photo.length() > 3_000_000) {
                throw new IllegalArgumentException("Profile photo must be a valid image smaller than 2 MB.");
            }
            profile.setPhotoDataUrl(photo);
        } else if (Boolean.TRUE.equals(body.get("removePhoto"))) {
            profile.setPhotoDataUrl("");
        }

        return toResponse(repository.save(profile));
    }

    private AdminProfile getOrCreate() {
        return repository.findById(PROFILE_ID).orElseGet(() -> {
            AdminProfile profile = new AdminProfile();
            profile.setUsername(auth.getUsername());
            return repository.save(profile);
        });
    }

    private String clean(Object value) {
        return value == null ? "" : Objects.toString(value, "").trim();
    }

    private String defaultIfBlank(String value, String fallback) {
        return value.isBlank() ? fallback : value;
    }

    private Map<String, Object> toResponse(AdminProfile profile) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fullName", profile.getFullName());
        result.put("username", profile.getUsername());
        result.put("email", profile.getEmail());
        result.put("phone", profile.getPhone());
        result.put("designation", profile.getDesignation());
        result.put("company", profile.getCompany());
        result.put("address", profile.getAddress());
        result.put("about", profile.getAbout());
        result.put("photoDataUrl", profile.getPhotoDataUrl());
        result.put("updatedAt", profile.getUpdatedAt() == null ? "" : profile.getUpdatedAt().toString());
        return result;
    }
}
