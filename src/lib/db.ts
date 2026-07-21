import { Sequelize } from "sequelize";

// Required credentials (from .env — never commit real values).
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PWD = process.env.DB_PWD;

// Optional; sensible defaults for PostgreSQL / RDS.
const DB_NAME = process.env.DB_NAME || "postgres";
const DB_PORT = Number(process.env.DB_PORT) || 5432;

if (!DB_HOST || !DB_USER || !DB_PWD) {
  throw new Error(
    "Missing database credentials. Set DB_HOST, DB_USER, and DB_PWD in your .env file.",
  );
}

/**
 * Reuse a single Sequelize instance across dev hot-reloads. Without this,
 * every file change spins up a new connection pool and quickly exhausts the
 * database's connection limit. In production the module is only evaluated once,
 * so the global cache is skipped.
 */
const globalForDb = globalThis as unknown as { sequelize?: Sequelize };

export const sequelize =
  globalForDb.sequelize ??
  new Sequelize(DB_NAME, DB_USER, DB_PWD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: "postgres",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    // Connection pooling.
    pool: {
      max: 10, // max simultaneous connections in the pool
      min: 0, // keep no idle connections open when unused
      acquire: 30000, // ms to wait for a free connection before throwing
      idle: 10000, // ms a connection may sit idle before being released
    },
    // AWS RDS supports TLS out of the box. `rejectUnauthorized: false` accepts
    // the RDS-managed certificate without bundling the CA. For production,
    // pin the RDS CA bundle and set this to true.
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sequelize = sequelize;
}

/**
 * Verify the database is reachable. Call from a route handler / server action
 * during startup checks, e.g. `await assertDbConnection()`.
 */
export async function assertDbConnection(): Promise<void> {
  await sequelize.authenticate();
}

export default sequelize;
