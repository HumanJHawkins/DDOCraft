import { Router } from "express";
import { pool } from "../db";

export const referenceRouter = Router();

referenceRouter.get("/bonus-types", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT bonusTypeId, bonusTypeName FROM bonusType ORDER BY bonusTypeName"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

referenceRouter.get("/augment-colors", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT augmentColorId, augmentColorName FROM augmentColor ORDER BY augmentColorName"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

referenceRouter.get("/character-classes", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT characterClassId, className, parentClassId
       FROM characterClass ORDER BY characterClassSortOrder, className`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
