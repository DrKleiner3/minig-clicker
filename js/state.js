// js/state.js
// Zentraler, gemeinsam genutzter Spielzustand
// Phase 3.0: Level/Stein-Progress + Boost/GoldRegen-Grundlage (nur Logik)
// (Kompatibel zu bestehenden Modulen – keine Layout-/Design-Änderungen)

///////////////////////////////
// Konstanten
///////////////////////////////
export const TILE_SIZE = 64;

export let MAP_WIDTH = 12;
export let MAP_HEIGHT = 13;

export const AOE_INTERVAL_MS = 200;

// (Wird von der alten Anzeige genutzt; UI wird in Phase 3.0 ersetzt)
export const LEVEL_THRESHOLD = 1000;

// Rundenlänge
export const ROUND_TIME = 30;

// Upgrade-Caps (Phase 2.1)
export const MAX_RADIUS = 25;
export const MAX_AMOUNT = 101;

// NEU: Level-/Boost-Parameter (Phase 3.0)
export const STONE_LV_BASE = 40;      // Basis-Steine für Level 1 → 2
export const STONE_LV_GROWTH = 1.18;   // exponentielles Wachstum pro Level
export const BOOST_TICK_MS = 1000;     // Boost-/Regen-Tick (1s)

///////////////////////////////
// DOM-/Runtime-Referenzen
///////////////////////////////
export const tiles = [];
export const gameArea = (typeof document !== "undefined")
  ? document.getElementById("game")
  : null;

///////////////////////////////
// Save laden (robust)
///////////////////////////////
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

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

///////////////////////////////
// Biome
///////////////////////////////
export let biome =
  (saveData && typeof saveData.biome === "string") ? saveData.biome : "gras";

export function setBiome(v) {
  biome = String(v || "gras");
}

///////////////////////////////
// Upgrades (merge & cast)
///////////////////////////////
const DEFAULT_UPGRADES = { radius: 1, damage: 0, amount: 0, goldBoost: 0 };

export let upgrades = {
  ...DEFAULT_UPGRADES,
  ...(saveData && typeof saveData.upgrades === "object" ? saveData.upgrades : {})
};
for (const k of Object.keys(DEFAULT_UPGRADES)) {
  upgrades[k] = toNum(upgrades[k], DEFAULT_UPGRADES[k]);
}

///////////////////////////////
// Gold
///////////////////////////////
let gold = toNum(saveData?.gold, 0);
export function getGold() { return gold; }
export function setGold(v) { gold = toNum(v, 0); }

///////////////////////////////
// Rundentimer
///////////////////////////////
let timeLeft =
  (typeof saveData?.remainingTime === "number" && saveData.remainingTime > 0)
    ? Math.floor(saveData.remainingTime)
    : ROUND_TIME;

export function getTimeLeft() { return timeLeft; }
export function setTimeLeft(v) {
  timeLeft = Math.max(0, Math.floor(toNum(v, 0)));
}

///////////////////////////////
// Stage
///////////////////////////////
let stage = Math.max(1, Math.floor(toNum(saveData?.stage, 1)));
export function getStage() { return stage; }
export function setStage(n) {
  stage = Math.max(1, Math.floor(toNum(n, 1)));
  return stage;
}

///////////////////////////////
// Steine-Tracking für Stage-Ende
///////////////////////////////
let stonesRemaining = 0;
export function getStonesRemaining() { return stonesRemaining; }
export function setStonesRemaining(n) {
  stonesRemaining = Math.max(0, Math.floor(toNum(n, 0)));
  return stonesRemaining;
}
export function decStonesRemaining(delta = 1) {
  stonesRemaining = Math.max(0, stonesRemaining - Math.max(1, Math.floor(toNum(delta, 1))));
  return stonesRemaining;
}

///////////////////////////////
// (Optional) Map-Resize-Helper
///////////////////////////////
export function setMapSize(w, h) {
  const W = Math.max(1, Math.floor(toNum(w, MAP_WIDTH)));
  const H = Math.max(1, Math.floor(toNum(h, MAP_HEIGHT)));
  MAP_WIDTH = W;
  MAP_HEIGHT = H;
}

///////////////////////////////
// === NEU: Level-/Boost-System (Phase 3.0) ===
///////////////////////////////

// Level & Stein-Progress
let level = Math.max(1, Math.floor(toNum(saveData?.level, 1)));
let stonesThisRound = 0;                          // wird pro Runde neu befüllt
let stonesTotal = Math.max(0, Math.floor(toNum(saveData?.stonesTotal, 0)));

// Passive Gold-Regeneration (nur in Spielwelt tickend)
let goldRegenPerSec = Math.max(0, toNum(saveData?.goldRegenPerSec ?? saveData?.pendingGoldRegen, 0));

// Zeitlich begrenzte Boosts (laufen nur in Spielwelt)
let activeBoosts = Array.isArray(saveData?.activeBoosts)
  ? saveData.activeBoosts
      .map(b => ({
        type: String(b?.type || ""),
        magnitude: toNum(b?.magnitude, 0),
        remainingSec: Math.max(0, Math.floor(toNum(b?.remainingSec, 0))),
      }))
      .filter(b => b.type && b.remainingSec > 0)
  : [];

// ——— Level-Getter/Setter ———
export function getLevel() { return level; }
export function setLevel(v) {
  level = Math.max(1, Math.floor(toNum(v, 1)));
  return level;
}

