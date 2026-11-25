/**
 * Procedural Overland Cartography Name Generator (Wonderdraft-parity naming assistant).
 * Supports 10 rich naming styles across Kingdoms, Cities, Rivers, Mountains, Seas, Forests & Regions.
 */

export type WorldNameCultureId =
  | "high_fantasy"
  | "elven"
  | "dwarven"
  | "nordic"
  | "maritime_pirate"
  | "desert"
  | "eastern"
  | "grimdark"
  | "geographical_water"
  | "geographical_land";

export interface WorldNameCultureMeta {
  id: WorldNameCultureId;
  label: string;
  example: string;
}

export const WORLD_NAME_CULTURES: WorldNameCultureMeta[] = [
  { id: "high_fantasy", label: "High Fantasy Cities", example: "Valenhold" },
  { id: "elven", label: "Elven Realms", example: "Lothalor" },
  { id: "dwarven", label: "Dwarven Holds", example: "Khaz-Dûrn" },
  { id: "nordic", label: "Nordic Fjords", example: "Skaldvik" },
  { id: "maritime_pirate", label: "Pirate & Coastal", example: "Blackwater Cay" },
  { id: "desert", label: "Desert & Oasis", example: "Qadim al-Shar" },
  { id: "eastern", label: "Eastern Dynasties", example: "Kuroshio" },
  { id: "grimdark", label: "Grimdark & Cursed", example: "Ashenmire" },
  { id: "geographical_water", label: "Seas, Bays & Rivers", example: "The Shattered Sound" },
  { id: "geographical_land", label: "Mountains & Forests", example: "Ironspine Peaks" },
];

interface NameGrammar {
  prefixes: string[];
  middles?: string[];
  suffixes: string[];
  titles?: string[];
  compoundChance?: number;
}

