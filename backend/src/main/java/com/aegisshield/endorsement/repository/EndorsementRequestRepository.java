package com.aegisshield.endorsement.repository;

import com.aegisshield.endorsement.model.EndorsementRequest;
import com.aegisshield.endorsement.model.EndorsementStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface EndorsementRequestRepository extends JpaRepository<EndorsementRequest, String> {
    List<EndorsementRequest> findByEmployerId(String employerId);
    List<EndorsementRequest> findByStatus(EndorsementStatus status);
    Optional<EndorsementRequest> findByIdempotencyKey(String idempotencyKey);
}
