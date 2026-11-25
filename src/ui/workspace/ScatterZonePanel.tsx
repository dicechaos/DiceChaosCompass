import React, { useMemo, useState } from "react";
import { Check, Plus, RefreshCw, Search, Sparkles, Trash2, X } from "lucide-react";
import { useVaultStore } from "@/store/vaultStore";
import type { VaultAsset } from "@/types/map";

export interface ScatterPreset {
  id: string;
  label: string;
  group: "outdoor" | "indoor";
  spacing: number;
  minScale: number;
  maxScale: number;
  assetIds: string[];
}

export const SCATTER_PRESETS: ScatterPreset[] = [
  // --- OUTDOOR SCATTER PRESETS ---
  {
    id: "woodland",
    label: "Woodland Trees",
    group: "outdoor",
    spacing: 2.6,
    minScale: 0.78,
    maxScale: 1.15,
    assetIds: [
      "modular-suite/props/trees_deciduous/tree_oak_broad.png",
      "modular-suite/props/trees_deciduous/tree_ancient_oak.png",
      "modular-suite/props/trees_deciduous/tree_birch_silver.png",
      "modular-suite/props/trees_biomes/tree_dark_pine.png",
      "modular-suite/props/trees_biomes/tree_tall_spruce.png",
      "modular-suite/props/flora/bush_round_green.png",
    ],
  },
  {
    id: "autumn",
    label: "Autumn Grove",
    group: "outdoor",
    spacing: 2.4,
    minScale: 0.78,
    maxScale: 1.12,
    assetIds: [
      "modular-suite/props/trees_deciduous/tree_autumn_maple_red.png",
      "modular-suite/props/trees_deciduous/tree_golden_birch.png",
      "modular-suite/props/flora/bush_autumn_russet.png",
      "modular-suite/props/flora/bush_autumn_gold.png",
      "modular-suite/modular/dec_autumn_leaves_a.png",
      "modular-suite/modular/dec_autumn_leaves_b.png",
    ],
  },
  {
    id: "garden",
    label: "Park & Flora",
    group: "outdoor",
    spacing: 1.7,
    minScale: 0.75,
    maxScale: 1.08,
    assetIds: [
      "modular-suite/props/trees_deciduous/tree_cherry_blossom.png",
      "modular-suite/props/flora/bush_white_blossom.png",
      "modular-suite/props/flora/bush_trimmed_boxwood.png",
      "modular-suite/props/flora/flora_woodland_fern.png",
      "modular-suite/props/flora/flora_yellow_wildflowers.png",
      "modular-suite/props/flora/flora_lavender_clump.png",
    ],
  },
  {
    id: "rocks",
    label: "Rocks & Forest",
    group: "outdoor",
    spacing: 1.9,
    minScale: 0.75,
    maxScale: 1.15,
    assetIds: [
      "modular-suite/props/rocks_nature/rock_smooth_river.png",
      "modular-suite/props/rocks_nature/rock_jagged_granite.png",
      "modular-suite/props/rocks_nature/rock_mossy_boulder.png",
      "modular-suite/props/rocks_nature/nature_fresh_stump.png",
      "modular-suite/props/rocks_nature/nature_mossy_log.png",
      "modular-suite/props/rocks_nature/nature_mushroom_ring.png",
      "modular-suite/props/rocks_nature/nature_pebble_scatter.png",
    ],
  },
  {
    id: "alley",
    label: "Alley Clutter",
    group: "outdoor",
    spacing: 1.75,
    minScale: 0.76,
    maxScale: 1.05,
    assetIds: [
      "modular-suite/props/docks_streets/doc_stenciled_crate.png",
      "modular-suite/props/sewers_alleys/sew_alley_trash_barrel.png",
      "modular-suite/props/sewers_alleys/sew_broken_crate_debris.png",
      "modular-suite/props/sewers_alleys/sew_burlap_trash_sack.png",
      "modular-suite/props/sewers_alleys/sew_scattered_bottles.png",
      "modular-suite/modular/crate_oak_sm.png",
      "modular-suite/modular/barrel_oak_closed.png",
    ],
  },
  {
    id: "market",
    label: "Market Cargo",
    group: "outdoor",
    spacing: 1.75,
    minScale: 0.8,
    maxScale: 1.05,
    assetIds: [
      "modular-suite/props/market_tailor/mkt_apple_crate.png",
      "modular-suite/props/market_tailor/mkt_produce_crate.png",
      "modular-suite/props/market_tailor/mkt_open_grain_barrel.png",
      "modular-suite/props/market_tailor/mkt_tied_burlap_sack.png",
      "modular-suite/props/market_tailor/mkt_coiled_rope_basket.png",
      "modular-suite/modular/crate_pine_slatted.png",
    ],
  },
  {
    id: "graveyard",
    label: "Graveyard",
    group: "outdoor",
    spacing: 2.2,
    minScale: 0.82,
    maxScale: 1.08,
    assetIds: [
      "modular-suite/props/funeral/fun_mossy_tombstone.png",
      "modular-suite/props/funeral/fun_celtic_cross_grave.png",
      "modular-suite/props/funeral/fun_white_lily_wreath.png",
      "modular-suite/props/trees_biomes/tree_dead_gnarled.png",
      "modular-suite/props/flora/bush_thorny_bramble.png",
      "modular-suite/modular/arch_grave_headstone_rd.png",
    ],
  },
  {
    id: "lakeshore",
    label: "Lakeshore & Reeds",
    group: "outdoor",
    spacing: 1.75,
    minScale: 0.78,
    maxScale: 1.1,
    assetIds: [
      "modular-suite/props/water_flora_banks/wat_lily_lotus_pink.png",
      "modular-suite/props/water_flora_banks/wat_lily_pad_bed.png",
      "modular-suite/props/water_flora_banks/wat_cattail_tuft_top.png",
      "modular-suite/props/water_flora_banks/wat_sedge_grass_bank.png",
      "modular-suite/props/water_flora_banks/wat_marsh_marigold.png",
      "modular-suite/props/water_flora_banks/wat_wet_cobble_cluster.png",
      "modular-suite/props/water_flora_banks/wat_riverbank_fern.png",
    ],
  },
  {
    id: "lakebed",
    label: "Submerged Lakebed",
    group: "outdoor",
    spacing: 2.1,
    minScale: 0.76,
    maxScale: 1.08,
    assetIds: [
      "modular-suite/props/water_wildlife_submerged/wat_submerged_pebbles.png",
      "modular-suite/props/water_wildlife_submerged/wat_koi_school.png",
      "modular-suite/props/water_wildlife_submerged/wat_alpine_trout_trio.png",
      "modular-suite/props/water_flora_banks/wat_submerged_kelp.png",
      "modular-suite/props/water_flora_banks/wat_submerged_boulder.png",
      "modular-suite/props/water_ripples_foam/wat_caustics_patch.png",
    ],
  },
  {
    id: "shipyard",
    label: "Shipyard & Cargo",
    group: "outdoor",
    spacing: 1.9,
    minScale: 0.78,
    maxScale: 1.08,
    assetIds: [
      "modular-suite/props/shipyard_building/yard_pine_deck_planks.png",
      "modular-suite/props/shipyard_building/yard_curved_hull_ribs.png",
      "modular-suite/props/shipyard_building/yard_wood_shavings_pile.png",
      "modular-suite/props/shipyard_building/yard_caulking_mallet_oakum.png",
      "modular-suite/props/ship_cargo_hold/cargo_braced_shipping_crate.png",
      "modular-suite/props/ship_cargo_hold/cargo_hemp_rope_bales.png",
      "modular-suite/props/ship_cargo_hold/cargo_strapped_lumber_spars.png",
    ],
  },
  {
    id: "cavern",
    label: "Cavern & Ruins",
    group: "outdoor",
    spacing: 2.0,
    minScale: 0.78,
    maxScale: 1.15,
    assetIds: [
      "modular-suite/props/mining_cavern/min_cyan_crystals.png",
      "modular-suite/props/mining_cavern/min_amethyst_crystals.png",
      "modular-suite/props/mining_cavern/min_cave_stalagmite.png",
      "modular-suite/props/mining_cavern/min_giant_glow_shroom.png",
      "modular-suite/props/mining_cavern/min_cavern_rubble.png",
      "modular-suite/modular/dec_pebbles_b.png",
    ],
  },

  // --- INDOOR SCATTER PRESETS ---
  {
    id: "indoor-tavern",
    label: "Tavern & Dining",
    group: "indoor",
    spacing: 1.35,
    minScale: 0.8,
    maxScale: 1.05,
    assetIds: [
      "modular-suite/props/tavern_clutter/tav_foamy_ale_mug.png",
      "modular-suite/props/tavern_clutter/tav_wine_bottle_goblet.png",
      "modular-suite/props/tavern_clutter/tav_pewter_place_setting.png",
      "modular-suite/props/tavern_clutter/tav_hot_stew_bowl.png",
      "modular-suite/props/tavern_clutter/tav_playing_cards.png",
      "modular-suite/props/tavern_clutter/tav_leather_dice_cup.png",
      "modular-suite/props/tavern_clutter/tav_brass_chamberstick.png",
      "modular-suite/props/tavern_clutter/tav_spilled_ale_mug.png",
    ],
  },
  {
    id: "indoor-bakery",
    label: "Bakery & Pantry",
    group: "indoor",
    spacing: 1.4,
    minScale: 0.8,
    maxScale: 1.05,
    assetIds: [
      "modular-suite/props/bakery/bak_braided_loaf.png",
      "modular-suite/props/bakery/bak_baguette_basket.png",
      "modular-suite/props/bakery/bak_lattice_cherry_pie.png",
      "modular-suite/props/bakery/bak_croissant_tray.png",
      "modular-suite/props/bakery/bak_flour_sack.png",
      "modular-suite/props/bakery/bak_open_flour_barrel.png",
      "modular-suite/props/bakery/bak_jam_honey_jars.png",
      "modular-suite/modular/dec_flour_spill.png",
    ],
  },
  {
    id: "indoor-kitchen",
    label: "Kitchen Clutter",
    group: "indoor",
    spacing: 1.35,
    minScale: 0.78,
    maxScale: 1.05,
    assetIds: [
      "modular-suite/props/kitchen/kit_cast_iron_skillet.png",
      "modular-suite/props/kitchen/kit_copper_stockpot.png",
      "modular-suite/props/kitchen/kit_chopping_board_knives.png",
      "modular-suite/props/kitchen/kit_cheese_wheel.png",
      "modular-suite/props/kitchen/kit_sourdough_boule.png",
      "modular-suite/props/kitchen/kit_spice_jars.png",
      "modular-suite/props/kitchen/kit_vegetable_basket.png",
      "modular-suite/props/kitchen/kit_ceramic_plate_stack.png",
    ],
  },
  {
    id: "indoor-clinic",
    label: "Doctor & Clinic",
    group: "indoor",
    spacing: 1.4,
    minScale: 0.8,
    maxScale: 1.05,
    assetIds: [
      "modular-suite/props/doctor_apothecary/doc_surgical_tray.png",
      "modular-suite/props/doctor_apothecary/doc_mortar_pestle.png",
      "modular-suite/props/doctor_apothecary/doc_medicine_vials.png",
      "modular-suite/props/doctor_apothecary/doc_bandages_gauze.png",
      "modular-suite/props/doctor_apothecary/doc_specimen_jar.png",
      "modular-suite/props/doctor_apothecary/doc_anatomy_scroll.png",
      "modular-suite/props/doctor_apothecary/doc_dried_lavender.png",
      "modular-suite/props/doctor_apothecary/doc_leather_satchel.png",
    ],
  },
  {
    id: "indoor-office",
    label: "Post & Study",
    group: "indoor",
    spacing: 1.3,
    minScale: 0.8,
    maxScale: 1.05,
    assetIds: [
      "modular-suite/props/post_office/po_tied_letter_stack.png",
      "modular-suite/props/post_office/po_wax_sealed_envelope.png",
      "modular-suite/props/post_office/po_quill_inkwell.png",
      "modular-suite/props/post_office/po_open_ledger.png",
      "modular-suite/props/post_office/po_brown_parcel.png",
      "modular-suite/props/post_office/po_rubber_stamp_pad.png",
      "modular-suite/props/post_office/po_gold_coin_stacks.png",
      "modular-suite/props/school_courtroom/sch_legal_ledger_stack.png",
    ],
  },
  {
    id: "indoor-library",
    label: "Library & Alchemy",
    group: "indoor",
    spacing: 1.35,
    minScale: 0.8,
    maxScale: 1.05,
    assetIds: [
      "modular-suite/props/library_alchemy/arc_glowing_grimoire.png",
      "modular-suite/props/library_alchemy/arc_stacked_tomes.png",
      "modular-suite/props/library_alchemy/arc_ribbon_scrolls.png",
      "modular-suite/props/library_alchemy/arc_potion_trio.png",
      "modular-suite/props/library_alchemy/arc_candle_skull.png",
      "modular-suite/props/library_alchemy/arc_brass_hourglass.png",
      "modular-suite/props/library_alchemy/arc_glowing_mortar.png",
      "modular-suite/props/library_alchemy/arc_alembic_still.png",
    ],
  },
  {
    id: "indoor-forge",
    label: "Forge & Workshop",
    group: "indoor",
    spacing: 1.5,
    minScale: 0.8,
    maxScale: 1.08,
    assetIds: [
      "modular-suite/props/blacksmith/bs_tongs_hammer.png",
      "modular-suite/props/blacksmith/bs_iron_ingot_stack.png",
      "modular-suite/props/blacksmith/bs_horseshoes_set.png",
      "modular-suite/props/blacksmith/bs_saw_mallet.png",
      "modular-suite/props/blacksmith/bs_chain_rope_coil.png",
      "modular-suite/props/blacksmith/bs_open_toolbox.png",
      "modular-suite/props/blacksmith/bs_coal_pile.png",
      "modular-suite/modular/dec_sawdust_pile.png",
    ],
  },
  {
    id: "indoor-cellar",
    label: "Cellar Storage",
    group: "indoor",
    spacing: 1.65,
    minScale: 0.8,
    maxScale: 1.08,
    assetIds: [
      "modular-suite/modular/crate_oak_sm.png",
      "modular-suite/modular/crate_oak_md.png",
      "modular-suite/modular/crate_walnut_iron.png",
      "modular-suite/modular/barrel_oak_closed.png",
      "modular-suite/modular/barrel_walnut_closed.png",
      "modular-suite/modular/barrel_lying_dark.png",
      "modular-suite/modular/sack_burlap_sm.png",
      "modular-suite/modular/basket_empty_round.png",
    ],
  },
  {
    id: "indoor-home",
    label: "Home & Parlor",
    group: "indoor",
    spacing: 1.45,
    minScale: 0.8,
    maxScale: 1.05,
    assetIds: [
      "modular-suite/props/bedroom_home/home_laundry_basket.png",
      "modular-suite/props/bedroom_home/home_potted_fern.png",
      "modular-suite/props/bedroom_home/home_blue_flower_vase.png",
      "modular-suite/props/bedroom_home/home_patchwork_quilts.png",
      "modular-suite/props/bedroom_home/home_rush_seat_stool.png",
      "modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png",
      "modular-suite/props/music_theater_tea/tea_porcelain_set.png",
      "modular-suite/props/music_theater_tea/tea_chess_board.png",
    ],
  },
  {
    id: "indoor-ship-deck",
    label: "Ship Deck & Hold",
    group: "indoor",
    spacing: 1.6,
    minScale: 0.78,
    maxScale: 1.06,
    assetIds: [
      "modular-suite/props/ship_masts_sails/ship_coiled_halyard_rope.png",
      "modular-suite/props/ship_anchors_mooring/ship_coiled_anchor_chain.png",
      "modular-suite/props/ship_crew_galley/ship_mop_holystone_bucket.png",
      "modular-suite/props/ship_crew_galley/ship_sailor_ditty_bag.png",
      "modular-suite/props/ship_crew_galley/ship_hardtack_barrel.png",
      "modular-suite/props/ship_cargo_hold/cargo_braced_shipping_crate.png",
      "modular-suite/props/ship_cargo_hold/cargo_burlap_grain_sacks.png",
      "modular-suite/props/ship_ornaments_damage/ship_plank_repair_patch.png",
    ],
  },
  {
    id: "indoor-dungeon",
    label: "Dungeon & Armory",
    group: "indoor",
    spacing: 1.55,
    minScale: 0.8,
    maxScale: 1.08,
    assetIds: [
      "modular-suite/props/armory_dungeon/arm_iron_shackles.png",
      "modular-suite/props/armory_dungeon/arm_round_shield.png",
      "modular-suite/props/armory_dungeon/arm_crossed_swords.png",
      "modular-suite/props/armory_dungeon/arm_bear_trap.png",
      "modular-suite/props/armory_dungeon/arm_iron_caltrops.png",
      "modular-suite/props/armory_dungeon/arm_rusty_bucket.png",
      "modular-suite/props/mining_cavern/min_corner_cobweb.png",
      "modular-suite/modular/dec_rubble_chips_a.png",
    ],
  },
];

