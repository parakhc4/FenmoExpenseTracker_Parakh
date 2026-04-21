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