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
      "SELECT namedItemId, category, itemName, itemData FROM namedItem WHERE userId = ? ORDER BY category, itemName",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Upsert by (userId, category, itemName) - "any per-user named item is just saved over the existing
// named item" (names are mutually exclusive per user PER CATEGORY, not per user overall - a real DDO
// named item belongs to one specific equipment slot, see db/ddocraft_schema.sql's namedItem comment).
// No separate create-vs-update distinction the client needs to make: picking an existing name and
// clicking Save overwrites it in place, typing a brand new name creates one.
namedItemsRouter.post("/", async (req, res, next) => {
  const userId = parseUserId(req.body?.userId);
  const { category, itemName, itemData } = req.body ?? {};

  if (userId === null) {
    res.status(400).json({ error: "userId must be a positive integer" });
    return;
  }
  if (typeof category !== "string" || !category.trim()) {
    res.status(400).json({ error: "category is required" });
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
      `INSERT INTO namedItem (userId, category, itemName, itemData, createBy, updateBy)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE itemData = VALUES(itemData), updateBy = VALUES(updateBy)`,
      [userId, category, itemName, JSON.stringify(itemData), SERVICE_IDENTITY, SERVICE_IDENTITY]
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT namedItemId FROM namedItem WHERE userId = ? AND category = ? AND itemName = ?",
      [userId, category, itemName]
    );
    res.json({ namedItemId: rows[0].namedItemId });
  } catch (err) {
    next(err);
  }
});

// A real hard delete, not a soft delete like characterBuild - namedItem has no deletedDate column.
// No undo, matching characterBuild's own DELETE /:id (same honesty: the client confirms with the
// user before ever calling this).
namedItemsRouter.delete("/:id", async (req, res, next) => {
  const namedItemId = Number(req.params.id);
  const userId = parseUserId(req.query.userId);

  if (!Number.isInteger(namedItemId) || namedItemId <= 0) {
    res.status(400).json({ error: "id must be a positive integer" });
    return;
  }
  if (userId === null) {
    res.status(400).json({ error: "userId query parameter must be a positive integer" });
    return;
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM namedItem WHERE namedItemId = ? AND userId = ?",
      [namedItemId, userId]
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
