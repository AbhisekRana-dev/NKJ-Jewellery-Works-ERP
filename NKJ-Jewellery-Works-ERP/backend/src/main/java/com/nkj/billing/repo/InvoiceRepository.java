// package com.nkj.billing.repo;
// import com.nkj.billing.model.Invoice;
// import org.springframework.data.jpa.repository.JpaRepository;
// import java.util.*;
// public interface InvoiceRepository extends JpaRepository<Invoice,Long>{
//  List<Invoice> findAllByOrderByCreatedAtDesc();
//  Optional<Invoice> findByInvoiceNo(String invoiceNo);
// }

package com.nkj.billing.repo;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.nkj.billing.model.Invoice;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    List<Invoice> findAllByOrderByCreatedAtDesc();

    Optional<Invoice> findByInvoiceNo(String invoiceNo);
}