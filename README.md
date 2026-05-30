# Endorsement Management System for Group Insurance

A premium, state-of-the-art Web Application designed to handle insurance contract modifications ("endorsements") for group policies. This platform streamlines employee onboarding, termination, and coverage tier changes with fully automated retroactive premium proration, risk anomaly scanning, available-funds validations, and real-time underwriter review pipelines.

Developed with a modern, decoupled architecture featuring a **Spring Boot 3 (Java 17)** backend with **H2 SQL JPA storage**, and a stunning **Vite React** responsive client designed with premium glassmorphism dark aesthetics.

---

## 🛠️ Technology Stack

| Layer | Technology | Key Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript | Highly interactive Client-side SPA |
| **Styling** | Vanilla CSS, Lucide Icons | Responsive glassmorphic layout, dynamic charts, dark-mode styling |
| **Backend** | Spring Boot 3, Java 17 | Enterprise REST API, dynamic premium logic, message queuing |
| **Data Storage** | JPA (Hibernate), In-Memory H2 SQL | Thread-safe, production-ready relational persistence with automatic seeder |
| **Docs / Spec** | SpringDoc, OpenAPI 3.0, Swagger | Interactive API testing sandbox, auto-generated OpenAPI schemas |

---

## 🚀 Core Architectural Features

* **Zero-Coverage Gap Retroactivity**: Billing proration is calculated retroactively back to the employee's `EligibilityDate`. If an addition lacks immediate funding, the worker registers `QUEUED_FOR_INSURER` and grants temporary grace cover to ensure coverage remains active while HR is notified to deposit funds.
* **Idempotency Key Guard**: Single/bulk submissions pass a client-generated UUID header `Idempotency-Key`. Duplicate submissions return cached execution receipts, preventing double billing or duplicate roster entries.
* **Serialized Batch Queue**: Processing bulk additions locks a concurrent mutex queue per employer to guarantee ordered serialization. Features an **SLA Fast-Forward** capability to bypass processing time-lags.
* **Underwriter Review Queue**: Flagged anomalies (unusual backdating, age band limits, overaged dependents, or insufficient funds) are routed to an Underwriting Console where insurers can review side-by-side comparisons, provide rejection remarks, or force-approve submissions.
* **API Log Terminal**: Underwriters can track real-time API logs, simulate connectivity failures (timeout drops), and trigger automated retries through a built-in terminal console.

---

## 💻 Running the Code Locally

Ensure you have **OpenJDK 17** (or above), **Maven 3.x**, and **Node.js 18+** installed.

### Step 1: Start the Spring Boot Backend Service
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Build and launch the server (starts on port `5001`):
   ```bash
   mvn spring-boot:run
   ```

### Step 2: Start the React Frontend Developer Client
1. Open a second terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the developer server (runs on port `3000`):
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser to interact with the application.

---

## 📖 API Documentation & Live Swagger UI

The backend includes auto-generated OpenAPI Swagger specifications. When the backend server is running on port `5001`:

* **Interactive Swagger UI Dashboard**: [http://localhost:5001/swagger-ui/index.html](http://localhost:5001/swagger-ui/index.html) — view, search, and run test queries against all 18 endpoints directly from your browser.
* **Raw OpenAPI Spec (JSON)**: [http://localhost:5001/v3/api-docs](http://localhost:5001/v3/api-docs)

---

## 🗄️ Database & In-Memory SQL Console

The application is powered by an in-memory SQL database (**H2 Database**), seeding active rosters, past endorsement requests, ledger history, and starting balances automatically at boot.

To query and inspect tables directly in the database:
* **H2 Console URL**: [http://localhost:5001/h2-console](http://localhost:5001/h2-console)
* **Configuration Parameters**:
  * **Driver Class**: `org.h2.Driver`
  * **JDBC URL**: `jdbc:h2:mem:endorsementdb`
  * **User Name**: `sa`
  * **Password**: *(leave blank)*
* Click **Connect** to run live SQL queries.

> **💡 Note**: All data runs in RAM. To persist database tables permanently to a file on your disk, open [application.properties](file:///Users/chanchalchitwan/gcp/Agentic/endorsement-management-system/backend/src/main/resources/application.properties) and update the JDBC URL to `spring.datasource.url=jdbc:h2:file:./data/endorsementdb`.

---

## 🧪 Verification Walkthrough Scenarios

Use the interactive UI client to verify the core business logic of the system:

### 1. Add Standard Member (Instant Auto-Reconciliation)
* Click **Add Employee** in the Employer Portal.
* Enter standard details (e.g., Name: `Peter Parker`, DOB: `1995-10-15`, select `INDIVIDUAL` tier).
* Under Step 3, note the estimate and the low-risk indicator: *"Eligible for instant auto-reconciliation"*.
* Commit the transaction. The member is instantly approved as `EFFECTIVE` on your roster.

### 2. Insufficient Account Funds Guard
* View your current Endorsement Account (EA) Balance.
* Add an employee with a `FAMILY` tier, backdating eligibility to `2026-01-01` (causing high retroactive premiums).
* Review the **Insufficient Account Funds Alert** banner in Step 3.
* Commit the transaction. Notice the notification bell rings: *"Underwriting Required: Insufficient balance"*.
* Switch to the **Insurer Dashboard** tab. Find the request in the queue. Clicking "Approve" will be blocked until HR completes an account **Top-Up** from the Employer Portal.

### 3. Anomaly Routing & Pipeline Retry
* Submit an employee with the email containing `retry` (e.g., `test-retry@acme.com`).
* The system simulates an API network timeout. See the alert: *"Timeout connecting to core system"*.
* Go to the **Insurer Dashboard** and scroll to the **API Log Console**. Find the failed transaction and click **Retry Pipeline** to trigger automated queue processing and successfully reconcile the member.
