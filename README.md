# FenmoExpenseTracker_Parakh

Expense Tracker application for Fenmo

---

## Preface

*(Written at 03:57:17)*

Hi, my name is Parakh. I am a published LLM researcher, a backend developer and the founder of an AI startup. In order to separate myself from everyone else submitting this same assignment for Fenmo.ai, I have decided to only utilize AI / LLMs for the pure coding parts.

Everything else, from the Design, Documentation to the Deployment, I am doing by myself. In doing this I aim to showcase how well I can utilize and guide AI systems to successfully complete use-cases while having 0 technical debt.

---

## Phase 1 — Functional Requirements

### Core

| ID | Requirement |
|---|---|
| FR1 | The system shall allow the user to create an expense entry with amount, category, description and date. |
| FR2 | The system shall allow the user to view a list of all of the expenses. |
| FR3 | The system shall allow the user to filter the expense list by category. |
| FR4 | The system shall allow the user to sort the expense list by date, with the newest expense appearing first. |
| FR5 | The system shall compute and display a running total of all currently visible expenses, reflecting the active filter and sort state. |
| FR6 | The system shall handle duplicate submissions gracefully. Retrying a failed or slow request must not create duplicate expense records. |
| FR7 | The system shall persist expense data across page refreshes and browser sessions. |
| FR8 | The system shall validate expense input on both the client and the server. Amount must be a positive number. Category, description, and date must be non-empty. Invalid requests must be rejected with a descriptive error. |

---

## Phase 2 — Design

*(Written at 03:29:21)*

### Entities

**Expense**

| Attribute | Type | Description |
|---|---|---|
| `id` | `TEXT` | Primary key. UUID v4 generated server-side at insert time. |
| `amount` | `INTEGER` | Stored in paise (rupees × 100). Floating point arithmetic cannot represent all decimal fractions exactly in binary. Storing as integer eliminates rounding errors entirely. Used in major financial systems such as Razorpay and Stripe. |
| `category` | `TEXT` | Free-form string. No separate Category table — categories are user-defined and unstructured at this scale. |
| `description` | `TEXT` | Free-form string describing what the expense was for. |
| `date` | `TEXT` | User-reported date in `YYYY-MM-DD` format. Represents when the money was spent — separate from `created_at` because a user may log an expense after the fact. |
| `created_at` | `TEXT` | Server-generated ISO 8601 timestamp of when the record was inserted. Used as a tiebreaker when two expenses share the same `date`. |
| `idempotency_key` | `TEXT` | Nullable, unique. Client-generated UUID v4 sent per form session. Prevents duplicate records on retry. |

> The current schema is intentionally single-tenant. A `User` entity with a `user_id` foreign key on the `EXPENSE` table would be the natural next step if multi-user support were required. That extension would not require changing any existing columns.

---

## Phase 3 — API Contract
(Written at 03:23:17)
### POST /expenses
Now that we have our entities and attributes locked in, the next step is to define how the frontend talks to the backend. The API contract defines the boundary between the two — what each endpoint accepts, what it returns, and how it behaves under edge cases like retries and validation failures. I designed this before writing a single line of code.
Creates a new expense entry.

**Headers**

| Header | Required | Description |
|---|---|---|
| `Content-Type` | Yes | `application/json` |
| `Idempotency-Key` | Recommended | UUID v4 generated client-side per form session. Ensures retries do not create duplicate records. |

**Request Body**

```json
{
  "amount": 350.50,
  "category": "Food",
  "description": "Lunch at Subway",
  "date": "2026-04-21"
}
```

| Field | Type | Constraints |
|---|---|---|
| `amount` | `number` | Required. Must be a positive value. Stored internally in paise (amount × 100) to avoid floating point errors. |
| `category` | `string` | Required. Non-empty. |
| `description` | `string` | Required. Non-empty. |
| `date` | `string` | Required. ISO 8601 date format `YYYY-MM-DD`. Represents when the money was spent, not when the record was created. |

**Response — 201 Created**

Returned when a new expense is successfully created.

