import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Opt Sequelize out of Server Component bundling so its dynamic dialect
  // `require`s resolve via native Node.js. `pg` is externalized automatically.
  serverExternalPackages: ["sequelize"],
};

export default nextConfig;
