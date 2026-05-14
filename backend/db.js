const sql = require("mssql");
require("dotenv").config();

function cleanEnv(value) {
  return String(value || "").trim().replace(/^['\"]|['\"]$/g, "");
}

const config = {
  server: cleanEnv(process.env.SQL_SERVER),
  port: Number(process.env.SQL_PORT || 1433),
  database: cleanEnv(process.env.SQL_DATABASE),
  user: cleanEnv(process.env.SQL_USER),
  password: cleanEnv(process.env.SQL_PASSWORD),
  options: {
    encrypt: String(process.env.SQL_ENCRYPT).toLowerCase() === "true",
    trustServerCertificate:
      String(process.env.SQL_TRUST_CERT).toLowerCase() === "true",
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool;
let poolPromise;

async function getPool() {
  if (pool?.connected) return pool;

  if (!poolPromise) {
    console.log("Conectando SQL Server", {
      server: config.server,
      port: config.port,
      database: config.database,
      user: config.user,
      encrypt: config.options.encrypt,
      trustServerCertificate: config.options.trustServerCertificate,
    });

    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((connectedPool) => {
        pool = connectedPool;
        console.log("SQL Server conectado");

        pool.on("error", (err) => {
          console.error("Error en pool SQL:", err.message);
          pool = null;
          poolPromise = null;
        });

        return pool;
      })
      .catch((err) => {
        pool = null;
        poolPromise = null;
        throw err;
      });
  }

  return poolPromise;
}

async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
    poolPromise = null;
  }
}

module.exports = {
  sql,
  getPool,
  closePool,
  sqlConfig: config,
};
