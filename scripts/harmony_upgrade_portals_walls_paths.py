"""
Step 3A — In-Place Painterly Harmonization of ALL Earliest Flat Structural Assets:
  - ALL 44 existing Portals (doors, windows, gates, hatches) across starter, core-fantasy & modular-suite
  - ALL 59 existing Walls across starter, core-fantasy & modular-suite
  - ALL 56 remaining early flat Paths (skipping the 5 newly upgraded stair paths & bespoke ic_mini_brass_track)

Preserves 100% of existing filenames, IDs, and native pixel dimensions while upgrading
every single asset to our 2x-supersampled hand-inked painterly Berlin Dark-Magipunk standard!
"""

from __future__ import annotations

from pathlib import Path
from PIL import Image

from harmony_arch_generators import render_path, render_portal, render_wall
from harmony_art_engine import CORE_DIR, DD_RED_DEEP, MOD_DIR, SCRATCH_DIR, STARTER_DIR, save_qa_sheet

# =============================================================================
# 1. ALL 44 EXISTING PORTALS (exact filename & pixel size preserved!)
# =============================================================================
PORTAL_UPGRADES: list[tuple[Path, dict]] = [
    # --- starter-cc0 (9 portals) ---
    (STARTER_DIR / "portals/jugendstil_brass_door.png", dict(kind="door_double", base=(128, 66, 38), trim=(208, 168, 72), jamb=(118, 98, 62), jamb_style="brass", gilded_frame=True, seed=101)),
    (STARTER_DIR / "portals/magiglass_stained_window.png", dict(kind="window_stained", base=(68, 76, 86), trim=(206, 168, 74), jamb=(112, 110, 108), palette=[(56, 188, 224), (222, 178, 62), (76, 206, 232)], seed=102)),
    (STARTER_DIR / "portals/tenement_slum_door.png", dict(kind="door_single", base=(116, 84, 58), trim=(74, 78, 84), jamb=(98, 92, 86), iron_bands=True, planks=5, seed=103)),
    (STARTER_DIR / "portals/slum_grimy_window.png", dict(kind="window_mullion", base=(88, 74, 58), glass=(186, 164, 114), glow=(238, 194, 106), jamb=(102, 96, 90), panes=3, seed=104)),
    (STARTER_DIR / "portals/aether_sliding_gate.png", dict(kind="door_sliding_aether", base=(46, 76, 72), trim=(198, 160, 74), glow=(64, 214, 238), jamb=(74, 84, 88), jamb_style="iron", seed=105)),
    (STARTER_DIR / "portals/station_oak_door.png", dict(kind="door_single", base=(146, 98, 56), trim=(194, 156, 72), jamb=(106, 104, 102), planks=4, seed=106)),
    (STARTER_DIR / "portals/funicular_iron_gate.png", dict(kind="gate_iron", base=(66, 74, 84), trim=(198, 162, 74), jamb=(82, 88, 96), jamb_style="iron", bars=8, seed=107)),
    (STARTER_DIR / "portals/station_mullion_window.png", dict(kind="window_mullion", base=(74, 84, 96), glass=(116, 174, 212), jamb=(108, 112, 118), jamb_style="iron", panes=3, seed=108)),
    (STARTER_DIR / "portals/machine_steel_hatch.png", dict(kind="door_vault", base=(84, 94, 106), trim=(202, 164, 72), jamb=(68, 76, 86), jamb_style="iron", seed=109)),

    # --- core-fantasy-cc0 (16 portals) ---
    (CORE_DIR / "portals/oak_tavern_door.png", dict(kind="door_single", base=(148, 100, 56), trim=(188, 150, 68), jamb=(118, 112, 104), planks=4, seed=110)),
    (CORE_DIR / "portals/iron_dungeon_door.png", dict(kind="door_single", base=(96, 76, 62), trim=(62, 68, 76), jamb=(104, 102, 102), iron_bands=True, planks=4, seed=111)),
    (CORE_DIR / "portals/prison_cell_gate.png", dict(kind="gate_iron", base=(68, 74, 82), trim=(92, 98, 106), jamb=(108, 108, 110), bars=9, seed=112)),
    (CORE_DIR / "portals/castle_double_door.png", dict(kind="door_double", base=(128, 86, 52), trim=(178, 146, 74), jamb=(116, 114, 110), seed=113)),
    (CORE_DIR / "portals/palace_gilded_door.png", dict(kind="door_double", base=(146, 42, 46), trim=(224, 184, 76), jamb=(206, 198, 182), gilded_frame=True, seed=114)),
    (CORE_DIR / "portals/crypt_stone_door.png", dict(kind="door_single", base=(128, 128, 130), trim=(142, 146, 152), jamb=(104, 106, 108), jamb_style="moss_stone", planks=2, seed=115)),
    (CORE_DIR / "portals/secret_bookcase_door.png", dict(kind="door_bookcase", base=(116, 74, 42), jamb=(106, 102, 96), seed=116)),
    (CORE_DIR / "portals/portcullis_iron_gate.png", dict(kind="gate_iron", base=(58, 64, 72), trim=(104, 110, 118), jamb=(112, 110, 108), bars=8, mid_bar=True, seed=117)),
    (CORE_DIR / "portals/tavern_leaded_window.png", dict(kind="window_mullion", base=(118, 78, 46), glass=(138, 194, 218), jamb=(116, 110, 102), panes=4, diamond_lead=True, seed=118)),
    (CORE_DIR / "portals/mansion_mullion_window.png", dict(kind="window_mullion", base=(212, 202, 182), glass=(142, 196, 224), jamb=(196, 188, 170), panes=4, seed=119)),
    (CORE_DIR / "portals/shuttered_cottage_window.png", dict(kind="window_mullion", base=(124, 84, 50), glass=(114, 168, 198), jamb=(118, 80, 48), jamb_style="wood", panes=2, shutters="open", shutter_rgb=(66, 106, 72), seed=120)),
    (CORE_DIR / "portals/castle_arrow_slit.png", dict(kind="window_slit", base=(124, 126, 130), jamb=(108, 110, 114), seed=121)),
    (CORE_DIR / "portals/wooden_trapdoor_hatch.png", dict(kind="hatch_floor", w=256, h=256, sub="wood_trapdoor", base=(142, 96, 56), trim=(74, 80, 88), jamb=(112, 108, 104), seed=122)),
    (CORE_DIR / "portals/iron_sewer_grate.png", dict(kind="hatch_floor", w=256, h=256, sub="iron_grate", base=(72, 80, 88), trim=(112, 118, 124), jamb=(102, 104, 106), bars=6, seed=123)),
    (CORE_DIR / "portals/colorable_wood_door.png", dict(kind="door_single", colorable=True, trim=(198, 162, 74), jamb=(120, 116, 112), seed=124)),
    (CORE_DIR / "portals/colorable_stained_window.png", dict(kind="window_mullion", colorable=True, base=(62, 66, 74), jamb=(112, 110, 108), panes=4, diamond_lead=True, seed=125)),

    # --- modular-suite-cc0 (19 portals) ---
    (MOD_DIR / "portals/portal_clinic_double.png", dict(kind="door_double", base=(226, 228, 228), trim=(188, 158, 86), jamb=(196, 198, 198), glass_inset=True, glass=(172, 214, 224), seed=126)),
    (MOD_DIR / "portals/portal_bakery_window.png", dict(kind="window_mullion", base=(136, 86, 48), glass=(154, 206, 226), glow=(255, 222, 152), jamb=(132, 82, 46), jamb_style="wood", panes=4, seed=127)),
    (MOD_DIR / "portals/portal_post_grille.png", dict(kind="gate_iron", base=(116, 76, 44), trim=(208, 170, 74), jamb=(116, 76, 44), jamb_style="wood", bars=11, brass_bars=True, mid_bar=False, seed=128)),
    (MOD_DIR / "portals/portal_cemetery_gate.png", dict(kind="gate_iron", base=(52, 58, 64), trim=(94, 102, 108), jamb=(114, 114, 116), jamb_style="moss_stone", bars=10, seed=129)),
    (MOD_DIR / "portals/portal_stained_lancet.png", dict(kind="window_stained", base=(58, 60, 68), trim=(182, 150, 74), jamb=(112, 112, 116), palette=[(178, 42, 56), (48, 102, 184), (218, 166, 44), (52, 142, 88)], seed=130)),
    (MOD_DIR / "portals/portal_barn_sliding.png", dict(kind="door_single", base=(142, 92, 52), trim=(68, 72, 78), jamb=(106, 70, 40), jamb_style="wood", iron_bands=True, planks=5, seed=131)),
    (MOD_DIR / "portals/portal_tavern_saloon.png", dict(kind="door_saloon", base=(162, 112, 66), trim=(194, 156, 74), jamb=(112, 76, 46), jamb_style="wood", seed=132)),
    (MOD_DIR / "portals/portal_bank_vault.png", dict(kind="door_vault", base=(114, 122, 130), trim=(212, 174, 72), jamb=(82, 88, 96), jamb_style="iron", seed=133)),
    (MOD_DIR / "portals/portal_cellar_hatch.png", dict(kind="door_double", base=(128, 90, 58), trim=(74, 80, 86), jamb=(112, 110, 106), seed=134)),
    (MOD_DIR / "portals/portal_greenhouse_win.png", dict(kind="window_mullion", base=(224, 228, 224), glass=(158, 212, 228), jamb=(214, 218, 214), jamb_style="iron", panes=4, seed=135)),
    (MOD_DIR / "portals/portal_cottage_door.png", dict(kind="door_single", base=(154, 106, 62), trim=(186, 148, 72), jamb=(114, 80, 48), jamb_style="wood", planks=4, seed=136)),
    (MOD_DIR / "portals/portal_prison_grate.png", dict(kind="gate_iron", base=(62, 68, 76), trim=(104, 110, 118), jamb=(108, 108, 112), bars=10, seed=137)),
    (MOD_DIR / "portals/portal_crypt_arch.png", dict(kind="door_archway", base=(118, 118, 120), trim=(138, 138, 138), jamb=(106, 108, 110), jamb_style="moss_stone", moss=0.28, seed=138)),
    (MOD_DIR / "portals/portal_colorable_door.png", dict(kind="door_single", colorable=True, trim=(198, 162, 74), jamb=(120, 116, 112), seed=139)),
    (MOD_DIR / "portals/portal_colorable_double.png", dict(kind="door_double", colorable=True, trim=(198, 162, 74), jamb=(120, 116, 112), seed=140)),
    (MOD_DIR / "portals/portal_colorable_window.png", dict(kind="window_mullion", colorable=True, color_frame=True, glass=(136, 190, 218), jamb=(120, 116, 112), panes=4, seed=141)),
    (MOD_DIR / "portals/ship_cabin_brass_door.png", dict(kind="door_single", base=(146, 94, 48), trim=(216, 176, 72), jamb=(178, 140, 60), jamb_style="brass", planks=4, seed=142)),
    (MOD_DIR / "portals/ship_brass_porthole.png", dict(kind="window_mullion", base=(198, 160, 68), glass=(88, 184, 224), jamb=(176, 140, 58), jamb_style="brass", panes=2, seed=143)),
    (MOD_DIR / "portals/ship_gunport_shutter.png", dict(kind="door_single", base=(104, 70, 44), trim=(74, 80, 88), jamb=(86, 58, 36), jamb_style="wood", iron_bands=True, planks=5, seed=144)),
]


