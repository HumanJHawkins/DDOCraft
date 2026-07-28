import { Router } from "express";
import { pool } from "../db";

export const effectsRouter = Router();

effectsRouter.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.effectId, e.effectName, e.effectKey, e.effectGroup, e.effectDescription,
              e.minLevelCannith, e.minLevelAugment, bt.bonusTypeName
       FROM effect e
       LEFT JOIN bonusType bt ON bt.bonusTypeId = e.bonusTypeId
       ORDER BY e.effectSortOrder, e.effectName`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

effectsRouter.get("/:id/bonus", async (req, res, next) => {
  const effectId = Number(req.params.id);
  if (!Number.isInteger(effectId)) {
    res.status(400).json({ error: "effectId must be an integer" });
    return;
  }
  try {
    const [rows] = await pool.query(
      "SELECT deliveryType, level, bonus FROM effectBonusByLevel WHERE effectId = ? ORDER BY deliveryType, level",
      [effectId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
