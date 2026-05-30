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
public class ForecastDetails {
    private double currentBalance;
    private int forecastedAdditions30Days;
    private int forecastedTerminations30Days;
    private double predictedNetPremiumImpact;
    private double recommendedBuffer;
    private double minimumRequiredBalance;
    private List<Integer> historicalHiresTrend;
    private List<Integer> historicalTermsTrend;
}
