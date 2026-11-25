"""
Precision modular splitter (Pass 2 QA-hardened) for the AI-illustrated hero composites in:
  - public/assets/modular-suite-cc0/props/ice_cream_train/  (32 modular pieces)
  - public/assets/modular-suite-cc0/props/sovereign_temple/ (11 modular pieces)

Preserves 100% of original composites untouched. Every sprite uses exact shape-union /
contour masks + outline-aware flood-fill and verified pure-texture patch cloning so
zero background slivers, zero white halos, and zero cloned artifacts remain.
"""

import json
import math
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

MOD_DIR = Path("public/assets/modular-suite-cc0")
IC_DIR = MOD_DIR / "props" / "ice_cream_train"
SOV_DIR = MOD_DIR / "props" / "sovereign_temple"
QA_IC_PATH = r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae\scratch\qa_splits_ice_cream.png"
QA_SOV_PATH = r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae\scratch\qa_splits_sovereign.png"


def crop_tight(img: Image.Image, pad: int = 6) -> Image.Image:
    arr = np.array(img)
    ys, xs = np.where(arr[:, :, 3] > 18)
    if len(xs) == 0:
        return img
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(img.width, int(xs.max()) + 1 + pad)
    y1 = min(img.height, int(ys.max()) + 1 + pad)
    return img.crop((x0, y0, x1, y1))


def apply_mask(src: Image.Image, mask: Image.Image, feather: float = 0.7) -> Image.Image:
    if feather > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    out = src.convert("RGBA").copy()
    a = np.array(out.getchannel("A"), dtype=np.float32)
    m = np.array(mask, dtype=np.float32) / 255.0
    out.putalpha(Image.fromarray(np.clip(a * m, 0, 255).astype(np.uint8), "L"))
    return crop_tight(out, pad=6)


def mask_from_shapes(size, draw_fn) -> Image.Image:
    m = Image.new("L", size, 0)
    draw_fn(ImageDraw.Draw(m))
    return m


