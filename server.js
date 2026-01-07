require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const db = require("./db");

const app = express();
const server = http.createServer(app);

/* =========================
   HEALTH CHECK
========================= */
app.get("/health", (req, res) => {
  res.send("OK");
});

/* =========================
   SOCKET.IO
========================= */
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

io.on("connection", (socket) => {
  console.log("🟢 Dashboard connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Dashboard disconnected:", socket.id);
  });
});

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());

/* =========================
   BOT EVENT API
========================= */
app.post("/api/bot/event", async (req, res) => {
  try {
    const {
      status,
      patientName,
      alNumber,
      policyNumber,
      hospitalGroup,
      tpa
    } = req.body;

    // Ignore invalid payloads silently
    if (!status || !tpa) {
      console.warn("⚠ Invalid payload:", req.body);
      return res.sendStatus(200);
    }

    const now = new Date();

    await db.query(
      `
      INSERT INTO bot_dashboard_cases
      (
        patient_name,
        al_number,
        policy_number,
        hospital_group,
        tpa_name,
        parsed_time,
        saved_time,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        patientName || "N/A",
        alNumber || "N/A",
        policyNumber || "N/A",
        hospitalGroup || "N/A",
        tpa || "N/A",
        status === "PARSED" ? now : null,
        status === "SAVED" ? now : null,
        status
      ]
    );

    // Notify dashboard in realtime
    io.emit("bot_update");

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ BOT EVENT ERROR:", err);
    res.sendStatus(500);
  }
});

/* =========================
   DASHBOARD APIs
========================= */

// 1️⃣ Counters
app.get("/api/dashboard/counts", async (req, res) => {
  try {
    const parsed = await db.query(
      "SELECT COUNT(*) FROM bot_dashboard_cases WHERE status='PARSED'"
    );
    const saved = await db.query(
      "SELECT COUNT(*) FROM bot_dashboard_cases WHERE status='SAVED'"
    );

    res.json({
      parsed: Number(parsed.rows[0].count),
      saved: Number(saved.rows[0].count)
    });
  } catch (err) {
    console.error("❌ COUNT ERROR:", err);
    res.sendStatus(500);
  }
});

// 2️⃣ All cases
app.get("/api/dashboard/cases", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM bot_dashboard_cases
      ORDER BY updated_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ CASES ERROR:", err);
    res.sendStatus(500);
  }
});

// 3️⃣ Saved cases by Hospital Group
app.get("/api/dashboard/by-hospital", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT hospital_group, COUNT(*) AS count
      FROM bot_dashboard_cases
      WHERE status='SAVED'
      GROUP BY hospital_group
      ORDER BY count DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ HOSPITAL STATS ERROR:", err);
    res.sendStatus(500);
  }
});

// 4️⃣ Saved cases by TPA
app.get("/api/dashboard/by-tpa", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT tpa_name, COUNT(*) AS count
      FROM bot_dashboard_cases
      WHERE status='SAVED'
      GROUP BY tpa_name
      ORDER BY count DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ TPA STATS ERROR:", err);
    res.sendStatus(500);
  }
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
