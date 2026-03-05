// js/ui.js
// Statusleisten-Logik: Timer, Gold-, Level- und Stage-Anzeige
// Phase 3.0: "Steine bis Level-Up" nutzt echten Stein-Progress
// + Boost Panel: Gold Regen + aktive Boosts

import {
  getGold,
  getTimeLeft,
  setTimeLeft,

  // Phase 3.0 – Progress
  getStonesToNextLevel,

  // Boost/Gold-Regen Anzeige
  getGoldRegenPerSec,
  getActiveBoosts,
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
 * Anzeige-Text: "Steine bis Level-Up" basierend auf echtem Stein-Progress.
 */
export function updateLevelInfo() {
  const el = document.getElementById("levelInfo");
  if (!el) return;
  const remainingStones = Math.max(0, Math.ceil(getStonesToNextLevel()));
  el.textContent = `Steine bis Level-Up: ${remainingStones}`;
}

/**
 * Boost Panel rechts: "Booster:" + darunter Gold Regen und aktive Boosts.
 * Erwartet im HTML:
 * <div id="boostPanel"><div class="boostTitle">Booster:</div><div id="boostList"></div></div>
 */
export function updateBoostPanel() {
  const list = document.getElementById("boostList");
  if (!list) return;

  const regen = Number(getGoldRegenPerSec() || 0);
  const boosts = getActiveBoosts();

  const lines = [];
  // Ohne Klammern, wie gewünscht:
  lines.push(`Gold Regen: ${regen}`);

  // Aktive Boosts (optional)
  for (const b of boosts) {
    const type = String(b.type || "");
    const mag = Number(b.magnitude || 0);
    const rem = Math.max(0, Math.floor(Number(b.remainingSec || 0)));

    // Format: damage: 50% 10s  | radius: 3 8s
    const val =
      (type === "gold" || type === "damage")
        ? `${Math.round(mag * 100)}%`
        : `${mag}`;

    lines.push(`${type}: ${val} ${rem}s`);
  }

  list.innerHTML = lines.map(t => `<div>${t}</div>`).join("");
}

/**
 * Stage-Anzeige aktualisieren.
 * Wenn gerade eine Boss-Runde aktiv ist, wird "(Boss)" angehängt.
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

/* ---------- BoostPanel Platzhalter (falls HTML es noch nicht hat) ---------- */
function ensureBoostPanel() {
  if (document.getElementById("boostPanel")) return;

  const panel = document.createElement("div");
  panel.id = "boostPanel";

  const title = document.createElement("div");
  title.className = "boostTitle";
  title.textContent = "Booster:";

  const list = document.createElement("div");
  list.id = "boostList";

  panel.appendChild(title);
  panel.appendChild(list);

  document.body.appendChild(panel);
}

document.addEventListener("DOMContentLoaded", () => {
  ensureStageSlot();
  ensureBoostPanel();
  updateStageInfo();     // "Stage: –" initial
  updateBoostPanel();    // initial render
});
