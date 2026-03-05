// js/game.js
// Runden-Orchestrierung: Stage/Biom anwenden, Map bauen, Timer/Mining/Boost-Tick steuern,
// Rundenende speichern → Upgrades.

import {
  TILE_SIZE,
  AOE_INTERVAL_MS,
  upgrades,
  getGold,
  getTimeLeft,
  setBiome as setBiomeState,
  getStonesRemaining,
  MAX_RADIUS,

  // Phase 3.0 – Level/Boost
  BOOST_TICK_MS,
  tickBoostsAndRegen,
  getLevelBoostSavePatch,
  resetStonesThisRound,
} from "./state.js";

import {
  initStageFromSave,
  getStage,
  setStage as setStageStages,
  shouldAdvance,
  isBossStage,
  getBossStageFor,
  getPreBossStageFor,
  getForceBossRound,
  clearForceBossRound,
  recordBossAttempt,
  recordBossDefeat,
} from "./stages.js";

import { getBiomeForStage, applyBiome } from "./biom.js";
import { generateMap } from "./map.js";
import { autoMine } from "./mining.js";

import {
  startTimer,
  updateGoldDisplay,
  updateLevelInfo,
  updateStageInfo,
  updateBoostPanel,
} from "./ui.js";

/* ---------------------------------
 * Laufvariablen
 * --------------------------------*/
let mouseX = 0;
let mouseY = 0;
let rafId = null;
let aoeInterval = null;
let boostInterval = null;
let gameRunning = true;
let isTransitioning = false;

/* ---------------------------------
 * Mausposition tracken
 * --------------------------------*/
document.addEventListener("mousemove", (e) => {
  mouseX = e.pageX;
  mouseY = e.pageY;
});

/* ---------------------------------
 * Ring-Animation (visuell gecappt)
 * --------------------------------*/
function animateRing(radiusCircleEl) {
  const levelRadius = Math.min(Number(upgrades.radius || 0), MAX_RADIUS);
  const radius = TILE_SIZE * (0.5 + 0.2 * levelRadius);
  radiusCircleEl.style.left = `${mouseX - radius}px`;
  radiusCircleEl.style.top = `${mouseY - radius}px`;
  radiusCircleEl.style.width = `${radius * 2}px`;
  radiusCircleEl.style.height = `${radius * 2}px`;
  rafId = requestAnimationFrame(() => animateRing(radiusCircleEl));
}

/* ---------------------------------
 * Rundenende → speichern + Upgrades
 * --------------------------------*/
function endRound(context) {
  if (isTransitioning) return;

  gameRunning = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (aoeInterval) clearInterval(aoeInterval);
  if (boostInterval) clearInterval(boostInterval);
  isTransitioning = true;

  const { baseStage, isBossRound, runStage } = context;
  const stonesLeft = getStonesRemaining();

  let nextStageValue = baseStage;
  const bossSystemReady = Boolean(window.__mc_bossSystemReady);

  if (bossSystemReady && isBossRound) {
    const bossDefeated = Boolean(window.__mc_bossDefeated);
    if (bossDefeated) {
      recordBossDefeat(runStage);
      nextStageValue = runStage + 1;
    } else {
      recordBossAttempt(runStage);
      nextStageValue = getPreBossStageFor(runStage);
    }
    clearForceBossRound();
    setStageStages(nextStageValue, true);
  } else {
    nextStageValue = shouldAdvance(stonesLeft) ? baseStage + 1 : baseStage;
    setStageStages(nextStageValue, true);
  }

  const slotKey = localStorage.getItem("mineclicker_current_slot");
  if (slotKey) {
    try {
      const save = JSON.parse(localStorage.getItem(slotKey) || "{}");
      save.phase = "upgrades";
      save.remainingTime = Math.max(0, getTimeLeft() || 0);
      save.gold = getGold();
      save.upgrades = upgrades;
      save.stage = nextStageValue;
      delete save.startTime;
      save.forceBossRound = false;

      Object.assign(save, getLevelBoostSavePatch());
      localStorage.setItem(slotKey, JSON.stringify(save));
    } catch {
      /* ignore */
    }
  }

  location.href = "upgrades.html";
}

