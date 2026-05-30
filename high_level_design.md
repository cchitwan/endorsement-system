# High-Level Design (HLD): Endorsement Management System

This document outlines the architecture, data flows, components, and key algorithmic strategies for the Endorsement Management System, now updated to detail the separation of frontend and backend modules, and the abstract queuing design for Kafka compatibility.

---

## 1. Module Architecture (Frontend & Backend Separation)

To ensure clean separation of concerns and future scalability, the project is divided into two distinct directories:
- **`frontend/`**: Vite + React (TypeScript) + Vanilla CSS single-page application.
- **`backend/`**: Node.js + Express (TypeScript) server managing state, rules, and queues in memory.

---

## 2. Backend Modules & Services

The backend is structured into decoupled modules, allowing individual modules to be rewritten or migrated to microservices in the future.

```
backend/
├── src/
│   ├── index.ts                # Server entry point
│   ├── interfaces/
│   │   └── IMessageQueue.ts    # Message queue abstraction (In-memory/Kafka ready)
│   ├── queue/
│   │   └── InMemoryQueue.ts    # In-memory implementation of IMessageQueue
│   ├── controllers/
│   │   ├── member.controller.ts
│   │   ├── endorsement.controller.ts
│   │   └── ledger.controller.ts
│   ├── services/
│   │   ├── calc.service.ts     # Premium Calculation Engine
│   │   ├── anomaly.service.ts  # AI/Rule Anomaly Detector
│   │   ├── ledger.service.ts   # Endorsement Account Ledger & Balance Guard
│   │   └── reconciliation.service.ts # Auto-Reconciliation Handler
│   ├── types/
│   │   └── insurance.ts        # Common type definitions
│   └── data/
│       └── store.ts            # In-memory data store (Simulating database)
```

### In-Memory to Kafka Queuing Interface

The messaging system is abstracted via a generic queue interface. To transition to Kafka later, one only needs to implement `IMessageQueue` using a Kafka library (like `kafkajs`) and swap the dependency injection.

#### `interfaces/IMessageQueue.ts`
```typescript
export interface IMessageQueue {
  publish(topic: string, message: any): Promise<void>;
  subscribe(topic: string, callback: (message: any) => Promise<void>): Promise<void>;
}
```

#### `queue/InMemoryQueue.ts`
This class implements the interface using standard NodeJS `EventEmitter` to simulate asynchronous, decoupled event-driven consumer loops:
```typescript
import { EventEmitter } from 'events';
import { IMessageQueue } from '../interfaces/IMessageQueue';

export class InMemoryQueue implements IMessageQueue {
  private emitter = new EventEmitter();

  async publish(topic: string, message: any): Promise<void> {
    // Simulate slight network latency
    setTimeout(() => {
      this.emitter.emit(topic, message);
    }, 50);
  }

  async subscribe(topic: string, callback: (message: any) => Promise<void>): Promise<void> {
    this.emitter.on(topic, async (message) => {
      try {
        await callback(message);
      } catch (err) {
        console.error(`Error processing message on topic ${topic}:`, err);
      }
    });
  }
}
```

---

## 3. Data Store Selection, Concurrency, and Idempotency

### A. Data Store Selection (CQRS Design)
To support 100K employers and 1M changes/day, we separate the Write (Transactional) and Read (Query/Analytics) workloads:

1. **Transactional Write Store: Amazon DynamoDB**
   - **Rationale**: Since group policies are completely independent, we isolate and partition data by `EmployerID` (Partition Key). DynamoDB scales horizontally with predictable single-digit millisecond latency.
   - **Primary Key Structure**:
     - `PolicyTable`: Partition Key (`EmployerID`), Sort Key (`PolicyID`)
     - `LedgerTable`: Partition Key (`EmployerID`), Sort Key (`TransactionID` / `Timestamp`)
     - `EndorsementTable`: Partition Key (`EmployerID`), Sort Key (`EndorsementID`)
