package com.aegisshield.endorsement.model;

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
@Table(name = "batch_jobs")
public class BatchJob {
    @Id
    private String id;
    
    private String employerId;
    
    @Enumerated(EnumType.STRING)
    private BatchStatus status;
    
    private String submittedAt;
    private String completedAt;
    private int totalRecords;
    private int processedRecords;
    private int successCount;
    private int failureCount;
    private double totalPremiumImpact;
    
    @Lob
    @Column(columnDefinition = "CLOB")
    @Convert(converter = StringListConverter.class)
    private List<String> errorLog;
    
    @Lob
    @Column(columnDefinition = "CLOB")
    @Convert(converter = StringListConverter.class)
    private List<String> endorsementIds; // references to processed endorsements
}
