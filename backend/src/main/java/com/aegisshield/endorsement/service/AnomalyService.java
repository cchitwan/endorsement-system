package com.aegisshield.endorsement.service;

import com.aegisshield.endorsement.model.EndorsementRequest;
import com.aegisshield.endorsement.model.MemberDetails;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
public class AnomalyService {

    private static final int MAX_BACKDATING_DAYS = 60;
    private static final int MAX_DEPENDENT_AGE_CHILD = 25;
    private static final int MAX_DEPENDENT_AGE_PARENT = 80;

    public AnomalyResult analyze(EndorsementRequest req) {
        List<String> flags = new ArrayList<>();
        String riskLevel = "LOW";

        MemberDetails details = req.getMemberDetails();
        if (details == null) {
            return new AnomalyResult(riskLevel, flags);
        }

        String effectiveDateStr = details.getTargetEffectiveDate();
        String dobStr = details.getDob();
        String email = details.getEmail();

        // ── 1. Backdating check ──────────────────────────────────────────
        if (effectiveDateStr != null && !effectiveDateStr.isBlank()) {
            try {
                LocalDate effective = LocalDate.parse(effectiveDateStr, DateTimeFormatter.ISO_DATE);
                long daysDiff = ChronoUnit.DAYS.between(effective, LocalDate.now());
                if (daysDiff > MAX_BACKDATING_DAYS) {
                    flags.add("BACKDATING: Effective date is " + daysDiff + " days in the past (limit: "
                            + MAX_BACKDATING_DAYS + " days). Insurer approval required.");
                    riskLevel = "HIGH";
                } else if (daysDiff > 30) {
                    flags.add("BACKDATING_WARNING: Effective date is " + daysDiff + " days ago. Review recommended.");
                    riskLevel = escalate(riskLevel, "MEDIUM");
                }
            } catch (Exception ignored) {}
        }

        // ── 2. Future effective date ─────────────────────────────────────
        if (effectiveDateStr != null && !effectiveDateStr.isBlank()) {
            try {
                LocalDate effective = LocalDate.parse(effectiveDateStr, DateTimeFormatter.ISO_DATE);
                if (effective.isAfter(LocalDate.now().plusMonths(3))) {
                    flags.add("FUTURE_DATE: Effective date is more than 3 months in the future.");
                    riskLevel = escalate(riskLevel, "MEDIUM");
                }
            } catch (Exception ignored) {}
        }

        // ── 3. Member age anomaly ────────────────────────────────────────
        if (dobStr != null && !dobStr.isBlank()) {
            try {
                LocalDate dob = LocalDate.parse(dobStr, DateTimeFormatter.ISO_DATE);
                long age = ChronoUnit.YEARS.between(dob, LocalDate.now());
                if (age < 18) {
                    flags.add("AGE_UNDER_18: Member age " + age + " is below minimum insurable age.");
                    riskLevel = "HIGH";
                } else if (age > 70) {
                    flags.add("AGE_HIGH_RISK: Member age " + age + " falls in high-premium band (66+).");
                    riskLevel = escalate(riskLevel, "MEDIUM");
                }
            } catch (Exception ignored) {}
        }

        // ── 4. Dependent anomalies ───────────────────────────────────────
        if (details.getDependents() != null) {
            details.getDependents().forEach(dep -> {
                if ("child".equalsIgnoreCase(dep.getRelationship()) && dep.getAge() > MAX_DEPENDENT_AGE_CHILD) {
                    flags.add("DEP_AGE: Child dependent '" + dep.getName() + "' is " + dep.getAge()
                            + " yrs old (max " + MAX_DEPENDENT_AGE_CHILD + ").");
                }
                if ("parent".equalsIgnoreCase(dep.getRelationship()) && dep.getAge() > MAX_DEPENDENT_AGE_PARENT) {
                    flags.add("DEP_PARENT_AGE: Parent dependent '" + dep.getName() + "' is " + dep.getAge()
                            + " yrs old (max " + MAX_DEPENDENT_AGE_PARENT + ").");
                }
            });
            if (!flags.isEmpty()) riskLevel = escalate(riskLevel, "MEDIUM");
        }

        // ── 5. Retry simulation trigger (email contains "retry") ─────────
        if (email != null && email.contains("retry")) {
            flags.add("GATEWAY_SIM: Email contains 'retry' — simulating insurer gateway timeout.");
            riskLevel = escalate(riskLevel, "MEDIUM");
        }

        return new AnomalyResult(riskLevel, flags);
    }

    private String escalate(String current, String candidate) {
        List<String> order = List.of("LOW", "MEDIUM", "HIGH");
        return order.indexOf(candidate) > order.indexOf(current) ? candidate : current;
    }

    public record AnomalyResult(String riskLevel, List<String> flags) {}
}
