import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sequelize } from "../lib/db";

/**
 * Apply every migration in src/db/migrations, in filename order. Each file is
 * split into individual statements (robust across drivers). All DDL is
 * idempotent (CREATE/ALTER ... IF NOT EXISTS), so re-running is safe.
 */
export async function migrate(): Promise<void> {
  const dir = join(process.cwd(), "src", "db", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let total = 0;
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await sequelize.query(statement);
    }
    total += statements.length;
    console.log(`  ✓ ${file} (${statements.length} statements)`);
  }

  console.log(`✓ migrate: applied ${files.length} migration file(s), ${total} statements`);
}
