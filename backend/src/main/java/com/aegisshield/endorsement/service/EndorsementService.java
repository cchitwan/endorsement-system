package com.aegisshield.endorsement.service;

import com.aegisshield.endorsement.model.*;
import com.aegisshield.endorsement.queue.InMemoryQueue;
import com.aegisshield.endorsement.repository.AppNotificationRepository;
import com.aegisshield.endorsement.repository.BatchJobRepository;
import com.aegisshield.endorsement.repository.EndorsementRequestRepository;
import com.aegisshield.endorsement.repository.MemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
public class EndorsementService {

    private static final Logger log = LoggerFactory.getLogger(EndorsementService.class);
    private static final String TOPIC_ENDORSEMENT = "endorsement.process";

    private final EndorsementRequestRepository endorsementRepo;
    private final MemberRepository memberRepo;
    private final BatchJobRepository batchJobRepo;
    private final AppNotificationRepository notificationRepo;

    private final PremiumCalculatorService calc;
    private final AnomalyService anomaly;
    private final LedgerService ledger;
    private final ReconciliationService reconciliation;
    private final InMemoryQueue queue;

    // Sequential ID Counters initialized to match seed values
    private final AtomicInteger memberSeq = new AtomicInteger(106);
    private final AtomicInteger endorsementSeq = new AtomicInteger(10);
    private final AtomicInteger notificationSeq = new AtomicInteger(10);
    private final AtomicInteger batchSeq = new AtomicInteger(1);

    public String nextMemberId()      { return "MBR-" + memberSeq.getAndIncrement(); }
    public String nextEndorsementId() { return "END-" + String.format("%04d", endorsementSeq.getAndIncrement()); }
    public String nextNotificationId(){ return "NTF-" + notificationSeq.getAndIncrement(); }
    public String nextBatchId()       { return "BAT-" + String.format("%03d", batchSeq.getAndIncrement()); }

    public EndorsementService(EndorsementRequestRepository endorsementRepo,
                              MemberRepository memberRepo,
                              BatchJobRepository batchJobRepo,
                              AppNotificationRepository notificationRepo,
                              PremiumCalculatorService calc,
                              AnomalyService anomaly,
                              LedgerService ledger,
                              ReconciliationService reconciliation,
                              InMemoryQueue queue) {
        this.endorsementRepo = endorsementRepo;
        this.memberRepo = memberRepo;
        this.batchJobRepo = batchJobRepo;
        this.notificationRepo = notificationRepo;
        this.calc = calc;
        this.anomaly = anomaly;
        this.ledger = ledger;
        this.reconciliation = reconciliation;
        this.queue = queue;

        // Wire up queue consumer on startup
        this.queue.subscribe(TOPIC_ENDORSEMENT, this::processFromQueue);
    }

    // ─── Submission ────────────────────────────────────────────────────────

    public EndorsementRequest submit(EndorsementRequest req) {
        // 1. Idempotency guard
        if (req.getIdempotencyKey() != null) {
            String existing = ledger.checkIdempotency(req.getIdempotencyKey());
            if (existing != null) {
                log.info("[Endorsement] Duplicate idempotency key {} → returning existing {}", req.getIdempotencyKey(), existing);
                return endorsementRepo.findById(existing).orElse(null);
            }
        }

        // 2. Assign ID and defaults
        String id = nextEndorsementId();
        req.setId(id);
        req.setProcessedAt(null);
        req.setStatus(EndorsementStatus.PENDING);

        MemberDetails details = req.getMemberDetails();
        if (details == null) {
            details = MemberDetails.builder().dependents(new ArrayList<>()).build();
            req.setMemberDetails(details);
        }

        // 3. Effective date default to today
        if (details.getTargetEffectiveDate() == null || details.getTargetEffectiveDate().isBlank()) {
            details.setTargetEffectiveDate(LocalDate.now().format(DateTimeFormatter.ISO_DATE));
        }

        // 4. Premium estimation
        int age = details.getDob() != null ? calculateAge(details.getDob()) : 30;
        CoverageTier tier = details.getCoverageTier() != null ? details.getCoverageTier() : CoverageTier.EMPLOYEE_ONLY;
        LocalDate effectiveDate = LocalDate.parse(details.getTargetEffectiveDate(), DateTimeFormatter.ISO_DATE);
        
        double proratedImpact = req.getType() == EndorsementType.TERMINATE
                ? 0.0
                : calc.calculateProratedPremium(age, tier, effectiveDate);
        req.setProratedPremiumImpact(proratedImpact);

        double monthlyImpact = req.getType() == EndorsementType.TERMINATE
                ? 0.0
                : calc.calculateMonthlyPremium(age, tier);
        req.setMonthlyPremiumImpact(monthlyImpact);

        // 5. Anomaly scan
        AnomalyService.AnomalyResult anomalyResult = anomaly.analyze(req);
        req.setAnomalyRisk(anomalyResult.riskLevel());
        req.setAnomalies(anomalyResult.flags());

        // 6. Persist and register
        EndorsementRequest saved = endorsementRepo.save(req);

        // 7. Publish to processing queue
        saved.setStatus(EndorsementStatus.PROCESSING);
        endorsementRepo.save(saved);
        queue.publish(TOPIC_ENDORSEMENT, id);

        log.info("[Endorsement] Submitted {} | type={} | employer={} | risk={}",
                id, saved.getType(), saved.getEmployerId(), saved.getAnomalyRisk());
        return saved;
    }

