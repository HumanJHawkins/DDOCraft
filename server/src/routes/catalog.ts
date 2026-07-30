import { Router } from "express";
import { pool } from "../db";

export const catalogRouter = Router();

// The client's whole item/slot/color/effect catalog, one bulk fetch, replacing the static
//   ddocraft.json export - see TO DO.md item 1 for the "one endpoint, not several small ones"
//   reasoning. All the actual join logic lives in db/create_catalog_views.sql's vw_catalogFlat -
//   this route is intentionally just SELECT * FROM the view, same pattern as reference.ts's
//   existing routes.
catalogRouter.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM vw_catalogFlat");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