# =============================================================================
# 2. ALL 59 EXISTING WALLS (512x128 horizontally seamless!)
# =============================================================================
WALL_UPGRADES: list[tuple[Path, dict]] = [
    # --- starter-cc0 (9 walls) ---
    (STARTER_DIR / "walls/grunderzeit_brick_wall.png", dict(kind="brick", base=(142, 62, 48), mortar=(56, 48, 44), soot=True, rows=3, cols=11, seed=201)),
    (STARTER_DIR / "walls/prussian_limestone_wall.png", dict(kind="ashlar", base=(208, 198, 176), mortar=(92, 86, 76), accent=(196, 160, 74), center_strip=True, rows=2, cols=8, seed=202)),
    (STARTER_DIR / "walls/jugendstil_iron_balustrade.png", dict(kind="balustrade", base=(58, 66, 72), accent=(206, 168, 72), amp=18, posts=8, seed=203)),
    (STARTER_DIR / "walls/aether_conduit_bulkhead.png", dict(kind="bulkhead", base=(64, 78, 86), accent=(194, 158, 74), glow=(64, 212, 236), seed=204)),
    (STARTER_DIR / "walls/tenement_plaster_wall.png", dict(kind="plaster_timber", base=(158, 146, 126), trim=(94, 72, 52), infill="peeling", bays=4, seed=205)),
    (STARTER_DIR / "walls/alpine_stone_wall.png", dict(kind="ashlar", base=(128, 134, 142), mortar=(52, 56, 64), rows=2, cols=7, cracks=0.55, seed=206)),
    (STARTER_DIR / "walls/timber_station_wall.png", dict(kind="plaster_timber", base=(126, 82, 48), trim=(74, 80, 88), accent=(196, 160, 72), infill="wood_panel", bays=4, seed=207)),
    (STARTER_DIR / "walls/iron_safety_railing.png", dict(kind="balustrade", base=(72, 80, 90), accent=(172, 150, 84), amp=12, posts=10, seed=208)),
    (STARTER_DIR / "walls/retaining_cliff_wall.png", dict(kind="ashlar", base=(104, 110, 118), mortar=(44, 48, 56), rows=3, cols=9, moss=0.14, seed=209)),

    # --- core-fantasy-cc0 (16 walls) ---
    (CORE_DIR / "walls/castle_ashlar_wall.png", dict(kind="ashlar", base=(142, 144, 148), mortar=(58, 60, 66), rows=2, cols=8, cracks=0.45, seed=210)),
    (CORE_DIR / "walls/dungeon_stone_wall.png", dict(kind="ashlar", base=(116, 112, 118), mortar=(46, 44, 50), rows=3, cols=9, moss=0.12, cracks=0.6, seed=211)),
    (CORE_DIR / "walls/crypt_mossy_wall.png", dict(kind="ashlar", base=(118, 120, 112), mortar=(46, 52, 44), rows=2, cols=8, moss=0.52, cracks=0.65, seed=212)),
    (CORE_DIR / "walls/cavern_rock_wall.png", dict(kind="cavern_rock", base=(108, 102, 108), rocks=14, seed=213)),
    (CORE_DIR / "walls/tavern_halftimber_wall.png", dict(kind="plaster_timber", base=(216, 206, 182), trim=(104, 68, 40), infill="plaster", bays=4, seed=214)),
    (CORE_DIR / "walls/mansion_wainscot_wall.png", dict(kind="plaster_timber", base=(142, 92, 54), trim=(94, 58, 34), infill="wood_panel", bays=4, seed=215)),
    (CORE_DIR / "walls/palace_marble_wall.png", dict(kind="ashlar", base=(226, 220, 206), mortar=(148, 140, 128), accent=(214, 178, 78), center_strip=True, rows=2, cols=8, cracks=0.15, seed=216)),
    (CORE_DIR / "walls/sandstone_keep_wall.png", dict(kind="ashlar", base=(198, 172, 126), mortar=(102, 84, 56), rows=2, cols=8, cracks=0.45, seed=217)),
    (CORE_DIR / "walls/ruined_brick_wall.png", dict(kind="ruined_wall", base=(158, 78, 56), moss=0.22, seed=218)),
    (CORE_DIR / "walls/timber_palisade_wall.png", dict(kind="palisade", base=(136, 94, 56), logs=14, seed=219)),
    (CORE_DIR / "walls/log_cabin_wall.png", dict(kind="plaster_timber", base=(146, 98, 58), trim=(102, 66, 38), infill="wood_panel", bays=4, post_w=34, seed=220)),
    (CORE_DIR / "walls/estate_hedgerow_wall.png", dict(kind="hedgerow", base=(68, 116, 52), clumps=12, seed=221)),
    (CORE_DIR / "walls/dungeon_iron_bars.png", dict(kind="balustrade", base=(72, 78, 86), accent=(114, 120, 128), amp=8, posts=12, brass_studs=False, seed=222)),
    (CORE_DIR / "walls/estate_wrought_fence.png", dict(kind="balustrade", base=(58, 62, 68), accent=(212, 174, 72), amp=16, posts=8, seed=223)),
    (CORE_DIR / "walls/colorable_plaster_wall.png", dict(kind="plaster_timber", colorable=True, trim=(112, 74, 44), infill="plaster", bays=4, seed=224)),
    (CORE_DIR / "walls/colorable_tapestry_wall.png", dict(kind="brick", colorable=True, mortar=(72, 24, 24), rows=3, cols=10, seed=225)),

    # --- modular-suite-cc0 (34 walls) ---
    (MOD_DIR / "walls/wall_clinic_plaster.png", dict(kind="plaster_timber", base=(228, 228, 224), trim=(142, 134, 122), infill="plaster", bays=4, seed=226)),
    (MOD_DIR / "walls/wall_bakery_brick.png", dict(kind="brick", base=(168, 82, 54), mortar=(76, 62, 54), rows=3, cols=11, seed=227)),
    (MOD_DIR / "walls/wall_cemetery_iron.png", dict(kind="balustrade", base=(56, 62, 68), accent=(96, 104, 110), amp=14, posts=8, stone_curb=True, mortar=(94, 96, 98), seed=228)),
    (MOD_DIR / "walls/wall_white_picket.png", dict(kind="picket", base=(232, 228, 218), pickets=24, seed=229)),
    (MOD_DIR / "walls/wall_garden_cobble.png", dict(kind="ashlar", base=(158, 152, 140), mortar=(72, 68, 62), rows=2, cols=9, moss=0.22, seed=230)),
    (MOD_DIR / "walls/wall_chapel_stone.png", dict(kind="ashlar", base=(118, 114, 124), mortar=(44, 42, 48), rows=3, cols=9, buttresses=True, moss=0.08, seed=231)),
    (MOD_DIR / "walls/wall_bamboo_screen.png", dict(kind="plaster_timber", base=(192, 168, 96), trim=(132, 108, 56), infill="wood_panel", bays=4, seed=232)),
    (MOD_DIR / "walls/wall_industrial_iron.png", dict(kind="bulkhead", base=(96, 104, 112), accent=(148, 156, 164), plates=4, seed=233)),
    (MOD_DIR / "walls/wall_cavern_crystal.png", dict(kind="cavern_rock", base=(88, 92, 106), crystals=True, crystal_rgb=(76, 214, 242), rocks=12, seed=234)),
    (MOD_DIR / "walls/wall_cellar_brick.png", dict(kind="brick", base=(118, 82, 68), mortar=(48, 42, 40), soot=True, moss=0.14, rows=3, cols=11, seed=235)),
    (MOD_DIR / "walls/wall_adobe_mudbrick.png", dict(kind="plaster_timber", base=(198, 158, 112), trim=(142, 104, 68), infill="plaster", bays=4, seed=236)),
    (MOD_DIR / "walls/wall_temple_marble.png", dict(kind="ashlar", base=(230, 226, 214), mortar=(154, 146, 132), accent=(212, 176, 76), center_strip=True, rows=2, cols=8, seed=237)),
    (MOD_DIR / "walls/wall_blooming_hedge.png", dict(kind="hedgerow", base=(68, 122, 54), blossom=(228, 112, 148), clumps=12, seed=238)),
    (MOD_DIR / "walls/wall_barn_timber.png", dict(kind="plaster_timber", base=(134, 92, 58), trim=(88, 58, 36), infill="wood_panel", bays=4, seed=239)),
    (MOD_DIR / "walls/wall_colorable_plaster.png", dict(kind="plaster_timber", colorable=True, trim=(112, 74, 44), infill="plaster", bays=4, seed=240)),
    (MOD_DIR / "walls/wall_colorable_brick.png", dict(kind="brick", colorable=True, mortar=(72, 24, 24), rows=3, cols=11, seed=241)),
    (MOD_DIR / "walls/cave_granite_jagged.png", dict(kind="cavern_rock", base=(118, 122, 130), rocks=14, seed=242)),
    (MOD_DIR / "walls/cave_mossy_grotto.png", dict(kind="cavern_rock", base=(106, 114, 104), moss=0.58, rocks=14, seed=243)),
    (MOD_DIR / "walls/cave_sandstone_canyon.png", dict(kind="cavern_rock", base=(178, 128, 82), rocks=14, seed=244)),
    (MOD_DIR / "walls/cave_glacial_ice.png", dict(kind="cavern_rock", base=(144, 198, 228), crystals=True, crystal_rgb=(214, 244, 255), rocks=14, seed=245)),
    (MOD_DIR / "walls/cave_obsidian_volcanic.png", dict(kind="cavern_rock", base=(54, 52, 62), magma=True, rocks=14, seed=246)),
    (MOD_DIR / "walls/cave_earth_burrow.png", dict(kind="cavern_rock", base=(126, 94, 66), moss=0.14, rocks=14, seed=247)),
    (MOD_DIR / "walls/dungeon_ashlar_cutstone.png", dict(kind="ashlar", base=(138, 142, 146), mortar=(52, 56, 62), rows=2, cols=8, cracks=0.45, seed=248)),
    (MOD_DIR / "walls/cave_colorable_rock.png", dict(kind="cavern_rock", colorable=True, rocks=14, seed=249)),
    (MOD_DIR / "walls/ship_hull_oak_gunwale.png", dict(kind="ship_hull", base=(146, 98, 56), trim=(98, 64, 36), accent=(196, 160, 74), seed=250)),
    (MOD_DIR / "walls/ship_hull_ironclad_riveted.png", dict(kind="bulkhead", base=(88, 96, 106), accent=(158, 166, 174), plates=5, seed=251)),
    (MOD_DIR / "walls/skyship_hull_brass_aether.png", dict(kind="ship_hull", base=(162, 126, 56), trim=(112, 82, 38), accent=(224, 188, 92), glow=(76, 214, 238), seed=252)),
    (MOD_DIR / "walls/ship_railing_carved_oak.png", dict(kind="balustrade", base=(142, 96, 56), accent=(206, 168, 76), amp=14, posts=10, seed=253)),
    (MOD_DIR / "walls/ship_bulkhead_cabin_wood.png", dict(kind="plaster_timber", base=(124, 82, 48), trim=(84, 54, 32), infill="wood_panel", bays=4, seed=254)),
    (MOD_DIR / "walls/ship_hull_colorable.png", dict(kind="ship_hull", colorable=True, trim=(96, 24, 24), accent=(206, 168, 76), seed=255)),
    (MOD_DIR / "walls/water_seawall_masonry.png", dict(kind="ashlar", base=(124, 128, 124), mortar=(48, 56, 50), rows=2, cols=7, moss=0.36, seed=256)),
    (MOD_DIR / "walls/water_pier_rope_railing.png", dict(kind="balustrade", base=(166, 134, 88), accent=(126, 86, 48), amp=12, posts=6, seed=257)),
    (MOD_DIR / "walls/water_yacht_white_hull.png", dict(kind="ship_hull", base=(232, 228, 220), trim=(178, 132, 68), accent=(214, 178, 82), seed=258)),
    (MOD_DIR / "walls/water_timber_retaining_dock.png", dict(kind="palisade", base=(118, 84, 54), logs=16, seed=259)),
]


