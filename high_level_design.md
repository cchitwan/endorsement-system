# High-Level Design (HLD): Endorsement Management System

This document outlines the architecture, data flows, components, and key algorithmic strategies for the Endorsement Management System, updated to detail the robust separation of the React frontend from the **Java 17 & Spring Boot 3** backend, using **Spring Data JPA & H2 SQL** relational persistence.

---

## 1. Module Architecture (Frontend & Backend Separation)

To ensure clean separation of concerns and maximum enterprise scalability, the project is divided into two distinct directories:
- **`frontend/`**: Vite + React (TypeScript) + Vanilla CSS single-page application styled with responsive Glassmorphism and CSS dark mode.
- **`backend/`**: Java 17 + Spring Boot 3 + Spring Data JPA + H2 In-Memory SQL database managing rules, ledger history, queue pipelines, and OpenAPI configurations.

---

## 2. Backend Architecture & Service Layers

The backend utilizes Spring Boot's standard layered architecture (Controller-Service-Repository) to implement thread-safe transaction logic, isolated business services, and decoupled event handling.

```
backend/
├── pom.xml                                     # Maven build coordinates and Spring dependencies
├── src/main/resources/
│   └── application.properties                  # Spring Boot properties (ports, H2, JPA settings)
└── src/main/java/com/aegisshield/endorsement/
    ├── EndorsementApplication.java             # Main application entry point
    ├── config/
    │   └── CorsConfig.java                     # Cross-Origin resource sharing mapping (allows port 3000)
    ├── controller/
    │   └── EndorsementController.java          # Handles 18 endpoints & fallback defaults
    ├── model/                                  # JPA Entities
    │   ├── Member.java                         # Roster profiles (ACTIVE, TERMINATED)
    │   ├── EndorsementRequest.java             # Individual real-time and batch transactions
    │   ├── Transaction.java                    # Ledger balance credits & debits
    │   ├── BatchJob.java                       # Bulk upload progress tracker
    │   ├── AppNotification.java                # Notifications and audit alerts
    │   └── converter/                          # Jackson-based converters for nested structures
    ├── repository/                             # Spring Data JPA Repositories
    │   ├── MemberRepository.java
    │   ├── EndorsementRequestRepository.java
    │   ├── TransactionRepository.java
    │   ├── BatchJobRepository.java
    │   └── AppNotificationRepository.java
    ├── queue/                                  # Pluggable Broker Queue Contracts
    │   ├── MessageQueue.java                   # Queue interface (Kafka compatibility contract)
    │   └── InMemoryQueue.java                  # Java ScheduledExecutorService broker simulation
    └── service/                                # Core Domain Business Logic
        ├── PremiumCalculatorService.java       # Calendar-day retroactive proration engine
        ├── AnomalyService.java                 # Business rules & backdating scanner
        ├── LedgerService.java                  # Endorsement Account ledger balance and locks
        ├── ReconciliationService.java          # Straight-through auto-approval router
        └── EndorsementService.java             # Core submission, batch executor, & worker
```

### Pluggable Message Queuing Interface (Kafka-Ready)

To mirror enterprise Kafka behaviors, the messaging system is decoupled using a pluggable Java interface. Swapping to a live Apache Kafka broker simply requires implementing `MessageQueue` and binding it via Spring's `@Primary` or profile configurations.

#### `queue/MessageQueue.java`
```java
package com.aegisshield.endorsement.queue;

public interface MessageQueue {
    void publish(String topic, Object message);
    void subscribe(String topic, MessageHandler handler);
}
```

#### `queue/InMemoryQueue.java`
This class implements the interface using a Java `ScheduledExecutorService` thread pool, simulating asynchronous event delivery with network latency:
```java
package com.aegisshield.endorsement.queue;

import org.springframework.stereotype.Component;
import java.util.*;
import java.util.concurrent.*;

@Component
public class InMemoryQueue implements MessageQueue {
    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(4);
    private final Map<String, List<MessageHandler>> listeners = new ConcurrentHashMap<>();

    @Override
    public void publish(String topic, Object message) {
        List<MessageHandler> handlers = listeners.getOrDefault(topic, Collections.emptyList());
        for (MessageHandler handler : handlers) {
            // Simulate 50ms of network broker delay
            executor.schedule(() -> {
                try {
                    handler.handle(message);
                } catch (Exception e) {
                    System.err.println("Error processing queue message: " + e.getMessage());
                }
            }, 50, TimeUnit.MILLISECONDS);
        }
    }

    @Override
    public void subscribe(String topic, MessageHandler handler) {
        listeners.computeIfAbsent(topic, k -> new CopyOnWriteArrayList<>()).add(handler);
    }
}
```