2. **Distributed Cache & Locking: Redis**
   - **Rationale**: Used to store active idempotency keys (with short TTLs), active batch queue locks, and real-time Endorsement Account (EA) balances for fast reads in dashboards.
3. **Read Store (Optional Search / Analytics)**:
   - Read-replicas or Elasticsearch for advanced directory searches, separating query load from transactional DynamoDB writes.

---

### B. Concurrency Control
Concurrent balance deductions or batch execution could lead to race conditions (e.g., two requests deducting money at the same time and putting the balance below zero). We enforce two levels of protection:

1. **Distributed Locks (Redis Mutex)**:
   - Before modifying a policy's Endorsement Account balance or processing a member upload batch, the service must acquire a lock in Redis:
     - Key: `lock:employer:${employerId}`
     - Value: Unique Request UUID
     - TTL: 30 seconds (safety release timeout)
   - If a concurrent request attempts to modify the balance while the lock is held, it will retry (exponential backoff) or return a conflict error.
2. **Optimistic Concurrency Control (OCC)**:
   - If utilizing a relational database or DynamoDB, write updates check the record version:
     - `UPDATE policy SET ea_balance = :new_balance, version = version + 1 WHERE id = :policyId AND version = :current_version`
   - If the version changes due to a concurrent write, the database rejects the write, and the transaction coordinator safely rolls back.

---

### C. Idempotency (Strict Once-and-Only-Once Processing)
To prevent duplicate charges or double enrollments when network dropouts occur and client APIs trigger retries:

1. **Idempotency Key Requirement**:
   - All REST requests and batch headers must include a unique header: `Idempotency-Key: <UUIDv4>`.
2. **Idempotency Lifecycle in Redis (or DynamoDB)**:
   - Upon receiving a request:
     - Query if the `Idempotency-Key` exists.
     - **State: IN_PROGRESS**: If key exists and state is `IN_PROGRESS`, reject with `409 Conflict` (or instruct the client to wait).
     - **State: COMPLETED**: If key exists and state is `COMPLETED`, return the cached API response payload directly.
     - **Not Found**: Save the key with status `IN_PROGRESS` and a TTL of 24 hours.
   - Execute the endorsement and database updates.
   - Once successfully committed, update the state of the `Idempotency-Key` to `COMPLETED` and attach the API response body.

```
Client             API Gateway            Idempotency Store (Redis)       Database/Services
  |                     |                             |                           |
  |--- POST Request --->|                             |                           |
  |    with Idemp-Key   |--- Check Idempotency Key -->|                           |
  |                     |<-- Return (Not Found) ------|                           |
  |                     |                             |                           |
  |                     |--- Set Key (IN_PROGRESS) -->|                           |
  |                     |                             |                           |
  |                     |------------------ Execute Business Logic -------------->|
  |                     |                                                         | (Commit DB changes)
  |                     |<----------------- Success Response ---------------------|
  |                     |                             |                           |
  |                     |--- Update Key (COMPLETED) ->|                           |
  |                     |    & Attach Response Body   |                           |
  |                     |                             |                           |
  |<-- Return Response -|                             |                           |
```

---

## 4. Data Store Schema & API Design

### Endpoints (REST API)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/members` | `GET` | Retrieve the active member roster. |
| `/api/endorsements` | `GET` | List all real-time and batch endorsement requests. |
| `/api/endorsements` | `POST` | Submit a single/real-time endorsement request. |
| `/api/endorsements/batch` | `POST` | Submit a bulk batch (JSON array) of endorsements (Batch API). |
| `/api/endorsements/:id/confirm` | `POST` | Confirms/Underwrites a pending request. |
| `/api/endorsements/:id/reject` | `POST` | Rejects a pending request. |
| `/api/endorsements/:id/retry` | `POST` | Manually retries a failed request. |
| `/api/ledger` | `GET` | Get the transactional history & current EA Balance. |
| `/api/ledger/topup` | `POST` | Deposit funds to the Endorsement Account. |
| `/api/ledger/optimize` | `GET` | Get AI balance forecasts and minimum balance recommendation. |