```json
{
  "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "amount": 350.50,
  "category": "Food",
  "description": "Lunch at Subway",
  "date": "2026-04-21",
  "created_at": "2026-04-21T10:23:45.000Z"
}
```

**Response — 200 OK (idempotent replay)**

Returned when the same `Idempotency-Key` is received again. The original record is returned unchanged. No duplicate row is created. The `200` vs `201` distinction signals to the client that this was a replay, not a new creation.

**Response — 400 Bad Request**

Returned when validation fails.

```json
{
  "error": "amount must be a positive number"
}
```

---

### GET /expenses

Returns a list of expenses. Supports optional filtering and sorting via query parameters.

**Query Parameters**

| Parameter | Type | Description |
|---|---|---|
| `category` | `string` | Optional. Filters results to only expenses matching this category. |
| `sort` | `string` | Optional. Pass `date_desc` to sort by date newest first. This is also the default behaviour. |

**Example**

```
GET /expenses?category=Food&sort=date_desc
```

**Response — 200 OK**

Always returns an array. Returns an empty array `[]` when no results match — never `null`.

```json
[
  {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "amount": 350.50,
    "category": "Food",
    "description": "Lunch at Subway",
    "date": "2026-04-21",
    "created_at": "2026-04-21T10:23:45.000Z"
  }
]
```

> `amount` is returned in rupees (not paise). The paise conversion is internal to the server — API consumers never interact with raw paise values.

---

### GET /expenses/categories

Returns a distinct, alphabetically sorted list of all categories that currently exist in the database. Used to populate the filter dropdown on the frontend.

Keeping this as a separate endpoint ensures the dropdown stays in sync with the actual data — no hardcoding of category values anywhere in the system.

**Response — 200 OK**

```json
["Entertainment", "Food", "Rent", "Travel"]
```



## Phase 4 — Design Decisions, Patterns and Trade-offs
(Written at 03:01:42)

Now that the contract is defined, I want to walk through the key decisions I made while designing this system. I'll outline what I chose, what I gave up, and why each trade-off was worth it given the timebox.

---

### 1. Persistence — SQLite over everything else

The assignment gave full freedom on the persistence layer. I am chosing to use SQLite (`better-sqlite3`).

The reasoning is straightforward : an in-memory store dies on every server restart — FR7 rules it out immediately. A hosted Postgres or MySQL instance would have been overkill for a single-user personal finance tool ( would introduce network latency and deployment complexity versus little value added). SQLite is zero-configuration and ships as a native dependency.

I asked AI about sqlLite and learned about enabling WAL mode (`PRAGMA journal_mode = WAL`) on startup. SQLite's default journal mode uses exclusive write locks, meaning a concurrent read blocks during a write. It seems WAL allows reads and writes to proceed simultaneously — relevant here because a POST /expenses and a GET /expenses could arrive at the same time (v v imp).

Following are some Design Patterns I have utilized :
**Pattern used — Singleton.**
The database connection is initialised only once in `db.js` and exported as a module-level constant. Every route that needs the database imports this single instance. Very standard.

(following is via AI)
```javascript
// db.js — one connection, shared across the entire application
const db = new Database(path.join(__dirname, '../expenses.db'));
db.pragma('journal_mode = WAL');
module.exports = db; // Node caches this — Singleton
```

---

### 2. Money — Integer (paise) over Float