const QUICK_FILTERS = [
  { id: "all", label: "All" },
  { id: "ship", label: "Ships" },
  { id: "tree", label: "Trees" },
  { id: "bush", label: "Bushes" },
  { id: "rock", label: "Rocks" },
  { id: "flower", label: "Flora" },
  { id: "crate", label: "Crates" },
  { id: "food", label: "Food" },
  { id: "office", label: "Study" },
  { id: "medical", label: "Clinic" },
  { id: "arcane", label: "Arcane" },
  { id: "decal", label: "Decals" },
];

interface ScatterZonePanelProps {
  mode: "edit" | "tool";
  name: string;
  assetIds: string[];
  minSpacingCells: number;
  minScale: number;
  maxScale: number;
  avoidWalls: boolean;
  avoidPaths: boolean;
  placedCount?: number;
  seed?: number;
  onChangeName?: (name: string) => void;
  onChangeAssets: (nextAssetIds: string[], presetLabel?: string) => void;
  onChangeSettings: (partial: {
    minSpacingCells?: number;
    minScale?: number;
    maxScale?: number;
    avoidWalls?: boolean;
    avoidPaths?: boolean;
  }) => void;
  onReseed?: () => void;
  onDelete?: () => void;
}

export const ScatterZonePanel: React.FC<ScatterZonePanelProps> = ({
  mode,
  name,
  assetIds,
  minSpacingCells,
  minScale,
  maxScale,
  avoidWalls,
  avoidPaths,
  placedCount,
  seed,
  onChangeName,
  onChangeAssets,
  onChangeSettings,
  onReseed,
  onDelete,
}) => {
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [presetTab, setPresetTab] = useState<"outdoor" | "indoor">("outdoor");

  const allAssets = useVaultStore((s) => s.assets);
  const selectedVaultAssetId = useVaultStore((s) => s.selectedAssetId);

  const objectAssets = useMemo(
    () => allAssets.filter((a) => a.category === "object"),
    [allAssets],
  );
  const assetById = useMemo(() => {
    const m = new Map<string, VaultAsset>();
    for (const a of allAssets) m.set(a.id, a);
    return m;
  }, [allAssets]);

  const activeSet = useMemo(() => new Set(assetIds), [assetIds]);

  const selectedVaultObject = useMemo(() => {
    if (!selectedVaultAssetId) return null;
    const found = assetById.get(selectedVaultAssetId);
    return found && found.category === "object" ? found : null;
  }, [assetById, selectedVaultAssetId]);

  const pickerList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = objectAssets.filter((a) => {
      const hay = `${a.displayName} ${a.id} ${a.tags.join(" ")}`.toLowerCase();
      if (quickFilter !== "all") {
        if (quickFilter === "flower") {
          if (!["flower", "flora", "fern", "mushroom", "reeds", "plant"].some((k) => hay.includes(k))) {
            return false;
          }
        } else if (quickFilter === "crate") {
          if (!["crate", "barrel", "sack", "basket", "chest", "storage"].some((k) => hay.includes(k))) {
            return false;
          }
        } else if (quickFilter === "food") {
          if (!["food", "bakery", "kitchen", "tavern", "bread", "cake", "pie", "drink", "tea", "tableware"].some((k) => hay.includes(k))) {
            return false;
          }
        } else if (quickFilter === "office") {
          if (!["post_office", "study", "school", "courtroom", "book", "ledger", "letter", "paper", "quill"].some((k) => hay.includes(k))) {
            return false;
          }
        } else if (quickFilter === "medical") {
          if (!["doctor", "clinic", "medical", "apothecary", "bandage", "surgical", "herb"].some((k) => hay.includes(k))) {
            return false;
          }
        } else if (quickFilter === "arcane") {
          if (!["arcane", "alchemy", "magic", "potion", "crystal", "rune", "grimoire", "scroll"].some((k) => hay.includes(k))) {
            return false;
          }
        } else if (!hay.includes(quickFilter)) {
          return false;
        }
      }
      if (q && !hay.includes(q)) return false;
      return true;
    });
    // Sort: built-in CC0 modular/core props first so curated new assets surface immediately!
    filtered.sort((a, b) => {
      const aMod = a.id.startsWith("modular-suite/") ? 0 : a.sourceKind === "dcpack" ? 1 : 2;
      const bMod = b.id.startsWith("modular-suite/") ? 0 : b.sourceKind === "dcpack" ? 1 : 2;
      if (aMod !== bMod) return aMod - bMod;
      return a.displayName.localeCompare(b.displayName);
    });
    return filtered.slice(0, 48);
  }, [objectAssets, search, quickFilter]);

  const toggleAsset = (id: string) => {
    if (activeSet.has(id)) {
      if (assetIds.length <= 1) return; // Always keep at least 1 prop in the scatter list
      onChangeAssets(assetIds.filter((x) => x !== id));
    } else {
      onChangeAssets([...assetIds, id]);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {mode === "edit" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="text"
              className="dc-input"
              style={{ flex: 1, fontSize: 11, height: 26 }}
              value={name}
              aria-label="Scatter Zone Name"
              onChange={(e) => onChangeName?.(e.target.value)}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 8px",
              borderRadius: 6,
              background: "var(--bg-panel)",
              border: "1px solid var(--border-subtle)",
              fontSize: 11,
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--accent-gold)", fontFamily: "var(--font-mono)" }}>
                {placedCount ?? 0}
              </strong>{" "}
              props ·{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>
                #{seed}
              </span>
            </span>
            <button
              type="button"
              className="dc-chip active"
              style={{ height: 22, fontSize: 10, gap: 4 }}
              onClick={onReseed}
              title="Generate a fresh Poisson-disc arrangement"
            >
              <RefreshCw size={11} />
              <span>Re-Seed</span>
            </button>
          </div>
        </>
      )}

      {/* 1. Curated Scatter Presets (Outdoor / Indoor Switcher) */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 5,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--accent-gold)",
            }}
          >
            <Sparkles size={11} />
            <span>Scatter Presets</span>
          </span>
          <div style={{ display: "inline-flex", gap: 3 }}>
            <button
              type="button"
              className={`dc-chip ${presetTab === "outdoor" ? "active" : ""}`}
              style={{ height: 19, fontSize: 9.5, padding: "0 6px" }}
              onClick={() => setPresetTab("outdoor")}
            >
              Outdoor (8)
            </button>
            <button
              type="button"
              className={`dc-chip ${presetTab === "indoor" ? "active" : ""}`}
              style={{ height: 19, fontSize: 9.5, padding: "0 6px" }}
              onClick={() => setPresetTab("indoor")}
            >
              Indoor (10)
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {SCATTER_PRESETS.filter((p) => p.group === presetTab).map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="dc-chip"
              style={{ height: 22, fontSize: 10, padding: "0 7px" }}
              onClick={() => {
                onChangeAssets([...preset.assetIds], preset.label);
                onChangeSettings({
                  minSpacingCells: preset.spacing,
                  minScale: preset.minScale,
                  maxScale: preset.maxScale,
                });
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Active Prop Palette inside this Scatter Zone */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 5,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
            }}
          >
            Active Props ({assetIds.length})
          </span>
          {selectedVaultObject && !activeSet.has(selectedVaultObject.id) && (
            <button
              type="button"
              className="dc-chip active"
              style={{ height: 20, fontSize: 9, padding: "0 6px", gap: 3 }}
              title={`Add "${selectedVaultObject.displayName}" from the Asset Vault`}
              onClick={() => onChangeAssets([...assetIds, selectedVaultObject.id])}
            >
              <Plus size={10} />
              <span>Add Vault Prop</span>
            </button>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 4,
            padding: 5,
            borderRadius: 6,
            background: "var(--bg-panel)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {assetIds.map((id) => {
            const meta = assetById.get(id);
            const fallbackUrl = id.startsWith("modular-suite/")
              ? `/assets/modular-suite-cc0/${id.slice("modular-suite/".length)}`
              : id.startsWith("core-fantasy/")
                ? `/assets/core-fantasy-cc0/${id.slice("core-fantasy/".length)}`
                : `/assets/starter-cc0/${id}`;
            return (
              <div
                key={id}
                title={`${meta?.displayName ?? id} — Click × to remove`}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "4px 2px 3px",
                  borderRadius: 5,
                  background: "rgba(229, 169, 60, 0.1)",
                  border: "1px solid rgba(229, 169, 60, 0.45)",
                }}
              >
                <img
                  src={meta?.thumbUrl ?? fallbackUrl}
                  alt={meta?.displayName ?? id}
                  style={{ width: 28, height: 28, objectFit: "contain" }}
                />
                <span
                  style={{
                    fontSize: 8.5,
                    color: "var(--text-secondary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    width: "100%",
                    textAlign: "center",
                    marginTop: 2,
                  }}
                >
                  {meta?.displayName ?? id.split("/").pop()?.replace(".png", "")}
                </span>
                {assetIds.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove ${meta?.displayName ?? id}`}
                    onClick={() => toggleAsset(id)}
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      width: 15,
                      height: 15,
                      borderRadius: "50%",
                      border: "1px solid var(--border-strong)",
                      background: "#181B24",
                      color: "#FCA5A5",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <X size={9} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Interactive Visual Prop Picker (click any tile to toggle into scatter palette!) */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          Pick Props to Scatter (Click to Toggle)
        </div>
        <div className="dc-search-input" style={{ height: 24, padding: "0 7px", marginBottom: 5 }}>
          <Search size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            type="search"
            placeholder="Search trees, bushes, crates, rocks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: 10 }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.id}
              type="button"
              className={`dc-chip ${quickFilter === qf.id ? "active" : ""}`}
              style={{ height: 19, fontSize: 9.5, padding: "0 6px" }}
              onClick={() => setQuickFilter(qf.id)}
            >
              {qf.label}
            </button>
          ))}
        </div>
        <div
          className="dc-scroll"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 4,
            maxHeight: 158,
            overflowY: "auto",
            padding: 4,
            borderRadius: 6,
            background: "var(--bg-canvas)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {pickerList.map((item) => {
            const included = activeSet.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                title={item.displayName}
                aria-pressed={included}
                onClick={() => toggleAsset(item.id)}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "4px 2px 3px",
                  borderRadius: 5,
                  border: `1px solid ${included ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                  background: included ? "rgba(229, 169, 60, 0.16)" : "var(--bg-panel)",
                  cursor: "pointer",
                  minWidth: 0,
                }}
              >
                <img
                  src={item.thumbUrl}
                  alt={item.displayName}
                  loading="lazy"
                  style={{ width: 30, height: 30, objectFit: "contain" }}
                />
                <span
                  style={{
                    fontSize: 8.5,
                    color: included ? "#FDE68A" : "var(--text-secondary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    width: "100%",
                    textAlign: "center",
                    marginTop: 2,
                  }}
                >
                  {item.displayName}
                </span>
                {included && (
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      background: "var(--accent-gold)",
                      color: "#11131A",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={9} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Density, Scale & Collision Controls */}
      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 6 }}>
        <div className="dc-field-row">
          <span className="dc-field-label">Spacing ({minSpacingCells.toFixed(1)} sq)</span>
          <input
            type="range"
            className="dc-range"
            style={{ width: 112 }}
            min={0.7}
            max={5.5}
            step={0.1}
            value={minSpacingCells}
            onChange={(e) => onChangeSettings({ minSpacingCells: Number(e.target.value) })}
          />
        </div>
        <div className="dc-field-row">
          <span className="dc-field-label">Min Scale ({minScale.toFixed(2)}×)</span>
          <input
            type="range"
            className="dc-range"
            style={{ width: 112 }}
            min={0.35}
            max={1.6}
            step={0.05}
            value={minScale}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChangeSettings({ minScale: v, maxScale: Math.max(v, maxScale) });
            }}
          />
        </div>
        <div className="dc-field-row">
          <span className="dc-field-label">Max Scale ({maxScale.toFixed(2)}×)</span>
          <input
            type="range"
            className="dc-range"
            style={{ width: 112 }}
            min={0.45}
            max={2.0}
            step={0.05}
            value={maxScale}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChangeSettings({ maxScale: v, minScale: Math.min(minScale, v) });
            }}
          />
        </div>
        <div className="dc-field-row">
          <span className="dc-field-label">Avoid Walls</span>
          <button
            type="button"
            role="switch"
            aria-checked={avoidWalls}
            className="dc-switch"
            onClick={() => onChangeSettings({ avoidWalls: !avoidWalls })}
          />
        </div>
        <div className="dc-field-row">
          <span className="dc-field-label">Avoid Tracks &amp; Paths</span>
          <button
            type="button"
            role="switch"
            aria-checked={avoidPaths}
            className="dc-switch"
            onClick={() => onChangeSettings({ avoidPaths: !avoidPaths })}
          />
        </div>
      </div>

      {mode === "edit" && onDelete && (
        <button
          type="button"
          className="dc-btn"
          style={{
            width: "100%",
            color: "#fca5a5",
            borderColor: "rgba(239, 68, 68, 0.45)",
            fontSize: 11,
          }}
          onClick={onDelete}
        >
          <Trash2 size={12} />
          <span>Delete Scatter Zone</span>
        </button>
      )}
    </div>
  );
};
