package com.nkj.billing.repo;

import org.springframework.data.jpa.repository.JpaRepository;

import com.nkj.billing.model.AdminProfile;

public interface AdminProfileRepository extends JpaRepository<AdminProfile, Long> {
}
