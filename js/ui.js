// js/ui.js
// Statusleisten-Logik: Timer, Gold-, Level- und Stage-Anzeige
// + Boost Panel (Booster: / Gold Regen:)

import {
  getGold,
  getTimeLeft,
  setTimeLeft,

  // Level-Progress
  getStonesToNextLevel,

  // Boost/Regen
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

function insertAfter(newNode, referenceNode) {
  if (!referenceNode || !referenceNode.parentNode) return;
  if (referenceNode.nextSibling) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
  } else {
    referenceNode.parentNode.appendChild(newNode);
  }
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

export function updateStageInfo(stage, markBoss) {
  const el = document.getElementById("stageInfo");
  if (!el) return;

  const valid = typeof stage === "number" && stage > 0;
  const boss = typeof markBoss === "boolean" ? markBoss : isBossRoundActive();
  const base = valid ? `Stage: ${stage}` : "Stage: –";
  el.textContent = boss && valid ? `${base} (Boss)` : base;
}

export function startTimer(onEnd = () => {}) {
  const timerDisplay = document.getElementById("timer");
  if (!timerDisplay) return;

  if (window.__mc_timerInterval) {
    clearInterval(window.__mc_timerInterval);
    window.__mc_timerInterval = null;
  }

  timerDisplay.textContent = `${formatTime(getTimeLeft())}`;

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

/* ---------- Boost Panel ---------- */
export function updateBoostPanel() {
  const list = document.getElementById("boostList");
  if (!list) return;

  const regen = Number(getGoldRegenPerSec() || 0);
  const boosts = getActiveBoosts();

  const lines = [];
  lines.push(`Gold Regen: ${regen.toFixed(1)}`);

  for (const b of boosts) {
    const type = String(b.type || "");
    const rem = Math.max(0, Number(b.remainingSec || 0));

    let val = "";
    if (type === "gold" || type === "damage") {
      val = `${Math.round(Number(b.magnitude || 0) * 100)}%`;
    } else if (type === "radius") {
      val = `${Number(b.magnitude || 0)}`;
    } else {
      val = `${Number(b.magnitude || 0)}`;
    }

    lines.push(`${type}: ${val} (${rem}s)`);
  }

  list.innerHTML = lines.map(t => `<div>${t}</div>`).join("");
}

/* ---------- Auto-create HUD slots ---------- */
function ensureStageSlot() {
  if (document.getElementById("stageInfo")) return;

  const bar = document.querySelector(".statusbar");
  if (!bar) return;

  const stage = document.createElement("span");
  stage.id = "stageInfo";
  stage.textContent = "Stage: –";

  const gold = document.getElementById("goldDisplay");
  if (gold && gold.parentElement === bar) insertAfter(stage, gold);
  else bar.appendChild(stage);
}

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

  updateStageInfo();
  updateBoostPanel();
});
