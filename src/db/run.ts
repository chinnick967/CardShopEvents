// CLI entry for database tasks. Run via the package scripts:
//   npm run db:migrate | npm run db:seed | npm run db:setup
//
// Loads .env FIRST (before any module that reads process.env at import time),
// then dynamically imports the task modules so the DB connection picks up the
// credentials. Usage: tsx src/db/run.ts <migrate|seed|setup|reset>
//   migrate  create the game_night schema + tables (idempotent)
//   seed     populate demo data if the events table is empty
//   setup    migrate + seed
//   reset    clear events + signups, then re-seed pristine demo data (keeps accounts)

process.loadEnvFile();

const command = process.argv[2] ?? "setup";

async function main(): Promise<void> {
  const { migrate } = await import("./migrate");
  const { seed } = await import("./seed");
  const { sequelize } = await import("../lib/db");

  try {
    if (command === "migrate" || command === "setup") await migrate();
    if (command === "reset") {
      await sequelize.query("TRUNCATE game_night.signups, game_night.events RESTART IDENTITY CASCADE");
      console.log("✓ reset: cleared events + signups");
    }
    if (command === "seed" || command === "setup" || command === "reset") await seed();
    console.log("✓ done");
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error("✗ db task failed:", err);
  process.exitCode = 1;
});
