package com.aegisshield.endorsement.service;

import com.aegisshield.endorsement.model.*;
import com.aegisshield.endorsement.repository.AppNotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class ReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(ReconciliationService.class);

    private final LedgerService ledgerService;
    private final AppNotificationRepository notificationRepo;

    public ReconciliationService(LedgerService ledgerService,
                                 AppNotificationRepository notificationRepo) {
        this.ledgerService = ledgerService;
        this.notificationRepo = notificationRepo;
    }

    public ReconciliationResult evaluate(EndorsementRequest req) {
        String employerId = req.getEmployerId();
        MemberDetails details = req.getMemberDetails();
        String memberEmail = details != null ? details.getEmail() : null;
        String memberName = details != null ? details.getName() : "Unknown";

        // Rule 1 – high anomaly risk
        if ("HIGH".equalsIgnoreCase(req.getAnomalyRisk())) {
            log.info("[Reconcile] {} → INSURER_QUEUE (high anomaly risk)", req.getId());
            return new ReconciliationResult(false, "HIGH_ANOMALY_RISK",
                    "Routed to insurer: high anomaly risk flags detected.");
        }

        // Rule 2 – gateway simulation (retry email trigger)
        if (memberEmail != null && memberEmail.contains("retry")) {
            // Since we don't have retryCount direct field, we can use a mock check or default, or let it fail
            log.warn("[Reconcile] {} → FAILED (gateway timeout simulation)", req.getId());
            return new ReconciliationResult(false, "GATEWAY_TIMEOUT",
                    "Simulated insurer gateway timeout. Please retry.");
        }

        // Rule 3 – insufficient funds
        double impact = req.getProratedPremiumImpact();
        if (req.getType() != EndorsementType.TERMINATE && !ledgerService.hasSufficientFunds(employerId, impact)) {
            double balance  = ledgerService.getBalance(employerId);
            double required = ledgerService.getMinimumRequired(employerId);
            log.warn("[Reconcile] {} → INSURER_QUEUE (insufficient funds: balance={}, min={})",
                    req.getId(), balance, required);
            return new ReconciliationResult(false, "INSUFFICIENT_FUNDS",
                    String.format("Your current Endorsement Account balance ($%.2f) cannot cover this debit of $%.2f.", balance, impact));
        }

        // Rule 4 – straight-through approval
        if (req.getType() != EndorsementType.TERMINATE && impact > 0) {
            ledgerService.debit(employerId, impact,
                    "Premium debit: " + req.getType() + " for " + memberName,
                    req.getId());
        }

        addApprovalNotification(req, memberName);
        log.info("[Reconcile] {} → AUTO_APPROVED (debit ${})", req.getId(), impact);
        return new ReconciliationResult(true, "AUTO_APPROVED",
                "Endorsement auto-approved. EA debited $" + String.format("%.2f", impact));
    }

    private void addApprovalNotification(EndorsementRequest req, String memberName) {
        AppNotification n = AppNotification.builder()
                .id(java.util.UUID.randomUUID().toString().substring(0, 8))
                .type("success")
                .title("Endorsement Approved")
                .message(req.getType() + " for " + memberName + " auto-approved. $"
                        + String.format("%.2f", req.getProratedPremiumImpact()) + " debited.")
                .timestamp(Instant.now().toString())
                .read(false)
                .employerId(req.getEmployerId())
                .relatedId(req.getId())
                .build();
        notificationRepo.save(n);
    }

    public record ReconciliationResult(boolean approved, String code, String message) {}
}