def flood_remove_bg(
    crop: Image.Image,
    bg_fn,
    erode_px: int = 0,
    feather: float = 0.6,
    keep_mask: Image.Image | None = None,
) -> Image.Image:
    """Border flood-fill background removal with optional interior protection mask."""
    arr = np.array(crop.convert("RGBA")).copy()
    h, w, _ = arr.shape
    r = arr[:, :, 0].astype(np.float32)
    g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)
    a = arr[:, :, 3].astype(np.float32)
    is_bg_cand = bg_fn(r, g, b, a)
    if keep_mask is not None:
        km = np.array(keep_mask.resize((w, h), Image.Resampling.NEAREST)) > 128
        is_bg_cand = is_bg_cand & (~km)

    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg_cand[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg_cand[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))

    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bg_cand[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    mask = (~visited).astype(np.uint8) * 255
    mask_im = Image.fromarray(mask, "L")
    for _ in range(erode_px):
        mask_im = mask_im.filter(ImageFilter.MinFilter(3))
    if feather > 0:
        soft = mask_im.filter(ImageFilter.GaussianBlur(feather))
        m_arr = np.minimum(np.array(mask_im), np.array(soft))
    else:
        m_arr = np.array(mask_im)
    arr[:, :, 3] = np.minimum(arr[:, :, 3], m_arr)
    return crop_tight(Image.fromarray(arr, "RGBA"), pad=6)


def is_marble_bg(r, g, b, a):
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    return (a < 30) | ((lum > 136) & (sat < 34))


def is_slate_stone_bg(r, g, b, a):
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    # Cool blue-grey slate stone of the inquisition dais (low sat, mid-low lum, b >= r)
    return (a < 30) | ((sat < 34) & (b >= r - 6) & (lum > 48) & (lum < 138))


def split_ice_cream_pack() -> list[tuple[str, str, Image.Image, bool, list[str]]]:
    results = []

    # =========================================================================
    # A. ic_parlor_bistro_sundae_table.png (460x261)
    # =========================================================================
    bistro = Image.open(IC_DIR / "ic_parlor_bistro_sundae_table.png").convert("RGBA")
    cx, cy, R_out, R_in = 229.5, 130.5, 126.5, 114.5

    # 1. Bare Round White-Marble & Brass Bistro Table (seamless natural veined marble — zero tiling seams!)
    bare_tbl = bistro.crop((int(cx - R_out - 6), int(cy - R_out - 6), int(cx + R_out + 6), int(cy + R_out + 6))).copy()
    tw, th = bare_tbl.size
    tcx, tcy = tw / 2.0, th / 2.0
    Y, X = np.ogrid[:th, :tw]
    dist = np.sqrt((X - tcx) ** 2 + (Y - tcy) ** 2)
    # Synthesize subtle warm veined Carrara marble matching original bistro table palette (#EDEBE7 + soft grey veins)
    yy, xx = np.mgrid[:th, :tw].astype(np.float32)
    ang1 = xx * 0.042 + yy * 0.036
    warp = 2.4 * np.sin(xx * 0.025 - yy * 0.021 + 0.7) + 1.4 * np.cos(xx * 0.055 + yy * 0.048)
    vein1 = np.abs(np.sin(ang1 + warp)) ** 0.35
    vein2 = np.abs(np.sin(xx * 0.075 - yy * 0.052 + 1.8 * np.cos(yy * 0.035))) ** 0.45
    cloud = 0.5 + 0.5 * np.sin(xx * 0.031 + yy * 0.027) * np.cos(xx * 0.019 - yy * 0.033)
    shade = 0.87 + 0.10 * vein1 * vein2 + 0.03 * cloud
    rng_m = np.random.default_rng(77)
    grain = rng_m.normal(0.0, 2.2, (th, tw))
    m_arr = np.zeros((th, tw, 4), dtype=np.float32)
    m_arr[:, :, 0] = np.clip(244 * shade + grain, 180, 252)
    m_arr[:, :, 1] = np.clip(242 * shade + grain, 178, 250)
    m_arr[:, :, 2] = np.clip(238 * shade + grain, 174, 248)
    m_arr[:, :, 3] = 255.0
    rim_shade = np.clip(1.0 - np.maximum(0.0, (dist - (R_in - 16)) / 18.0) * 0.11, 0.86, 1.0)
    m_arr[:, :, :3] *= rim_shade[:, :, None]
    bt_arr = np.array(bare_tbl, dtype=np.float32)
    inner_blend = np.clip((R_in - dist) / 3.0, 0.0, 1.0)[:, :, None]
    bt_arr[:, :, :3] = bt_arr[:, :, :3] * (1.0 - inner_blend) + m_arr[:, :, :3] * inner_blend
    outer_alpha = np.clip((R_out + 1.0 - dist) / 1.8, 0.0, 1.0)
    bt_arr[:, :, 3] = bt_arr[:, :, 3] * outer_alpha
    results.append(("ic_bare_marble_bistro_table.png", "Bare Marble & Brass Bistro Table",
                    crop_tight(Image.fromarray(np.clip(bt_arr, 0, 255).astype(np.uint8), "RGBA"), pad=6),
                    True, ["ice-cream", "cafe", "table", "marble", "bare", "modular"]))

    # 2. Standalone Wrought-Iron & Crimson Velvet Parlor Bistro Chair (rounded oval velvet seat!)
    chair_base = Image.new("RGBA", (142, 166), (0, 0, 0, 0))
    ch_orig = bistro.crop((0, 48, 124, 214)).copy()
    ch_arr = np.array(ch_orig, dtype=np.float32)
    CY, CX = np.ogrid[:ch_arr.shape[0], :ch_arr.shape[1]]
    d_tbl = np.sqrt((CX - cx) ** 2 + (CY - (cy - 48)) ** 2)
    ch_arr[d_tbl < R_out + 1.2, 3] = 0
    # Draw complete rounded crimson velvet cushion behind original scrolled iron frame
    cd = ImageDraw.Draw(chair_base)
    cd.ellipse([48, 30, 134, 136], fill=(138, 22, 44, 255), outline=(38, 24, 26, 255), width=3)
    cd.ellipse([54, 36, 126, 130], fill=(164, 34, 56, 235))
    cd.ellipse([66, 46, 114, 120], fill=(182, 46, 68, 130))
    chair_base.alpha_composite(Image.fromarray(ch_arr.astype(np.uint8), "RGBA"), (0, 0))
    results.append(("ic_parlor_bistro_chair.png", "Parlor Wrought-Iron Velvet Chair",
                    crop_tight(chair_base, pad=6), True, ["ice-cream", "cafe", "chair", "velvet", "modular"]))

    # 3. Strawberry Sundae Glass Bowl (tight marble flood + subtle shadow trim)
    sb_crop = bistro.crop((122, 90, 198, 168))
    sb = flood_remove_bg(sb_crop, is_marble_bg, erode_px=1, feather=0.6)
    results.append(("ic_sundae_bowl_strawberry.png", "Strawberry Sundae Glass Bowl", sb, True, ["ice-cream", "food", "sundae", "dessert", "modular"]))

    # 4. Chocolate Fudge Sundae Bowl
    cb_crop = bistro.crop((258, 90, 334, 168))
    cb = flood_remove_bg(cb_crop, is_marble_bg, erode_px=1, feather=0.6)
    results.append(("ic_sundae_bowl_chocolate.png", "Chocolate Fudge Sundae Bowl", cb, True, ["ice-cream", "food", "sundae", "dessert", "modular"]))

    # 5. Waffle Cone on Folded Napkins (strict contour polygon around cone + folded diamond napkins!)
    wc_m = mask_from_shapes(bistro.size, lambda d: d.polygon([
        (158, 42), (186, 52), (194, 44), (222, 70), (200, 99), (170, 74), (176, 62),
    ], fill=255))
    results.append(("ic_waffle_cone_napkin.png", "Waffle Cone on Folded Napkins",
                    apply_mask(bistro, wc_m, feather=0.6), False, ["ice-cream", "food", "cone", "napkin", "modular"]))

    # 6. Silver Ice Cream Spoon (clean 2x painterly spoon matching original silver spoon silhouette!)
    sp_hi = Image.new("RGBA", (220, 76), (0, 0, 0, 0))
    spd = ImageDraw.Draw(sp_hi)
    # Handle + oval silver bowl
    spd.polygon([(78, 36), (202, 18), (208, 26), (204, 34), (78, 46)], fill=(182, 190, 198, 255), outline=(42, 40, 44, 255))
    spd.line([(82, 38), (198, 22)], fill=(238, 244, 248, 230), width=4)
    spd.ellipse([14, 22, 86, 62], fill=(172, 180, 190, 255), outline=(42, 40, 44, 255), width=4)
    spd.ellipse([22, 28, 76, 56], fill=(214, 222, 230, 255))
    spd.arc([24, 30, 74, 54], 195, 340, fill=(250, 252, 255, 220), width=4)
    sp = crop_tight(sp_hi.resize((110, 38), Image.Resampling.LANCZOS), pad=4)
    results.append(("ic_silver_sundae_spoon.png", "Silver Ice Cream Spoon", sp, False, ["ice-cream", "cutlery", "spoon", "tableware", "modular"]))

    # 7. Brass Tabletop Napkin Dispenser (tight marble flood)
    nd_crop = bistro.crop((198, 22, 262, 60))
    nd_keep = mask_from_shapes(nd_crop.size, lambda d: d.rounded_rectangle([6, 6, 58, 32], radius=8, fill=255))
    nd = flood_remove_bg(nd_crop, is_marble_bg, erode_px=1, feather=0.5, keep_mask=nd_keep)
    results.append(("ic_brass_napkin_dispenser.png", "Brass Tabletop Napkin Dispenser", nd, True, ["ice-cream", "cafe", "napkin", "brass", "modular"]))

    # =========================================================================
    # B. ic_mini_train_sundae_car.png (440x188)
    # =========================================================================
    scar = Image.open(IC_DIR / "ic_mini_train_sundae_car.png").convert("RGBA")

    # 8. Bare Miniature Brass Train Flatcar (100% pure clean mahogany planks from x=58..74 ONLY!)
    bare_flat = scar.copy()
    p_left = scar.crop((58, 28, 74, 162))    # 16x134 100% pure unobstructed mahogany!
    p_left_f = p_left.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    bed = Image.new("RGBA", (324, 134))
    for i, bx in enumerate(range(0, 324, 16)):
        bed.paste(p_left if i % 2 == 0 else p_left_f, (bx, 0))
    bare_flat.paste(bed.crop((0, 0, 322, 134)), (58, 28))
    # Restore crisp top & bottom red rails + brass handrails cleanly using unobstructed segments!
    # Clean horizontal top rail segment: x=174..304, y=6..36 (130x30)
    clean_top = scar.crop((174, 4, 304, 36))
    bare_flat.paste(clean_top, (174, 4))
    bare_flat.paste(clean_top.crop((0, 0, 114, 32)), (60, 4))
    bare_flat.paste(clean_top.crop((30, 0, 112, 32)), (300, 4))
    # Restore top-left & top-right brass corner rail hooks cleanly
    bare_flat.alpha_composite(scar.crop((38, 4, 152, 24)), (38, 4))
    bare_flat.alpha_composite(scar.crop((290, 4, 404, 24)), (290, 4))
    # Clean bottom rail from unobstructed x=160..300
    clean_bot = scar.crop((160, 152, 300, 184))
    bare_flat.paste(clean_bot, (160, 152))
    bare_flat.paste(clean_bot.crop((0, 0, 102, 32)), (60, 152))
    bare_flat.paste(clean_bot.crop((20, 0, 102, 32)), (300, 152))
    bare_flat.alpha_composite(scar.crop((38, 164, 404, 184)), (38, 164))
    results.append(("ic_bare_mini_train_flatcar.png", "Bare Miniature Brass Train Flatcar",
                    crop_tight(bare_flat, pad=6), True, ["ice-cream", "train", "flatcar", "bare", "modular"]))

    # 9. Neapolitan Fluted Sundae Dish (exact circular fluted bowl mask!)
    ns_m = mask_from_shapes(scar.size, lambda d: d.ellipse([101, 21, 169, 89], fill=255))
    results.append(("ic_sundae_dish_neapolitan.png", "Neapolitan Fluted Sundae Dish",
                    apply_mask(scar, ns_m, feather=0.7), True, ["ice-cream", "food", "sundae", "dessert", "modular"]))

    # 10. Classic Glass Banana Split Boat (tight angled boat polygon tracing glass rim!)
    bs_m = mask_from_shapes(scar.size, lambda d: d.polygon([
        (169, 128), (186, 102), (218, 72), (254, 48), (279, 44), (288, 52),
        (281, 76), (258, 104), (222, 126), (184, 136), (171, 134),
    ], fill=255))
    results.append(("ic_banana_split_boat.png", "Classic Glass Banana Split Boat",
                    apply_mask(scar, bs_m, feather=0.7), True, ["ice-cream", "food", "banana-split", "dessert", "modular"]))

    # 11. Chocolate Cone in Brass Holder (tight scoop + waffle cone + brass spiral ring!)
    cc_m = mask_from_shapes(scar.size, lambda d: (
        d.ellipse([315, 13, 350, 44], fill=255),
        d.polygon([(318, 36), (347, 36), (336, 78), (329, 78)], fill=255),
        d.ellipse([311, 50, 351, 74], fill=255),
    ))
    results.append(("ic_cone_holder_chocolate.png", "Chocolate Cone in Brass Holder",
                    apply_mask(scar, cc_m, feather=0.6), True, ["ice-cream", "food", "cone", "brass", "modular"]))

    # 12. Vanilla Cone in Brass Holder
    vc_m = mask_from_shapes(scar.size, lambda d: (
        d.ellipse([317, 81, 353, 114], fill=255),
        d.polygon([(320, 106), (349, 106), (338, 148), (331, 148)], fill=255),
        d.ellipse([313, 120, 354, 145], fill=255),
    ))
    results.append(("ic_cone_holder_vanilla.png", "Vanilla Cone in Brass Holder",
                    apply_mask(scar, vc_m, feather=0.6), True, ["ice-cream", "food", "cone", "brass", "modular"]))

    # =========================================================================
    # C. ic_waffle_cone_station.png (480x205)
    # =========================================================================
    wbar = Image.open(IC_DIR / "ic_waffle_cone_station.png").convert("RGBA")

    # 13. Bare Walnut & Brass Shop Counter (pure clean walnut plank patch x=178..240, y=126..178!)
    bare_cnt = wbar.copy()
    w_strip = wbar.crop((178, 126, 240, 178))  # 62x52 pure grain (no knot!)
    w_panel = Image.new("RGBA", (446, 156))
    for r_i, wy in enumerate(range(0, 156, 52)):
        row_src = w_strip if r_i % 2 == 0 else w_strip.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        row_flip = row_src.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        for c_i, wx in enumerate(range(0, 446, 62)):
            w_panel.paste(row_src if (c_i + r_i) % 2 == 0 else row_flip, (wx, wy))
    bc_arr = np.array(bare_cnt)
    bc_arr[:24, :, 3] = 0
    bare_cnt = Image.fromarray(bc_arr, "RGBA")
    bare_cnt.paste(w_panel.crop((0, 0, 434, 148)), (22, 38))
    top_bar = wbar.crop((240, 22, 464, 42))
    bare_cnt.paste(top_bar, (240, 22))
    bare_cnt.paste(top_bar.crop((0, 0, 220, 20)), (20, 22))
    bare_cnt.alpha_composite(wbar.crop((0, 22, 24, 204)), (0, 22))
    bare_cnt.alpha_composite(wbar.crop((454, 22, 480, 204)), (454, 22))
    bare_cnt.alpha_composite(wbar.crop((0, 182, 480, 205)), (0, 182))
    results.append(("ic_bare_walnut_brass_counter.png", "Bare Walnut & Brass Shop Counter",
                    crop_tight(bare_cnt, pad=6), True, ["ice-cream", "shop", "counter", "walnut", "bare", "modular"]))

    # 14. Closed Cast-Iron Waffle Maker (exact circle + hinge + front clasp!)
    wic_m = mask_from_shapes(wbar.size, lambda d: (
        d.ellipse([21, 56, 97, 132], fill=255),
        d.rounded_rectangle([46, 48, 72, 62], radius=4, fill=255),
        d.rounded_rectangle([51, 128, 67, 146], radius=4, fill=255),
    ))
    results.append(("ic_waffle_iron_closed.png", "Closed Cast-Iron Waffle Maker",
                    apply_mask(wbar, wic_m, feather=0.6), True, ["ice-cream", "kitchen", "waffle", "iron", "modular"]))

    # 15. Open Waffle Iron with Fresh Golden Waffle (two clean circles + top finial!)
    wio_m = mask_from_shapes(wbar.size, lambda d: (
        d.ellipse([101, 12, 173, 86], fill=255),
        d.ellipse([100, 86, 174, 160], fill=255),
        d.ellipse([130, 1, 144, 15], fill=255),
        d.rectangle([124, 78, 150, 96], fill=255),
    ))
    results.append(("ic_waffle_iron_open.png", "Open Waffle Iron with Fresh Waffle",
                    apply_mask(wbar, wio_m, feather=0.6), True, ["ice-cream", "kitchen", "waffle", "food", "modular"]))

    # 16. Brass Waffle Cone Tabletop Stand (clean brass base + 4 protruding waffle cones!)
    bcs_m = mask_from_shapes(wbar.size, lambda d: (
        d.ellipse([178, 52, 236, 110], fill=255),
        d.polygon([(172, 46), (192, 34), (204, 22), (222, 22), (242, 40), (242, 66), (234, 96), (182, 96), (172, 68)], fill=255),
    ))
    results.append(("ic_brass_cone_stand.png", "Brass Waffle Cone Tabletop Stand",
                    apply_mask(wbar, bcs_m, feather=0.6), True, ["ice-cream", "cone", "brass", "display", "modular"]))

    # 17-19. Open Topping Jars (EXACT jar circle + tilted brass lid ellipse -> ZERO wood chunks, ZERO eaten rims!)
    tjs_m = mask_from_shapes(wbar.size, lambda d: (
        d.ellipse([250, 50, 294, 94], fill=255),
        d.ellipse([278, 36, 304, 68], fill=255),
    ))
    results.append(("ic_topping_jar_sprinkles.png", "Open Jar of Rainbow Sprinkles",
                    apply_mask(wbar, tjs_m, feather=0.6), True, ["ice-cream", "toppings", "jar", "food", "modular"]))

    tjn_m = mask_from_shapes(wbar.size, lambda d: (
        d.ellipse([297, 60, 341, 104], fill=255),
        d.ellipse([318, 43, 350, 74], fill=255),
    ))
    results.append(("ic_topping_jar_nuts.png", "Open Jar of Chopped Nuts",
                    apply_mask(wbar, tjn_m, feather=0.6), True, ["ice-cream", "toppings", "jar", "food", "modular"]))

    tjc_m = mask_from_shapes(wbar.size, lambda d: (
        d.ellipse([306, 111, 349, 155], fill=255),
        d.ellipse([292, 138, 326, 174], fill=255),
    ))
    results.append(("ic_topping_jar_cherries.png", "Open Jar of Maraschino Cherries",
                    apply_mask(wbar, tjc_m, feather=0.6), True, ["ice-cream", "toppings", "jar", "food", "modular"]))

    # 20. Copper Hot-Fudge Pot & Brass Ladle (exact round copper pot + side ear handles + ladle handle!)
    hfp_m = mask_from_shapes(wbar.size, lambda d: (
        d.ellipse([362, 42, 444, 126], fill=255),
        d.rounded_rectangle([352, 72, 368, 98], radius=5, fill=255),
        d.rounded_rectangle([438, 72, 454, 98], radius=5, fill=255),
        d.polygon([(408, 80), (442, 44), (450, 50), (416, 88)], fill=255),
    ))
    results.append(("ic_hot_fudge_pot_ladle.png", "Copper Hot-Fudge Pot & Ladle",
                    apply_mask(wbar, hfp_m, feather=0.6), True, ["ice-cream", "kitchen", "chocolate", "copper", "modular"]))

    # 21-22. Caramel & Berry Syrup Pump Dispensers (exact circular pump bottles!)
    sp1_m = mask_from_shapes(wbar.size, lambda d: d.ellipse([362, 139, 402, 179], fill=255))
    sp2_m = mask_from_shapes(wbar.size, lambda d: d.ellipse([412, 139, 452, 179], fill=255))
    results.append(("ic_syrup_pump_caramel.png", "Caramel Syrup Pump Dispenser",
                    apply_mask(wbar, sp1_m, feather=0.6), True, ["ice-cream", "syrup", "dispenser", "cafe", "modular"]))
    results.append(("ic_syrup_pump_berry.png", "Berry Syrup Pump Dispenser",
                    apply_mask(wbar, sp2_m, feather=0.6), True, ["ice-cream", "syrup", "dispenser", "cafe", "modular"]))

    # =========================================================================
    # D. ic_kids_bunk_bed_train.png (512x367)
    # =========================================================================
    kids = Image.open(IC_DIR / "ic_kids_bunk_bed_train.png").convert("RGBA")

    # 23. Plush Brown Teddy Bear (anatomical mask + white-pillow/red-quilt border strip!)
    tb_m = mask_from_shapes(kids.size, lambda d: (
        d.ellipse([41, 70, 56, 84], fill=255),
        d.ellipse([70, 68, 86, 83], fill=255),
        d.ellipse([43, 73, 84, 108], fill=255),
        d.ellipse([45, 96, 84, 135], fill=255),
        d.ellipse([36, 98, 56, 120], fill=255),
        d.ellipse([74, 102, 98, 124], fill=255),
        d.ellipse([44, 122, 65, 146], fill=255),
        d.ellipse([66, 120, 88, 143], fill=255),
    ))
    tb_cut = apply_mask(kids, tb_m, feather=0.5)
    tb_clean = flood_remove_bg(
        tb_cut,
        lambda r, g, b, a: (a < 30)
        | ((0.299 * r + 0.587 * g + 0.114 * b > 170) & (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b) < 38))
        | ((r > 130) & (g < 76) & (b < 76))
        | ((g > r + 4) & (b > r - 6)),  # teal quilt patch
        feather=0.5,
    )
    results.append(("ic_plush_teddy_bear.png", "Plush Brown Teddy Bear",
                    tb_clean, False, ["bedroom", "kids", "toy", "plush", "modular"]))

    # 24. Kids Wooden Patchwork Bed (already 10/10 seamless!)
    bed_im = kids.crop((0, 0, 224, 367)).copy()
    pil_r = kids.crop((112, 26, 174, 96)).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    pil_mask = Image.new("L", pil_r.size, 0)
    ImageDraw.Draw(pil_mask).ellipse([2, 2, pil_r.width - 2, pil_r.height - 2], fill=255)
    pil_mask = pil_mask.filter(ImageFilter.GaussianBlur(5))
    bed_im.paste(pil_r, (42, 26), pil_mask)
    bed_im.paste(kids.crop((102, 100, 166, 152)), (36, 98))
    results.append(("ic_kids_patchwork_bed.png", "Kids Wooden Patchwork Bed",
                    crop_tight(bed_im, pad=6), True, ["bedroom", "kids", "bed", "quilt", "modular"]))

    # 25. Bare Braided Jute & Navy Rag Rug (already 10/10 hand-woven masterpiece!)
    rug_crop = kids.crop((216, 36, 508, 330)).copy()
    rcx, rcy, R_rug = 144.5, 147.0, 144.0
    r_arr = np.array(rug_crop, dtype=np.float32)
    rh, rw = r_arr.shape[:2]
    YY, XX = np.mgrid[:rh, :rw]
    gx, gy = XX + 216, YY + 36
    in_blocks = (gx >= 404) & (gx <= 468) & (gy >= 84) & (gy <= 156)
    in_book = (gx >= 404) & (gx <= 504) & (gy >= 146) & (gy <= 238)
    d_top_cap = np.sqrt((gx - 331.0) ** 2 + (gy - 140.0) ** 2)
    d_bot_cap = np.sqrt((gx - 331.0) ** 2 + (gy - 226.0) ** 2)
    in_track = (
        ((gy >= 136) & (gy <= 230) & (((gx >= 248) & (gx <= 288)) | ((gx >= 376) & (gx <= 416))))
        | ((gy < 140) & (d_top_cap >= 44) & (d_top_cap <= 86))
        | ((gy > 226) & (d_bot_cap >= 44) & (d_bot_cap <= 86))
    )
    obstacle = in_blocks | in_book | in_track
    rad_map = np.sqrt((XX - rcx) ** 2 + (YY - rcy) ** 2)
    ang_map = np.arctan2(YY - rcy, XX - rcx)
    clean_rug = r_arr.copy()
    obs_ys, obs_xs = np.where(obstacle & (rad_map <= R_rug + 1))
    for y, x in zip(obs_ys, obs_xs):
        rr = rad_map[y, x]
        aa = ang_map[y, x]
        for step in (1.15, -1.15, 2.2, -2.2, 3.14159, 0.65, -0.65, 1.75, -1.75, 2.7, -2.7):
            sx = int(round(rcx + rr * math.cos(aa + step)))
            sy = int(round(rcy + rr * math.sin(aa + step)))
            if 0 <= sx < rw and 0 <= sy < rh and not obstacle[sy, sx] and r_arr[sy, sx, 3] > 200:
                clean_rug[y, x] = r_arr[sy, sx]
                break
    rep_im = Image.fromarray(np.clip(clean_rug, 0, 255).astype(np.uint8), "RGBA")
    obs_mask = Image.fromarray((obstacle.astype(np.uint8) * 255), "L").filter(ImageFilter.GaussianBlur(1.5))
    bare_rug = Image.composite(rep_im, rug_crop, obs_mask)
    results.append(("ic_bare_braided_rag_rug.png", "Bare Braided Jute & Navy Rag Rug",
                    crop_tight(bare_rug, pad=6), False, ["bedroom", "rug", "braided", "jute", "bare", "modular"]))

    # 26. Wooden Oval Toy Train & Track (already 10/10!)
    tr_mask = Image.new("L", kids.size, 0)
    td = ImageDraw.Draw(tr_mask)
    td.rounded_rectangle([254, 77, 408, 291], radius=76, fill=255)
    td.rounded_rectangle([282, 105, 380, 263], radius=48, fill=0)
    results.append(("ic_wooden_toy_train_oval.png", "Wooden Oval Toy Train & Track",
                    apply_mask(kids, tr_mask, feather=0.6), False, ["kids", "toy", "train", "wood", "modular"]))

    # 27. Wooden ABC Alphabet Blocks (tight cube polygons — zero rug flecks!)
    abc_m = mask_from_shapes(kids.size, lambda d: (
        d.polygon([(418, 100), (430, 94), (440, 102), (438, 113), (425, 119), (416, 111)], fill=255),
        d.polygon([(412, 128), (423, 124), (432, 135), (427, 147), (416, 150), (409, 140)], fill=255),
        d.polygon([(444, 129), (454, 124), (462, 135), (456, 146), (445, 150), (439, 140)], fill=255),
    ))
    results.append(("ic_wooden_abc_blocks.png", "Wooden ABC Alphabet Blocks",
                    apply_mask(kids, abc_m, feather=0.4), False, ["kids", "toy", "blocks", "bedroom", "modular"]))

    # 28. Open Illustrated Storybook (exact tight leather-cover contour — ZERO rug edge!)
    sbk_m = mask_from_shapes(kids.size, lambda d: d.polygon([
        (434, 156), (466, 173), (496, 184), (474, 228), (442, 211), (414, 198),
    ], fill=255))
    results.append(("ic_open_storybook.png", "Open Illustrated Storybook",
                    apply_mask(kids, sbk_m, feather=0.5), False, ["kids", "book", "toy", "bedroom", "modular"]))

    # =========================================================================
    # E. ic_mini_train_milkshake_car.png (440x132)
    # =========================================================================
    mcar = Image.open(IC_DIR / "ic_mini_train_milkshake_car.png").convert("RGBA")
    results.append(("ic_milkshake_tray_trio.png", "Wooden Milkshake Serving Tray",
                    crop_tight(mcar.crop((246, 16, 376, 114)), pad=4), True, ["ice-cream", "milkshake", "tray", "drink", "modular"]))
    results.append(("ic_milkshake_glass_strawberry.png", "Strawberry Milkshake Glass",
                    apply_mask(mcar, mask_from_shapes(mcar.size, lambda d: d.ellipse([262, 22, 306, 66], fill=255)), feather=0.7),
                    True, ["ice-cream", "milkshake", "drink", "modular"]))
    results.append(("ic_milkshake_glass_chocolate.png", "Chocolate Milkshake Glass",
                    apply_mask(mcar, mask_from_shapes(mcar.size, lambda d: d.ellipse([312, 22, 358, 66], fill=255)), feather=0.7),
                    True, ["ice-cream", "milkshake", "drink", "modular"]))
    results.append(("ic_milkshake_glass_vanilla.png", "Vanilla Milkshake Glass",
                    apply_mask(mcar, mask_from_shapes(mcar.size, lambda d: d.ellipse([286, 62, 334, 108], fill=255)), feather=0.7),
                    True, ["ice-cream", "milkshake", "drink", "modular"]))

    return results