---

## 3. Persistent Relational Storage & Database Migration

### A. Developer Sandbox SQL Schema (H2)
The backend uses **Spring Data JPA (Hibernate)** mapped to an in-memory **H2 SQL database** (`jdbc:h2:mem:endorsementdb`). 

To represent complex JSON structures (like list of dependents on a member or detailed error logs on a transaction) in a relational database format without over-complicating joins, the system utilizes customized Jackson-based JPA attributes:
* **`MemberDetailsConverter`**: Serializes nested member properties to a single `CLOB` JSON field.
* **`DependentListConverter`**: Serializes lists of dependents to a `CLOB` JSON field.
* **`ErrorDetailsConverter`**: Serializes background API log trace objects to a `CLOB` JSON field.

### B. Zero-Code Production Database Migration (PostgreSQL / MySQL)
Because the platform utilizes Spring Data JPA abstraction, migrating from the development H2 SQL database to a persistent production database (like PostgreSQL, Amazon RDS, or MySQL) requires **no code changes**. You only need to update the database coordinates inside `backend/src/main/resources/application.properties`:

```properties
# Example Migration to PostgreSQL Production
spring.datasource.url=jdbc:postgresql://production-db-rds.amazonaws.com:5432/endorsementdb
spring.datasource.driverClassName=org.postgresql.Driver
spring.datasource.username=production_user
spring.datasource.password=secure_rds_password
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
```

---

## 4. Concurrency Control & Idempotency

### A. Mutex Batch Locking
To prevent concurrent data writes or race conditions when processing massive batch uploads, `LedgerService.java` manages an active in-memory, thread-safe lock list (`ConcurrentHashMap`) keying on the `EmployerID`.
- Submitting a batch CSV immediately locks the policy queue.
- Concurrent uploads from different browser sessions for the same employer are rejected with a `429 Too Many Requests` or `IllegalStateException` until the current active batch releases its lock.

### B. Idempotency Key Guard
To protect against double billing if network dropouts occur and client clients trigger auto-retries:
- Endorsement wizards generate a unique client-side UUID sent in the `idempotency-key` header.
- The backend checks an in-memory key registry. 
- If a duplicate key is processed, the backend bypasses the queue and returns the cached execution result instantly, preventing duplicate ledger debits.

---

## 5. API Design & Interactive OpenAPI Swagger UI

The Spring Boot backend fully implements the REST API schema expected by the frontend. Additionally, it integrates **SpringDoc OpenAPI**, serving live API specifications:

* **Interactive Swagger Developer Console**: [http://localhost:5001/swagger-ui/index.html](http://localhost:5001/swagger-ui/index.html) (allows testing live endpoints directly).
* **Raw OpenAPI Specification (JSON)**: [http://localhost:5001/v3/api-docs](http://localhost:5001/v3/api-docs)

### Core REST Endpoints

| Endpoint | Method | Payload / Response | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/policy` | `GET` | `PolicySummary` | Fetch EA Balance, active counts, and policy boundaries. |
| `/api/members` | `GET` | `List<Member>` | Retrieve the active roster. |
| `/api/ledger` | `GET` | `{ ledger: List<Transaction> }` | View financial ledger history. |
| `/api/ledger/topup` | `POST` | `{ amount }` | Deposit funds to the Endorsement Account (EA). |
| `/api/endorsements` | `GET` | `List<EndorsementRequest>` | Fetch the underwriter history and queue list. |
| `/api/endorsements` | `POST` | `EndorsementRequest` | Submit a single real-time addition/termination. |
| `/api/endorsements/batch` | `POST` | `{ success: true, batchJob }` | Upload multiple employees (Batch API). |
| `/api/endorsements/:id/confirm` | `POST` | `{ success: true }` | Underwriter manual approval. |
| `/api/endorsements/:id/reject` | `POST` | `{ success: true }` | Underwriter rejection. |
| `/api/endorsements/:id/retry` | `POST` | `{ success: true }` | Manually retry a connection-dropped request. |
