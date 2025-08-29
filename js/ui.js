// js/ui.js
// Statusleisten-Logik: Timer, Gold-, Level- und Stage-Anzeige
// (keine Layout-/Design-Änderungen; nur Texte & Logik wie besprochen)

import {
  getGold,
  LEVEL_THRESHOLD,
  getTimeLeft,
  setTimeLeft,
} from "./state.js";

/* ---------- Helpers ---------- */
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function isBossRoundActive() {
  // wird in game.js / map.js gesetzt, sobald eine Boss-Runde läuft
  return Boolean(window.__mc_isBossRound);
}

/* ---------- Public API ---------- */
export function updateGoldDisplay() {
  const el = document.getElementById("goldDisplay");
  if (!el) return;
  el.textContent = `Gold: ${Math.floor(getGold())}`;
}

/**
 * Anzeige-Text: "Steine bis Level-Up".
 * Aktuell bleibt die Berechnung noch goldbasiert (LEVEL_THRESHOLD - Gold),
 * bis wir in einer späteren Phase auf echte "Steinziele" umstellen.
 */
export function updateLevelInfo() {
  const el = document.getElementById("levelInfo");
  if (!el) return;
  const remaining = Math.max(0, LEVEL_THRESHOLD - getGold());
  el.textContent = `Steine bis Level-Up: ${Math.ceil(remaining)}`;
}

/**
 * Stage-Anzeige aktualisieren.
 * Wenn gerade eine Boss-Runde aktiv ist, wird "(Boss)" angehängt.
 * Optional kann man per zweitem Argument (boolean) erzwingen, ob Boss markiert wird.
 */
export function updateStageInfo(stage, markBoss) {
  const el = document.getElementById("stageInfo");
  if (!el) return;
  const valid = (typeof stage === "number" && stage > 0);
  const boss = (typeof markBoss === "boolean") ? markBoss : isBossRoundActive();
  const base = valid ? `Stage: ${stage}` : "Stage: –";
  el.textContent = boss && valid ? `${base} (Boss)` : base;
}

/**
 * Startet/neu-startet den Rundentimer.
 * onEnd ist optional; wird nur aufgerufen, wenn es eine Funktion ist.
 */
export function startTimer(onEnd = () => {}) {
  const timerDisplay = document.getElementById("timer");
  if (!timerDisplay) return;

  // ggf. alten Timer stoppen
  if (window.__mc_timerInterval) {
    clearInterval(window.__mc_timerInterval);
    window.__mc_timerInterval = null;
  }

  // erste Anzeige
  timerDisplay.textContent = `${formatTime(getTimeLeft())}`;

  // Ticker
  window.__mc_timerInterval = setInterval(() => {
    const t = getTimeLeft();

    if (t <= 0) {
      clearInterval(window.__mc_timerInterval);
      window.__mc_timerInterval = null;
      if (typeof onEnd === "function") onEnd();
      return;
    }

    setTimeLeft(t - 1);
    timerDisplay.textContent = `${formatTime(getTimeLeft())}`;
  }, 1000);
}

/* ---------- Stage-Platzhalter automatisch einfügen ---------- */
function insertAfter(newNode, referenceNode) {
  if (!referenceNode || !referenceNode.parentNode) return;
  if (referenceNode.nextSibling) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
  } else {
    referenceNode.parentNode.appendChild(newNode);
  }
}

function ensureStageSlot() {
  if (document.getElementById("stageInfo")) return;

  const bar = document.querySelector(".statusbar");
  if (!bar) return;

  const stage = document.createElement("span");
  stage.id = "stageInfo";
  stage.textContent = "Stage: –";

  // Wunsch: Stage rechts neben Gold anzeigen
  const gold = document.getElementById("goldDisplay");
  if (gold && gold.parentElement === bar) {
    insertAfter(stage, gold);
  } else {
    bar.appendChild(stage);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  ensureStageSlot();
  updateStageInfo(); // zeigt "Stage: –" (und ggf. "(Boss)" wenn aktiv und Zahl später gesetzt)
});