# =============================================================================
# 3. ALL 56 REMAINING EARLY FLAT PATHS (skipping 5 already-upgraded stair paths & ic_mini_brass_track!)
# =============================================================================
PATH_UPGRADES: list[tuple[Path, dict]] = [
    # --- starter-cc0 (8 remaining) ---
    (STARTER_DIR / "paths/magirail_funicular_track.png", dict(kind="rail_track", w=512, h=192, base=(128, 136, 146), trim=(92, 66, 44), glow=(64, 214, 238), ties=16, seed=301)),
    (STARTER_DIR / "paths/aether_power_conduit.png", dict(kind="conduit_pipe", w=512, h=72, base=(164, 132, 64), accent=(208, 170, 74), glow=(72, 216, 238), pipes=1, seed=302)),
    (STARTER_DIR / "paths/berlin_curb_gutter.png", dict(kind="curb_stone", w=512, h=96, base=(146, 148, 152), rows=1, cols=10, gutter=True, seed=303)),
    (STARTER_DIR / "paths/laundry_banner_line.png", dict(kind="garland_festoon", w=512, h=96, sub="laundry", seed=304)),
    (STARTER_DIR / "paths/funicular_rail_track.png", dict(kind="rail_track", w=512, h=192, base=(124, 130, 138), trim=(104, 72, 46), ties=16, seed=305)),
    (STARTER_DIR / "paths/steel_haul_cable.png", dict(kind="garland_festoon", w=512, h=64, sub="cable", base=(142, 150, 160), seed=306)),
    (STARTER_DIR / "paths/cliff_ledge_dropoff.png", dict(kind="cliff_embankment", w=512, h=128, sub="rock", base=(104, 108, 118), seed=307)),
    (STARTER_DIR / "paths/maintenance_catwalk.png", dict(kind="wood_deck", w=512, h=112, base=(124, 88, 56), trim=(74, 80, 88), rails=True, planks=24, seed=308)),

    # --- core-fantasy-cc0 (13 remaining) ---
    (CORE_DIR / "paths/dirt_country_road.png", dict(kind="dirt_ruts", base=(154, 124, 86), seed=309)),
    (CORE_DIR / "paths/cobble_village_lane.png", dict(kind="cobble_lane", base=(142, 140, 136), bed_rgb=(96, 90, 82), stones=42, moss=0.14, seed=310)),
    (CORE_DIR / "paths/forest_stepping_stones.png", dict(kind="cobble_lane", base=(148, 146, 138), bed=False, stepping=True, stones=14, moss=0.35, seed=311)),
    (CORE_DIR / "paths/babbling_brook.png", dict(kind="water_stream", base=(72, 156, 186), ribbons=12, seed=312)),
    (CORE_DIR / "paths/wagon_wheel_ruts.png", dict(kind="dirt_ruts", base=(134, 104, 72), seed=313)),
    (CORE_DIR / "paths/rope_suspension_bridge.png", dict(kind="wood_deck", base=(152, 108, 66), trim=(178, 146, 96), rails=True, planks=18, gap=6, seed=314)),
    (CORE_DIR / "paths/wooden_dock_planks.png", dict(kind="wood_deck", base=(138, 98, 62), trim=(94, 66, 40), rails=False, planks=20, gap=5, seed=315)),
    (CORE_DIR / "paths/dungeon_iron_chains.png", dict(kind="garland_festoon", sub="chain", base=(96, 102, 112), seed=316)),
    (CORE_DIR / "paths/cliff_drop_ledge.png", dict(kind="cliff_embankment", sub="rock", base=(112, 108, 112), seed=317)),
    (CORE_DIR / "paths/royal_crimson_runner.png", dict(kind="runner_carpet", base=(146, 30, 38), accent=(218, 178, 72), seed=318)),
    (CORE_DIR / "paths/colorable_royal_runner.png", dict(kind="runner_carpet", colorable=True, accent=(224, 186, 82), seed=319)),
    (CORE_DIR / "paths/colorable_arcane_conduit.png", dict(kind="conduit_pipe", colorable=True, accent=(214, 176, 78), pipes=1, seed=320)),
    (CORE_DIR / "paths/ivy_vine_trail.png", dict(kind="garland_festoon", sub="vine", base=(66, 122, 54), seed=321)),

    # --- modular-suite-cc0 (35 remaining, skipping ic_mini_brass_track.png) ---
    (MOD_DIR / "paths/path_garden_gravel.png", dict(kind="cobble_lane", base=(178, 170, 154), bed_rgb=(156, 146, 128), stones=48, seed=322)),
    (MOD_DIR / "paths/path_cemetery_stones.png", dict(kind="cobble_lane", base=(146, 146, 142), bed=False, stepping=True, stones=12, moss=0.38, seed=323)),
    (MOD_DIR / "paths/path_brick_walkway.png", dict(kind="curb_stone", base=(166, 92, 66), rows=3, cols=10, moss=0.08, seed=324)),
    (MOD_DIR / "paths/path_stone_curbing.png", dict(kind="curb_stone", base=(154, 152, 146), rows=1, cols=14, moss=0.1, seed=325)),
    (MOD_DIR / "paths/path_drainage_trench.png", dict(kind="curb_stone", base=(96, 106, 96), rows=1, cols=12, gutter=True, moss=0.35, seed=326)),
    (MOD_DIR / "paths/path_narrow_dock_planks.png", dict(kind="wood_deck", base=(142, 102, 64), planks=24, gap=5, seed=327)),
    (MOD_DIR / "paths/path_stone_bridge_deck.png", dict(kind="curb_stone", base=(152, 148, 140), rows=2, cols=14, moss=0.12, seed=328)),
    (MOD_DIR / "paths/path_mine_cart_rails.png", dict(kind="rail_track", base=(114, 120, 128), trim=(104, 72, 46), ballast=False, ties=16, seed=329)),
    (MOD_DIR / "paths/path_rope_post_fence.png", dict(kind="rope_fence", base=(116, 80, 48), accent=(186, 154, 102), seed=330)),
    (MOD_DIR / "paths/path_mossy_crack.png", dict(kind="cracks_fissure", base=(44, 48, 42), moss=0.65, seed=331)),
    (MOD_DIR / "paths/path_flowerbed_border.png", dict(kind="flower_border", base=(68, 124, 56), blossom=(232, 112, 152), seed=332)),
    (MOD_DIR / "paths/path_braided_runner.png", dict(kind="runner_carpet", base=(156, 92, 68), accent=(218, 186, 128), seed=333)),
    (MOD_DIR / "paths/path_wagon_ruts.png", dict(kind="dirt_ruts", base=(128, 96, 66), seed=334)),
    (MOD_DIR / "paths/path_stream_rapids.png", dict(kind="water_stream", base=(78, 162, 194), ribbons=14, seed=335)),
    (MOD_DIR / "paths/path_colorable_runner.png", dict(kind="runner_carpet", colorable=True, accent=(238, 224, 206), seed=336)),
    (MOD_DIR / "paths/path_colorable_trim.png", dict(kind="curb_stone", colorable=True, rows=1, cols=12, moss=0.0, seed=337)),
    (MOD_DIR / "paths/embankment_urban_masonry.png", dict(kind="cliff_embankment", w=512, h=256, sub="masonry", base=(134, 136, 140), seed=338)),
    (MOD_DIR / "paths/embankment_grass_hillside.png", dict(kind="cliff_embankment", w=512, h=256, sub="grass", base=(96, 138, 64), seed=339)),
    (MOD_DIR / "paths/embankment_rocky_cliff.png", dict(kind="cliff_embankment", w=512, h=256, sub="rock", base=(122, 124, 130), seed=340)),
    (MOD_DIR / "paths/embankment_dirt_scree.png", dict(kind="cliff_embankment", w=512, h=256, sub="rock", base=(138, 110, 78), seed=341)),
    (MOD_DIR / "paths/embankment_sandstone_mesa.png", dict(kind="cliff_embankment", w=512, h=256, sub="rock", base=(192, 134, 82), seed=342)),
    (MOD_DIR / "paths/embankment_timber_terraced.png", dict(kind="cliff_embankment", w=512, h=256, sub="masonry", base=(138, 96, 58), seed=343)),
    (MOD_DIR / "paths/embankment_snowy_ridge.png", dict(kind="cliff_embankment", w=512, h=256, sub="rock", base=(196, 212, 226), seed=344)),
    (MOD_DIR / "paths/embankment_colorable_slope.png", dict(kind="cliff_embankment", w=512, h=256, sub="rock", colorable=True, seed=345)),
    (MOD_DIR / "paths/ship_rigging_rope_net.png", dict(kind="wood_deck", base=(168, 136, 88), trim=(142, 108, 64), rails=True, planks=20, gap=14, seed=346)),
    (MOD_DIR / "paths/ship_anchor_chain_path.png", dict(kind="garland_festoon", sub="chain", base=(104, 110, 118), seed=347)),
    (MOD_DIR / "paths/skyship_aether_rail_pipe.png", dict(kind="conduit_pipe", base=(184, 146, 68), accent=(218, 182, 82), glow=(78, 218, 240), pipes=1, seed=348)),
    (MOD_DIR / "paths/ship_timber_keel_frame.png", dict(kind="wood_deck", base=(126, 84, 48), trim=(94, 62, 34), rails=True, planks=12, gap=14, seed=349)),
    (MOD_DIR / "paths/ship_gangplank_walkway.png", dict(kind="wood_deck", base=(148, 106, 64), trim=(98, 66, 38), rails=True, planks=22, gap=3, seed=350)),
    (MOD_DIR / "paths/water_shore_foam_wave.png", dict(kind="water_stream", base=(142, 198, 216), foam_only=True, ribbons=10, seed=351)),
    (MOD_DIR / "paths/water_river_current_rapids.png", dict(kind="water_stream", base=(64, 146, 184), ribbons=14, seed=352)),
    (MOD_DIR / "paths/water_boat_wake_trail.png", dict(kind="water_stream", base=(96, 162, 194), ribbons=8, seed=353)),
    (MOD_DIR / "paths/water_waterfall_cascade.png", dict(kind="water_stream", base=(104, 186, 218), ribbons=16, seed=354)),
    (MOD_DIR / "paths/water_timber_pier_edge.png", dict(kind="rope_fence", base=(118, 84, 52), accent=(148, 114, 76), seed=355)),
    (MOD_DIR / "paths/water_stone_seawall_quay.png", dict(kind="curb_stone", base=(136, 140, 134), rows=1, cols=8, moss=0.32, seed=356)),
]


