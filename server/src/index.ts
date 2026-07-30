import express from "express";
import { pool } from "./db";
import { referenceRouter } from "./routes/reference";
import { effectsRouter } from "./routes/effects";
import { characterBuildsRouter } from "./routes/characterBuilds";
import { catalogRouter } from "./routes/catalog";
import { namedItemsRouter } from "./routes/namedItems";

const app = express();
const port = Number(process.env.DDOCRAFT_SERVER_PORT ?? 3001);

app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    res.status(503).json({ status: "db unreachable", error: (err as Error).message });
  }
});

app.use("/api", referenceRouter);
app.use("/api/effects", effectsRouter);
app.use("/api/character-builds", characterBuildsRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/named-items", namedItemsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

app.listen(port, () => {
  console.log(`ddocraft-server listening on port ${port}`);
});
