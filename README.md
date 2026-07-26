# Express + Prisma starter for Railway

An Express 5 API on Prisma 7 and Postgres, with database migrations in the
pre-deploy step rather than in the build.

## Why this exists

The Express/Prisma starter on Railway has not been touched since January 2023. It
pins Prisma 4, which is long past end of life, and its build script is:

```json
"build": "yarn migrate:deploy && tsc"
```

That runs `prisma migrate deploy` during the **build**. Builds have no database
attached, so the migration cannot connect and the build fails before TypeScript
ever runs. Fewer than half of the deployments from that template come up.

Railway has a step for exactly this. `railway.json` here declares:

```json
"preDeployCommand": "npm run migrate"
```

which runs after the build and before the new version takes traffic, when
`DATABASE_URL` is available. Migrations apply on every deploy; a failed migration
stops the rollout instead of shipping code against the wrong schema.

## What's in here

| File | Why it exists |
|------|---------------|
| `src/index.ts` | The API: `/`, `/health`, `GET /notes`, `POST /notes` |
| `prisma/schema.prisma` | One `Note` model, enough to prove the database works |
| `prisma.config.ts` | Prisma 7 reads the connection URL from here, not from the schema |
| `railway.json` | Pre-deploy migration, health check, restart policy |
| `package-lock.json` | Committed, so `npm ci` reproduces an audited tree |

Two details worth knowing if you extend it:

- **Prisma 7 uses driver adapters.** `new PrismaClient({ adapter: new PrismaPg(...) })`
  replaces the old engine, and `url` is no longer allowed in `schema.prisma`.
- **The lockfile is audited clean.** Railway refuses to build when the committed
  lockfile carries a HIGH advisory. Prisma's own dependency tree currently pulls a
  vulnerable `find-my-way`, so `package.json` overrides it forward. Check with
  `npm audit --audit-level=high` before pushing.

## Endpoints

| Method | Path | Does |
|--------|------|------|
| GET | `/` | Lists the endpoints |
| GET | `/health` | Runs `SELECT 1`, so it reports unhealthy when Postgres is unreachable |
| GET | `/notes` | Last 100 notes, newest first |
| POST | `/notes` | Creates a note from `{"body": "..."}` |

## Run locally

```bash
npm ci
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mydb"
npx prisma migrate dev
npm run dev
```

## Configuration

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Postgres connection string |
| `PORT` | no | Defaults to 8080 |

## License

MIT
