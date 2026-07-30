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

// Plain count of selected options/effects - one per occupied slot plus one per selected inherent
//   effect. Both are already flat arrays in buildData (see ddocraft.js's updateSave()), so this is
//   just their combined length - no need to walk the canonicalization above for a simple count.
function countEffects(buildData: Record<string, any>): number {
  const positional = Array.isArray(buildData.positional) ? buildData.positional : [];
  const inherent = Array.isArray(buildData.inherent) ? buildData.inherent : [];
  return positional.length + inherent.length;
}

// How many fewer selections trigger an overwrite confirmation instead of proceeding silently.
const OVERWRITE_CONFIRMATION_DROP_THRESHOLD = 5;

characterBuildsRouter.post("/", async (req, res, next) => {
  const userId = parseUserId(req.body?.userId);
  const { charName, charLevel, description, appVersion, buildData, confirmOverwrite } = req.body ?? {};

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
  const effectCount = countEffects(buildData);

  try {
    // buildChecksum alone deliberately ignores charName (see its schema comment - it's meant to
    //   recognize the same BUILD regardless of who made it or what they called it, e.g. across
    //   different users). But for "did the user just click Save again with nothing new to say,"
    //   charName has to count too - a mechanically-identical build saved under a different name is
    //   a deliberate second save (e.g. "Backup" vs "PvP Loadout"), not a duplicate re-save of the
    //   same one. So this match composes both: same owner, same name, same build content.
    const [exactMatch] = await pool.query<RowDataPacket[]>(
      `SELECT characterBuildId FROM characterBuild
       WHERE userId = ? AND charName = ? AND buildChecksum = ? AND deletedDate IS NULL
       ORDER BY updateDate DESC LIMIT 1`,
      [userId, charName, buildChecksum]
    );

    if (exactMatch.length > 0) {
      // Not a bare timestamp touch - description/appVersion can differ even when the build itself
      //   (and its name) didn't, and those still need to be persisted rather than silently dropped.
      const characterBuildId = exactMatch[0].characterBuildId;
      await pool.query<ResultSetHeader>(
        `UPDATE characterBuild
         SET description = ?, appVersion = ?, buildData = ?, buildChecksum = ?, effectCount = ?, updateBy = ?
         WHERE characterBuildId = ?`,
        [description ?? null, appVersion, JSON.stringify(buildData), buildChecksum, effectCount,
          SERVICE_IDENTITY, characterBuildId]
      );
      res.status(200).json({ characterBuildId, buildChecksum, created: false });
      return;
    }

    // Different content saved under a name that already has an active build - this is an
    //   overwrite, not a fresh save. Doesn't literally overwrite: the old row is soft-deleted (see
    //   its schema comment) and a new row is inserted, so the prior version stays recoverable.
    const [nameMatch] = await pool.query<RowDataPacket[]>(
      `SELECT characterBuildId, charLevel, effectCount FROM characterBuild
       WHERE userId = ? AND charName = ? AND deletedDate IS NULL
       ORDER BY updateDate DESC LIMIT 1`,
      [userId, charName]
    );

    if (nameMatch.length > 0) {
      const existing = nameMatch[0];
      const drop = existing.effectCount - effectCount;
      if (!confirmOverwrite && drop >= OVERWRITE_CONFIRMATION_DROP_THRESHOLD) {
        res.status(409).json({
          needsConfirmation: true,
          existingCharName: charName,
          existingCharLevel: existing.charLevel,
          existingEffectCount: existing.effectCount,
          newEffectCount: effectCount
        });
        return;
      }

      // updateDate = updateDate suppresses the column's own ON UPDATE CURRENT_TIMESTAMP - a soft
      //   delete is a status change, not a content change, and letting it bump updateDate anyway
      //   used to tie (or beat) the new row's own timestamp, since DATETIME here has only
      //   whole-second precision and the insert below follows within the same request.
      await pool.query<ResultSetHeader>(
        "UPDATE characterBuild SET deletedDate = NOW(), updateBy = ?, updateDate = updateDate WHERE characterBuildId = ?",
        [SERVICE_IDENTITY, existing.characterBuildId]
      );
    }

    const characterBuildId = randomUUID();
    await pool.query<ResultSetHeader>(
      `INSERT INTO characterBuild
         (characterBuildId, userId, charName, charLevel, description, appVersion, buildData,
          buildChecksum, effectCount, createBy, updateBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [characterBuildId, userId, charName, charLevel, description ?? null, appVersion,
        JSON.stringify(buildData), buildChecksum, effectCount, SERVICE_IDENTITY, SERVICE_IDENTITY]
    );
    res.status(201).json({ characterBuildId, buildChecksum, created: true });
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
  const effectCount = countEffects(buildData);

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE characterBuild
       SET charName = ?, charLevel = ?, description = ?, appVersion = ?, buildData = ?,
           buildChecksum = ?, effectCount = ?, updateBy = ?
       WHERE characterBuildId = ? AND userId = ? AND deletedDate IS NULL`,
      [charName, charLevel, description ?? null, appVersion, JSON.stringify(buildData),
        buildChecksum, effectCount, SERVICE_IDENTITY, characterBuildId, userId]
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
      `SELECT characterBuildId, charName, charLevel, description, effectCount, updateDate
       FROM characterBuild WHERE userId = ? AND deletedDate IS NULL ORDER BY updateDate DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Registered before GET /:id on purpose - Express matches routes in order, and /:id would
//   otherwise swallow "history" as if it were an id.
//
// Every version (active and soft-deleted) of one specific build, newest by updateDate - which is
//   really "newest by last real content change," since soft-delete/rollback deliberately don't
//   touch updateDate (see the overwrite/rollback comments above). The active row isn't guaranteed
//   to sort first here; deletedDate IS NULL is what actually marks it, not position. No userId-vs-
//   ownership ambiguity here despite returning deleted rows too: this is scoped to userId, unlike
//   the unguessable-GUID single-GET below.
characterBuildsRouter.get("/history", async (req, res, next) => {
  const userId = parseUserId(req.query.userId);
  const charName = req.query.charName;

  if (userId === null) {
    res.status(400).json({ error: "userId query parameter must be a positive integer" });
    return;
  }
  if (typeof charName !== "string" || !charName) {
    res.status(400).json({ error: "charName query parameter is required" });
    return;
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT characterBuildId, charName, charLevel, effectCount, deletedDate, updateDate
       FROM characterBuild WHERE userId = ? AND charName = ? ORDER BY updateDate DESC`,
      [userId, charName]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Deactivates whatever is currently active under this build's name and reactivates this one -
//   always exactly a two-row swap, never a rename or a conflict to resolve, because there is
//   always exactly one active row per (userId, charName). Symmetric: rolling back to what was
//   just deactivated undoes a rollback the same way.
characterBuildsRouter.post("/:id/rollback", async (req, res, next) => {
  const characterBuildId = req.params.id;
  const userId = parseUserId(req.body?.userId);

  if (!isValidGuid(characterBuildId)) {
    res.status(400).json({ error: "characterBuildId must be a valid GUID" });
    return;
  }
  if (userId === null) {
    res.status(400).json({ error: "userId must be a positive integer" });
    return;
  }

  try {
    const [target] = await pool.query<RowDataPacket[]>(
      "SELECT charName FROM characterBuild WHERE characterBuildId = ? AND userId = ? AND deletedDate IS NOT NULL",
      [characterBuildId, userId]
    );
    if (target.length === 0) {
      res.status(404).json({ error: "not found (or not currently rolled back)" });
      return;
    }
    const charName = target[0].charName;

    // Both sides of the swap are pure status changes (see the overwrite comment above for why
    //   updateDate is deliberately left alone) - a rolled-back-to version keeps showing when its
    //   content actually last changed, not when someone happened to roll back to it.
    await pool.query<ResultSetHeader>(
      "UPDATE characterBuild SET deletedDate = NOW(), updateBy = ?, updateDate = updateDate WHERE userId = ? AND charName = ? AND deletedDate IS NULL",
      [SERVICE_IDENTITY, userId, charName]
    );
    await pool.query<ResultSetHeader>(
      "UPDATE characterBuild SET deletedDate = NULL, updateBy = ?, updateDate = updateDate WHERE characterBuildId = ?",
      [SERVICE_IDENTITY, characterBuildId]
    );

    res.json({ characterBuildId });
  } catch (err) {
    next(err);
  }
});

// No userId check here, deliberately: characterBuildId is a random, unguessable GUID - knowing it
//   is what grants read access (the same way a Google Docs "anyone with the link" URL works), so
//   this is the one route both a build's own owner AND anyone they've shared the id with can use.
// Still filters out soft-deleted rows - a superseded build shouldn't be reachable via a stale link
//   either.
characterBuildsRouter.get("/:id", async (req, res, next) => {
  const characterBuildId = req.params.id;

  if (!isValidGuid(characterBuildId)) {
    res.status(400).json({ error: "characterBuildId must be a valid GUID" });
    return;
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT characterBuildId, charName, charLevel, description, appVersion, buildData,
              buildChecksum, effectCount, updateDate
       FROM characterBuild WHERE characterBuildId = ? AND deletedDate IS NULL`,
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

// Soft delete only, matching every other list-facing state change in this file - the row still
//   exists afterward, but only reachable via /history if some OTHER version of the same charName
//   is still active. Deleting a build's only version currently leaves it unreachable from the UI.
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
      "UPDATE characterBuild SET deletedDate = NOW(), updateDate = updateDate WHERE characterBuildId = ? AND userId = ? AND deletedDate IS NULL",
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