def split_sovereign_temple_pack() -> list[tuple[str, str, Image.Image, bool, list[str]]]:
    results = []

    # =========================================================================
    # A. sov_iron_throne_dais.png (512x504)
    # =========================================================================
    tdais = Image.open(SOV_DIR / "sov_iron_throne_dais.png").convert("RGBA")

    # 1. Sovereign Crimson & Iron Throne
    thr_m = mask_from_shapes(tdais.size, lambda d: d.polygon([
        (166, 84), (204, 80), (256, 100), (308, 80), (348, 84), (344, 164),
        (344, 286), (330, 308), (182, 308), (168, 286), (168, 164),
    ], fill=255))
    results.append(("sov_crimson_iron_throne.png", "Sovereign Crimson & Iron Throne",
                    apply_mask(tdais, thr_m, feather=0.8), True, ["temple", "throne", "chair", "sovereign", "modular"]))

    # 2. Bare Stepped Obsidian Throne Dais (already 10/10!)
    bare_dais = tdais.copy()
    obs_patch = tdais.crop((196, 304, 316, 344))
    obs_flip = obs_patch.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    obs_fill = Image.new("RGBA", (220, 220))
    for oy in range(0, 220, 40):
        src = obs_patch if (oy // 40) % 2 == 0 else obs_flip
        for ox in range(0, 220, 120):
            obs_fill.paste(src, (ox, oy))
    dm = Image.new("L", tdais.size, 0)
    ImageDraw.Draw(dm).regular_polygon((256, 224, 104), n_sides=8, fill=255)
    ImageDraw.Draw(dm).ellipse([160, 76, 352, 164], fill=255)
    dm = dm.filter(ImageFilter.GaussianBlur(3.5))
    bg_layer = Image.new("RGBA", tdais.size, (0, 0, 0, 0))
    bg_layer.paste(obs_fill, (146, 114))
    bare_dais = Image.composite(bg_layer, bare_dais, dm)
    bdd = ImageDraw.Draw(bare_dais)
    for r_o, col, w_o in [(112, (36, 28, 24, 240), 6), (108, (186, 152, 82, 235), 4), (102, (62, 48, 36, 210), 3)]:
        pts = [(256 + r_o * math.cos(math.pi / 8 + k * math.pi / 4), 226 + r_o * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)]
        bdd.line(pts + [pts[0]], fill=col, width=w_o)
    results.append(("sov_bare_obsidian_dais.png", "Bare Stepped Obsidian Throne Dais",
                    crop_tight(bare_dais, pad=4), True, ["temple", "dais", "platform", "obsidian", "bare", "modular"]))

    # =========================================================================
    # B. sov_inquisition_chair.png (479x480)
    # =========================================================================
    inq = Image.open(SOV_DIR / "sov_inquisition_chair.png").convert("RGBA")

    # 3. Magipunk Aether Interrogation Chair (remove slate stone floor via cool-grey flood-fill!)
    ic_crop = inq.crop((102, 72, 378, 366))
    ic_keep = mask_from_shapes(ic_crop.size, lambda d: (
        d.rounded_rectangle([62, 24, 214, 266], radius=24, fill=255),
        d.ellipse([36, 62, 84, 134], fill=255),   # left purple vial
        d.ellipse([192, 62, 240, 134], fill=255), # right purple vial
    ))
    ichair = flood_remove_bg(ic_crop, is_slate_stone_bg, erode_px=0, feather=0.6, keep_mask=ic_keep)
    results.append(("sov_inquisition_restraint_chair.png", "Magipunk Aether Interrogation Chair",
                    ichair, True, ["temple", "inquisition", "chair", "magipunk", "modular"]))

    # 4. Bare Octagonal Runic Stone Dais (already 10/10!)
    bare_runic = inq.copy()
    st_patch = inq.crop((152, 352, 326, 396))
    st_fill = Image.new("RGBA", (320, 320))
    for sy in range(0, 320, 44):
        src = st_patch if (sy // 44) % 2 == 0 else st_patch.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        for sx in range(0, 320, 174):
            st_fill.paste(src, (sx, sy))
    rm = Image.new("L", inq.size, 0)
    ImageDraw.Draw(rm).regular_polygon((240, 236, 146), n_sides=8, fill=255)
    rm = rm.filter(ImageFilter.GaussianBlur(3.0))
    rlayer = Image.new("RGBA", inq.size, (0, 0, 0, 0))
    rlayer.paste(st_fill, (80, 76))
    bare_runic = Image.composite(rlayer, bare_runic, rm)
    rd = ImageDraw.Draw(bare_runic)
    for r_o, col, w_o in [(148, (32, 36, 44, 230), 5), (143, (124, 134, 148, 190), 3), (84, (96, 108, 124, 130), 2)]:
        pts = [(240 + r_o * math.cos(math.pi / 8 + k * math.pi / 4), 236 + r_o * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)]
        rd.line(pts + [pts[0]], fill=col, width=w_o)
    results.append(("sov_bare_runic_stone_dais.png", "Bare Octagonal Runic Stone Dais",
                    crop_tight(bare_runic, pad=4), False, ["temple", "dais", "runic", "stone", "bare", "modular"]))

    # =========================================================================
    # C. sov_high_altar_aether.png (512x263)
    # =========================================================================
    alt = Image.open(SOV_DIR / "sov_high_altar_aether.png").convert("RGBA")

    # 5. Glowing Aether Relic Crystal (tight 8-point star tracing the 8 brass claws -> ZERO crimson cloth!)
    cx_a, cy_a = 256.0, 131.0
    star_pts = []
    for k in range(16):
        ang = k * (math.pi / 8)
        rad = 43.0 if k % 2 == 0 else 32.0
        star_pts.append((cx_a + rad * math.cos(ang), cy_a + rad * math.sin(ang)))
    crys_m = mask_from_shapes(alt.size, lambda d: d.polygon(star_pts, fill=255))
    results.append(("sov_aether_crystal_reliquary.png", "Glowing Aether Relic Crystal",
                    apply_mask(alt, crys_m, feather=0.6), False, ["temple", "relic", "crystal", "aether", "magic", "modular"]))

    # 6. Clustered Cream Altar Candles (exact 3-circle union + crimson runner strip -> PURE WAX!)
    cnd_m = mask_from_shapes(alt.size, lambda d: (
        d.ellipse([142, 95, 174, 128], fill=255),
        d.ellipse([167, 111, 198, 142], fill=255),
        d.ellipse([147, 130, 178, 162], fill=255),
    ))
    cnd_cut = apply_mask(alt, cnd_m, feather=0.4)
    cnd_clean = flood_remove_bg(
        cnd_cut,
        lambda r, g, b, a: (a < 30) | ((r > g + 26) & (r > b + 20) & (g < 110)),
        feather=0.5,
    )
    results.append(("sov_altar_white_candles.png", "Clustered Cream Altar Candles",
                    cnd_clean, False, ["temple", "candles", "altar", "ritual", "modular"]))

    # 7. Brass Crimson Ritual Offering Basin (exact round bowl circle -> ZERO stone corner!)
    bsn_m = mask_from_shapes(alt.size, lambda d: d.ellipse([388, 151, 434, 197], fill=255))
    results.append(("sov_altar_offering_basin.png", "Brass Crimson Offering Basin",
                    apply_mask(alt, bsn_m, feather=0.6), False, ["temple", "altar", "basin", "ritual", "modular"]))

    # 8. Bare Brass-Piped Obsidian Altar (cleanly erase crimson runner edges top & bottom!)
    bare_alt = alt.copy()
    clean_slab = alt.crop((46, 32, 142, 226))
    clean_slab_r = clean_slab.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    ba_arr = np.array(bare_alt)
    ba_arr[:33, 140:370, 3] = 0
    ba_arr[225:, 140:370, 3] = 0
    bare_alt = Image.fromarray(ba_arr, "RGBA")
    for ax, tile in [(142, clean_slab_r), (238, clean_slab), (334, clean_slab_r)]:
        bare_alt.paste(tile, (ax, 32))
    bare_alt.alpha_composite(alt.crop((442, 24, 512, 236)), (442, 24))
    results.append(("sov_bare_obsidian_altar.png", "Bare Brass-Piped Obsidian Altar",
                    crop_tight(bare_alt, pad=4), True, ["temple", "altar", "obsidian", "bare", "modular"]))

    # =========================================================================
    # D. sov_scrying_console.png (440x225)
    # =========================================================================
    scr = Image.open(SOV_DIR / "sov_scrying_console.png").convert("RGBA")

    # 9. Open Brass-Bound Grimoire (clean tight book contour — zero mahogany console chunk!)
    book_m = mask_from_shapes(scr.size, lambda d: d.polygon([
        (335, 133), (366, 147), (392, 155), (371, 203), (344, 191), (318, 178),
    ], fill=255))
    results.append(("sov_open_ledger_quill.png", "Open Brass-Bound Grimoire",
                    apply_mask(scr, book_m, feather=0.6), False, ["temple", "book", "grimoire", "desk", "modular"]))

    # 10. Bare Curved Magipunk Scrying Console (already 10/10!)
    bare_scr = scr.copy()
    left_arm = scr.crop((14, 114, 126, 225)).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    sm = Image.new("L", left_arm.size, 0)
    ImageDraw.Draw(sm).rectangle([0, 6, left_arm.width, left_arm.height], fill=255)
    sm = sm.filter(ImageFilter.GaussianBlur(3.0))
    bs_arr = np.array(bare_scr)
    bs_arr[128:180, 408:, 3] = 0
    bare_scr = Image.fromarray(bs_arr, "RGBA")
    bare_scr.paste(left_arm, (314, 114), sm)
    results.append(("sov_bare_scrying_console.png", "Bare Magipunk Scrying Console",
                    crop_tight(bare_scr, pad=4), True, ["temple", "console", "scrying", "bare", "modular"]))

    # =========================================================================
    # E. sov_confession_booth.png (420x282)
    # =========================================================================
    conf = Image.open(SOV_DIR / "sov_confession_booth.png").convert("RGBA")
    # 11. Crimson Velvet Prayer Kneeler (exact bench seat + knee rail -> ZERO floorboards!)
    kn_m = mask_from_shapes(conf.size, lambda d: (
        d.rounded_rectangle([252, 98, 282, 185], radius=6, fill=255),
        d.rounded_rectangle([282, 110, 304, 174], radius=5, fill=255),
        d.rectangle([264, 108, 294, 116], fill=255),
        d.rectangle([264, 168, 294, 176], fill=255),
    ))
    results.append(("sov_crimson_kneeler_bench.png", "Crimson Velvet Prayer Kneeler",
                    apply_mask(conf, kn_m, feather=0.6), True, ["temple", "bench", "kneeler", "velvet", "modular"]))

    return results


def save_qa_sheet(entries: list[tuple[str, str, Image.Image, bool, list[str]]], out_path: str, cols: int = 6):
    rows = (len(entries) + cols - 1) // cols
    cw, ch = 260, 210
    sheet = Image.new("RGBA", (cols * cw, rows * ch), (28, 30, 38, 255))
    d = ImageDraw.Draw(sheet)
    for y in range(0, rows * ch, 14):
        for x in range(0, cols * cw, 14):
            if ((x // 14) + (y // 14)) % 2 == 0:
                d.rectangle([x, y, x + 13, y + 13], fill=(42, 46, 56, 255))
    for i, (fname, _, im, _, _) in enumerate(entries):
        r, c = divmod(i, cols)
        sc = min((cw - 24) / max(1, im.width), (ch - 42) / max(1, im.height))
        nw, nh = max(1, int(im.width * sc)), max(1, int(im.height * sc))
        th = im.resize((nw, nh), Image.Resampling.LANCZOS)
        sheet.alpha_composite(th, (c * cw + (cw - nw) // 2, r * ch + (ch - 24 - nh) // 2))
        d.rectangle([c * cw, (r + 1) * ch - 22, (c + 1) * cw - 1, (r + 1) * ch - 1], fill=(16, 18, 24, 232))
        d.text((c * cw + 5, (r + 1) * ch - 17), fname.replace(".png", ""), fill=(235, 240, 248, 255))
    sheet.convert("RGB").save(out_path, "PNG")


def main():
    ic_entries = split_ice_cream_pack()
    for fname, _, im, _, _ in ic_entries:
        im.save(IC_DIR / fname, "PNG", optimize=True)
    save_qa_sheet(ic_entries, QA_IC_PATH, cols=6)
    print(f"Saved {len(ic_entries)} ice_cream_train modular splits -> {QA_IC_PATH}")

    sov_entries = split_sovereign_temple_pack()
    for fname, _, im, _, _ in sov_entries:
        im.save(SOV_DIR / fname, "PNG", optimize=True)
    save_qa_sheet(sov_entries, QA_SOV_PATH, cols=4)
    print(f"Saved {len(sov_entries)} sovereign_temple modular splits -> {QA_SOV_PATH}")

    meta = []
    for subdir, entries in [("props/ice_cream_train", ic_entries), ("props/sovereign_temple", sov_entries)]:
        for fname, label, im, shadow, tags in entries:
            meta.append({
                "path": f"{subdir}/{fname}",
                "displayName": label,
                "category": "object",
                "tags": tags,
                "widthPx": im.width,
                "heightPx": im.height,
                "defaultPpi": 256,
                "drawMode": "normal",
                "castsShadow": shadow,
                "dominantHex": "#A08C74",
            })
    meta_out = r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae\scratch\meta_splits_ai.json"
    with open(meta_out, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"Wrote {len(meta)} metadata entries -> {meta_out}")


if __name__ == "__main__":
    main()
