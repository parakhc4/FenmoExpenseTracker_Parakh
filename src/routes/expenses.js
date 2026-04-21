const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

const router = express.Router();

// ─── Utility ────────────────────────────────────────────────────────────────

// Value Object pattern — amount conversion lives in exactly one place
// All internal logic works in paise, this function converts back to rupees at the output boundary
function formatExpense(row) {
  return {
    id: row.id,
    amount: row.amount / 100,
    category: row.category,
    description: row.description,
    date: row.date,
    created_at: row.created_at,
  };
}

// ─── POST /expenses ──────────────────────────────────────────────────────────

router.post("/", (req, res) => {
  const { amount, category, description, date } = req.body;
  const idempotencyKey = req.headers["idempotency-key"] || null;

  // Server-side validation — FR8
  // We validate here regardless of what the frontend sent
  if (!amount || !category || !description || !date) {
    return res.status(400).json({
      error: "amount, category, description and date are all required",
    });
  }

  // Convert rupees to paise — Value Object pattern
  // Math.round handles floating point imprecision during the conversion itself
  const amountInPaise = Math.round(parseFloat(amount) * 100);

  if (isNaN(amountInPaise) || amountInPaise <= 0) {
    return res.status(400).json({
      error: "amount must be a positive number",
    });
  }

  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return res.status(400).json({
      error: "date must be in YYYY-MM-DD format",
    });
  }

  // Idempotency check — if this key has been seen before, return the original record
  // This handles retries, double clicks, and network replays
  // Returns 200 (not 201) to signal to the client this was a replay, not a new creation
  if (idempotencyKey) {
    const existing = db
      .prepare("SELECT * FROM expenses WHERE idempotency_key = ?")
      .get(idempotencyKey);

    if (existing) {
      return res.status(200).json(formatExpense(existing));
    }
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO expenses (id, amount, category, description, date, created_at, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, amountInPaise, category.trim(), description.trim(), date, createdAt, idempotencyKey);

    const created = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
    return res.status(201).json(formatExpense(created));

  } catch (err) {
    // Race condition safety net — two requests with the same idempotency key arrived simultaneously
    // The UNIQUE constraint on idempotency_key catches the second one at the database level
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      const existing = db
        .prepare("SELECT * FROM expenses WHERE idempotency_key = ?")
        .get(idempotencyKey);
      return res.status(200).json(formatExpense(existing));
    }

    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /expenses ───────────────────────────────────────────────────────────

router.get("/", (req, res) => {
  const { category, sort } = req.query;

  let query = "SELECT * FROM expenses";
  const params = [];

  // Optional category filter
  if (category) {
    query += " WHERE category = ?";
    params.push(category);
  }

  // Sort by date — if two expenses share the same date, created_at is the tiebreaker
  if (sort === "date_desc") {
    query += " ORDER BY date DESC, created_at DESC";
  } else {
    query += " ORDER BY date DESC, created_at DESC";
  }

  const rows = db.prepare(query).all(...params);

  // Always return an array — never null
  return res.status(200).json(rows.map(formatExpense));
});

// ─── GET /categories ─────────────────────────────────────────────────────────

// Returns distinct categories sorted alphabetically
// Used to populate the filter dropdown — no hardcoding of categories anywhere
router.get("/categories", (req, res) => {
  const rows = db
    .prepare("SELECT DISTINCT category FROM expenses ORDER BY category ASC")
    .all();

  return res.status(200).json(rows.map((r) => r.category));
});

module.exports = router;