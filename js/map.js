// js/map.js
// Normale Runde: Steine + Tile-Floor
// Boss-Runde: EIN großes Floor-Bild auf #game, Tiles transparent, Boss zentriert.

import {
  TILE_SIZE,           // für die visuelle Korrektur bei geraden Gridmaßen
  MAP_WIDTH,
  MAP_HEIGHT,
  upgrades,
  biome,
  gameArea,
  tiles,
  setStonesRemaining,
  MAX_AMOUNT,
} from "./state.js";

import { getFloorTextureForBiome, normalizeBiome } from "./biom.js";
import {
  getStage,
  getStoneHpMultiplier,
  getGoldMultiplier,
  getMaxFillRatio,
  getBossStageFor,
} from "./stages.js";

import { enableBossSystem, spawnBoss } from "./boss.js";

/* Boss-System aktivieren (Map kann jetzt Boss-Runden darstellen) */
enableBossSystem();

/* -----------------------------
 * Helfer
 * --------------------------- */

/** Boss-Floor-Datei (aus assets/floor/boss/) rotierend nach Boss-Block */
function getBossFloorForStage(stage) {
  const bossStage = Math.max(6, getBossStageFor(stage)); // 6,12,18,…
  const idx = (Math.ceil(bossStage / 6) - 1) % 3;        // 0..2
  const files = ["boss_floor_lava.png", "boss_floor_rune.png", "boss_floor_void.png"];
  return files[idx] || files[0];
}

/** Sparkles auf Rare-Steinen */
function createSparkles(stoneEl, count = 4) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement("div");
    s.className = "sparkle";
    const x = Math.floor(Math.random() * 56) + 4; // 4..60
    const y = Math.floor(Math.random() * 56) + 4;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty("--delay", (Math.random() * 1.5).toFixed(2) + "s");
    s.style.setProperty("--spd", (0.9 + Math.random() * 0.8).toFixed(2) + "s");
    stoneEl.appendChild(s);
  }
}

/** Stein-Element (normal/rare) mit Stage-Skalierung */
function createStoneElement(isRare, hpMult, goldMult) {
  const stone = document.createElement("div");
  stone.className = "stone" + (isRare ? " rare" : "");

  const img = isRare ? "rarestone.png" : "stone1.png";
  stone.style.backgroundImage = `url('assets/stone/${img}')`;
  stone.style.backgroundSize = "cover";

  const baseHp   = isRare ? 60 + Math.random() * 20 : 12 + Math.random() * 8;
  const baseGold = isRare ? 10 : 3;

  const hp   = baseHp   * hpMult;
  const gold = baseGold * goldMult;

  stone.dataset.hp = hp;
  stone.dataset.maxHp = hp;
  stone.dataset.gold = gold;

  const bar = document.createElement("div");
  bar.className = "hp-bar";
  stone.appendChild(bar);

  if (isRare) createSparkles(stone, 4 + Math.floor(Math.random() * 3)); // 4..6

  return stone;
}

/* -----------------------------
 * Public API
 * --------------------------- */

/**
 * Baut die Map neu auf.
 * - Normale Runde: Steine + Tile-Floor je Tile
 * - Boss-Runde: EIN großer Boss-Floor auf #game, Tiles transparent, 1 Boss zentriert
 * @returns {number} stonesCount
 */
export function generateMap() {
  if (!gameArea) return 0;

  // Reset
  gameArea.innerHTML = "";
  tiles.length = 0;

  const isBossRound = Boolean(window.__mc_isBossRound);

  // --- Grid (Tiles) immer erzeugen ---
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tiles.push(tile);
      gameArea.appendChild(tile);
    }
  }

  if (isBossRound) {
    // === Boss-Runde ===
    // EIN großes Floor-Bild auf dem Container (#game)
    const bossFloor = getBossFloorForStage(getStage());
    gameArea.style.background = `url('assets/floor/boss/${bossFloor}') center / contain no-repeat`;

    // Tiles transparent lassen (keine per-Tile-Floor-Grafik)
    tiles.forEach(t => {
      t.style.backgroundImage = "none";
      t.style.backgroundColor = "transparent";
    });

    // Boss in (nahezu) zentrale Tile setzen ...
    const cx = Math.floor(MAP_WIDTH / 2);
    const cy = Math.floor(MAP_HEIGHT / 2);
    const idx = Math.max(0, Math.min(tiles.length - 1, cy * MAP_WIDTH + cx));
    const centerTile = tiles[idx] || tiles[0];

    // ... und für gerade Gridmaße optisch halb verschieben, damit er genau mittig sitzt
    const bossEl = spawnBoss(centerTile, getBossStageFor(getStage()));
    if (bossEl) {
      const offX = (MAP_WIDTH  % 2 === 0) ? -TILE_SIZE / 2 : 0;
      const offY = (MAP_HEIGHT % 2 === 0) ? -TILE_SIZE / 2 : 0;
      if (offX || offY) {
        bossEl.style.transform = `translate(${offX}px, ${offY}px)`;
      }
    }

    setStonesRemaining(0);
    return 0;
  }

  // === Normale Runde ===
  // Container-Hintergrund zurücksetzen
  gameArea.style.background = "";

  // Floor je Biom pro Tile setzen
  const curBiome = normalizeBiome(biome);
  const floorImage = getFloorTextureForBiome(curBiome);

  tiles.forEach((tile) => {
    tile.style.backgroundImage = `url('assets/floor/${floorImage}')`;
    tile.style.backgroundSize = "cover";
  });

  // Stage-Skalierung
  const st = getStage();
  const hpMult = getStoneHpMultiplier(st);
  const goldMult = getGoldMultiplier(st);

  // Spawnchance (abhängig von Upgrade "amount", aber geclamped)
  const amountLevel = Math.min(Number(upgrades.amount || 0), MAX_AMOUNT);
  const chance = Math.min(0.4 + amountLevel * 0.05, 0.65);

  // Zusätzlicher Spawn-Deckel (max. Füllgrad)
  const totalTiles = MAP_WIDTH * MAP_HEIGHT;
  const maxStonesAllowed = Math.floor(totalTiles * getMaxFillRatio());

  let stonesCount = 0;

  for (let i = 0; i < tiles.length; i++) {
    if (stonesCount >= maxStonesAllowed) break;
    if (Math.random() < chance) {
      const isRare = Math.random() < 0.1;
      const stoneEl = createStoneElement(isRare, hpMult, goldMult);
      tiles[i].appendChild(stoneEl);
      stonesCount++;
    }
  }

  setStonesRemaining(stonesCount);
  return stonesCount;
}
