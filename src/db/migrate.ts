import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sequelize } from "../lib/db";

/**
 * Apply the schema migration. Splits the .sql file into individual statements
 * so each runs as its own simple query (robust across drivers). The DDL is
 * idempotent, so re-running is safe.
 */
export async function migrate(): Promise<void> {
  const sqlPath = join(process.cwd(), "src", "db", "migrations", "001_init.sql");
  const sql = readFileSync(sqlPath, "utf8");

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await sequelize.query(statement);
  }

  console.log(`✓ migrate: game_night schema ready (${statements.length} statements)`);
}
