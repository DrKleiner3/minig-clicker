// js/state.js
// Zentraler, gemeinsam genutzter Spielzustand (ohne Redirects/Seiteneffekte)

export const TILE_SIZE = 64;

// Aktuelle Grid-Abmessungen (müssen mit dem CSS-Grid übereinstimmen)
export let MAP_WIDTH = 12;
export let MAP_HEIGHT = 13;

// Takte/Schwellen
export const AOE_INTERVAL_MS = 200;
export const LEVEL_THRESHOLD = 1000;
export const ROUND_TIME = 30;

// --- Neu in Phase 2.1: Caps für Upgrades ---
export const MAX_RADIUS = 25;  // maximaler Radius-Level
export const MAX_AMOUNT = 101; // maximaler "Mehr Steine"-Level

// Tiles-Sammlung (wird in map.js befüllt)
export const tiles = [];

// Spielfeld-Referenz (kann außerhalb von game.html null sein)
export const gameArea = typeof document !== "undefined"
  ? document.getElementById("game")
  : null;

// Aktueller Slot + Save laden (kein Redirect hier; Seiten regeln das selbst)
export const slotKey = (typeof localStorage !== "undefined")
  ? localStorage.getItem("mineclicker_current_slot")
  : null;

let saveData = null;
try {
  saveData = (slotKey && typeof localStorage !== "undefined")
    ? JSON.parse(localStorage.getItem(slotKey))
    : null;
} catch {
  saveData = null;
}

/* -----------------------------
 * Biome
 * --------------------------- */
export let biome =
  (saveData && typeof saveData.biome === "string") ? saveData.biome : "gras";

export function setBiome(v) {
  biome = String(v || "gras");
}

/* -----------------------------
 * Upgrades (robust mergen & casten)
 * --------------------------- */
const DEFAULT_UPGRADES = { radius: 1, damage: 0, amount: 0, goldBoost: 0 };

export let upgrades = {
  ...DEFAULT_UPGRADES,
  ...(saveData && typeof saveData.upgrades === "object" ? saveData.upgrades : {})
};

for (const k of Object.keys(DEFAULT_UPGRADES)) {
  const n = Number(upgrades[k]);
  upgrades[k] = Number.isFinite(n) ? n : DEFAULT_UPGRADES[k];
}

/* -----------------------------
 * Gold (immer numerisch)
 * --------------------------- */
let gold = Number(saveData?.gold ?? 0);
if (!Number.isFinite(gold)) gold = 0;

export function getGold() { return gold; }
export function setGold(v) { gold = Number(v) || 0; }

/* -----------------------------
 * Rundentimer (Restzeit)
 * --------------------------- */
let timeLeft =
  (typeof saveData?.remainingTime === "number" && saveData.remainingTime > 0)
    ? Math.floor(saveData.remainingTime)
    : ROUND_TIME;

export function getTimeLeft() { return timeLeft; }
export function setTimeLeft(v) {
  timeLeft = Math.max(0, Math.floor(Number(v) || 0));
}

/* -----------------------------
 * Stage (Phase 2.0)
 * --------------------------- */
let stage = Math.max(1, Math.floor(Number(saveData?.stage ?? 1) || 1));

export function getStage() { return stage; }
export function setStage(n) {
  stage = Math.max(1, Math.floor(Number(n) || 1));
  return stage;
}

/* -----------------------------
 * Steine-Tracking (Phase 2.0)
 * --------------------------- */
let stonesRemaining = 0;

export function getStonesRemaining() { return stonesRemaining; }
export function setStonesRemaining(n) {
  stonesRemaining = Math.max(0, Math.floor(Number(n) || 0));
  return stonesRemaining;
}
export function decStonesRemaining(delta = 1) {
  stonesRemaining = Math.max(0, stonesRemaining - Math.max(1, Math.floor(Number(delta) || 1)));
  return stonesRemaining;
}

/* -----------------------------
 * (Optional) Map-Resize-Helper
 * --------------------------- */
export function setMapSize(w, h) {
  const W = Math.max(1, Math.floor(Number(w) || MAP_WIDTH));
  const H = Math.max(1, Math.floor(Number(h) || MAP_HEIGHT));
  MAP_WIDTH = W;
  MAP_HEIGHT = H;
}
