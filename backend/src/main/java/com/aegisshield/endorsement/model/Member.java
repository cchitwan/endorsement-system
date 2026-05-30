package com.aegisshield.endorsement.model;

import com.aegisshield.endorsement.model.converter.DependentListConverter;
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
@Table(name = "members")
public class Member {
    @Id
    private String id;
    
    private String employerId;
    private String name;
    private String email;
    private String dob;                  // "YYYY-MM-DD"
    private String dateOfJoining;        // "YYYY-MM-DD"
    private String eligibilityDate;      // "YYYY-MM-DD"
    
    @Enumerated(EnumType.STRING)
    private CoverageTier coverageTier;
    
    private double monthlyPremium;
    
    @Enumerated(EnumType.STRING)
    private MemberStatus status;
    
    @Lob
    @Column(columnDefinition = "CLOB")
    @Convert(converter = DependentListConverter.class)
    private List<Dependent> dependents;
}
