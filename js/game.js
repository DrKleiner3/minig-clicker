// js/game.js
// Orchestrierung der Runde: Stage laden, Biome anwenden, Map bauen,
// Timer/Mining starten, am Ende speichern & zur Upgrade-Seite wechseln.
// Phase 2.2+: Boss-Flow verdrahtet + (2.3) Ring visuell gecappt & Boss-Sofort-Ende.

import {
  TILE_SIZE,
  AOE_INTERVAL_MS,
  upgrades,
  getGold,
  getTimeLeft,
  setTimeLeft,
  setBiome as setBiomeState,
  getStonesRemaining,
  MAX_RADIUS,                 // <-- neu: für visuellen Ring-Cap
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
import { startTimer, updateGoldDisplay, updateLevelInfo, updateStageInfo } from "./ui.js";

/* ---------------------------------
 * Laufvariablen
 * --------------------------------*/
let mouseX = 0;
let mouseY = 0;
let rafId = null;
let aoeInterval = null;
let gameRunning = true;
let isTransitioning = false; // schützt vor "paused"-Überschreiben beim Seitenwechsel

/* ---------------------------------
 * Mausposition tracken
 * --------------------------------*/
document.addEventListener("mousemove", (e) => {
  mouseX = e.pageX;
  mouseY = e.pageY;
});

/* ---------------------------------
 * Ring-Animation (visuell gecappter Radius)
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
  if (isTransitioning) return; // Mehrfachaufruf verhindern

  // Loops stoppen
  gameRunning = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (aoeInterval) clearInterval(aoeInterval);

  // Seitenwechsel: beforeunload nichts mehr überschreiben lassen
  isTransitioning = true;

  const { baseStage, isBossRound, runStage } = context;
  const stonesLeft = getStonesRemaining();

  let nextStageValue = baseStage;

  // Boss-System nur verwenden, wenn vorhanden (rückwärtskompatibel)
  const bossSystemReady = Boolean(window.__mc_bossSystemReady);

  if (bossSystemReady && isBossRound) {
    const bossDefeated = Boolean(window.__mc_bossDefeated);
    if (bossDefeated) {
      // Boss besiegt -> Sieg registrieren, Stage ++
      recordBossDefeat(runStage);
      nextStageValue = runStage + 1;
    } else {
      // Boss nicht besiegt -> Versuch registrieren, zurück zur Pre-Boss-Stage
      recordBossAttempt(runStage);
      nextStageValue = getPreBossStageFor(runStage);
    }
    // Boss-Flag zurücksetzen (für nächste Runde)
    clearForceBossRound();
    // interne Stage synchron halten
    setStageStages(nextStageValue, true);
  } else {
    // Normaler Flow (Steine-basiert)
    nextStageValue = shouldAdvance(stonesLeft) ? baseStage + 1 : baseStage;
    setStageStages(nextStageValue, true);
  }

  // Save aktualisieren
  const slotKey = localStorage.getItem("mineclicker_current_slot");
  if (slotKey) {
    try {
      const save = JSON.parse(localStorage.getItem(slotKey) || "{}");
      save.phase = "upgrades";
      save.remainingTime = Math.max(0, getTimeLeft() || 0);
      save.gold = getGold();
      save.upgrades = upgrades;
      save.stage = nextStageValue;   // neue/gleiche Stage persistieren
      delete save.startTime;
      // Boss-Run-Status zurücksetzen (Sicherheitsnetz)
      save.forceBossRound = false;
      localStorage.setItem(slotKey, JSON.stringify(save));
    } catch {
      /* ignore */
    }
  }

  // Wechsel ins Upgrade-Menü
  location.href = "upgrades.html";
}

/* ---------------------------------
 * Spielstart
 * --------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
  // Validierung des Save-Kontexts (wie gehabt)
  const slotKey = localStorage.getItem("mineclicker_current_slot");
  if (!slotKey) { location.href = "index.html"; return; }
  try {
    const save = JSON.parse(localStorage.getItem(slotKey));
    if (!save || save.phase !== "playing") {
      location.href = "upgrades.html";
      return;
    }
  } catch {
    location.href = "index.html";
    return;
  }

  // 1) Stage laden & syncen
  const baseStage = initStageFromSave(); // aus stages.js (liest robust aus dem Save)
  setStageStages(baseStage);             // interne stages.js-Variable auf baseStage

  // 2) Boss-Kontext bestimmen (rückwärtskompatibel, erst aktiv wenn boss.js bereit)
  const bossSystemReady = Boolean(window.__mc_bossSystemReady);
  const forcedBoss = getForceBossRound();
  const baseIsBoss = isBossStage(baseStage);

  // Ist diese Runde ein Boss-Run?
  const isBossRound = bossSystemReady && (baseIsBoss || forcedBoss);

  // Welche Stage wird diese Runde tatsächlich gespielt (für UI/Biome)?
  const runStage = isBossRound
    ? (baseIsBoss ? baseStage : getBossStageFor(baseStage))
    : baseStage;

  // 3) Biome pro (run)Stage wählen & anwenden (CSS-Hintergrund) + in state.js hinterlegen
  const biome = getBiomeForStage(runStage);
  applyBiome(biome);
  setBiomeState(biome); // damit map.js den passenden Floor nutzt

  // 4) UI initialisieren
  updateGoldDisplay();
  updateLevelInfo();
  updateStageInfo(runStage, isBossRound); // "(Boss)" Marker wenn Boss-Run

  // 5) Map bauen (setzt intern stonesRemaining)
  window.__mc_isBossRound = isBossRound;
  window.__mc_bossDefeated = false; // wird durch boss.js bei Boss-Kill auf true gesetzt
  generateMap();

  // 6) Timer starten → beim Ablauf endRound()
  const onTimerEnd = () => endRound({ baseStage, isBossRound, runStage });
  startTimer(onTimerEnd);

  // 7) Mining-Loop (+ Boss-Sofort-Ende, falls besiegt)
  aoeInterval = setInterval(() => {
    if (!gameRunning) return;

    autoMine(mouseX, mouseY);

    // Sofortiger Abschluss, wenn Boss in dieser Runde bereits besiegt wurde
    if (isBossRound && window.__mc_bossDefeated) {
      endRound({ baseStage, isBossRound, runStage });
    }
  }, AOE_INTERVAL_MS);

  // 8) Ring-Animation starten
  const radiusCircleEl = document.getElementById("radiusCircle");
  if (radiusCircleEl) animateRing(radiusCircleEl);
});

/* ---------------------------------
 * Aufräumen beim Verlassen
 * --------------------------------*/
window.addEventListener("beforeunload", () => {
  // Bei bewusstem Wechsel ins Upgrade-Menü Save nicht mehr auf "paused" überschreiben
  if (isTransitioning) return;

  gameRunning = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (aoeInterval) clearInterval(aoeInterval);

  // Zwischenstand sichern als "paused"
  const slotKey = localStorage.getItem("mineclicker_current_slot");
  if (slotKey) {
    try {
      const save = JSON.parse(localStorage.getItem(slotKey) || "{}");
      save.phase = "paused";
      save.remainingTime = Math.max(0, getTimeLeft() || 0);
      save.gold = getGold();
      save.upgrades = upgrades;
      save.stage = getStage();
      localStorage.setItem(slotKey, JSON.stringify(save));
    } catch {
      /* noop */
    }
  }
});
