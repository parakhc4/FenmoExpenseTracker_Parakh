const express = require("express");
const cors = require("cors");
const path = require("path");
const expensesRouter = require("./routes/expenses");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve the frontend as a static file from the public folder
app.use(express.static(path.join(__dirname, "../public")));

// Mount the expenses router
app.use("/expenses", expensesRouter);

// Health check — useful for Railway and deployment verification
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});