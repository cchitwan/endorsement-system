# Tasks Checklist - Endorsement Management System

- `[x]` **Phase 1: Backend Setup & Business Logic (Migrated to Spring Boot)**
  - `[x]` Initialize project Maven structure and write `pom.xml` & `application.properties`.
  - `[x]` Create domain POJOs & Enums under `com.aegisshield.endorsement.model`.
  - `[x]` Implement thread-safe `InMemoryDB` in Java.
  - `[x]` Implement Queue contracts: `MessageQueue`, `MessageHandler`, and `InMemoryQueue` using `ScheduledExecutorService`.
  - `[x]` Implement core logic services:
    - `[x]` `PremiumCalculatorService` (age band rates, proration).
    - `[x]` `AnomalyService` (checks backdating, age, dependent limits, timeout simulator).
    - `[x]` `LedgerService` (mutations, locking simulation, idempotency registries).
    - `[x]` `ReconciliationService` (orchestrates evaluation rules).
    - `[x]` `EndorsementService` (integrates submission, queue worker, and member state updates).
  - `[x]` Write `CorsConfig` to allow Vite server requests on port `5001`.
  - `[x]` Create REST API controller with all 18 endpoints matching existing frontend.
  - `[x]` Clean up old Node.js/TypeScript leftover files in the workspace.

- `[x]` **Phase 2: Frontend Setup & Shell**
  - `[x]` Verify Vite React project proxy settings maps `/api` to port `5001`.
  - `[x]` Build rich index.css dark-mode/glassmorphism design system.
  - `[x]` Build layout in `App.tsx` and API clients.

- `[x]` **Phase 3: Frontend Components & Dashboards**
  - `[x]` Header and Notification Drawer.
  - `[x]` Employer HR Portal (KPIs, Active Roster Grid, EA Ledger Table, AI Optimizer Charts).
  - `[x]` Endorsement Wizard (cost estimator, funds check, validation log).
  - `[x]` Bulk Upload Simulator (CSV parser, serialized queue lock, SLA fast-forward).
  - `[x]` Insurer Underwriter Dashboard (pending queue, compare drawer, retry terminal).
  - `[x]` Scale Architecture Blueprint visualizer.

- `[x]` **Phase 4: End-to-End Verification**
  - `[x]` Verify compilation with `mvn clean compile`.
  - `[x]` Start backend (`mvn spring-boot:run`) on port `5001`.
  - `[x]` Start frontend (`npm run dev`) on port `3000`.
  - `[x]` Verify health, policy summary, and transaction APIs work end-to-end.
  - `[x]` Update `walkthrough.md` with Java stack and execution guide.

- `[x]` **Phase 5: Production-Ready In-Memory SQL (H2 & JPA) & OpenAPI/Swagger Integration**
  - `[x]` Update `pom.xml` to include Spring Data JPA, H2 runtime, and SpringDoc Swagger dependencies.
  - `[x]` Update `application.properties` with H2 datasource and JPA/Hibernate configuration.
  - `[x]` Build Jackson-based JPA `AttributeConverter` classes to handle nested objects (`MemberDetails`, `Dependent[]`, `ErrorDetails`, `List<String>`).
  - `[x]` Annotate all domain model classes (`Member`, `EndorsementRequest`, `Transaction`, `BatchJob`, `AppNotification`) as JPA Entities with `@Entity`, `@Id`, etc.
  - `[x]` Create Spring Data `JpaRepository` interfaces.
  - `[x]` Implement `DbSeeder` to populate initial data into the H2 database at startup.
  - `[x]` Deprecate and remove/retire manual `InMemoryDB` store.
  - `[x]` Refactor all business services (`LedgerService`, `AnomalyService`, `ReconciliationService`, `EndorsementService`) to utilize the new JPA repositories.
  - `[x]` Rewrite `EndorsementController` to perfectly match the REST API expectations of the frontend (`GET /api/policy`, `GET /api/ledger`, `GET /api/ledger/optimize`, `POST /api/endorsements`, proper `success: true` wrapper responses, underwriter confirm endpoints, etc.) and handle fallback default `employerId = "EMP-001"`.
  - `[x]` Verify application compilation and startup.
  - `[x]` Run manual testing scenarios:
    - `[x]` Verify OpenAPI Swagger docs load at `http://localhost:5001/swagger-ui/index.html`.
    - `[x]` Verify frontend loads the correct balance **$85,000.00** from H2 via `/api/policy`.
    - `[x]` Verify successful employee additions without any balance alerts.
