import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: 'netlify/database/migrations',
  dbCredentials: {
    url: process.env.NEON_DATABASE_URL!,
  },
})