/* ---------------------------------
 * Spielstart
 * --------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
  const slotKey = localStorage.getItem("mineclicker_current_slot");
  if (!slotKey) {
    location.href = "index.html";
    return;
  }

  let save;
  try {
    save = JSON.parse(localStorage.getItem(slotKey) || "{}");
  } catch {
    save = null;
  }

  if (!save || typeof save !== "object") {
    location.href = "index.html";
    return;
  }

  if (save.phase !== "playing") {
    save.phase = "playing";
    save.startTime = Date.now();
    localStorage.setItem(slotKey, JSON.stringify(save));
  }

  const baseStage = initStageFromSave();
  setStageStages(baseStage);

  const bossSystemReady = Boolean(window.__mc_bossSystemReady);
  const forcedBoss = getForceBossRound();
  const baseIsBoss = isBossStage(baseStage);
  const isBossRound = bossSystemReady && (baseIsBoss || forcedBoss);
  const runStage = isBossRound
    ? (baseIsBoss ? baseStage : getBossStageFor(baseStage))
    : baseStage;

  const biome = getBiomeForStage(runStage);
  applyBiome(biome);
  setBiomeState(biome);

  updateGoldDisplay();
  updateLevelInfo();
  updateStageInfo(runStage, isBossRound);
  updateBoostPanel();

  window.__mc_isBossRound = isBossRound;
  window.__mc_bossDefeated = false;
  generateMap();

  resetStonesThisRound();

  const onTimerEnd = () => endRound({ baseStage, isBossRound, runStage });
  startTimer(onTimerEnd);

  aoeInterval = setInterval(() => {
    if (!gameRunning) return;
    autoMine(mouseX, mouseY);

    if (isBossRound && window.__mc_bossDefeated) {
      endRound({ baseStage, isBossRound, runStage });
    }
  }, AOE_INTERVAL_MS);

  boostInterval = setInterval(() => {
    if (!gameRunning) return;

    // Gold-Regen + Boost-Timer
    tickBoostsAndRegen(1);

    // UI
    updateGoldDisplay();
    updateLevelInfo();
    updateBoostPanel();
  }, BOOST_TICK_MS);

  const radiusCircleEl = document.getElementById("radiusCircle");
  if (radiusCircleEl) animateRing(radiusCircleEl);
});

/* ---------------------------------
 * Aufräumen beim Verlassen
 * --------------------------------*/
window.addEventListener("beforeunload", () => {
  if (isTransitioning) return;

  const slotKey = localStorage.getItem("mineclicker_current_slot");
  if (!slotKey) return;

  try {
    const save = JSON.parse(localStorage.getItem(slotKey) || "{}");

    if (window.__mc_isBossRound && !window.__mc_bossDefeated) {
      const cur = getStage();
      const bossStage = isBossStage(cur) ? cur : getBossStageFor(cur);
      recordBossAttempt(bossStage);

      save.phase = "upgrades";
      save.remainingTime = Math.max(0, getTimeLeft() || 0);
      save.gold = getGold();
      save.upgrades = upgrades;
      save.stage = getPreBossStageFor(bossStage);
      save.forceBossRound = false;
      delete save.startTime;

      Object.assign(save, getLevelBoostSavePatch());
      localStorage.setItem(slotKey, JSON.stringify(save));
      return;
    }

    save.phase = "paused";
    save.remainingTime = Math.max(0, getTimeLeft() || 0);
    save.gold = getGold();
    save.upgrades = upgrades;
    save.stage = getStage();

    Object.assign(save, getLevelBoostSavePatch());
    localStorage.setItem(slotKey, JSON.stringify(save));
  } catch {
    /* ignore */
  }
});
