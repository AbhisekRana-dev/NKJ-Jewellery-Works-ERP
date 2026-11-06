package com.nkj.billing.repo;

import org.springframework.data.jpa.repository.JpaRepository;

import com.nkj.billing.model.MetalRate;

public interface MetalRateRepository extends JpaRepository<MetalRate, Long> {
}
