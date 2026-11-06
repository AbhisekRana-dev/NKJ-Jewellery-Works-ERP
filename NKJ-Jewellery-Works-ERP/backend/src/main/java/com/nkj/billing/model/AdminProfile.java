package com.nkj.billing.model;

import java.time.LocalDateTime;
import java.time.ZoneId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "admin_profile", schema = "public")
public class AdminProfile {

    @Id
    private Long id = 1L;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName = "Abhisek Rana";

    @Column(name = "username", nullable = false, length = 100)
    private String username = "admin2026";

    @Column(name = "email", length = 200)
    private String email = "";

    @Column(name = "phone", length = 50)
    private String phone = "";

    @Column(name = "designation", length = 100)
    private String designation = "Administrator";

    @Column(name = "company", length = 200)
    private String company = "Nandikishor Jewellery Works";

    @Column(name = "address", length = 1000)
    private String address = "Sasra, Gopiballavpur, Jhargram, West Bengal - 721506";

    @Column(name = "about", columnDefinition = "TEXT")
    private String about = "Administrator of Nandikishor Jewellery Works.";

    @Column(name = "photo_data_url", columnDefinition = "TEXT")
    private String photoDataUrl = "";

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public AdminProfile() {
    }

    @PrePersist
    @PreUpdate
    protected void updateTimestamp() {
        updatedAt = LocalDateTime.now(ZoneId.of("Asia/Kolkata"));
    }

    public Long getId() { return id; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }
    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getAbout() { return about; }
    public void setAbout(String about) { this.about = about; }
    public String getPhotoDataUrl() { return photoDataUrl; }
    public void setPhotoDataUrl(String photoDataUrl) { this.photoDataUrl = photoDataUrl; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
