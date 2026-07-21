// Load .env so the Sequelize instance has DB credentials before any test module
// imports it. Runs before test files (vitest setupFiles).
process.loadEnvFile();
