import express, { type Request, type Response, type NextFunction } from "express"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Attach a Postgres service and reference its URL.")
  process.exit(1)
}

// Prisma 7 talks to Postgres through a driver adapter instead of its own engine, so
// the connection string is supplied here rather than in schema.prisma.
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
const app = express()

app.use(express.json())

// Railway routes the public domain to PORT. Falling back to 8080 keeps `npm start`
// working locally without any environment set up.
const port = Number(process.env.PORT ?? 8080)

app.get("/", (_req, res) => {
  res.json({
    message: "Express + Prisma on Railway",
    endpoints: ["GET /health", "GET /notes", "POST /notes"],
  })
})

// The health check hits the database too, so a deployment is only reported healthy
// once it can actually serve a request that needs Postgres.
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: "ok", database: "ok" })
  } catch {
    res.status(503).json({ status: "degraded", database: "unreachable" })
  }
})

app.get("/notes", async (_req, res, next) => {
  try {
    res.json(await prisma.note.findMany({ orderBy: { createdAt: "desc" }, take: 100 }))
  } catch (err) {
    next(err)
  }
})

app.post("/notes", async (req, res, next) => {
  const { body } = req.body ?? {}
  if (typeof body !== "string" || !body.trim()) {
    return res.status(400).json({ error: "body is required and must be a non-empty string" })
  }
  try {
    res.status(201).json(await prisma.note.create({ data: { body: body.trim() } }))
  } catch (err) {
    next(err)
  }
})

// Express 5 forwards rejected promises here, so an unreachable database returns 500
// instead of taking the process down.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: "internal server error" })
})

const server = app.listen(port, () => {
  console.log(`listening on ${port}`)
})

// Railway sends SIGTERM before replacing a container. Closing the server and the
// connection pool lets in-flight requests finish instead of being cut off.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
  })
}
