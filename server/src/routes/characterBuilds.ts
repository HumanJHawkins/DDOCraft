import { Router } from "express";
import { pool } from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const characterBuildsRouter = Router();

// Phase 1 (no real accounts yet): the caller supplies userId directly - there is no session to
//   derive it from. Phase 2 replaces this with the authenticated user's id from a shared
//   GateIron.com session; every route below already keys off req.body/query userId as if it were
//   trustworthy, so swapping the source later needs no schema or query changes, just a different
//   place to read userId from.
const SERVICE_IDENTITY = "ddocraft_api";

function parseUserId(value: unknown): number | null {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

characterBuildsRouter.post("/", async (req, res, next) => {
  const userId = parseUserId(req.body?.userId);
  const { charName, charLevel, description, appVersion, buildData } = req.body ?? {};

  if (userId === null) {
    res.status(400).json({ error: "userId must be a positive integer" });
    return;
  }
  if (typeof charName !== "string" || !charName) {
    res.status(400).json({ error: "charName is required" });
    return;
  }
  if (!Number.isInteger(charLevel) || charLevel < 1) {
    res.status(400).json({ error: "charLevel must be a positive integer" });
    return;
  }
  if (typeof appVersion !== "string" || !appVersion) {
    res.status(400).json({ error: "appVersion is required" });
    return;
  }
  if (typeof buildData !== "object" || buildData === null) {
    res.status(400).json({ error: "buildData must be an object" });
    return;
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO characterBuild
         (userId, charName, charLevel, description, appVersion, buildData, createBy, updateBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, charName, charLevel, description ?? null, appVersion, JSON.stringify(buildData),
        SERVICE_IDENTITY, SERVICE_IDENTITY]
    );
    res.status(201).json({ characterBuildId: result.insertId });
  } catch (err) {
    next(err);
  }
});

characterBuildsRouter.put("/:id", async (req, res, next) => {
  const characterBuildId = Number(req.params.id);
  const userId = parseUserId(req.body?.userId);
  const { charName, charLevel, description, appVersion, buildData } = req.body ?? {};

  if (!Number.isInteger(characterBuildId)) {
    res.status(400).json({ error: "characterBuildId must be an integer" });
    return;
  }
  if (userId === null) {
    res.status(400).json({ error: "userId must be a positive integer" });
    return;
  }
  if (typeof charName !== "string" || !charName) {
    res.status(400).json({ error: "charName is required" });
    return;
  }
  if (!Number.isInteger(charLevel) || charLevel < 1) {
    res.status(400).json({ error: "charLevel must be a positive integer" });
    return;
  }
  if (typeof appVersion !== "string" || !appVersion) {
    res.status(400).json({ error: "appVersion is required" });
    return;
  }
  if (typeof buildData !== "object" || buildData === null) {
    res.status(400).json({ error: "buildData must be an object" });
    return;
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE characterBuild
       SET charName = ?, charLevel = ?, description = ?, appVersion = ?, buildData = ?, updateBy = ?
       WHERE characterBuildId = ? AND userId = ?`,
      [charName, charLevel, description ?? null, appVersion, JSON.stringify(buildData),
        SERVICE_IDENTITY, characterBuildId, userId]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ characterBuildId });
  } catch (err) {
    next(err);
  }
});

characterBuildsRouter.get("/", async (req, res, next) => {
  const userId = parseUserId(req.query.userId);
  if (userId === null) {
    res.status(400).json({ error: "userId query parameter must be a positive integer" });
    return;
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT characterBuildId, charName, charLevel, description, updateDate
       FROM characterBuild WHERE userId = ? ORDER BY updateDate DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

characterBuildsRouter.get("/:id", async (req, res, next) => {
  const characterBuildId = Number(req.params.id);
  const userId = parseUserId(req.query.userId);

  if (!Number.isInteger(characterBuildId)) {
    res.status(400).json({ error: "characterBuildId must be an integer" });
    return;
  }
  if (userId === null) {
    res.status(400).json({ error: "userId query parameter must be a positive integer" });
    return;
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT characterBuildId, charName, charLevel, description, appVersion, buildData, updateDate
       FROM characterBuild WHERE characterBuildId = ? AND userId = ?`,
      [characterBuildId, userId]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

characterBuildsRouter.delete("/:id", async (req, res, next) => {
  const characterBuildId = Number(req.params.id);
  const userId = parseUserId(req.body?.userId ?? req.query.userId);

  if (!Number.isInteger(characterBuildId)) {
    res.status(400).json({ error: "characterBuildId must be an integer" });
    return;
  }
  if (userId === null) {
    res.status(400).json({ error: "userId must be a positive integer" });
    return;
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM characterBuild WHERE characterBuildId = ? AND userId = ?",
      [characterBuildId, userId]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
