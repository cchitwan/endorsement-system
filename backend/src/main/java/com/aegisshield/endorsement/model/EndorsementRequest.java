package com.aegisshield.endorsement.model;

import com.aegisshield.endorsement.model.converter.ErrorDetailsConverter;
import com.aegisshield.endorsement.model.converter.MemberDetailsConverter;
import com.aegisshield.endorsement.model.converter.StringListConverter;
import jakarta.persistence.*;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "endorsement_requests")
public class EndorsementRequest {
    @Id
    private String id;
    
    private String employerId;
    private String memberId;
    
    @Enumerated(EnumType.STRING)
    private EndorsementType type;
    
    @Enumerated(EnumType.STRING)
    private EndorsementStatus status;
    
    private String submissionType; // "MANUAL" or "BATCH"
    private double proratedPremiumImpact;
    private double monthlyPremiumImpact;
    
    @Lob
    @Column(columnDefinition = "CLOB")
    @Convert(converter = StringListConverter.class)
    private List<String> anomalies;
    
    private String anomalyRisk; // "LOW", "MEDIUM", "HIGH"
    
    private String comments;
    private String processedAt;
    private String confirmedBy;
    
    @Lob
    @Column(columnDefinition = "CLOB")
    @Convert(converter = ErrorDetailsConverter.class)
    private ErrorDetails errorDetails;
    
    @Lob
    @Column(columnDefinition = "CLOB")
    @Convert(converter = MemberDetailsConverter.class)
    private MemberDetails memberDetails;
    
    private String idempotencyKey;
    private String batchId;
}
