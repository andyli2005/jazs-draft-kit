const express = require("express");
const cors = require("cors");

const app = express();

const allowedOrigins = new Set([
  process.env.FRONTEND_ORIGIN,    
  "http://localhost:5173"
].filter(Boolean));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "draft-kit-backend" });
});

app.post("/api/echo", (req, res) => {
  res.json({ youSent: req.body });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});