package com.aegisshield.endorsement.service;

import com.aegisshield.endorsement.model.CoverageTier;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Map;

@Service
public class PremiumCalculatorService {

    private static final Map<String, Double> AGE_BAND_RATES = Map.of(
            "18-25", 5500.0,
            "26-35", 7800.0,
            "36-45", 11200.0,
            "46-55", 16800.0,
            "56-65", 24500.0,
            "66+",   35000.0
    );

    private static final Map<CoverageTier, Double> TIER_MULTIPLIERS = Map.of(
            CoverageTier.EMPLOYEE_ONLY,   1.0,
            CoverageTier.EMPLOYEE_SPOUSE, 1.8,
            CoverageTier.EMPLOYEE_FAMILY, 2.5
    );

    public double calculateMonthlyPremium(int age, CoverageTier tier) {
        double base = getAgeBandRate(age);
        double multiplier = TIER_MULTIPLIERS.getOrDefault(tier, 1.0);
        return Math.round(base * multiplier * 100.0) / 100.0;
    }

    public double calculateProratedPremium(int age, CoverageTier tier, LocalDate effectiveDate) {
        double monthly = calculateMonthlyPremium(age, tier);
        
        // Let's compute proration fractions based on remaining days of the calendar year to match the frontend math:
        // prorationFraction = (remaining days in year) / total days in year
        LocalDate endOfYear = LocalDate.of(effectiveDate.getYear(), 12, 31);
        long daysRemaining = ChronoUnit.DAYS.between(effectiveDate, endOfYear) + 1;
        long totalDaysInYear = effectiveDate.isLeapYear() ? 366 : 365;
        
        double prorated = monthly * 12 * ((double) daysRemaining / totalDaysInYear);
        return Math.round(prorated * 100.0) / 100.0;
    }

    private double getAgeBandRate(int age) {
        if (age <= 25) return AGE_BAND_RATES.get("18-25");
        if (age <= 35) return AGE_BAND_RATES.get("26-35");
        if (age <= 45) return AGE_BAND_RATES.get("36-45");
        if (age <= 55) return AGE_BAND_RATES.get("46-55");
        if (age <= 65) return AGE_BAND_RATES.get("56-65");
        return AGE_BAND_RATES.get("66+");
    }
}
