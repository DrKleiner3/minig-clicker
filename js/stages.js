// js/stages.js
// Stage-Management + sanfte Skalierung (Phase 2.1) + Boss-Progress (Phase 2.2).
// KEINE Layout-/Design-Änderungen. Persistenz nur gezielt über writeSave().

///////////////////////////////
// Interner State
///////////////////////////////
let stage = 1; // Default, falls nichts im Save steht

///////////////////////////////
// Save-Helfer (robust)
///////////////////////////////
function getSlotKey() {
  try { return localStorage.getItem("mineclicker_current_slot"); }
  catch { return null; }
}

function readSave() {
  const slotKey = getSlotKey();
  if (!slotKey) return null;
  try {
    const raw = localStorage.getItem(slotKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return (data && typeof data === "object") ? data : null;
  } catch {
    return null;
  }
}

function writeSave(patch) {
  const slotKey = getSlotKey();
  if (!slotKey) return false;
  try {
    const base = readSave() || {};
    const next = { ...base, ...patch };
    localStorage.setItem(slotKey, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

///////////////////////////////
// Öffentliche API – Stage-Basis
///////////////////////////////

/** Zu Rundenbeginn aufrufen; lädt Stage aus dem Save. */
export function initStageFromSave() {
  const save = readSave();
  const s = Number(save?.stage ?? 1);
  stage = Number.isFinite(s) && s > 0 ? Math.floor(s) : 1;
  return stage;
}

/** Aktuelle Stage lesen. */
export function getStage() { return stage; }

/** Stage setzen; optional sofort persistieren. */
export function setStage(n, persist = false) {
  const v = Math.max(1, Math.floor(Number(n) || 1));
  stage = v;
  if (persist) writeSave({ stage: v });
  return stage;
}

/** Stage +1; optional sofort persistieren. */
export function nextStage(persist = false) {
  stage = Math.max(1, stage + 1);
  if (persist) writeSave({ stage });
  return stage;
}

/** Boss-Stage? Ab 6, dann jede 6te (6,12,18, …). */
export function isBossStage(s = stage) {
  const v = Math.max(1, Math.floor(Number(s) || stage));
  return v >= 6 && v % 6 === 0;
}

/** Aufstiegskriterium (Phase 2.0/2.1): keine Steine übrig → weiter. */
export function shouldAdvance(stonesRemaining) {
  return Number(stonesRemaining) <= 0;
}

///////////////////////////////
// Skalierung & Grenzen (Phase 2.1)
///////////////////////////////

/** Grid-Größe pro Stage (neutral – keine Layout-Shifts). */
export function getGridSizeForStage(s = stage, baseW = 12, baseH = 13) {
  return { width: baseW, height: baseH };
}

/** Sanfter HP-Multiplikator (+7 % je Stage-Schritt). */
export function getStoneHpMultiplier(s = stage) {
  const v = Math.max(1, Math.floor(Number(s) || stage));
  const mult = 1 + 0.07 * (v - 1);
  return Math.max(1, mult);
}

/** Sanfter Gold-Multiplikator (+6 % je Stage-Schritt). */
export function getGoldMultiplier(s = stage) {
  const v = Math.max(1, Math.floor(Number(s) || stage));
  const mult = 1 + 0.06 * (v - 1);
  return Math.max(1, mult);
}

/** Maximaler Füllgrad der Map (zusätzlicher Spawn-Deckel). */
export function getMaxFillRatio() {
  return 0.80; // 80% der Tiles maximal mit Steinen
}

///////////////////////////////
// Boss-Progress & Boss-Run-Flag (Phase 2.2)
///////////////////////////////

/**
 * Liefert die Boss-Stage für eine gegebene Stage:
 * - Stage 1–5  -> 6
 * - Stage 6    -> 6
 * - Stage 7–11 -> 12
 * - Stage 12   -> 12
 * ...
 */
export function getBossStageFor(s = stage) {
  const v = Math.max(1, Math.floor(Number(s) || stage));
  return Math.ceil(v / 6) * 6;
}

/** Vor-Boss-Stage zu einer Boss-Stage (mind. 1). */
export function getPreBossStageFor(bossStage) {
  const b = Math.max(1, Math.floor(Number(bossStage) || 1));
  return Math.max(1, b - 1);
}

/** Boss-Progress-Objekt aus dem Save holen (oder leeres Objekt). */
export function getBossProgress() {
  const save = readSave();
  const p = save?.bossProgress;
  return (p && typeof p === "object") ? { ...p } : {};
}

/** Hat es für den (zugehörigen) Boss bereits einen Versuch gegeben? */
export function hasBossAttempt(s = stage) {
  const b = String(getBossStageFor(s));
  const p = getBossProgress();
  return Boolean(p[b]?.attempted);
}

/** Wurde der (zugehörige) Boss bereits besiegt? */
export function hasBossDefeat(s = stage) {
  const b = String(getBossStageFor(s));
  const p = getBossProgress();
  return Boolean(p[b]?.defeated);
}

/** Versuch für den (zugehörigen) Boss registrieren (persistiert). */
export function recordBossAttempt(s = stage) {
  const b = String(getBossStageFor(s));
  const base = readSave() || {};
  const prog = (base.bossProgress && typeof base.bossProgress === "object") ? { ...base.bossProgress } : {};
  prog[b] = { ...(prog[b] || {}), attempted: true, defeated: Boolean(prog[b]?.defeated) };
  writeSave({ bossProgress: prog });
  return true;
}

/** Sieg gegen den (zugehörigen) Boss registrieren (persistiert). */
export function recordBossDefeat(s = stage) {
  const b = String(getBossStageFor(s));
  const base = readSave() || {};
  const prog = (base.bossProgress && typeof base.bossProgress === "object") ? { ...base.bossProgress } : {};
  prog[b] = { attempted: true, defeated: true };
  writeSave({ bossProgress: prog });
  return true;
}

/** Boss-Run-Flag lesen (nächste Runde soll Boss sein). */
export function getForceBossRound() {
  const save = readSave();
  return Boolean(save?.forceBossRound);
}

/** Boss-Run-Flag setzen/entfernen (persistiert). */
export function setForceBossRound(flag) {
  writeSave({ forceBossRound: Boolean(flag) });
  return true;
}

/** Boss-Run-Flag abschalten (persistiert). */
export function clearForceBossRound() {
  writeSave({ forceBossRound: false });
  return true;
}

///////////////////////////////
// Komfort
///////////////////////////////
export function persistStageToSave() {
  return writeSave({ stage });
}