const GRAMMARS: Record<WorldNameCultureId, NameGrammar> = {
  high_fantasy: {
    prefixes: ["Val", "Aethel", "Cael", "Oakh", "Silver", "Gold", "Storm", "High", "Ravens", "Iron", "Bright", "Sun", "Crown", "Alder", "Bramble", "West", "East", "North", "Stone", "Winter", "Amber", "Falcon", "Thorn", "King"],
    suffixes: ["hold", "haven", "keep", "ford", "watch", "crest", "spire", "gate", "bridge", "vale", "stead", "port", "brook", "hall", "march", "fall", "wood", "moor", "wick", "bury", "gard", "reach"],
    titles: ["", "", "", "Port ", "Fort ", "New "],
  },
  elven: {
    prefixes: ["Loth", "Syl", "Ael", "Thal", "Elen", "Cala", "Fae", "Gal", "Nym", "Vael", "Ili", "Ser", "Mir", "Lor", "Tael", "Oroph", "Aran", "Yav"],
    middles: ["a", "e", "i", "o", "ae", "ia", "el", "an", "or"],
    suffixes: ["lor", "dor", "thil", "rien", "wen", "mir", "neth", "vorn", "syr", "lith", "driel", "lan", "vael", "nor", "thas", "rion"],
  },
  dwarven: {
    prefixes: ["Khaz", "Kaz", "Barak", "Karak", "Thar", "Durn", "Grim", "Bryn", "Krag", "Gund", "Morn", "Nain", "Drak", "Keld", "Zorn", "Varn"],
    suffixes: ["-dûm", "-gûl", "hold", "anvil", "delve", "deep", "helm", "peak", "forge", "crag", "hammer", "stone", "grum", "bain", "kar", "bar"],
  },
  nordic: {
    prefixes: ["Skald", "Fjord", "Rime", "Frost", "Ulf", "Valk", "Hrafn", "Solv", "Kald", "Jotun", "Bjorn", "Tor", "Asg", "Hald", "Vind", "Styr"],
    suffixes: ["vik", "heim", "fjord", "ness", "mark", "gard", "borg", "stad", "lund", "ey", "holme", "fell", "dal", "by", "skerry"],
  },
  maritime_pirate: {
    prefixes: ["Black", "Salt", "Cutlass", "Barnacle", "Siren", "Kraken", "Corsair", "Smuggler's", "Driftwood", "Deadman's", "Gale", "Reef", "Rum", "Cinder", "Crimson", "Shipwreck", "Tempest", "Dagger", "Brimstone", "Viper"],
    suffixes: [" Cay", " Cove", " Atoll", " Shoals", " Point", " Anchorage", " Haven", " Tortuga", " Bluff", " Harbor", " Landing", " Keys", " Rock", " Strait"],
  },
  desert: {
    prefixes: ["Qadim", "Al-", "Sahr", "Zahir", "Marak", "Khar", "Sul", "Azir", "Rash", "Nadir", "Jabal", "Wadi", "Samir", "Tarq", "Malik", "Fayr"],
    middles: [" al-", " ", "a", "i", "u"],
    suffixes: ["Shar", "Mir", "Kesh", "Raan", "Dune", "Bahr", "Qasr", "Zan", "Oasis", "Safa", "Noor", "Khal", "Mar", "Hazar"],
  },
  eastern: {
    prefixes: ["Kuro", "Shiro", "Aka", "Ao", "Taka", "Mori", "Kawa", "Yama", "Hoshi", "Kiri", "Tatsu", "Sora", "Mizu", "Hana", "Kaze", "Shin"],
    suffixes: ["shio", "yama", "kawa", "mori", "jo", "to", "hama", "saki", "mura", "dera", "kura", "guchi", "mine", "hara", "no"],
  },
  grimdark: {
    prefixes: ["Ashen", "Blight", "Dread", "Gloom", "Wither", "Bleak", "Cinder", "Marrow", "Raven", "Sorrow", "Hollow", "Grim", "Mire", "Shroud", "Rot", "Bane", "Wraith", "Night"],
    suffixes: ["mire", "fell", "hollow", "moor", "fen", "crag", "tomb", "scar", "watch", "spire", "pit", "waste", "keep", "barrow", "grave", "reach"],
  },
  geographical_water: {
    prefixes: ["Shattered", "Sapphire", "Whispering", "Emerald", "Silver", "Storm", "Gilded", "Sunken", "Misty", "Cobalt", "Serpent's", "Sunlit", "Iron", "Crying", "Moonlit", "Tidebreak", "Azure", "Abyssal"],
    suffixes: [" Sea", " Ocean", " Bay", " Sound", " Strait", " Gulf", " River", " Delta", " Rapids", " Estuary", " Reach", " Passage", " Basin", " Lake"],
    titles: ["The ", "The ", ""],
  },
  geographical_land: {
    prefixes: ["Ironspine", "Frostfang", "Whispering", "Elder", "Shattered", "Dragonback", "Emerald", "Amber", "Shadow", "High", "Redrock", "Starfall", "Briar", "Thunder", "Sunscorched", "Cloud", "Mistwood", "Gloom"],
    suffixes: [" Peaks", " Mountains", " Range", " Forest", " Woods", " Weald", " Highlands", " Wastes", " Plains", " Steppes", " Valley", " Marshes", " Badlands", " Ridge", " Downs"],
    titles: ["The ", ""],
  },
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateWorldName(culture: WorldNameCultureId, seed?: number): string {
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;
  const g = GRAMMARS[culture] ?? GRAMMARS.high_fantasy;
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const title = g.titles ? pick(g.titles) : "";
  const pre = pick(g.prefixes);
  const mid = g.middles && rng() < 0.65 ? pick(g.middles) : "";
  const suf = pick(g.suffixes);

  // Avoid awkward double-spaces or hyphen+space combos
  const raw = `${title}${pre}${mid}${suf}`.replace(/\s+/g, " ").replace(/-\s+/g, "-").trim();
  return raw;
}

export function generateWorldNameBatch(
  culture: WorldNameCultureId,
  count = 8,
  seed?: number,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const baseSeed = seed ?? Math.floor(Math.random() * 1_000_000);
  let attempts = 0;
  while (out.length < count && attempts < count * 8) {
    const candidate = generateWorldName(culture, baseSeed + attempts * 7919);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      out.push(candidate);
    }
    attempts++;
  }
  return out;
}
