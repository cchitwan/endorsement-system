package com.aegisshield.endorsement.model;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PolicySummary {
    private String policyId;
    private String employerName;
    private int totalActiveMembers;
    private double totalMonthlyPremium;
    private String policyStartDate;
    private String policyEndDate;
    private double eaBalance;
    private double optimizedMinimumBalance;
    private int version;
}
