// js/biom.js
// Biome-Hilfen: Mapping pro Stage, Normalisierung, Body-Attribut setzen,
// sowie (optional) Floor-Texture-Namen für map.js.

export const ALLOWED_BIOMES = [
  "gras", "dirt", "stone", "ice", "dungeon", "crystal", "lava"
];

// Reihenfolge, in der die Biome über die Stages rotieren.
// Stage 1 -> gras, 2 -> dirt, 3 -> stone, 4 -> ice, 5 -> dungeon, 6 -> crystal, 7 -> lava, 8 -> wieder gras, ...
export const BIOME_CYCLE = ["gras", "dirt", "stone", "ice", "dungeon", "crystal", "lava"];

// Legacy-Bezeichner auf unsere Namen mappen
const LEGACY_MAP = {
  default: "gras",
  grass:   "gras",
  cave:    "stone"
};

/** Interne Normalisierung auf erlaubte Biome. Fallback: "gras". */
export function normalizeBiome(biome) {
  let v = String(biome || "").toLowerCase().trim();
  if (!v) v = "gras";
  if (LEGACY_MAP[v]) v = LEGACY_MAP[v];
  if (!ALLOWED_BIOMES.includes(v)) v = "gras";
  return v;
}

/** Liefert das Biom für eine Stage-Nummer (>=1) gemäß BIOME_CYCLE. */
export function getBiomeForStage(stage) {
  const s = Math.max(1, Math.floor(Number(stage) || 1));
  const idx = (s - 1) % BIOME_CYCLE.length;
  return BIOME_CYCLE[idx];
}

/**
 * Setzt das Biom am <body> (data-biome="...") und gibt den verwendeten Wert zurück.
 * CSS-Hintergründe greifen damit automatisch.
 */
export function applyBiome(biome) {
  const v = normalizeBiome(biome);
  if (typeof document !== "undefined" && document.body) {
    document.body.setAttribute("data-biome", v);
  }
  return v;
}

/** Komfort: Wählt Biom anhand Stage und setzt es am <body>. */
export function pickAndApplyBiomeForStage(stage) {
  return applyBiome(getBiomeForStage(stage));
}

/**
 * Optional für map.js: liefert den **Dateinamen** der Floor-Textur
 * (ohne Pfad), passend zum Biom. Pfad: "assets/floor/<datei>".
 */
export function getFloorTextureForBiome(biome) {
  const v = normalizeBiome(biome);
  const map = {
    gras:    "gras.png",
    dirt:    "dirt.png",
    stone:   "stone.png",
    ice:     "ice.png",
    dungeon: "dungeon.png",
    crystal: "crystal.png",
    lava:    "lava.png"
  };
  return map[v] || "gras.png";
}
