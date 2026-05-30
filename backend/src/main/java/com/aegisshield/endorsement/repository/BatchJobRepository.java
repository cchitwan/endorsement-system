package com.aegisshield.endorsement.repository;

import com.aegisshield.endorsement.model.BatchJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BatchJobRepository extends JpaRepository<BatchJob, String> {
    List<BatchJob> findByEmployerId(String employerId);
}
