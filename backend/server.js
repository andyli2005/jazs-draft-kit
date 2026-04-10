require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const db = require("./db");
const authRoutes = require("./routes/auth");
const playersRoutes = require("./routes/players");
const transactionsRoutes = require("./routes/transactions");
const leaguesRoutes = require("./routes/leagues");

const app = express();

const allowedOrigins = new Set([
  process.env.FRONTEND_ORIGIN,    
  "http://localhost:3000"
].filter(Boolean));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/players", playersRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/leagues", leaguesRoutes);

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await db.connect();
    app.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
