# Implementation Plan - Production-Ready In-Memory SQL Backend (H2 + JPA) & Swagger Integration

We will refactor the Java Spring Boot backend to use an in-memory SQL database (**H2**) along with **Spring Data JPA**. This turns the application into a production-grade codebase: migrating to a persistent SQL database like **PostgreSQL** in production will require only a basic configuration change in `application.properties` (with zero changes to the Java source code).

We will also integrate **Swagger/OpenAPI** for live API documentation and correct the route/schema mismatches to resolve the frontend zero-balance bug.

---

## User Review Required

> [!IMPORTANT]
> **Key Architecture Decisions for Production Readiness:**
> - **In-Memory SQL Database (H2)**: Replace `InMemoryDB` custom collections with an in-memory SQL database. H2 will start automatically when the app starts, using an in-memory schema.
> - **Spring Data JPA**: All database interactions (saves, queries) will go through standard declarative Repository interfaces (`MemberRepository`, `EndorsementRequestRepository`, etc.). Swapping to PostgreSQL later only requires swapping the JDBC driver and connection URL in `application.properties`.
> - **JSON Attribute Converters (No Relational Mismatch)**: To avoid splitting the frontend's nested JSON models (like `MemberDetails` or `Dependent[]` inside `EndorsementRequest`) into many complex tables with tricky joins, we will use a JPA `AttributeConverter` to store these nested objects as serialized JSON strings. This is a highly robust, standard JPA solution that works seamlessly across H2, PostgreSQL, MySQL, and Oracle!
> - **OpenAPI/Swagger Integration**: Enabled via SpringDoc, allowing live interactive API testing at `http://localhost:5001/swagger-ui/index.html`.
> - **Resolving the "$0" Balance Bug**: We will realign the API routes to match what the frontend expects (`GET /api/policy`, `GET /api/ledger`, etc.). This will instantly load the pre-seeded `$85,000` balance, resolving the "Insufficient Account Funds Alert" when adding an employee.

---

## Proposed Changes

### 1. Dependency Updates

#### [MODIFY] [pom.xml](file:///Users/chanchalchitwan/gcp/Agentic/endorsement-management-system/backend/pom.xml)
- Add standard Spring Boot starter dependencies for JPA and H2 database:
  ```xml
  <!-- Spring Data JPA -->
  <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
  </dependency>
  <!-- H2 Database (In-Memory SQL) -->
  <dependency>
      <groupId>com.h2database</groupId>
      <artifactId>h2</artifactId>
      <scope>runtime</scope>
  </dependency>
  <!-- SpringDoc OpenAPI (Swagger) -->
  <dependency>
      <groupId>org.springdoc</groupId>
      <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
      <version>2.5.0</version>
  </dependency>
  ```

### 2. Configuration Settings

#### [MODIFY] [application.properties](file:///Users/chanchalchitwan/gcp/Agentic/endorsement-management-system/backend/src/main/resources/application.properties)
- Configure H2 datasource, JPA ddl-auto settings, and server port `5001`:
  ```properties
  server.port=5001
  
  # H2 Datasource Configuration
  spring.datasource.url=jdbc:h2:mem:endorsementdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
  spring.datasource.driverClassName=org.h2.Driver
  spring.datasource.username=sa
  spring.datasource.password=
  spring.h2.console.enabled=true
  spring.h2.console.path=/h2-console
  
  # JPA/Hibernate
  spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
  spring.jpa.hibernate.ddl-auto=update
  spring.jpa.show-sql=true
  ```

### 3. Model Annotations & JPA Entities

We will convert our POJOs to JPA Entities:

#### [MODIFY] [Member.java](file:///Users/chanchalchitwan/gcp/Agentic/endorsement-management-system/backend/src/main/java/com/aegisshield/endorsement/model/Member.java)
- Annotate with `@Entity`, `@Id`, and use `@Convert(converter = DependentListConverter.class)` to serialize dependents to a JSON string.

#### [MODIFY] [EndorsementRequest.java](file:///Users/chanchalchitwan/gcp/Agentic/endorsement-management-system/backend/src/main/java/com/aegisshield/endorsement/model/EndorsementRequest.java)
- Annotate with `@Entity`, `@Id`.
- Use `@Convert(converter = MemberDetailsConverter.class)` for `memberDetails`.
- Use `@Convert(converter = StringListConverter.class)` for `anomalies`.
- Use `@Convert(converter = ErrorDetailsConverter.class)` for `errorDetails`.

