package com.aegisshield.endorsement.model;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberDetails {
    private String id;
    private String name;
    private String email;
    private String dob;                  // "YYYY-MM-DD"
    private String dateOfJoining;        // "YYYY-MM-DD"
    private String eligibilityDate;      // "YYYY-MM-DD"
    private CoverageTier coverageTier;   // EMPLOYEE_ONLY, EMPLOYEE_SPOUSE, EMPLOYEE_FAMILY
    private String targetEffectiveDate;  // "YYYY-MM-DD"
    private List<Dependent> dependents;
}
