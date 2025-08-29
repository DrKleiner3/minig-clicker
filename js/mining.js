// js/mining.js
// Auto-Mining-Logik: Schaden in Radius, HP-Bar-Update, Effekte, Gold-Gewinn,
// Steinzähler-Dekrement + korrekte Effekt-Positionen.
// Phase 2.1: Runtime-Clamp für Radius (MAX_RADIUS).
// Phase 2.2: Boss-Schaden via boss.js.

import {
  TILE_SIZE,
  tiles,
  upgrades,
  getGold,
  setGold,
  gameArea,
  decStonesRemaining,
  MAX_RADIUS,
} from "./state.js";

import { updateGoldDisplay, updateLevelInfo } from "./ui.js";
import { damageBoss } from "./boss.js";

/* -----------------------------
 * Koordinaten-Helfer
 * --------------------------- */

/** Page-Koordinaten (Viewport + Scroll) der linken/oberen Ecke von #game */
function getGamePageOffset() {
  if (!gameArea) return { left: 0, top: 0 };
  const r = gameArea.getBoundingClientRect();
  return { left: r.left + window.scrollX, top: r.top + window.scrollY };
}

/** Wandelt Page-(x,y) in #game-lokale Koordinaten um */
function pageToGameLocal(px, py) {
  const off = getGamePageOffset();
  return { x: px - off.left, y: py - off.top };
}

/** Mittelpunkt eines Elements in Page-Koordinaten */
function getElementPageCenter(el) {
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width / 2 + window.scrollX,
    y: r.top + r.height / 2 + window.scrollY,
  };
}

/* -----------------------------
 * Effekte
 * --------------------------- */

// Kleine „Staub“-Partikel – erwartet Page-Koordinaten (wird intern konvertiert)
function spawnParticlesAtPage(px, py, count = 5) {
  if (!gameArea) return;
  const local = pageToGameLocal(px, py);
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = `${local.x}px`;
    p.style.top = `${local.y}px`;
    gameArea.appendChild(p);
    p.addEventListener("animationend", () => p.remove());
  }
}

// Kleine Stein-Bruchstücke (Chips) – startet in der Mitte des Elements
function spawnChipsFromElement(el, howMany = 4) {
  if (!gameArea || !el) return;
  const center = getElementPageCenter(el);           // Page-Koordinaten
  const local = pageToGameLocal(center.x, center.y); // in #game umrechnen

  for (let i = 0; i < howMany; i++) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.style.left = `${local.x}px`;
    chip.style.top = `${local.y}px`;

    // Zufällige Flugrichtung
    const dx = (Math.random() * 16 - 8).toFixed(1);   // -8..8px
    const dy = (Math.random() * 20 - 16).toFixed(1);  // -16..4px
    chip.style.setProperty("--dx", `${dx}px`);
    chip.style.setProperty("--dy", `${dy}px`);
    chip.style.setProperty("--chip-spd", `${(0.3 + Math.random() * 0.35).toFixed(2)}s`);

    gameArea.appendChild(chip);
    chip.addEventListener("animationend", () => chip.remove());
  }
}

// Fliegendes Gold-Icon – aus Element-Mitte zur Mitte der Gold-Anzeige
function showGoldFlyFromElement(el) {
  const goldDisplay = document.getElementById("goldDisplay");
  if (!goldDisplay || !el) return;

  // Start (Page)
  const start = getElementPageCenter(el);

  // Ziel (Page)
  const trg = goldDisplay.getBoundingClientRect();
  const targetX = trg.left + trg.width / 2 + window.scrollX;
  const targetY = trg.top + trg.height / 2 + window.scrollY;

  const dx = targetX - start.x;
  const dy = targetY - start.y;

  const fly = document.createElement("div");
  fly.className = "fly-gold";
  fly.style.left = `${start.x}px`;
  fly.style.top = `${start.y}px`;
  fly.style.setProperty("--dx", `${dx}px`);
  fly.style.setProperty("--dy", `${dy}px`);
  fly.textContent = "💰"; // reiner Effekt
  document.body.appendChild(fly);
  fly.addEventListener("animationend", () => fly.remove());
}

/* -----------------------------
 * Kernlogik
 * --------------------------- */

export function autoMine(mouseX, mouseY) {
  // Runtime-Clamp für Radius-Level
  const levelRadius = Math.min(Number(upgrades.radius || 0), MAX_RADIUS);
  const radius = TILE_SIZE * (0.5 + 0.2 * levelRadius);

  // Schaden hängt (wie gehabt) vom Damage-Upgrade ab
  const dmg = 1 + 0.5 * (Number(upgrades.damage || 0));

  tiles.forEach((tile) => {
    // Element im Radius?
    const rect = tile.getBoundingClientRect();
    const dx = rect.left + TILE_SIZE / 2 - mouseX;
    const dy = rect.top + TILE_SIZE / 2 - mouseY;
    if (Math.hypot(dx, dy) > radius) return;

    // 1) Boss priorisieren (Boss-Runde hat typischerweise nur den Boss)
    const bossEl = tile.querySelector(".boss");
    if (bossEl) {
      damageBoss(bossEl, dmg);
      return; // in Boss-Runden reicht das
    }

    // 2) Normale Steine
    const elem = tile.querySelector(".stone");
    if (!elem) return;

    // HP reduzieren
    let hp = Number(elem.dataset.hp || 0);
    const maxHp = Number(elem.dataset.maxHp || hp || 1);

    hp -= dmg;
    elem.dataset.hp = hp;

    // HP-Bar aktualisieren
    const bar = elem.querySelector(".hp-bar");
    if (bar) {
      const ratio = Math.max(0, hp / maxHp);
      bar.style.width = `${ratio * 100}%`;
      // von rot → grün
      bar.style.backgroundColor = `rgb(${Math.floor(255 * (1 - ratio))}, ${Math.floor(255 * ratio)}, 0)`;
    }

    // Hit-Feedback (Shake + Chips)
    elem.classList.add("shake");
    setTimeout(() => elem.classList.remove("shake"), 110);
    spawnChipsFromElement(elem, 3 + Math.floor(Math.random() * 2)); // 3–4 Chips

    // Zerstört?
    if (hp <= 0) {
      // Effekte am Stein (Mitte, korrekt relativ zu #game)
      const c = getElementPageCenter(elem);
      spawnParticlesAtPage(c.x, c.y, 6);
      showGoldFlyFromElement(elem);

      // Gold-Gewinn berechnen
      let gain = Number(elem.dataset.gold || 0);
      gain *= 1 + (Number(upgrades.goldBoost || 0)) * 0.05; // permanenter Boost
      gain *= 1 + Math.random() * 0.2;                      // leichte Varianz

      // Gold setzen + UI aktualisieren
      setGold(getGold() + gain);
      updateGoldDisplay();
      updateLevelInfo();

      // Stein entfernen
      tile.removeChild(elem);

      // Steinzähler runter
      decStonesRemaining(1);
    }
  });
}
