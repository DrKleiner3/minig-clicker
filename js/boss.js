// js/boss.js
// Schlanke Boss-Logik/Factory (Phase 2.2/2.3) – keine Layout-/Design-Änderungen.
// API: enableBossSystem, spawnBoss, damageBoss, isBoss

import {
  getStage,
  getStoneHpMultiplier,
  getGoldMultiplier,
  getBossStageFor,
} from "./stages.js";
import { getGold, setGold, upgrades, TILE_SIZE, gameArea } from "./state.js";
import { updateGoldDisplay, updateLevelInfo } from "./ui.js";

/* ---------------------------------
 * Globale Schalter/Flags (bewusst manuell)
 * --------------------------------*/

/** Map ruft dies auf, sobald Boss-Spawn tatsächlich genutzt wird. */
export function enableBossSystem() {
  window.__mc_bossSystemReady = true;
}

/* ---------------------------------
 * Interne Helfer
 * --------------------------------*/

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function createHpBar() {
  const bar = document.createElement("div");
  bar.className = "hp-bar"; // nutzt bestehendes Styling
  return bar;
}

function updateHpBar(el, hp, maxHp) {
  const bar = el.querySelector(".hp-bar");
  if (!bar) return;
  const ratio = clamp(maxHp > 0 ? hp / maxHp : 0, 0, 1);
  bar.style.width = `${ratio * 100}%`;
  bar.style.backgroundColor = `rgb(${Math.floor(255 * (1 - ratio))}, ${Math.floor(255 * ratio)}, 0)`;
}

function getElementPageCenter(el) {
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width / 2 + window.scrollX,
    y: r.top + r.height / 2 + window.scrollY,
  };
}

// kleine Partikel am gegebenen Punkt (Page-Koordinaten) – relativ zu #game einfügen
function spawnParticlesAtPage(px, py, count = 10) {
  if (!gameArea) return;
  const off = gameArea.getBoundingClientRect();
  const localX = px - (off.left + window.scrollX);
  const localY = py - (off.top + window.scrollY);
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = `${localX}px`;
    p.style.top = `${localY}px`;
    gameArea.appendChild(p);
    p.addEventListener("animationend", () => p.remove());
  }
}

/* ---------------------------------
 * Boss-Sprites – Rotation pro Boss-Block (6/12/18/…)
 * --------------------------------*/
const BOSS_SPRITES = [
  "boss_gold.png",   // z. B. Gold-Boss
  "boss_crystal.png",  // Crystal-Boss
  "boss_lava_violet.png",  // Lava/Violett
  "boss_demon_lava.png",  // Dämon
  "boss_mech.png",  // Maschinen-Boss
];

/** Wählt Boss-Sprite-Datei für die gegebene Stage. */
function getBossSpriteForStage(stage) {
  const bossStage = getBossStageFor(stage);          // 6, 12, 18, ...
  const idx = (Math.ceil(bossStage / 6) - 1) % BOSS_SPRITES.length;
  return BOSS_SPRITES[idx] || BOSS_SPRITES[0];
}

/* ---------------------------------
 * Öffentliche API
 * --------------------------------*/

/**
 * Erzeugt ein Boss-Element und hängt es an containerEl an.
 * @param {HTMLElement} containerEl - z. B. die mittlere Tile des Grids.
 * @param {number} [stage=getStage()] - Stage für Skalierung.
 * @returns {HTMLElement} bossEl
 */
export function spawnBoss(containerEl, stage = getStage()) {
  if (!containerEl) throw new Error("spawnBoss: containerEl fehlt");

  const hpMult = getStoneHpMultiplier(stage);
  const goldMult = getGoldMultiplier(stage);

  // Basiswerte (neutral, später leicht anpassbar)
  const baseHp = 800;
  const baseGold = 300;
  const size = TILE_SIZE; // 64px – keine Designänderung

  const boss = document.createElement("div");
  boss.className = "boss";
  boss.style.width = `${size}px`;
  boss.style.height = `${size}px`;

  // Sprite abhängig vom Boss-Block
  const sprite = getBossSpriteForStage(stage);
  boss.style.backgroundImage = `url('assets/boss/${sprite}')`;
  boss.style.backgroundSize = "cover";

  const hp = baseHp * hpMult;
  const gold = baseGold * goldMult;

  boss.dataset.hp = String(hp);
  boss.dataset.maxHp = String(hp);
  boss.dataset.gold = String(gold);

  boss.appendChild(createHpBar());
  updateHpBar(boss, hp, hp);

  containerEl.appendChild(boss);

  // Markiere, dass eine Boss-Runde läuft (game.js liest dies bereits)
  window.__mc_isBossRound = true;
  window.__mc_bossDefeated = false;

  return boss;
}

/** Kleiner Type-Guard */
export function isBoss(el) {
  return !!(el && el.classList && el.classList.contains("boss"));
}

/**
 * Wendet Schaden am Boss an. Bei 0 HP: Gold gutschreiben, Flag setzen, entfernen.
 * @param {HTMLElement} bossEl
 * @param {number} amount
 */
export function damageBoss(bossEl, amount) {
  if (!isBoss(bossEl)) return;
  let hp = Number(bossEl.dataset.hp || 0);
  const maxHp = Number(bossEl.dataset.maxHp || 1);

  hp -= Math.max(0, Number(amount) || 0);
  bossEl.dataset.hp = String(hp);
  updateHpBar(bossEl, hp, maxHp);

  // kleines Treffer-Feedback
  bossEl.classList.add("shake");
  setTimeout(() => bossEl.classList.remove("shake"), 110);

  if (hp <= 0) {
    onBossDefeated(bossEl);
  }
}

/* ---------------------------------
 * Abschluss bei Boss-Kill
 * --------------------------------*/
function onBossDefeated(bossEl) {
  // Effekte
  const c = getElementPageCenter(bossEl);
  spawnParticlesAtPage(c.x, c.y, 14);

  // Gold gutschreiben (inkl. GoldBoost)
  let gain = Number(bossEl.dataset.gold || 0);
  gain *= 1 + (Number(upgrades.goldBoost || 0)) * 0.05; // permanenter Boost
  gain *= 1 + Math.random() * 0.2;                      // leichte Varianz
  setGold(getGold() + gain);
  updateGoldDisplay();
  updateLevelInfo();

  // Boss entfernen, Sieg markieren
  bossEl.remove();
  window.__mc_bossDefeated = true;
}
