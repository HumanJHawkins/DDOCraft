import { Router } from "express";
import { pool } from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const namedItemsRouter = Router();

// Same phase-1-no-real-accounts trust model as characterBuilds.ts - see its SERVICE_IDENTITY
// comment for the full reasoning.
const SERVICE_IDENTITY = "ddocraft_api";

function parseUserId(value: unknown): number | null {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

// Lists the current user's named-item library, alphabetically - the client's combo box datalist
// is populated straight from this (see ddocraft.js's loadNamedItems()).
namedItemsRouter.get("/", async (req, res, next) => {
  const userId = parseUserId(req.query.userId);
  if (userId === null) {
    res.status(400).json({ error: "userId query parameter must be a positive integer" });
    return;
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT namedItemId, itemName, itemData FROM namedItem WHERE userId = ? ORDER BY itemName",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Upsert by (userId, itemName) - "any per-user named item is just saved over the existing named
// item" (names are mutually exclusive per user, see db/ddocraft_schema.sql's namedItem comment).
// No separate create-vs-update distinction the client needs to make: picking an existing name and
// clicking Save overwrites it in place, typing a brand new name creates one.
namedItemsRouter.post("/", async (req, res, next) => {
  const userId = parseUserId(req.body?.userId);
  const { itemName, itemData } = req.body ?? {};

  if (userId === null) {
    res.status(400).json({ error: "userId must be a positive integer" });
    return;
  }
  if (typeof itemName !== "string" || !itemName.trim()) {
    res.status(400).json({ error: "itemName is required" });
    return;
  }
  if (typeof itemData !== "object" || itemData === null) {
    res.status(400).json({ error: "itemData must be an object" });
    return;
  }

  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO namedItem (userId, itemName, itemData, createBy, updateBy)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE itemData = VALUES(itemData), updateBy = VALUES(updateBy)`,
      [userId, itemName, JSON.stringify(itemData), SERVICE_IDENTITY, SERVICE_IDENTITY]
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT namedItemId FROM namedItem WHERE userId = ? AND itemName = ?",
      [userId, itemName]
    );
    res.json({ namedItemId: rows[0].namedItemId });
  } catch (err) {
    next(err);
  }
});
