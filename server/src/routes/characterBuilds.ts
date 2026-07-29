import { Router } from "express";
import { randomUUID, createHash } from "crypto";
import { pool } from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const characterBuildsRouter = Router();

// Phase 1 (no real accounts yet): the caller supplies userId directly - there is no session to
//   derive it from. Phase 2 replaces this with the authenticated user's id from a shared
//   GateIron.com session; every route below already keys off req.body/query userId as if it were
//   trustworthy, so swapping the source later needs no schema or query changes, just a different
//   place to read userId from.
const SERVICE_IDENTITY = "ddocraft_api";

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidGuid(value: unknown): value is string {
  return typeof value === "string" && GUID_PATTERN.test(value);
}

function parseUserId(value: unknown): number | null {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

// Canonicalizes and hashes the parts of a build that make it what it mechanically IS - not who
//   owns it, what it's named, or when it was saved (see db/ddocraft_schema.sql's characterBuild
//   comment for the full reasoning). Two saves with an identical set of choices hash identically
//   regardless of what order those choices were made in, or what the build happens to be called.
function computeBuildChecksum(charLevel: number, buildData: Record<string, any>): string {
  const positional = Array.isArray(buildData.positional) ? buildData.positional : [];
  const inherent = Array.isArray(buildData.inherent) ? buildData.inherent : [];
  const categoryMode = (buildData.categoryMode ?? {}) as Record<string, string>;
  const customItems = (buildData.customItems ?? {}) as Record<string, any>;

  const canonicalPositional = positional
    .map((p: any) => ({ item: p.item, slot: p.slot, color: p.color, enchName: p.enchName }))
    .sort((a: any, b: any) =>
      (a.item + "|" + a.slot + "|" + a.color + "|" + a.enchName)
        .localeCompare(b.item + "|" + b.slot + "|" + b.color + "|" + b.enchName)
    );

  const canonicalInherent = inherent
    .map((i: any) => ({ category: i.category, item: i.item, enchName: i.enchName }))
    .sort((a: any, b: any) =>
      (a.category + "|" + a.item + "|" + a.enchName).localeCompare(b.category + "|" + b.item + "|" + b.enchName)
    );

  // Only "custom" is meaningful - an unset/"cannith" entry is the implicit default, and whether
  //   it happens to be explicitly recorded as "cannith" or simply absent is just toggle history,
  //   not a real difference in the build.
  const canonicalCustomCategories = Object.keys(categoryMode)
    .filter((category) => categoryMode[category] === "custom")
    .sort();

  const canonicalCustomItems = Object.keys(customItems)
    .sort()
    .map((category) => {
      const item = customItems[category] ?? {};
      const augments = Array.isArray(item.augments) ? item.augments : [];
      return {
        category,
        name: item.name ?? "",
        description: item.description ?? "",
        // augment "id" is an arbitrary add-order counter, not meaningful to the build - only the
        //   resulting set of slot colors is.
        augmentColors: augments.map((a: any) => a.color).sort()
      };
    });

  const canonical = {
    charLevel,
    positional: canonicalPositional,
    inherent: canonicalInherent,
    customCategories: canonicalCustomCategories,
    customItems: canonicalCustomItems
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
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

  const characterBuildId = randomUUID();
  const buildChecksum = computeBuildChecksum(charLevel, buildData);

  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO characterBuild
         (characterBuildId, userId, charName, charLevel, description, appVersion, buildData,
          buildChecksum, createBy, updateBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [characterBuildId, userId, charName, charLevel, description ?? null, appVersion,
        JSON.stringify(buildData), buildChecksum, SERVICE_IDENTITY, SERVICE_IDENTITY]
    );
    res.status(201).json({ characterBuildId, buildChecksum });
  } catch (err) {
    next(err);
  }
});

characterBuildsRouter.put("/:id", async (req, res, next) => {
  const characterBuildId = req.params.id;
  const userId = parseUserId(req.body?.userId);
  const { charName, charLevel, description, appVersion, buildData } = req.body ?? {};

  if (!isValidGuid(characterBuildId)) {
    res.status(400).json({ error: "characterBuildId must be a valid GUID" });
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

  const buildChecksum = computeBuildChecksum(charLevel, buildData);

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE characterBuild
       SET charName = ?, charLevel = ?, description = ?, appVersion = ?, buildData = ?,
           buildChecksum = ?, updateBy = ?
       WHERE characterBuildId = ? AND userId = ?`,
      [charName, charLevel, description ?? null, appVersion, JSON.stringify(buildData),
        buildChecksum, SERVICE_IDENTITY, characterBuildId, userId]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ characterBuildId, buildChecksum });
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

// No userId check here, deliberately: characterBuildId is a random, unguessable GUID - knowing it
//   is what grants read access (the same way a Google Docs "anyone with the link" URL works), so
//   this is the one route both a build's own owner AND anyone they've shared the id with can use.
characterBuildsRouter.get("/:id", async (req, res, next) => {
  const characterBuildId = req.params.id;

  if (!isValidGuid(characterBuildId)) {
    res.status(400).json({ error: "characterBuildId must be a valid GUID" });
    return;
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT characterBuildId, charName, charLevel, description, appVersion, buildData,
              buildChecksum, updateDate
       FROM characterBuild WHERE characterBuildId = ?`,
      [characterBuildId]
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
  const characterBuildId = req.params.id;
  const userId = parseUserId(req.body?.userId ?? req.query.userId);

  if (!isValidGuid(characterBuildId)) {
    res.status(400).json({ error: "characterBuildId must be a valid GUID" });
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
