const TILE_SIZE = 64;
const MAP_SIZE = 20;
const ROUND_TIME = 10;
const AOE_INTERVAL_MS = 200;
const LEVEL_THRESHOLD = 1000;

let biome = "default";
let leveled = false;

const slotKey = localStorage.getItem("mineclicker_current_slot");
if (!slotKey) location.href = "index.html";

let saveData;
try {
  saveData = JSON.parse(localStorage.getItem(slotKey));
} catch {
  location.href = "index.html";
}

if (!saveData || saveData.phase !== "playing") {
  location.href = "upgrades.html";
}

let gold = saveData.gold || 0;
let upgrades = saveData.upgrades || { radius: 1, damage: 0, amount: 0, goldBoost: 0 };

let timeLeft = typeof saveData.remainingTime === "number" && saveData.remainingTime > 0
  ? saveData.remainingTime
  : ROUND_TIME;

saveData.startTime = Date.now();
localStorage.setItem(slotKey, JSON.stringify(saveData));

let timerInterval, aoeInterval, rafId;
let tiles = [];
let gameRunning = true;
let mouseX = 0, mouseY = 0;

const timerDisplay = document.getElementById("timer");
const goldDisplay = document.getElementById("goldDisplay");
const levelInfo = document.getElementById("levelInfo");
const gameArea = document.getElementById("game");
const radiusCircle = document.getElementById("radiusCircle");

const BIOMES = ["default", "cave", "lava"];
biome = BIOMES[Math.floor(Math.random() * BIOMES.length)];
document.body.setAttribute("data-biome", biome);

function updateGoldDisplay() {
  goldDisplay.textContent = `💰 Gold: ${Math.floor(gold)}`;
}

function updateLevelInfo() {
  const remaining = Math.max(0, LEVEL_THRESHOLD - gold);
  levelInfo.textContent = `🆙 Gold bis Level-Up: ${Math.ceil(remaining)}`;
}

function triggerLevelUp() {
  if (!leveled && gold >= LEVEL_THRESHOLD) {
    goldDisplay.classList.add("levelup");
    gameArea.classList.add("glow");
    setTimeout(() => {
      goldDisplay.classList.remove("levelup");
      gameArea.classList.remove("glow");
    }, 1000);
    leveled = true;
  }
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function generateMap() {
  gameArea.innerHTML = "";
  tiles = [];

  const floorImage = {
    default: "gras.png",
    cave: "stone.png",
    lava: "lava.png"
  }[biome] || "gras.png";

  const chance = Math.min(0.4 + upgrades.amount * 0.05, 0.65);

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.style.backgroundImage = `url('assets/floor/${floorImage}')`;
      tile.style.backgroundSize = "cover";
      gameArea.appendChild(tile);
      tiles.push(tile);

      if (Math.random() < chance) {
        const isRare = Math.random() < 0.1;
        const isBoss = Math.random() < 0.02;

        if (isBoss) {
          const boss = document.createElement("div");
          boss.className = "boss";
          boss.style.backgroundImage = "url('assets/enemy/boss.png')";
          boss.dataset.hp = 200 + upgrades.amount * 20;
          boss.dataset.maxHp = boss.dataset.hp;
          boss.dataset.gold = 100;
          const bar = document.createElement("div");
          bar.className = "hp-bar";
          boss.appendChild(bar);
          tile.appendChild(boss);
        } else {
          const stone = document.createElement("div");
          stone.className = "stone";
          const img = isRare ? "rarestone.png" : "stone1.png";
          stone.style.backgroundImage = `url('assets/stone/${img}')`;
          stone.style.backgroundSize = "cover";
          stone.dataset.hp = isRare ? 60 + Math.random() * 20 : 12 + Math.random() * 8;
          stone.dataset.maxHp = stone.dataset.hp;
          stone.dataset.gold = isRare ? 10 : 3;
          const bar = document.createElement("div");
          bar.className = "hp-bar";
          stone.appendChild(bar);
          tile.appendChild(stone);
        }
      }
    }
  }
}

