import { defineConfig } from "prisma/config"

// Prisma 7 no longer takes the connection URL from schema.prisma. The CLI reads it
// from here (for `migrate`), and the runtime gets it through the driver adapter in
// src/index.ts. DATABASE_URL is the only thing you have to set.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Read directly rather than through prisma/config's env(), which throws when the
    // variable is missing - that would break `prisma generate` in a build step that
    // has no database attached.
    url: process.env.DATABASE_URL ?? "",
  },
})
