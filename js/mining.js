// js/mining.js
// Auto-Mining: AoE-Schaden, HP-Bar, Effekte, Gold-Gewinn,
// Steinzähler + LevelUp/Boost-Integration (Phase 3.0),
// Boss-Schaden (Phase 2.2) und Positions-Fixes.

import {
  TILE_SIZE,
  tiles,
  upgrades,
  getGold,
  setGold,
  gameArea,
  decStonesRemaining,
  MAX_RADIUS,

  // Phase 3.0 – Level/Boosts:
  incStonesCounters,
  tryLevelUp,
  getEffectiveDamageMultiplier,
  getEffectiveGoldMultiplier,
  getRadiusTemporaryBonus,
} from "./state.js";

import { updateGoldDisplay, updateLevelInfo } from "./ui.js";
import { damageBoss } from "./boss.js";

/* -----------------------------
 * Koordinaten-Helfer
 * --------------------------- */

function getGamePageOffset() {
  if (!gameArea) return { left: 0, top: 0 };
  const r = gameArea.getBoundingClientRect();
  return { left: r.left + window.scrollX, top: r.top + window.scrollY };
}

function pageToGameLocal(px, py) {
  const off = getGamePageOffset();
  return { x: px - off.left, y: py - off.top };
}

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

function spawnChipsFromElement(el, howMany = 4) {
  if (!gameArea || !el) return;
  const center = getElementPageCenter(el);
  const local = pageToGameLocal(center.x, center.y);

  for (let i = 0; i < howMany; i++) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.style.left = `${local.x}px`;
    chip.style.top = `${local.y}px`;

    const dx = (Math.random() * 16 - 8).toFixed(1);   // -8..8
    const dy = (Math.random() * 20 - 16).toFixed(1);  // -16..4
    chip.style.setProperty("--dx", `${dx}px`);
    chip.style.setProperty("--dy", `${dy}px`);
    chip.style.setProperty("--chip-spd", `${(0.3 + Math.random() * 0.35).toFixed(2)}s`);

    gameArea.appendChild(chip);
    chip.addEventListener("animationend", () => chip.remove());
  }
}

function showGoldFlyFromElement(el) {
  const goldDisplay = document.getElementById("goldDisplay");
  if (!goldDisplay || !el) return;

  const start = getElementPageCenter(el);
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
  fly.textContent = "💰";
  document.body.appendChild(fly);
  fly.addEventListener("animationend", () => fly.remove());
}

/* -----------------------------
 * Kernlogik
 * --------------------------- */

export function autoMine(mouseX, mouseY) {
  // Radius-Level inkl. temporärem Bonus, dann hart cappen
  const tempRadiusBonus = Math.max(0, Number(getRadiusTemporaryBonus() || 0));
  const clampedRadiusLevel = Math.min(
    Number(upgrades.radius || 0) + tempRadiusBonus,
    MAX_RADIUS
  );
  const radius = TILE_SIZE * (0.5 + 0.2 * clampedRadiusLevel);

  // Schaden: Basis * aktive Damage-Boosts
  const baseDamage = 1 + 0.5 * (Number(upgrades.damage || 0));
  const damage = baseDamage * Math.max(1, Number(getEffectiveDamageMultiplier() || 1));

  // Gold-Mult: permanente + aktive Boosts
  const goldMultPermanent = 1 + (Number(upgrades.goldBoost || 0)) * 0.05;
  const goldMultActive = Math.max(1, Number(getEffectiveGoldMultiplier() || 1));

  tiles.forEach((tile) => {
    const rect = tile.getBoundingClientRect();
    const dx = rect.left + TILE_SIZE / 2 - mouseX;
    const dy = rect.top + TILE_SIZE / 2 - mouseY;
    if (Math.hypot(dx, dy) > radius) return;

    // Boss priorisieren
    const bossEl = tile.querySelector(".boss");
    if (bossEl) {
      damageBoss(bossEl, damage);
      return;
    }

    // Normale Steine
    const elem = tile.querySelector(".stone");
    if (!elem) return;

    let hp = Number(elem.dataset.hp || 0);
    const maxHp = Number(elem.dataset.maxHp || hp || 1);

    hp -= damage;
    elem.dataset.hp = hp;

    const bar = elem.querySelector(".hp-bar");
    if (bar) {
      const ratio = Math.max(0, hp / maxHp);
      bar.style.width = `${ratio * 100}%`;
      bar.style.backgroundColor = `rgb(${Math.floor(255 * (1 - ratio))}, ${Math.floor(255 * ratio)}, 0)`;
    }

    // Treffer-Feedback
    elem.classList.add("shake");
    setTimeout(() => elem.classList.remove("shake"), 110);
    spawnChipsFromElement(elem, 3 + Math.floor(Math.random() * 2)); // 3–4 Chips

    if (hp <= 0) {
      // Effekte am Stein (korrekte Position relativ zu #game)
      const c = getElementPageCenter(elem);
      spawnParticlesAtPage(c.x, c.y, 6);
      showGoldFlyFromElement(elem);

      // Gold
      let gain = Number(elem.dataset.gold || 0);
      gain *= goldMultPermanent;
      gain *= goldMultActive;
      gain *= 1 + Math.random() * 0.2; // leichte Varianz

      setGold(getGold() + gain);
      updateGoldDisplay();

      // Stein entfernen
      tile.removeChild(elem);
      decStonesRemaining(1);

      // Steinzähler + LevelUp-Check (Phase 3.0)
      incStonesCounters(1);
      const ups = tryLevelUp();
      if (ups > 0) {
        // Bis die UI umgestellt ist, bleibt updateLevelInfo() bestehen.
        // (In der nächsten Datei-Änderung passen wir ui.js an, damit
        //  „Steine bis Level-Up“ die echte Restmenge zeigt.)
        updateLevelInfo();
      } else {
        // Auch ohne LevelUp kann sich die Restanzeige ändern – bis UI umgestellt ist, aktualisieren wir hier ebenfalls.
        updateLevelInfo();
      }
    }
  });
}
