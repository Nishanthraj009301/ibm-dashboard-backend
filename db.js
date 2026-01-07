const { Pool } = require("pg");

const isProduction = !!process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction
    ? { rejectUnauthorized: false }
    : false
});

module.exports = pool;