// ——— Stein-Progress-APIs ———
export function getStonesThisRound() { return stonesThisRound; }
export function getStonesTotal() { return stonesTotal; }

/** Zählt Steine hoch (wird beim Abbau aufgerufen). */
export function incStonesCounters(delta = 1) {
  const d = Math.max(1, Math.floor(toNum(delta, 1)));
  stonesThisRound += d;
  stonesTotal += d;
  return { stonesThisRound, stonesTotal };
}

/** Zu Rundenbeginn zurücksetzen. */
export function resetStonesThisRound() {
  stonesThisRound = 0;
  return stonesThisRound;
}

// ——— Level-Schwellen ———
export function stonesNeededForLevel(lvl = level) {
  const L = Math.max(1, Math.floor(toNum(lvl, level)));
  return Math.ceil(STONE_LV_BASE * Math.pow(STONE_LV_GROWTH, L - 1));
}
export function getStonesToNextLevel() {
  return Math.max(0, stonesNeededForLevel(level) - stonesThisRound);
}

// ——— Boost-/Regen-APIs ———
export function getGoldRegenPerSec() { return goldRegenPerSec; }
export function setGoldRegenPerSec(v) { goldRegenPerSec = Math.max(0, toNum(v, 0)); return goldRegenPerSec; }

export function getActiveBoosts() {
  // Rückgabe als Kopie (keine Mutationen nach außen)
  return activeBoosts.map(b => ({ ...b }));
}

/**
 * Fügt einen zeitlich begrenzten Boost hinzu.
 * @param {"damage"|"gold"|"radius"} type
 * @param {number} magnitude  z. B. 0.5 für +50% (damage/gold) oder +3 (radius)
 * @param {number} durationSec Laufzeit in Sekunden
 */
export function addBoost(type, magnitude, durationSec) {
  const t = String(type || "");
  if (!t) return false;
  const m = toNum(magnitude, 0);
  const s = Math.max(1, Math.floor(toNum(durationSec, 0)));
  activeBoosts.push({ type: t, magnitude: m, remainingSec: s });
  return true;
}

/**
 * Tick-Funktion: reduziert Boost-Zeiten und addiert Gold-Regen.
 * (Aufruf nur während Spielwelt; game.js startet/stopp diesen Tick.)
 */
export function tickBoostsAndRegen(deltaSec = 1) {
  // Gold-Regen
  const g = toNum(goldRegenPerSec, 0) * Math.max(0, toNum(deltaSec, 1));
  if (g > 0) setGold(getGold() + g);

  // Boost-Zeiten
  if (activeBoosts.length) {
    for (const b of activeBoosts) {
      b.remainingSec = Math.max(0, b.remainingSec - Math.max(0, Math.floor(deltaSec)));
    }
    // Abgelaufene entfernen
    activeBoosts = activeBoosts.filter(b => b.remainingSec > 0);
  }
}

/**
 * Liefert Effekt-Multiplikatoren für Schaden/Gold und Bonus für Radius
 * basierend auf aktiven Boosts. (Mining/Anzeige können diese nutzen.)
 */
export function getEffectiveDamageMultiplier() {
  let mult = 1;
  for (const b of activeBoosts) if (b.type === "damage") mult *= (1 + toNum(b.magnitude, 0));
  return mult;
}
export function getEffectiveGoldMultiplier() {
  let mult = 1;
  for (const b of activeBoosts) if (b.type === "gold") mult *= (1 + toNum(b.magnitude, 0));
  return mult;
}
export function getRadiusTemporaryBonus() {
  // Summe additiver Radiusstufen (wird mit MAX_RADIUS geclamped, wenn genutzt)
  let bonus = 0;
  for (const b of activeBoosts) if (b.type === "radius") bonus += toNum(b.magnitude, 0);
  return bonus;
}

/**
 * Hebt das Level an, vergibt Standard-Belohnungen:
 * - +0.5 Gold/s Regeneration (nur in Spielwelt wirksam)
 * - einen zufälligen Boost:
 *   damage +50% 10s  ODER  gold +50% 10s  ODER  radius +3 8s
 * Gibt das neue Level zurück.
 */
export function grantLevelUp() {
  level += 1;

  // Gold-Regen erhöhen
  goldRegenPerSec = Math.max(0, goldRegenPerSec + 0.5);

  // Zufallsboost
  const r = Math.random();
  if (r < 1/3) {
    addBoost("damage", 0.5, 10);
  } else if (r < 2/3) {
    addBoost("gold", 0.5, 10);
  } else {
    addBoost("radius", 3, 8); // Anwendung muss später MAX_RADIUS berücksichtigen
  }

  return level;
}

/**
 * Prüft, ob genug Steine für einen Level-Up vorhanden sind,
 * und wendet ggf. mehrfach Level-Ups an (falls große Sprünge).
 * @returns {number} Anzahl der durchgeführten Level-Ups
 */
export function tryLevelUp() {
  let ups = 0;
  while (stonesThisRound >= stonesNeededForLevel(level)) {
    stonesThisRound -= stonesNeededForLevel(level);
    grantLevelUp();
    ups++;
  }
  return ups;
}

/**
 * Liefert ein Patch-Objekt mit allen 3.0-Feldern für das Speichern.
 * (Kann von game.js beim Rundenende genutzt werden.)
 */
export function getLevelBoostSavePatch() {
  return {
    level,
    stonesTotal,
    goldRegenPerSec,
    activeBoosts,
  };
}
