package com.aegisshield.endorsement.repository;

import com.aegisshield.endorsement.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, String> {
    List<Transaction> findByEmployerId(String employerId);
}
