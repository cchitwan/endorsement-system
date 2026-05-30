package com.aegisshield.endorsement.data;

import com.aegisshield.endorsement.model.*;
import com.aegisshield.endorsement.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Component
public class DbSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DbSeeder.class);

    private final MemberRepository memberRepo;
    private final EndorsementRequestRepository endorsementRepo;
    private final TransactionRepository transactionRepo;
    private final AppNotificationRepository notificationRepo;

    public DbSeeder(MemberRepository memberRepo,
                    EndorsementRequestRepository endorsementRepo,
                    TransactionRepository transactionRepo,
                    AppNotificationRepository notificationRepo) {
        this.memberRepo = memberRepo;
        this.endorsementRepo = endorsementRepo;
        this.transactionRepo = transactionRepo;
        this.notificationRepo = notificationRepo;
    }

    @Override
    public void run(String... args) throws Exception {
        if (memberRepo.count() > 0) {
            log.info("[Seeder] Database already contains data. Skipping seeding.");
            return;
        }

        log.info("[Seeder] Seeding database...");
        String eid = "EMP-001";

        // 1. Seed Members
        memberRepo.save(Member.builder()
                .id("MBR-101")
                .employerId(eid)
                .name("Ananya Krishnan")
                .email("ananya.k@techcorp.in")
                .dob("1988-04-12")
                .dateOfJoining("2020-01-15")
                .eligibilityDate("2020-01-15")
                .coverageTier(CoverageTier.EMPLOYEE_FAMILY)
                .status(MemberStatus.ACTIVE)
                .monthlyPremium(18500.0)
                .dependents(List.of(
                        dep("Rohit Krishnan", "SPOUSE", "1990-06-20"),
                        dep("Priya Krishnan", "CHILD", "2015-03-10")
                ))
                .build());

        memberRepo.save(Member.builder()
                .id("MBR-102")
                .employerId(eid)
                .name("Vikram Sharma")
                .email("vikram.s@techcorp.in")
                .dob("1992-11-08")
                .dateOfJoining("2021-03-01")
                .eligibilityDate("2021-03-01")
                .coverageTier(CoverageTier.EMPLOYEE_ONLY)
                .status(MemberStatus.ACTIVE)
                .monthlyPremium(8200.0)
                .dependents(new ArrayList<>())
                .build());

        memberRepo.save(Member.builder()
                .id("MBR-103")
                .employerId(eid)
                .name("Preethi Nair")
                .email("preethi.n@techcorp.in")
                .dob("1985-07-22")
                .dateOfJoining("2019-06-10")
                .eligibilityDate("2019-06-10")
                .coverageTier(CoverageTier.EMPLOYEE_SPOUSE)
                .status(MemberStatus.ACTIVE)
                .monthlyPremium(12400.0)
                .dependents(List.of(
                        dep("Arun Nair", "SPOUSE", "1984-02-14")
                ))
                .build());

        // 2. Seed Transactions
        String prevMonthDate = LocalDate.now().minusDays(15).format(DateTimeFormatter.ISO_DATE) + "T10:30:00Z";
        String earlierMonthDate = LocalDate.now().minusDays(30).format(DateTimeFormatter.ISO_DATE) + "T09:15:00Z";

        transactionRepo.save(Transaction.builder()
                .id("TXN-101")
                .employerId(eid)
                .date(earlierMonthDate)
                .type("DEPOSIT")
                .amount(100000.0)
                .description("Initial Endorsement Account Deposit")
                .balanceAfter(100000.0)
                .build());

        transactionRepo.save(Transaction.builder()
                .id("TXN-102")
                .employerId(eid)
                .date(prevMonthDate)
                .type("ENDORSEMENT_DEBIT")
                .amount(15000.0)
                .description("Add Member: Vikram Sharma (EMPLOYEE_ONLY)")
                .endorsementId("END-0001")
                .balanceAfter(85000.0)
                .build());

        // 3. Seed Endorsements
        endorsementRepo.save(EndorsementRequest.builder()
                .id("END-0002")
                .employerId(eid)
                .type(EndorsementType.ADD)
                .status(EndorsementStatus.EFFECTIVE)
                .submissionType("MANUAL")
                .proratedPremiumImpact(8200.0)
                .monthlyPremiumImpact(8200.0)
                .anomalies(new ArrayList<>())
                .processedAt(prevMonthDate)
                .confirmedBy("SYSTEM_AUTO_RECONCILER")
                .memberDetails(MemberDetails.builder()
                        .name("Vikram Sharma")
                        .email("vikram.s@techcorp.in")
                        .dob("1992-11-08")
                        .dateOfJoining("2021-03-01")
                        .eligibilityDate("2021-03-01")
                        .coverageTier(CoverageTier.EMPLOYEE_ONLY)
                        .targetEffectiveDate("2021-03-01")
                        .dependents(new ArrayList<>())
                        .build())
                .build());

        endorsementRepo.save(EndorsementRequest.builder()
                .id("END-0003")
                .employerId(eid)
                .type(EndorsementType.ADD)
                .status(EndorsementStatus.PENDING_CONFIRMATION)
                .submissionType("MANUAL")
                .proratedPremiumImpact(16200.0)
                .monthlyPremiumImpact(16200.0)
                .anomalies(List.of("BACKDATING: Effective date is 65 days in the past (limit: 60 days). Insurer approval required."))
                .memberDetails(MemberDetails.builder()
                        .name("Diana Prince")
                        .email("diana.p@techcorp.in")
                        .dob("1980-01-01")
                        .dateOfJoining("2024-01-01")
                        .eligibilityDate("2024-01-01")
                        .coverageTier(CoverageTier.EMPLOYEE_FAMILY)
                        .targetEffectiveDate("2024-01-01")
                        .dependents(new ArrayList<>())
                        .build())
                .comments("Extreme backdating: Backdated beyond standard 60-day window.")
                .build());

        // 4. Seed Notifications
        notificationRepo.save(AppNotification.builder()
                .id("NTF-101")
                .employerId(eid)
                .title("Account Active")
                .message("Your group endorsement policy has been successfully initialized.")
                .type("info")
                .timestamp(LocalDate.now().format(DateTimeFormatter.ISO_DATE) + "T09:00:00Z")
                .read(false)
                .build());

        log.info("[Seeder] Database seeding finished successfully.");
    }

    private Dependent dep(String name, String rel, String dob) {
        return Dependent.builder().name(name).relationship(rel).dob(dob).build();
    }
}
