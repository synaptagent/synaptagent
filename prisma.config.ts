import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moves the connection URL out of schema.prisma into this config.
// Migrations use the non-pooled DIRECT_URL; the app runtime uses the pooled
// DATABASE_URL via the Neon driver adapter (see lib/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