#### [MODIFY] [Transaction.java](file:///Users/chanchalchitwan/gcp/Agentic/endorsement-management-system/backend/src/main/java/com/aegisshield/endorsement/model/Transaction.java)
- Annotate with `@Entity`, `@Id`.

#### [MODIFY] [AppNotification.java](file:///Users/chanchalchitwan/gcp/Agentic/endorsement-management-system/backend/src/main/java/com/aegisshield/endorsement/model/AppNotification.java)
- Annotate with `@Entity`, `@Id`.

#### [MODIFY] [BatchJob.java](file:///Users/chanchalchitwan/gcp/Agentic/endorsement-management-system/backend/src/main/java/com/aegisshield/endorsement/model/BatchJob.java)
- Annotate with `@Entity`, `@Id`.
- Use `@Convert(converter = StringListConverter.class)` for `errorLog` and `endorsementIds`.

#### [NEW] [JPA Converters]
- Implement generic or specific JPA `AttributeConverter` classes to handle JSON mapping of list fields or complex child objects using standard `Jackson ObjectMapper`.

### 4. Database Seeding & JPA Repositories

#### [NEW] [Repositories]
- Create Spring Data repositories extending `JpaRepository` for all primary entities:
  - `MemberRepository`
  - `EndorsementRequestRepository`
  - `TransactionRepository`
  - `AppNotificationRepository`
  - `BatchJobRepository`

#### [NEW] [DbSeeder.java](file:///Users/chanchalchitwan/gcp/Agentic/endorsement-management-system/backend/src/main/java/com/aegisshield/endorsement/data/DbSeeder.java)
- Implement a `CommandLineRunner` that seeds initial data into H2 (like the TechCorp `"EMP-001"` active members, start balance, initial notifications, and ledger transaction logs) upon startup.
- We will deprecate `InMemoryDB` entirely.

### 5. Service & Controller Rewrites

#### [MODIFY] Core Services
- Inject standard JPA Repositories (e.g. `MemberRepository`) into `AnomalyService`, `LedgerService`, `ReconciliationService`, and `EndorsementService`.
- Replace manual maps lookup (`db.membersByEmployer.get()`) with standard spring data queries (e.g., `memberRepository.findByEmployerId()`).
- Implement balance tracking based on cumulative ledger transactions, or store/update the active balance on a per-employer basis in a separate entity/table.

#### [MODIFY] [EndorsementController.java](file:///Users/chanchalchitwan/gcp/Agentic/endorsement-management-system/backend/src/main/java/com/aegisshield/endorsement/controller/EndorsementController.java)
- Align all routes with the REST API requirements of the React frontend:
  - `GET /api/policy`: Returns `PolicySummary` (defaults to employer `"EMP-001"` if query param is null).
  - `GET /api/ledger`: Returns `{ "ledger": List<Transaction> }`.
  - `GET /api/ledger/optimize`: Returns optimization forecasts (`ForecastDetails`).
  - `POST /api/endorsements`: Automatically processes the payload, registers idempotency, and returns a JSON payload containing `{ "success": true, "data": ... }`.
  - `POST /api/endorsements/{id}/confirm`: Manually approves an underwriting hold.
  - `POST /api/endorsements/batch`: Processes bulk uploaded records.
  - `POST /api/batches/{id}/fast-forward`: Speeds up batch processing.

---

## Verification Plan

### Compilation & Boot
- Build the backend using `mvn clean compile` to ensure zero compilation errors.
- Run the backend: `mvn spring-boot:run` and verify that H2 starts, tables are auto-created, and seed data is populated.

### Manual Scenarios
- **Scenario 1 (Swagger UI)**: Open `http://localhost:5001/swagger-ui/index.html` and verify live documentation loads.
- **Scenario 2 (Roster Loading)**: Open frontend. Verify the employee roster loads properly, and the balance displays **$85,000.00**.
- **Scenario 3 (Successful Addition)**: Use the "Add Member" wizard to add a new employee. Confirm that the "Insufficient Account Funds Alert" is **NOT** triggered, the database transaction is successfully written to H2, and the user is added to the roster.
- **Scenario 4 (Underwriting & Confirm)**: Submit an addition that exceeds funds or contains an anomaly. Verify it goes to the "Insurer Dashboard" queue. Top up, click "Confirm", and verify it gets approved.
