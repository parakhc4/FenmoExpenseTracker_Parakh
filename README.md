# FenmoExpenseTracker_Parakh
Expense Tracker application for Fenmo 

# Preface 
(Written at 03:57:17)

Hi, my name is Parakh. I am a published LLM researcher, a backend developer and the founder of an AI startup.
 In order to separate myself from everyone else submitting this same assignment for Fenmo.ai, I have decided to only utilize AI / LLMs for the pure coding parts.

Everything else, from the Design, Documentatioon to the Deployment, I am doing by myself. In doing this I aim to showcase how well I can utilize and guide AI systems to sucessfully complete use-cases while having 0 technical debt.

# Phase 1 : Functional Requirements : 

Starting off, let's list out the Functional Requirements:

FR 1 : The System should allow the user to create an expense entry with amount, category, description and date.

FR 2 : The System should allow the user to view a list of all of the expenses.

FR 3 : The system shall allow the user to filter the expense list by category.

FR 4 : The system should allow the user to sort the expense list by date, with the newest expense appearing first.

FR5 : The System should compute and display a running total of all currently visible expenses, reflecting the active filter and sort state.

FR6 : The system shall handle duplicate submissions gracefully. Retrying a failed or slow request must not create duplicate expense records.

FR7 : The system shall persist expense data across page refreshes and browser sessions.

FR8 : The system shall validate expense input on both the client and the server. Amount must be a positive number. Category, description, and date must be non-empty. Invalid requests must be rejected with a descriptive error.

# Phase 2 : Design the Flow
1. Entities :
(Written at 03:29:21)

Expense 

Attributes : 
- id (Text, primary key, UUID4 generated at server side)

- amount (Integer) (stored in paise (rupees × 100) - I researched this right now and found this to be the best way to store money, used in major financial apps such as RazorPay, Stripe etc. Done because floating point arithmetic cannot represent all decimal fractions exactly in binary.)

- category (Text)

- description (Text)

- date (Text)

- created_At (Text) (server-generated ISO 8601 timestamp of when the record was inserted. Used as a tiebreaker when two expenses share the same date)


(The current schema is intentionally single-tenant. A User entity with a user_id foreign key on the EXPENSE table would be the natural next step if multi-user support were required. That extension would not require changing any existing columns.)