function startTimer() {
  timerDisplay.textContent = `⏱️ ${formatTime(timeLeft)}`;
  timerInterval = setInterval(() => {
    if (timeLeft <= 0) {
      endRound();
    } else {
      timerDisplay.textContent = `⏱️ ${formatTime(timeLeft)}`;
      timeLeft--;
    }
  }, 1000);
}

function endRound() {
  clearInterval(timerInterval);
  clearInterval(aoeInterval);
  cancelAnimationFrame(rafId);
  gameRunning = false;

  saveData.phase = "upgrades";
  saveData.remainingTime = timeLeft;
  saveData.gold = gold;
  saveData.upgrades = upgrades;
  delete saveData.startTime;
  localStorage.setItem(slotKey, JSON.stringify(saveData));

  window.location.href = "upgrades.html";
}

function spawnParticles(x, y) {
  for (let i = 0; i < 5; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    gameArea.appendChild(p);
    p.addEventListener("animationend", () => p.remove());
  }
}

function showGoldFly(x, y) {
  const target = goldDisplay.getBoundingClientRect();
  const dx = target.left - x;
  const dy = target.top - y;
  const el = document.createElement("div");
  el.className = "fly-gold";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.setProperty("--dx", `${dx}px`);
  el.style.setProperty("--dy", `${dy}px`);
  el.textContent = "💰";
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function autoMine(x, y) {
  const radius = TILE_SIZE * (0.5 + 0.2 * upgrades.radius);

  tiles.forEach(tile => {
    const rect = tile.getBoundingClientRect();
    const dx = rect.left + TILE_SIZE / 2 - x;
    const dy = rect.top + TILE_SIZE / 2 - y;
    if (Math.hypot(dx, dy) <= radius) {
      const elem = tile.querySelector(".boss, .stone");
      if (!elem) return;

      let hp = parseFloat(elem.dataset.hp);
      const maxHp = parseFloat(elem.dataset.maxHp);
      hp -= 1 + 0.5 * upgrades.damage;
      elem.dataset.hp = hp;

      const bar = elem.querySelector(".hp-bar");
      if (bar) {
        const ratio = Math.max(0, hp / maxHp);
        bar.style.width = `${ratio * 100}%`;
        bar.style.backgroundColor = `rgb(${Math.floor(255 * (1 - ratio))}, ${Math.floor(255 * ratio)}, 0)`;
      }

      elem.classList.add("shake");
      setTimeout(() => elem.classList.remove("shake"), 100);

      if (hp <= 0) {
        const pos = elem.getBoundingClientRect();
        spawnParticles(pos.left + TILE_SIZE / 2, pos.top + TILE_SIZE / 2);
        showGoldFly(pos.left, pos.top);

        let gain = parseFloat(elem.dataset.gold);
        gain *= 1 + upgrades.goldBoost * 0.05;
        gain *= 1 + Math.random() * 0.2;
        gold += gain;
        updateGoldDisplay();
        updateLevelInfo();
        triggerLevelUp();
        tile.removeChild(elem);
      }
    }
  });
}

document.addEventListener("mousemove", e => {
  mouseX = e.pageX;
  mouseY = e.pageY;
});

function animateRing() {
  const radius = TILE_SIZE * (0.5 + 0.2 * upgrades.radius);
  radiusCircle.style.left = `${mouseX - radius}px`;
  radiusCircle.style.top = `${mouseY - radius}px`;
  radiusCircle.style.width = `${radius * 2}px`;
  radiusCircle.style.height = `${radius * 2}px`;
  rafId = requestAnimationFrame(animateRing);
}

document.addEventListener("DOMContentLoaded", () => {
  generateMap();
  updateGoldDisplay();
  updateLevelInfo();
  startTimer();
  aoeInterval = setInterval(() => {
    if (gameRunning) autoMine(mouseX, mouseY);
  }, AOE_INTERVAL_MS);
  animateRing(); // Start der flüssigen Ringanimation
});

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(rafId);
  if (gameRunning) {
    saveData.phase = "paused";
    saveData.remainingTime = timeLeft;
    saveData.gold = gold;
    saveData.upgrades = upgrades;
    localStorage.setItem(slotKey, JSON.stringify(saveData));
  }
});
