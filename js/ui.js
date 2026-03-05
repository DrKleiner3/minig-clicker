// js/ui.js
// Statusleisten-Logik: Timer, Gold-, Level- und Stage-Anzeige
// Phase 3.0: "Steine bis Level-Up" nutzt echten Stein-Progress

import {
  getGold,
  getTimeLeft,
  setTimeLeft,

  // Level-Progress
  getStonesToNextLevel,

  // Boost / Regen
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
  return Boolean(window.__mc_isBossRound);
}

/* ---------- Public API ---------- */

export function updateGoldDisplay() {
  const el = document.getElementById("goldDisplay");
  if (!el) return;
  el.textContent = `Gold: ${Math.floor(getGold())}`;
}

export function updateLevelInfo() {
  const el = document.getElementById("levelInfo");
  if (!el) return;

  const remainingStones = Math.max(0, Math.ceil(getStonesToNextLevel()));
  el.textContent = `Steine bis Level-Up: ${remainingStones}`;
}

/* ---------- BOOST PANEL ---------- */

export function updateBoostPanel() {
  const list = document.getElementById("boostList");
  if (!list) return;

  const regen = getGoldRegenPerSec();
  const boosts = getActiveBoosts();

  const lines = [];
  lines.push(`Gold Regen: ${regen}`);

for (const b of boosts) {

  const pct =
    (b.type === "gold" || b.type === "damage")
      ? `${Math.round(b.magnitude * 100)}%`
      : `${b.magnitude}`;

  lines.push(`${b.type}: ${pct} (${b.remainingSec}s)`);

}

  list.innerHTML = lines.map(t => `<div>${t}</div>`).join("");
}

/* ---------- STAGE INFO ---------- */

export function updateStageInfo(stage, markBoss) {
  const el = document.getElementById("stageInfo");
  if (!el) return;

  const valid = (typeof stage === "number" && stage > 0);
  const boss = (typeof markBoss === "boolean") ? markBoss : isBossRoundActive();

  const base = valid ? `Stage: ${stage}` : "Stage: –";
  el.textContent = boss && valid ? `${base} (Boss)` : base;
}

/* ---------- TIMER ---------- */

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

/* ---------- STAGE SLOT AUTO CREATE ---------- */

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

  const gold = document.getElementById("goldDisplay");
  if (gold && gold.parentElement === bar) {
    insertAfter(stage, gold);
  } else {
    bar.appendChild(stage);
  }
}

/* ---------- BOOST PANEL AUTO CREATE ---------- */

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

/* ---------- INIT ---------- */

document.addEventListener("DOMContentLoaded", () => {
  ensureStageSlot();
  ensureBoostPanel();

  updateStageInfo();
  updateBoostPanel();
});

