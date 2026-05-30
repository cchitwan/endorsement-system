package com.aegisshield.endorsement.controller;

import com.aegisshield.endorsement.model.*;
import com.aegisshield.endorsement.repository.*;
import com.aegisshield.endorsement.service.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class EndorsementController {

    private static final Logger log = LoggerFactory.getLogger(EndorsementController.class);

    private final MemberRepository memberRepo;
    private final EndorsementRequestRepository endorsementRepo;
    private final TransactionRepository transactionRepo;
    private final AppNotificationRepository notificationRepo;
    private final BatchJobRepository batchJobRepo;

    private final EndorsementService endorsementService;
    private final LedgerService ledgerService;

    public EndorsementController(MemberRepository memberRepo,
                                 EndorsementRequestRepository endorsementRepo,
                                 TransactionRepository transactionRepo,
                                 AppNotificationRepository notificationRepo,
                                 BatchJobRepository batchJobRepo,
                                 EndorsementService endorsementService,
                                 LedgerService ledgerService) {
        this.memberRepo = memberRepo;
        this.endorsementRepo = endorsementRepo;
        this.transactionRepo = transactionRepo;
        this.notificationRepo = notificationRepo;
        this.batchJobRepo = batchJobRepo;
        this.endorsementService = endorsementService;
        this.ledgerService = ledgerService;
    }

    // ─── Policy Summary (GET /api/policy) ──────────────────────────────────

    @GetMapping("/policy")
    public ResponseEntity<PolicySummary> getPolicy(
            @RequestParam(required = false, defaultValue = "EMP-001") String employerId) {
        
        List<Member> members = memberRepo.findByEmployerId(employerId);

        long active = members.stream().filter(m -> m.getStatus() == MemberStatus.ACTIVE).count();
        double monthlyPremium = members.stream()
                .filter(m -> m.getStatus() == MemberStatus.ACTIVE)
                .mapToDouble(Member::getMonthlyPremium).sum();

        double balance = ledgerService.getBalance(employerId);
        double minRequired = ledgerService.getMinimumRequired(employerId);

        Map<String, String> employerNames = Map.of(
                "EMP-001", "TechCorp India Pvt Ltd",
                "EMP-002", "Global Finance Solutions"
        );

        PolicySummary summary = PolicySummary.builder()
                .policyId("EMP-001".equals(employerId) ? "POL-ALPHA-2024" : "POL-BETA-2024")
                .employerName(employerNames.getOrDefault(employerId, employerId))
                .totalActiveMembers((int) active)
                .totalMonthlyPremium(Math.round(monthlyPremium * 100.0) / 100.0)
                .policyStartDate("2024-04-01")
                .policyEndDate("2025-03-31")
                .eaBalance(balance)
                .optimizedMinimumBalance(minRequired)
                .version(1)
                .build();

        return ResponseEntity.ok(summary);
    }

    // ─── Member Roster (GET /api/members) ──────────────────────────────────

    @GetMapping("/members")
    public ResponseEntity<List<Member>> getMembers(
            @RequestParam(required = false, defaultValue = "EMP-001") String employerId) {
        List<Member> members = memberRepo.findByEmployerId(employerId);
        return ResponseEntity.ok(members);
    }

    // ─── Ledger History (GET /api/ledger) ─────────────────────────────────

    @GetMapping("/ledger")
    public ResponseEntity<Map<String, Object>> getLedger(
            @RequestParam(required = false, defaultValue = "EMP-001") String employerId) {
        List<Transaction> txns = ledgerService.getTransactions(employerId);
        // Sort newest first
        List<Transaction> sorted = new ArrayList<>(txns);
        sorted.sort(Comparator.comparing(Transaction::getId).reversed());
        return ResponseEntity.ok(Map.of("ledger", sorted));
    }

    // ─── Ledger Optimization (GET /api/ledger/optimize) ───────────────────

    @GetMapping("/ledger/optimize")
    public ResponseEntity<ForecastDetails> getOptimize(
            @RequestParam(required = false, defaultValue = "EMP-001") String employerId) {
        double currentBalance = ledgerService.getBalance(employerId);
        double minRequired = ledgerService.getMinimumRequired(employerId);

        ForecastDetails details = ForecastDetails.builder()
                .currentBalance(currentBalance)
                .forecastedAdditions30Days(3)
                .forecastedTerminations30Days(1)
                .predictedNetPremiumImpact(2800.0)
                .recommendedBuffer(minRequired)
                .minimumRequiredBalance(minRequired)
                .historicalHiresTrend(List.of(2, 4, 3, 5, 2, 4))
                .historicalTermsTrend(List.of(0, 1, 0, 2, 1, 0))
                .build();

        return ResponseEntity.ok(details);
    }

    // ─── Ledger Topup (POST /api/ledger/topup) ─────────────────────────────

    @PostMapping("/ledger/topup")
    public ResponseEntity<?> topUp(@RequestBody Map<String, Object> body) {
        String employerId = (String) body.getOrDefault("employerId", "EMP-001");
        double amount = ((Number) body.get("amount")).doubleValue();
        if (amount <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid top-up amount"));
        }
        Transaction txn = ledgerService.topUp(employerId, amount);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "transaction", txn,
                "newBalance", ledgerService.getBalance(employerId)
        ));
    }

    // ─── Real-time Endorsement (POST /api/endorsements) ────────────────────

    @PostMapping("/endorsements")
    public ResponseEntity<?> submitEndorsement(
            @RequestHeader(value = "idempotency-key", required = false) String idempotencyKey,
            @RequestBody EndorsementRequest req) {
        try {
            if (req.getEmployerId() == null || req.getEmployerId().isBlank()) {
                req.setEmployerId("EMP-001");
            }
            req.setSubmissionType("MANUAL");
            if (idempotencyKey != null && !idempotencyKey.isBlank()) {
                req.setIdempotencyKey(idempotencyKey);
            }

            EndorsementRequest result = endorsementService.submit(req);
            return ResponseEntity.ok(Map.of("success", true, "data", result));
        } catch (Exception e) {
            log.error("Error submitting endorsement", e);
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ─── Query Endorsements (GET /api/endorsements) ────────────────────────

    @GetMapping("/endorsements")
    public ResponseEntity<List<EndorsementRequest>> getEndorsements(
            @RequestParam(required = false, defaultValue = "EMP-001") String employerId) {
        return ResponseEntity.ok(endorsementService.getEndorsements(employerId));
    }

    // ─── Underwriter Actions ───────────────────────────────────────────────

    @PostMapping("/endorsements/{id}/confirm")
    public ResponseEntity<?> confirmEndorsement(@PathVariable String id) {
        try {
            EndorsementRequest result = endorsementService.underwriterApprove(id);
            return ResponseEntity.ok(Map.of("success", true, "data", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/endorsements/{id}/reject")
    public ResponseEntity<?> rejectEndorsement(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.getOrDefault("reason", "Rejected by underwriter") : "Rejected by underwriter";
        try {
            EndorsementRequest result = endorsementService.underwriterReject(id, reason);
            return ResponseEntity.ok(Map.of("success", true, "data", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/endorsements/{id}/retry")
    public ResponseEntity<?> retryEndorsement(@PathVariable String id) {
        try {
            EndorsementRequest result = endorsementService.retry(id);
            return ResponseEntity.ok(Map.of("success", true, "data", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ─── Batch Operations (POST /api/endorsements/batch) ───────────────────

    @PostMapping("/endorsements/batch")
    public ResponseEntity<?> uploadBatch(@RequestBody Map<String, Object> body) {
        String employerId = (String) body.getOrDefault("employerId", "EMP-001");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) body.get("records");

        if (rows == null || rows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No batch records supplied"));
        }

        List<EndorsementRequest> requests = rows.stream().map(row -> {
            EndorsementRequest req = new EndorsementRequest();
            req.setEmployerId(employerId);
            req.setSubmissionType("BATCH");
            req.setType(EndorsementType.valueOf(
                    row.getOrDefault("type", "ADD").toString().toUpperCase()));
            
            // Build nested MemberDetails
            String name = (String) row.getOrDefault("name", "Unknown");
            String email = (String) row.getOrDefault("email", "");
            String dob = (String) row.getOrDefault("dob", "1990-01-01");
            String effectiveDate = (String) row.getOrDefault("effectiveDate", null);
            String department = (String) row.getOrDefault("department", "");
            String employeeId = (String) row.getOrDefault("employeeId", "");
            
            CoverageTier tier;
            String tierStr = row.getOrDefault("coverageTier", "EMPLOYEE_ONLY").toString().toUpperCase();
            try { tier = CoverageTier.valueOf(tierStr); }
            catch (Exception e) { tier = CoverageTier.EMPLOYEE_ONLY; }

            req.setMemberDetails(MemberDetails.builder()
                    .name(name)
                    .email(email)
                    .dob(dob)
                    .dateOfJoining(effectiveDate)
                    .eligibilityDate(effectiveDate)
                    .targetEffectiveDate(effectiveDate)
                    .coverageTier(tier)
                    .dependents(new ArrayList<>())
                    .build());
                    
            req.setIdempotencyKey("batch-" + employerId + "-" + email);
            return req;
        }).collect(Collectors.toList());

        try {
            BatchJob job = endorsementService.processBatch(employerId, requests);
            return ResponseEntity.ok(Map.of("success", true, "batchJob", job));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(429).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/batch/{batchId}")
    public ResponseEntity<?> getBatch(@PathVariable String batchId) {
        BatchJob job = endorsementService.getBatch(batchId);
        if (job == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(job);
    }

    @PostMapping("/batches/{id}/fast-forward")
    public ResponseEntity<?> fastForwardBatch(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("success", true, "message", "Batch processing expedited"));
    }

    // ─── Notifications (GET /api/notifications) ────────────────────────────

    @GetMapping("/notifications")
    public ResponseEntity<List<AppNotification>> getNotifications(
            @RequestParam(required = false, defaultValue = "EMP-001") String employerId) {
        List<AppNotification> result = notificationRepo.findByEmployerId(employerId).stream()
                .sorted(Comparator.comparing(AppNotification::getId).reversed())
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/notifications/read")
    public ResponseEntity<?> markNotificationsRead(
            @RequestParam(required = false, defaultValue = "EMP-001") String employerId) {
        List<AppNotification> notifs = notificationRepo.findByEmployerId(employerId);
        notifs.forEach(n -> {
            n.setRead(true);
            notificationRepo.save(n);
        });
        return ResponseEntity.ok(Map.of("success", true));
    }
}
