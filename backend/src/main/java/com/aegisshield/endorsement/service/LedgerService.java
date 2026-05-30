package com.aegisshield.endorsement.service;

import com.aegisshield.endorsement.model.*;
import com.aegisshield.endorsement.repository.EndorsementRequestRepository;
import com.aegisshield.endorsement.repository.MemberRepository;
import com.aegisshield.endorsement.repository.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class LedgerService {

    private static final Logger log = LoggerFactory.getLogger(LedgerService.class);

    // Minimum EA balance cushion per active member (INR)
    private static final double MIN_BALANCE_PER_MEMBER = 5000.0;

    private final TransactionRepository transactionRepo;
    private final MemberRepository memberRepo;
    private final EndorsementRequestRepository endorsementRepo;

    // Thread-safe in-memory generators for sequence values
    private final AtomicInteger transactionSeq = new AtomicInteger(104);
    private final ConcurrentHashMap<String, Boolean> batchLocks = new ConcurrentHashMap<>();

    public LedgerService(TransactionRepository transactionRepo,
                         MemberRepository memberRepo,
                         EndorsementRequestRepository endorsementRepo) {
        this.transactionRepo = transactionRepo;
        this.memberRepo = memberRepo;
        this.endorsementRepo = endorsementRepo;
    }

    public String nextTransactionId() {
        return "TXN-" + transactionSeq.getAndIncrement();
    }

    // ─── Idempotency ──────────────────────────────────────────────────────

    public String checkIdempotency(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return null;
        }
        return endorsementRepo.findByIdempotencyKey(idempotencyKey)
                .map(EndorsementRequest::getId)
                .orElse(null);
    }

    // ─── Batch Locking ────────────────────────────────────────────────────

    public synchronized boolean acquireBatchLock(String employerId) {
        Boolean locked = batchLocks.getOrDefault(employerId, false);
        if (locked) {
            log.warn("[Lock] Batch lock BUSY for employer {}", employerId);
            return false;
        }
        batchLocks.put(employerId, true);
        log.info("[Lock] Batch lock ACQUIRED for employer {}", employerId);
        return true;
    }

    public synchronized void releaseBatchLock(String employerId) {
        batchLocks.put(employerId, false);
        log.info("[Lock] Batch lock RELEASED for employer {}", employerId);
    }

    public boolean isBatchLocked(String employerId) {
        return batchLocks.getOrDefault(employerId, false);
    }

    // ─── Balance checks ───────────────────────────────────────────────────

    public double getBalance(String employerId) {
        List<Transaction> txns = transactionRepo.findByEmployerId(employerId);
        if (txns.isEmpty()) {
            return 85000.0; // fallback if no transactions exist
        }
        // Return balanceAfter from latest transaction (sorted by id descending or timestamp)
        return txns.stream()
                .max(Comparator.comparing(Transaction::getId))
                .map(Transaction::getBalanceAfter)
                .orElse(85000.0);
    }

    public double getMinimumRequired(String employerId) {
        List<Member> members = memberRepo.findByEmployerId(employerId);
        long activeCount = members.stream()
                .filter(m -> m.getStatus() == MemberStatus.ACTIVE).count();
        return activeCount * MIN_BALANCE_PER_MEMBER;
    }

    public boolean hasSufficientFunds(String employerId, double requiredAmount) {
        double balance = getBalance(employerId);
        double minRequired = getMinimumRequired(employerId);
        return (balance - requiredAmount) >= minRequired;
    }

    // ─── Ledger mutations ─────────────────────────────────────────────────

    public Transaction debit(String employerId, double amount, String description, String endorsementId) {
        synchronized (getLock(employerId)) {
            double before = getBalance(employerId);
            double after = before - amount;
            return recordTransaction(employerId, "ENDORSEMENT_DEBIT", amount, before, after, description, endorsementId);
        }
    }

    public Transaction credit(String employerId, double amount, String description, String endorsementId) {
        synchronized (getLock(employerId)) {
            double before = getBalance(employerId);
            double after = before + amount;
            return recordTransaction(employerId, "DEPOSIT", amount, before, after, description, endorsementId);
        }
    }

    public Transaction topUp(String employerId, double amount) {
        return credit(employerId, amount, "Manual EA top-up", null);
    }

    // ─── Transaction history ──────────────────────────────────────────────

    public List<Transaction> getTransactions(String employerId) {
        return transactionRepo.findByEmployerId(employerId);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    private Transaction recordTransaction(String employerId, String type,
                                           double amount, double before, double after,
                                           String desc, String relId) {
        Transaction t = Transaction.builder()
                .id(nextTransactionId())
                .employerId(employerId)
                .type(type)
                .amount(amount)
                .description(desc)
                .endorsementId(relId)
                .balanceAfter(Math.round(after * 100.0) / 100.0)
                .date(Instant.now().toString())
                .build();

        Transaction saved = transactionRepo.save(t);
        log.info("[Ledger] {} ₹{} for employer {} | Balance: {} → {}",
                type, amount, employerId, before, after);
        return saved;
    }

    private final ConcurrentHashMap<String, Object> lockObjects = new ConcurrentHashMap<>();

    private Object getLock(String employerId) {
        return lockObjects.computeIfAbsent(employerId, k -> new Object());
    }
}