def main() -> None:
    print("=== UPGRADING ALL 44 EXISTING PORTALS ===")
    p_qa: list[tuple[str, Image.Image]] = []
    for path, spec in PORTAL_UPGRADES:
        im = render_portal(spec)
        im.save(path, "PNG", optimize=True)
        p_qa.append((path.stem, im))
    save_qa_sheet(p_qa, SCRATCH_DIR / "qa_upgraded_portals.png", cols=6, cw=240, ch=125)

    print("=== UPGRADING ALL 59 EXISTING WALLS ===")
    w_qa: list[tuple[str, Image.Image]] = []
    for path, spec in WALL_UPGRADES:
        im = render_wall(spec)
        im.save(path, "PNG", optimize=True)
        w_qa.append((path.stem, im))
    save_qa_sheet(w_qa, SCRATCH_DIR / "qa_upgraded_walls.png", cols=5, cw=280, ch=92)

    print("=== UPGRADING ALL 56 REMAINING EARLY PATHS ===")
    t_qa: list[tuple[str, Image.Image]] = []
    for path, spec in PATH_UPGRADES:
        im = render_path(spec)
        im.save(path, "PNG", optimize=True)
        t_qa.append((path.stem, im))
    save_qa_sheet(t_qa, SCRATCH_DIR / "qa_upgraded_paths.png", cols=5, cw=280, ch=92)

    print(f"DONE Step 3A: Upgraded {len(p_qa)} portals, {len(w_qa)} walls, {len(t_qa)} paths ({len(p_qa)+len(w_qa)+len(t_qa)} total)!")


if __name__ == "__main__":
    main()
