import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Opt Sequelize out of Server Component bundling so its dynamic dialect
  // `require`s resolve via native Node.js. `pg` is externalized automatically.
  serverExternalPackages: ["sequelize"],
  // Let component `.module.scss` files resolve the shared partials as bare
  // specifiers: `@use 'neon' as *;` / `@use 'breakpoints' as *;`.
  sassOptions: {
    loadPaths: ["./src/styles"],
  },
};

export default nextConfig;