I researched and found that this is a non-negotiable decision ( https://www.reddit.com/r/learnprogramming/comments/ceyg6j/money_as_integer_instead_of_float/ one of the references ). Floating point cannot represent all decimal fractions exactly in binary. For a financial application, rounding errors compound across many additions and produce subtly incorrect totals — which is unacceptable.

The industry-standard solution is to store monetary values as integers in the smallest denomination of the currency. For rupees that is paise. All arithmetic happens in integers. The conversion to rupees only happens at the API response boundary, never inside the system.

**Pattern used — Value Object.**
`amount` is never manipulated directly as a raw number inside the application. It enters as rupees from the client, is immediately converted to paise on input, all internal logic operates on paise, and it is converted back to rupees only at the output boundary. The conversion logic lives in one place — the `formatExpense` function in the route file. No conversion logic is scattered across the codebase.

```javascript
// Input boundary — rupees to paise
const stored = Math.round(parseFloat(amount) * 100);

// Output boundary — paise to rupees (formatExpense)
amount: row.amount / 100
```

---

### 3. Idempotency — UUID per form session

The assignment explicitly calls out unreliable networks, multiple submits, and retries as real-world conditions this system must handle. A simple solution like disabling the submit button wouldn't work for this as I have come to learn, as a disabled button does not help when a request is in-flight and the network drops.

The approach I took is a proper idempotency key pattern. When the form first renders, a UUID v4 is generated client-side. This key is sent as an `Idempotency-Key` header on every POST request. The server stores this key in the database with a UNIQUE constraint. If the same key arrives again — because the user retried, refreshed, or the network replayed the request — the server returns the original record with a `200 OK` instead of inserting a new row.

The key lifecycle is deliberate. On a successful submission, a new UUID is generated immediately — so the next expense gets a fresh key. On a failed submission, the same key is preserved — so the retry is safe. This means the system is correct under every failure mode the assignment describes.

**Pattern used — Idempotency Key Pattern** (a specialisation of the **Command Pattern**).
Each write request is treated as a uniquely identified command. The server records that the command was executed and returns the same result if the command is replayed. The uniqueness guarantee is enforced at the database level with a UNIQUE constraint — not at the application level — meaning even concurrent duplicate requests are handled correctly by the database engine, not by application-level locking.

```javascript
// Server — check before insert
const existing = db.prepare(
  'SELECT * FROM expenses WHERE idempotency_key = ?'
).get(idempotencyKey);
if (existing) return res.status(200).json(formatExpense(existing));

// Database constraint as the final safety net
// idempotency_key TEXT UNIQUE
```

---

### 4. Architecture — Repository Pattern (thin data layer)

All database access lives in `db.js`. The route files never write raw SQL outside their own scope — they call prepared statements through the shared db instance. This is a lightweight application of the Repository Pattern.

The reason is maintainability. If the persistence layer ever needs to change — say, swapping SQLite for Postgres — only `db.js` changes. The route files are insulated from that decision. For a two-route API this might feel like over-engineering, but the assignment explicitly says this should be written as something you would extend and maintain over time. Writing it this way costs nothing and signals the right instincts.

**Pattern used — Repository Pattern.**
`db.js` acts as the data access layer. Routes act as the application layer. The two layers communicate through a clean interface — prepared statements — with no raw SQL leaking into business logic.

---

### 5. Frontend — Vanilla JS over React

I chose vanilla JS with a single `index.html` file served as a static asset from Express. No build step, no bundler, no framework.

The reasoning is that the frontend requirements are genuinely simple — a form, a table, a dropdown, a total. React would have added a build pipeline, a `node_modules` folder on the frontend, and deployment complexity for no functional gain. The assignment says to keep styling simple and focus on correctness. Vanilla JS lets me do exactly that and ships faster.

The one place this shows up as a limitation is component reuse — if the UI grew significantly, the lack of a component model would become a problem. That is an honest trade-off I made because of the timebox.

**Pattern used — Observer Pattern (lightweight).**
The `loadExpenses()` function is the single source of truth for the list view. Every user action that changes state — submitting a form, changing the category filter, changing the sort order — calls `loadExpenses()` at the end. The UI always reflects the latest server state rather than trying to maintain local state in sync with the server.

---

### 6. What I intentionally did not do

**Authentication.** The assignment describes a personal finance tool — single user by definition. Adding auth would have introduced session management, token storage, and middleware that adds complexity without satisfying any stated requirement. The right extension here would be a single authenticated user via a session token, but that is out of scope.

**Edit and delete.** Not in the acceptance criteria. I did not add them because adding untested scope to hit a deadline is how technical debt starts.

**Pagination.** At personal expense scale — a few hundred records at most — pagination adds complexity with no real benefit. A full table scan on a local SQLite file is measured in microseconds at this scale.

**Automated tests.** Given the timebox, I prioritised a correct and well-documented implementation over test coverage. The natural next step would be integration tests on the two POST and GET endpoints using a test database, verifying the idempotency behaviour specifically.