    // ─── Queue Consumer ────────────────────────────────────────────────────

    private void processFromQueue(String endorsementId) {
        EndorsementRequest req = endorsementRepo.findById(endorsementId).orElse(null);
        if (req == null) {
            log.error("[Queue] Endorsement {} not found", endorsementId);
            return;
        }

        // Simulate processing delay
        try { Thread.sleep(400); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        ReconciliationService.ReconciliationResult result = reconciliation.evaluate(req);

        if (result.approved()) {
            req.setStatus(EndorsementStatus.EFFECTIVE); // Match status "EFFECTIVE" expected by front-end
            req.setProcessedAt(Instant.now().toString());
            req.setConfirmedBy("SYSTEM_AUTO_RECONCILER");
            applyMemberChange(req);
        } else if ("INSUFFICIENT_FUNDS".equals(result.code()) || "HIGH_ANOMALY_RISK".equals(result.code())) {
            req.setStatus(EndorsementStatus.PENDING_CONFIRMATION); // Match status "PENDING_CONFIRMATION"
            req.setComments(result.message());
            addInsurerNotification(req, result.message());
        } else {
            req.setStatus(EndorsementStatus.FAILED);
            req.setComments(result.message());
            addFailureNotification(req, result.message());
        }

        endorsementRepo.save(req);
        log.info("[Queue] Processed {} → {}", endorsementId, req.getStatus());
    }

    // ─── Underwriter Actions ──────────────────────────────────────────────

    public EndorsementRequest underwriterApprove(String endorsementId) {
        EndorsementRequest req = getOrThrow(endorsementId);
        req.setStatus(EndorsementStatus.EFFECTIVE);
        req.setProcessedAt(Instant.now().toString());
        req.setConfirmedBy("INSURER_UNDERWRITER");

        // Force debit even if funds were low (underwriter override)
        MemberDetails details = req.getMemberDetails();
        String memberName = details != null ? details.getName() : "Unknown";
        if (req.getType() != EndorsementType.TERMINATE && req.getProratedPremiumImpact() > 0) {
            ledger.debit(req.getEmployerId(), req.getProratedPremiumImpact(),
                    "Underwriter approved: " + req.getType() + " for " + memberName,
                    req.getId());
        }
        applyMemberChange(req);
        addApprovalNotif(req, memberName);
        return endorsementRepo.save(req);
    }

    public EndorsementRequest underwriterReject(String endorsementId, String reason) {
        EndorsementRequest req = getOrThrow(endorsementId);
        req.setStatus(EndorsementStatus.REJECTED);
        req.setProcessedAt(Instant.now().toString());
        req.setConfirmedBy("INSURER_UNDERWRITER");
        req.setComments("Rejected by underwriter: " + reason);
        addRejectionNotif(req, reason);
        return endorsementRepo.save(req);
    }

    public EndorsementRequest retry(String endorsementId) {
        EndorsementRequest req = getOrThrow(endorsementId);
        req.setStatus(EndorsementStatus.PROCESSING);
        req.setComments(null);
        endorsementRepo.save(req);
        queue.publish(TOPIC_ENDORSEMENT, endorsementId);
        log.info("[Endorsement] Retry for {}", endorsementId);
        return req;
    }

    // ─── Batch Processing ─────────────────────────────────────────────────

    public BatchJob processBatch(String employerId, List<EndorsementRequest> requests) {
        if (!ledger.acquireBatchLock(employerId)) {
            throw new IllegalStateException("A batch is already processing for employer " + employerId + ". Please wait.");
        }

        String batchId = nextBatchId();
        BatchJob job = BatchJob.builder()
                .id(batchId)
                .employerId(employerId)
                .status(BatchStatus.PROCESSING)
                .submittedAt(Instant.now().toString())
                .totalRecords(requests.size())
                .processedRecords(0)
                .successCount(0)
                .failureCount(0)
                .totalPremiumImpact(0.0)
                .errorLog(new ArrayList<>())
                .endorsementIds(new ArrayList<>())
                .build();

        BatchJob savedJob = batchJobRepo.save(job);

        // Process in background thread (serialized per employer via batch lock)
        new Thread(() -> {
            try {
                for (EndorsementRequest req : requests) {
                    req.setEmployerId(employerId);
                    req.setBatchId(batchId);
                    try {
                        EndorsementRequest submitted = submit(req);
                        savedJob.getEndorsementIds().add(submitted.getId());
                        savedJob.setProcessedRecords(savedJob.getProcessedRecords() + 1);
                        
                        // Wait for queue processing to complete
                        Thread.sleep(600);
                        
                        EndorsementRequest processed = endorsementRepo.findById(submitted.getId()).orElse(null);
                        if (processed != null && processed.getStatus() == EndorsementStatus.EFFECTIVE) {
                            savedJob.setSuccessCount(savedJob.getSuccessCount() + 1);
                            savedJob.setTotalPremiumImpact(savedJob.getTotalPremiumImpact() + processed.getProratedPremiumImpact());
                        } else {
                            savedJob.setFailureCount(savedJob.getFailureCount() + 1);
                        }
                    } catch (Exception e) {
                        savedJob.setFailureCount(savedJob.getFailureCount() + 1);
                        savedJob.getErrorLog().add("Row " + savedJob.getProcessedRecords() + ": " + e.getMessage());
                    }
                    batchJobRepo.save(savedJob);
                }
                savedJob.setStatus(BatchStatus.COMPLETED);
                savedJob.setCompletedAt(Instant.now().toString());
                addBatchCompleteNotification(savedJob);
            } finally {
                ledger.releaseBatchLock(employerId);
            }
            batchJobRepo.save(savedJob);
        }, "batch-processor-" + batchId).start();

        return savedJob;
    }

    // ─── Query helpers ─────────────────────────────────────────────────────

    public List<EndorsementRequest> getEndorsements(String employerId) {
        if (employerId == null) {
            return endorsementRepo.findAll().stream()
                    .sorted(Comparator.comparing(EndorsementRequest::getId).reversed())
                    .collect(Collectors.toList());
        }
        return endorsementRepo.findByEmployerId(employerId).stream()
                .sorted(Comparator.comparing(EndorsementRequest::getId).reversed())
                .collect(Collectors.toList());
    }

    public List<EndorsementRequest> getPendingInsurerQueue() {
        return endorsementRepo.findByStatus(EndorsementStatus.PENDING_CONFIRMATION);
    }

    public BatchJob getBatch(String batchId) {
        return batchJobRepo.findById(batchId).orElse(null);
    }

    // ─── Member state update ──────────────────────────────────────────────

    private void applyMemberChange(EndorsementRequest req) {
        String employerId = req.getEmployerId();
        MemberDetails details = req.getMemberDetails();
        if (details == null) return;

        switch (req.getType()) {
            case ADD -> {
                int age = details.getDob() != null ? calculateAge(details.getDob()) : 30;
                CoverageTier tier = details.getCoverageTier() != null ? details.getCoverageTier() : CoverageTier.EMPLOYEE_ONLY;
                double monthly = calc.calculateMonthlyPremium(age, tier);
                Member newMember = Member.builder()
                        .id(nextMemberId())
                        .employerId(employerId)
                        .name(details.getName())
                        .email(details.getEmail())
                        .dob(details.getDob())
                        .dateOfJoining(details.getDateOfJoining())
                        .eligibilityDate(details.getEligibilityDate())
                        .coverageTier(tier)
                        .status(MemberStatus.ACTIVE)
                        .monthlyPremium(monthly)
                        .dependents(details.getDependents() != null ? details.getDependents() : new ArrayList<>())
                        .build();
                memberRepo.save(newMember);
                log.info("[Member] Added {} to employer {}", newMember.getId(), employerId);
            }
            case TERMINATE -> {
                if (req.getMemberId() != null) {
                    memberRepo.findById(req.getMemberId()).ifPresent(m -> {
                        m.setStatus(MemberStatus.TERMINATED);
                        memberRepo.save(m);
                        log.info("[Member] Terminated {} for employer {}", m.getId(), employerId);
                    });
                }
            }
            case UPDATE -> {
                if (req.getMemberId() != null) {
                    memberRepo.findById(req.getMemberId()).ifPresent(m -> {
                        if (details.getCoverageTier() != null) {
                            m.setCoverageTier(details.getCoverageTier());
                            int age = m.getDob() != null ? calculateAge(m.getDob()) : 30;
                            double monthly = calc.calculateMonthlyPremium(age, details.getCoverageTier());
                            m.setMonthlyPremium(monthly);
                        }
                        if (details.getDependents() != null) {
                            m.setDependents(details.getDependents());
                        }
                        memberRepo.save(m);
                        log.info("[Member] Updated {} for employer {}", m.getId(), employerId);
                    });
                }
            }
        }
    }

    // ─── Notifications ─────────────────────────────────────────────────────

    private void addInsurerNotification(EndorsementRequest req, String comment) {
        MemberDetails details = req.getMemberDetails();
        String memberName = details != null ? details.getName() : "Unknown";
        notificationRepo.save(AppNotification.builder()
                .id(nextNotificationId())
                .type("warning")
                .title("Routed to Underwriting")
                .message(req.getType() + " for " + memberName + " flagged for manual review: " + comment)
                .timestamp(Instant.now().toString())
                .read(false)
                .employerId(req.getEmployerId())
                .relatedId(req.getId())
                .build());
    }

    private void addFailureNotification(EndorsementRequest req, String notes) {
        MemberDetails details = req.getMemberDetails();
        String memberName = details != null ? details.getName() : "Unknown";
        notificationRepo.save(AppNotification.builder()
                .id(nextNotificationId())
                .type("error")
                .title("Endorsement Failed")
                .message(req.getType() + " for " + memberName + " failed: " + notes)
                .timestamp(Instant.now().toString())
                .read(false)
                .employerId(req.getEmployerId())
                .relatedId(req.getId())
                .build());
    }

    private void addApprovalNotif(EndorsementRequest req, String memberName) {
        notificationRepo.save(AppNotification.builder()
                .id(nextNotificationId())
                .type("success")
                .title("Underwriter Approved")
                .message(req.getType() + " for " + memberName + " approved by underwriter.")
                .timestamp(Instant.now().toString())
                .read(false)
                .employerId(req.getEmployerId())
                .relatedId(req.getId())
                .build());
    }

    private void addRejectionNotif(EndorsementRequest req, String reason) {
        MemberDetails details = req.getMemberDetails();
        String memberName = details != null ? details.getName() : "Unknown";
        notificationRepo.save(AppNotification.builder()
                .id(nextNotificationId())
                .type("error")
                .title("Underwriter Rejected")
                .message(req.getType() + " for " + memberName + " rejected: " + reason)
                .timestamp(Instant.now().toString())
                .read(false)
                .employerId(req.getEmployerId())
                .relatedId(req.getId())
                .build());
    }

    private void addBatchCompleteNotification(BatchJob job) {
        notificationRepo.save(AppNotification.builder()
                .id(nextNotificationId())
                .type("info")
                .title("Batch Complete")
                .message("Batch " + job.getId() + ": " + job.getSuccessCount() + " approved, "
                        + job.getFailureCount() + " failed.")
                .timestamp(Instant.now().toString())
                .read(false)
                .employerId(job.getEmployerId())
                .relatedId(job.getId())
                .build());
    }

    private EndorsementRequest getOrThrow(String id) {
        return endorsementRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Endorsement not found: " + id));
    }

    private int calculateAge(String dob) {
        try {
            LocalDate birth = LocalDate.parse(dob, DateTimeFormatter.ISO_DATE);
            return (int) java.time.temporal.ChronoUnit.YEARS.between(birth, LocalDate.now());
        } catch (Exception e) {
            return 30;
        }
    }
}
