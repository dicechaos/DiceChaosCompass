"""
Clean-room 2x supersampled modular splits for the 3 programmatic painterly packs:
  1. public/assets/modular-suite-cc0/props/messy_apartment/  (20 standalone pieces)
  2. public/assets/modular-suite-cc0/props/neighborhood_park/ (15 standalone pieces)
  3. public/assets/modular-suite-cc0/props/district_streets/  (22 standalone pieces)

Preserves 100% of existing composite sprites untouched; gives mapmakers every
bare furniture/base piece AND every individual tabletop, garden, playground,
street, alley, yard, and memorial vigil prop to freely assemble their own scenes!
"""

import json
import math
import os
import random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

MOD_DIR = Path("public/assets/modular-suite-cc0")
APT_DIR = MOD_DIR / "props" / "messy_apartment"
PK_DIR = MOD_DIR / "props" / "neighborhood_park"
DST_DIR = MOD_DIR / "props" / "district_streets"

SCRATCH = Path(r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae\scratch")
INK = (32, 26, 24, 255)
INK_SOFT = (52, 42, 36, 220)


def hi(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))


def finish(im: Image.Image, w: int, h: int, seed: int = 1, grain: float = 6.5) -> Image.Image:
    out = im.resize((w, h), Image.Resampling.LANCZOS)
    if grain > 0:
        arr = np.array(out, dtype=np.float32)
        mask = arr[:, :, 3] > 24
        rng = np.random.default_rng(seed)
        noise = rng.normal(0.0, grain, size=arr[:, :, 0].shape)
        for c in range(3):
            arr[:, :, c] = np.clip(arr[:, :, c] + noise * mask, 0, 255)
        out = Image.fromarray(arr.astype(np.uint8), "RGBA")
    return out


def blob(cx, cy, rx, ry, n=42, amp=0.14, seed=1, rot=0.0):
    rng = random.Random(seed)
    p1, p2, p3 = rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28)
    cr, sr = math.cos(rot), math.sin(rot)
    pts = []
    for i in range(n):
        a = (i / n) * math.tau
        r = 1.0 + amp * (0.58 * math.sin(a * 3 + p1) + 0.28 * math.cos(a * 5 + p2) + 0.14 * math.sin(a * 7 + p3))
        lx, ly = math.cos(a) * rx * r, math.sin(a) * ry * r
        pts.append((cx + lx * cr - ly * sr, cy + lx * sr + ly * cr))
    return pts


def soft_shadow_poly(img: Image.Image, pts, off=(6, 8), col=(22, 16, 14, 86), blur=8):
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).polygon([(x + off[0], y + off[1]) for x, y in pts], fill=col)
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))


def draw_flower(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, col, ang=0.0):
    sx, sy = cx - math.cos(ang) * r * 2.0, cy - math.sin(ang) * r * 2.0
    d.line([(sx, sy), (cx, cy)], fill=(58, 88, 46, 235), width=4)
    for k in range(5):
        a = k * (math.tau / 5) + ang
        px, py = cx + math.cos(a) * r * 0.52, cy + math.sin(a) * r * 0.52
        d.ellipse([px - r * 0.52, py - r * 0.52, px + r * 0.52, py + r * 0.52], fill=(*col, 248), outline=INK_SOFT, width=2)
    d.ellipse([cx - r * 0.3, cy - r * 0.3, cx + r * 0.3, cy + r * 0.3], fill=(238, 200, 88, 255))


def draw_candle(base: Image.Image, glow: Image.Image, cx: float, cy: float, r: float, wax=(244, 232, 204), lit=True, jar=None, seed=1):
    d = ImageDraw.Draw(base)
    collar = blob(cx, cy, r * 1.46, r * 1.38, n=28, amp=0.16, seed=seed)
    d.polygon(collar, fill=(max(0, wax[0] - 28), max(0, wax[1] - 30), max(0, wax[2] - 34), 215), outline=(96, 78, 56, 150))
    if jar is not None:
        jr = r * 1.2
        d.ellipse([cx - jr, cy - jr, cx + jr, cy + jr], fill=(*jar, 195), outline=INK, width=3)
        ir = r * 0.85
        d.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=(*wax, 248))
        d.arc([cx - jr + 3, cy - jr + 3, cx + jr - 3, cy + jr - 3], 200, 265, fill=(255, 250, 240, 180), width=3)
    else:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*wax, 255), outline=INK, width=3)
        ir = r * 0.72
        d.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=(min(255, wax[0] + 10), min(255, wax[1] + 6), max(0, wax[2] - 8), 255), outline=(156, 132, 102, 180), width=2)
    if lit:
        gd = ImageDraw.Draw(glow)
        gd.ellipse([cx - r * 3.0, cy - r * 3.0, cx + r * 3.0, cy + r * 3.0], fill=(255, 168, 48, 78))
        gd.ellipse([cx - r * 1.5, cy - r * 1.5, cx + r * 1.5, cy + r * 1.5], fill=(255, 224, 112, 135))
        fr = max(4.5, r * 0.42)
        d.ellipse([cx - fr, cy - fr, cx + fr, cy + fr], fill=(255, 178, 50, 255))
        d.ellipse([cx - fr * 0.56, cy - fr * 0.56, cx + fr * 0.56, cy + fr * 0.56], fill=(255, 248, 208, 255))
    else:
        d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(40, 32, 28, 240))


# =============================================================================
# PACK 3: MESSY APARTMENT MODULAR SPLITS (20 pieces)
# =============================================================================
def build_apartment_splits():
    out = []

    # 1. Bare Weathered Wood Coffee Table
    im = hi(380, 236); d = ImageDraw.Draw(im)
    d.rounded_rectangle([32, 32, 728, 440], radius=16, fill=(134, 96, 60, 255), outline=INK, width=7)
    for y in range(114, 430, 82):
        d.line([(38, y), (722, y)], fill=(86, 58, 36, 200), width=4)
    d.rounded_rectangle([46, 46, 714, 426], radius=10, outline=(168, 128, 86, 110), width=3)
    out.append(("apt_bare_wood_coffee_table.png", "Bare Weathered Wood Coffee Table", finish(im, 380, 236, 301), True, ["apartment", "furniture", "table", "bare", "modular"]))

    # 2. Half-Eaten Open Cardboard Pizza Box
    im = hi(180, 180); d = ImageDraw.Draw(im)
    d.rounded_rectangle([36, 36, 324, 324], radius=8, fill=(214, 192, 152, 255), outline=INK, width=6)
    d.rectangle([56, 56, 304, 304], fill=(198, 174, 134, 255), outline=(142, 118, 82, 255), width=3)
    # Opaque grease spot
    d.polygon(blob(180, 182, 102, 96, n=28, amp=0.14, seed=302), fill=(178, 152, 110, 255))
    # 5 remaining slices of pepperoni pizza!
    d.pieslice([82, 82, 278, 278], start=35, end=255, fill=(228, 164, 62, 255), outline=INK, width=5)
    d.pieslice([98, 98, 262, 262], start=38, end=252, fill=(238, 196, 92, 255))
    for px, py in [(142, 140), (126, 188), (168, 224), (218, 212), (160, 182)]:
        d.ellipse([px - 14, py - 14, px + 14, py + 14], fill=(176, 48, 44, 255), outline=INK_SOFT, width=2)
    out.append(("apt_open_pizza_box.png", "Half-Eaten Open Pizza Box", finish(im, 180, 180, 302), False, ["apartment", "food", "pizza", "clutter", "modular"]))

    # 3. Ceramic Coffee Mug (with dark coffee inside)
    im = hi(110, 110); d = ImageDraw.Draw(im)
    d.rounded_rectangle([144, 96, 186, 124], radius=6, fill=(232, 224, 210, 255), outline=INK, width=5)
    d.ellipse([54, 54, 166, 166], fill=(236, 228, 214, 255), outline=INK, width=6)
    d.ellipse([70, 70, 150, 150], fill=(74, 46, 30, 255), outline=(44, 26, 18, 220), width=3)
    d.arc([78, 78, 142, 142], 200, 285, fill=(138, 96, 66, 170), width=4)
    out.append(("apt_coffee_mug.png", "Ceramic Coffee Mug", finish(im, 110, 110, 303), False, ["apartment", "kitchen", "mug", "coffee", "modular"]))

    # 4. Overflowing Ashtray & Scattered Playing Cards
    im = hi(170, 150); d = ImageDraw.Draw(im)
    for cx, cy, ang in [(88, 134, -0.35), (144, 118, 0.25), (118, 178, 0.12)]:
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in [(-32, -46), (32, -46), (32, 46), (-32, 46)]]
        d.polygon(pts, fill=(242, 236, 222, 255), outline=INK)
        d.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(182, 44, 48, 255))
    # Round glass/metal ashtray
    d.ellipse([196, 124, 294, 222], fill=(128, 124, 116, 255), outline=INK, width=5)
    d.ellipse([212, 140, 278, 206], fill=(82, 78, 74, 255))
    d.line([(230, 164), (274, 188)], fill=(236, 228, 214, 255), width=7)
    d.line([(262, 182), (274, 188)], fill=(196, 132, 68, 255), width=7)
    out.append(("apt_ashtray_playing_cards.png", "Ashtray & Playing Cards", finish(im, 170, 150, 304), False, ["apartment", "tavern", "cards", "clutter", "modular"]))

    # 5. Single Open Cardboard Moving Box
    im = hi(210, 210); d = ImageDraw.Draw(im)
    d.rectangle([74, 74, 346, 346], fill=(104, 74, 46, 255), outline=INK, width=6)
    # Peeking colorful items inside
    d.rounded_rectangle([94, 108, 204, 212], radius=8, fill=(56, 98, 146, 255), outline=INK, width=4)
    d.polygon(blob(254, 222, 62, 58, n=18, amp=0.14, seed=305), fill=(214, 176, 86, 255), outline=INK)
    d.rounded_rectangle([126, 224, 218, 312], radius=6, fill=(176, 62, 56, 255), outline=INK, width=4)
    # 4 folded-out corrugated cardboard flaps!
    d.polygon([(74, 74), (346, 74), (332, 34), (88, 34)], fill=(184, 142, 92, 255), outline=INK)
    d.polygon([(74, 346), (346, 346), (332, 386), (88, 386)], fill=(172, 130, 82, 255), outline=INK)
    d.polygon([(74, 74), (74, 346), (40, 330), (40, 90)], fill=(164, 124, 78, 255), outline=INK)
    d.polygon([(346, 74), (346, 346), (380, 330), (380, 90)], fill=(168, 128, 82, 255), outline=INK)
    out.append(("apt_cardboard_box_open.png", "Open Cardboard Moving Box", finish(im, 210, 210, 305), True, ["apartment", "box", "cardboard", "moving", "modular"]))

    # 6. Single Sealed Cardboard Moving Box (with tape & label)
    im = hi(190, 190); d = ImageDraw.Draw(im)
    d.rounded_rectangle([42, 42, 338, 338], radius=8, fill=(184, 142, 92, 255), outline=INK, width=6)
    d.rectangle([48, 172, 332, 208], fill=(212, 186, 138, 225), outline=(146, 114, 72, 190), width=2)
    d.line([(48, 190), (332, 190)], fill=(96, 68, 42, 210), width=4)
    d.rounded_rectangle([196, 76, 308, 136], radius=4, fill=(242, 236, 222, 255), outline=INK_SOFT, width=3)
    d.line([(212, 98), (290, 98)], fill=(76, 68, 62, 200), width=4)
    d.line([(212, 116), (272, 116)], fill=(76, 68, 62, 175), width=3)
    out.append(("apt_cardboard_box_sealed.png", "Sealed Cardboard Moving Box", finish(im, 190, 190, 306), True, ["apartment", "box", "cardboard", "moving", "modular"]))

    # 7. Small Sealed Parcel Box
    im = hi(140, 130); d = ImageDraw.Draw(im)
    d.rounded_rectangle([32, 32, 248, 228], radius=8, fill=(176, 136, 88, 255), outline=INK, width=6)
    d.rectangle([38, 116, 242, 144], fill=(208, 182, 136, 220))
    d.line([(38, 130), (242, 130)], fill=(92, 66, 40, 210), width=4)
    out.append(("apt_cardboard_box_small.png", "Small Cardboard Parcel Box", finish(im, 140, 130, 307), True, ["apartment", "box", "parcel", "modular"]))

    # 8. Bare Porcelain Kitchen Sink & Wood Counter (clean empty basin!)
    im = hi(420, 232); d = ImageDraw.Draw(im)
    d.rounded_rectangle([24, 24, 816, 440], radius=12, fill=(134, 96, 62, 255), outline=INK, width=7)
    for y in range(106, 420, 84):
        d.line([(32, y), (808, y)], fill=(88, 60, 38, 185), width=4)
    # Clean white enamel farmhouse sink basin left
    d.rounded_rectangle([58, 56, 488, 406], radius=24, fill=(224, 228, 230, 255), outline=INK, width=6)
    d.rounded_rectangle([84, 84, 462, 378], radius=18, fill=(198, 212, 218, 255), outline=(122, 136, 142, 220), width=4)
    d.ellipse([252, 212, 294, 254], fill=(82, 88, 92, 255), outline=INK, width=4)
    # Brass gooseneck faucet
    d.rounded_rectangle([232, 44, 314, 78], radius=10, fill=(192, 156, 74, 255), outline=INK, width=4)
    d.rounded_rectangle([264, 66, 282, 152], radius=8, fill=(214, 176, 86, 255), outline=INK, width=4)
    # Clean drying board grooves right
    d.rounded_rectangle([522, 62, 784, 398], radius=10, fill=(154, 114, 76, 255), outline=INK, width=5)
    for rx in range(562, 760, 38):
        d.line([(rx, 86), (rx, 374)], fill=(104, 72, 46, 180), width=5)
    out.append(("apt_bare_kitchen_sink.png", "Bare Porcelain Kitchen Sink Counter", finish(im, 420, 232, 308), True, ["apartment", "kitchen", "sink", "bare", "modular"]))

    # 9. Stack of Dirty Plates & Cast-Iron Skillet
    im = hi(210, 190); d = ImageDraw.Draw(im)
    for px, py, pr in [(136, 176, 78), (218, 186, 74), (274, 166, 70)]:
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(234, 228, 216, 255), outline=INK, width=5)
        d.ellipse([px - pr * 0.65, py - pr * 0.65, px + pr * 0.65, py + pr * 0.65], fill=(212, 206, 194, 255), outline=(154, 146, 134, 200), width=3)
    # Cast-iron frying pan resting on top
    d.line([(298, 216), (382, 302)], fill=(48, 46, 48, 255), width=20)
    d.ellipse([194, 136, 336, 278], fill=(54, 52, 54, 255), outline=INK, width=6)
    d.ellipse([212, 154, 318, 260], fill=(82, 68, 56, 255))
    out.append(("apt_dirty_plates_pan_stack.png", "Dirty Plates & Skillet Stack", finish(im, 210, 190, 309), False, ["apartment", "kitchen", "dishes", "clutter", "modular"]))

    # 10. Bare Folding Wooden Laundry Drying Rack
    im = hi(380, 226); d = ImageDraw.Draw(im)
    d.rounded_rectangle([32, 32, 728, 420], radius=10, outline=INK, width=14)
    d.rounded_rectangle([32, 32, 728, 420], radius=10, outline=(156, 114, 72, 255), width=8)
    for y in (110, 188, 266, 344):
        d.line([(40, y), (720, y)], fill=INK, width=10)
        d.line([(40, y), (720, y)], fill=(176, 136, 92, 255), width=5)
    out.append(("apt_bare_wooden_drying_rack.png", "Bare Wooden Laundry Drying Rack", finish(im, 380, 226, 310), True, ["apartment", "laundry", "rack", "bare", "modular"]))

    # 11. Folded/Crumpled Laundry Garments Stack
    im = hi(170, 150); d = ImageDraw.Draw(im)
    d.polygon(blob(145, 162, 86, 68, n=24, amp=0.14, seed=311), fill=(116, 148, 174, 255), outline=INK)
    d.polygon(blob(216, 138, 76, 64, n=24, amp=0.14, seed=312), fill=(186, 92, 82, 255), outline=INK)
    d.polygon(blob(176, 194, 68, 54, n=24, amp=0.14, seed=313), fill=(230, 222, 200, 255), outline=INK)
    out.append(("apt_folded_laundry_bundle.png", "Crumpled Laundry Clothes Bundle", finish(im, 170, 150, 311), False, ["apartment", "laundry", "clothes", "clutter", "modular"]))

    # 12. Empty Tipped Woven Wicker Hamper
    im = hi(180, 160); d = ImageDraw.Draw(im)
    d.ellipse([48, 42, 312, 278], fill=(124, 92, 58, 255), outline=INK, width=6)
    d.ellipse([68, 62, 292, 258], fill=(74, 54, 36, 255), outline=INK, width=4)
    # Cross-weave clipped strictly to basket rim mask!
    weave = Image.new("RGBA", im.size, (0, 0, 0, 0))
    wd = ImageDraw.Draw(weave)
    for k in range(-320, 420, 26):
        wd.line([(k, 0), (k + 260, 320)], fill=(158, 122, 78, 165), width=4)
        wd.line([(k + 260, 0), (k, 320)], fill=(96, 70, 42, 165), width=4)
    rim_m = Image.new("L", im.size, 0)
    ImageDraw.Draw(rim_m).ellipse([50, 44, 310, 276], fill=255)
    ImageDraw.Draw(rim_m).ellipse([74, 68, 286, 252], fill=0)
    im.paste(weave, (0, 0), rim_m)
    out.append(("apt_wicker_hamper_empty.png", "Empty Woven Wicker Hamper", finish(im, 180, 160, 312), True, ["apartment", "laundry", "basket", "bare", "modular"]))

    # 13. Mismatched Scattered Socks
    im = hi(140, 120); d = ImageDraw.Draw(im)
    for pts, c1, c2 in [
        ([(42, 92), (118, 66), (132, 96), (92, 114), (102, 148), (66, 158)], (188, 68, 64), (236, 224, 198)),
        ([(164, 124), (242, 142), (234, 174), (192, 164), (180, 198), (146, 184)], (76, 112, 156), (228, 196, 86)),
    ]:
        d.polygon(pts, fill=(*c1, 255), outline=INK)
        d.ellipse([pts[0][0] - 8, pts[0][1] - 8, pts[0][0] + 18, pts[0][1] + 18], fill=(*c2, 255), outline=INK, width=3)
    out.append(("apt_scattered_socks_pair.png", "Mismatched Scattered Socks", finish(im, 140, 120, 313), False, ["apartment", "bedroom", "laundry", "clutter", "modular"]))

    # 14. Bare Metal Wastebasket
    im = hi(150, 150); d = ImageDraw.Draw(im)
    d.ellipse([48, 48, 252, 252], fill=(122, 128, 132, 255), outline=INK, width=6)
    d.ellipse([68, 68, 232, 232], fill=(64, 66, 68, 255), outline=(42, 44, 46, 220), width=4)
    d.ellipse([104, 104, 196, 196], fill=(48, 50, 52, 255))
    out.append(("apt_bare_metal_wastebasket.png", "Bare Metal Indoor Wastebasket", finish(im, 150, 150, 314), True, ["apartment", "office", "trash", "bare", "modular"]))

    # 15. Crumpled Paper Balls & Bottle Litter
    im = hi(170, 150); d = ImageDraw.Draw(im)
    for cx, cy, r, sd in [(86, 98, 32, 1), (186, 82, 28, 2), (244, 178, 34, 3), (124, 212, 26, 4)]:
        d.polygon(blob(cx, cy, r, r * 0.88, n=16, amp=0.22, seed=320 + sd), fill=(234, 226, 206, 255), outline=INK)
    d.rounded_rectangle([172, 148, 264, 180], radius=12, fill=(72, 126, 74, 245), outline=INK, width=4)
    out.append(("apt_crumpled_paper_litter.png", "Crumpled Paper & Bottle Litter", finish(im, 170, 150, 315), False, ["apartment", "trash", "paper", "clutter", "modular"]))

    # 16. Single Open Broadsheet Newspaper
    im = hi(160, 140); d = ImageDraw.Draw(im)
    d.polygon([(36, 48), (158, 34), (284, 52), (272, 234), (154, 220), (28, 236)], fill=(232, 224, 202, 255), outline=INK)
    d.line([(156, 36), (154, 220)], fill=(128, 118, 100, 220), width=4)
    for y in range(68, 206, 22):
        d.line([(54, y), (138, y - 4)], fill=(82, 76, 68, 180), width=5)
        d.line([(174, y - 2), (254, y + 4)], fill=(82, 76, 68, 180), width=5)
    out.append(("apt_single_open_newspaper.png", "Single Open Broadsheet Newspaper", finish(im, 160, 140, 316), False, ["apartment", "paper", "newspaper", "park", "modular"]))

    # 17. Bare Vintage Ceramic Toilet (no rug, no TP!)
    im = hi(180, 230); d = ImageDraw.Draw(im)
    d.rounded_rectangle([88, 32, 272, 108], radius=12, fill=(138, 96, 60, 255), outline=INK, width=6)
    d.rectangle([166, 106, 194, 154], fill=(176, 142, 74, 255), outline=INK, width=4)
    d.ellipse([78, 146, 282, 398], fill=(236, 234, 228, 255), outline=INK, width=6)
    d.ellipse([104, 172, 256, 366], fill=(136, 86, 54, 255), outline=INK, width=5)
    d.ellipse([128, 196, 232, 340], fill=(196, 218, 228, 255), outline=(104, 126, 138, 200), width=4)
    out.append(("apt_bare_ceramic_toilet.png", "Bare Vintage Ceramic Toilet", finish(im, 180, 230, 317), True, ["apartment", "bathroom", "toilet", "bare", "modular"]))

    # 18. Oval Blue Bathroom Rug
    im = hi(190, 140); d = ImageDraw.Draw(im)
    d.polygon(blob(190, 140, 156, 104, n=40, amp=0.06, seed=318), fill=(116, 152, 182, 255), outline=INK)
    d.polygon(blob(190, 140, 124, 78, n=36, amp=0.05, seed=318), fill=(136, 172, 198, 230), outline=(74, 104, 132, 175))
    out.append(("apt_blue_bathmat_rug.png", "Oval Blue Bathroom Bathmat", finish(im, 190, 140, 318), False, ["apartment", "bathroom", "rug", "modular"]))

    # 19. Standalone Toilet Paper Roll
    im = hi(90, 90); d = ImageDraw.Draw(im)
    d.ellipse([36, 36, 144, 144], fill=(242, 240, 234, 255), outline=INK, width=5)
    d.ellipse([72, 72, 108, 108], fill=(136, 118, 98, 255), outline=INK, width=4)
    out.append(("apt_toilet_paper_roll.png", "Toilet Paper Roll", finish(im, 90, 90, 319), False, ["apartment", "bathroom", "clutter", "modular"]))

    # 20. Neatly Made Brass-Post Iron Bed
    im = hi(310, 424); d = ImageDraw.Draw(im)
    d.rounded_rectangle([38, 38, 582, 810], radius=16, fill=(58, 56, 60, 255), outline=INK, width=7)
    d.rounded_rectangle([58, 58, 562, 790], radius=10, fill=(236, 228, 212, 255), outline=INK, width=5)
    # 2 crisp neat pillows
    d.rounded_rectangle([84, 78, 296, 210], radius=28, fill=(244, 240, 230, 255), outline=INK, width=5)
    d.rounded_rectangle([324, 78, 536, 210], radius=28, fill=(244, 240, 230, 255), outline=INK, width=5)
    # Folded crisp navy/ochre striped blanket (100% opaque!)
    d.rounded_rectangle([62, 256, 558, 784], radius=10, fill=(56, 78, 102, 255), outline=INK, width=5)
    for sy in range(304, 760, 56):
        d.rectangle([66, sy, 554, sy + 18], fill=(142, 112, 72, 255))
    d.rectangle([62, 244, 558, 292], fill=(232, 224, 206, 255), outline=INK, width=4)
    # 4 Brass bedposts
    for bx, by in [(42, 42), (578, 42), (42, 806), (578, 806)]:
        d.ellipse([bx - 22, by - 22, bx + 22, by + 22], fill=(198, 162, 78, 255), outline=INK, width=5)
    out.append(("apt_bare_iron_bed_made.png", "Neatly Made Brass-Post Iron Bed", finish(im, 310, 424, 320), True, ["apartment", "bedroom", "bed", "bare", "modular"]))

    return out


# =============================================================================
# PACK 4: NEIGHBORHOOD PARK MODULAR SPLITS (15 pieces)
# =============================================================================
def build_park_splits():
    out = []

    # 1. Bare Faded Tartan Plaid Picnic Blanket (100% opaque alpha-composited tartan!)
    im = hi(340, 296); d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle([32, 32, 648, 560], radius=14, fill=(138, 48, 52, 255), outline=INK, width=6)
    for x in range(64, 636, 68):
        d.rectangle([x, 36, x + 28, 556], fill=(46, 72, 92, 165))
        d.line([(x + 14, 36), (x + 14, 556)], fill=(218, 194, 128, 140), width=4)
    for y in range(62, 548, 66):
        d.rectangle([36, y, 644, y + 26], fill=(46, 72, 92, 155))
        d.line([(36, y + 13), (644, y + 13)], fill=(218, 194, 128, 140), width=4)
    d.rounded_rectangle([32, 32, 648, 560], radius=14, outline=INK, width=6)
    out.append(("pk_bare_plaid_blanket.png", "Bare Tartan Plaid Picnic Blanket", finish(im, 340, 296, 401), False, ["park", "picnic", "blanket", "bare", "modular"]))

    # 2. Woven Wicker Picnic Basket
    im = hi(170, 140); d = ImageDraw.Draw(im)
    d.rounded_rectangle([42, 42, 298, 238], radius=18, fill=(184, 140, 82, 255), outline=INK, width=6)
    for y in range(74, 232, 28):
        d.line([(48, y), (292, y)], fill=(128, 92, 48, 195), width=4)
    d.rectangle([48, 86, 292, 114], fill=(166, 54, 52, 255), outline=INK, width=4)
    d.rectangle([48, 168, 292, 196], fill=(166, 54, 52, 255), outline=INK, width=4)
    d.rounded_rectangle([156, 28, 184, 252], radius=8, fill=(142, 102, 56, 255), outline=INK, width=5)
    out.append(("pk_wicker_picnic_basket.png", "Woven Wicker Picnic Basket", finish(im, 170, 140, 402), True, ["park", "picnic", "basket", "food", "modular"]))

    # 3. Picnic Sandwich Plate, Apples & Enamel Cups
    im = hi(170, 150); d = ImageDraw.Draw(im)
    d.ellipse([48, 48, 232, 232], fill=(238, 232, 218, 255), outline=INK, width=6)
    d.polygon([(92, 104), (168, 92), (164, 168), (88, 162)], fill=(214, 168, 96, 255), outline=INK)
    d.polygon([(134, 134), (206, 138), (192, 206), (124, 192)], fill=(208, 162, 92, 255), outline=INK)
    # Two apples + enamel mug
    d.ellipse([246, 66, 288, 108], fill=(186, 48, 46, 255), outline=INK, width=4)
    d.ellipse([268, 118, 306, 156], fill=(176, 54, 48, 255), outline=INK, width=4)
    d.ellipse([236, 188, 298, 250], fill=(216, 172, 62, 255), outline=INK, width=5)
    d.ellipse([250, 202, 284, 236], fill=(92, 58, 36, 255))
    out.append(("pk_picnic_sandwiches_plate.png", "Picnic Plate, Apples & Cup", finish(im, 170, 150, 403), False, ["park", "picnic", "food", "plate", "modular"]))

    # 4. Open Paperback Novel
    im = hi(130, 110); d = ImageDraw.Draw(im)
    d.rounded_rectangle([32, 32, 228, 188], radius=6, fill=(138, 56, 52, 255), outline=INK, width=5)
    d.rectangle([42, 42, 128, 178], fill=(242, 236, 218, 255), outline=INK_SOFT, width=3)
    d.rectangle([132, 42, 218, 178], fill=(238, 232, 214, 255), outline=INK_SOFT, width=3)
    for y in range(62, 168, 20):
        d.line([(54, y), (116, y)], fill=(94, 86, 78, 160), width=4)
        d.line([(144, y), (206, y)], fill=(94, 86, 78, 160), width=4)
    out.append(("pk_open_paperback_book.png", "Open Paperback Book", finish(im, 130, 110, 404), False, ["park", "book", "apartment", "clutter", "modular"]))

    # 5. Bare Concrete Outdoor Chess Table (no stools, no coffee cup!)
    im = hi(240, 240); d = ImageDraw.Draw(im)
    d.rounded_rectangle([42, 42, 438, 438], radius=18, fill=(166, 168, 162, 255), outline=INK, width=7)
    bx, by, bs = 112, 112, 256
    cell = bs // 8
    d.rectangle([bx - 6, by - 6, bx + bs + 6, by + bs + 6], fill=(68, 64, 60, 255), outline=INK, width=4)
    for r in range(8):
        for c in range(8):
            col = (228, 222, 206, 255) if (r + c) % 2 == 0 else (58, 62, 66, 255)
            d.rectangle([bx + c * cell, by + r * cell, bx + (c + 1) * cell, by + (r + 1) * cell], fill=col)
    out.append(("pk_bare_concrete_chess_table.png", "Bare Concrete Chess Table", finish(im, 240, 240, 405), True, ["park", "table", "chess", "bare", "modular"]))

    # 6. Round Concrete & Timber Park Stool
    im = hi(120, 120); d = ImageDraw.Draw(im)
    d.ellipse([36, 36, 204, 204], fill=(144, 146, 142, 255), outline=INK, width=6)
    d.ellipse([54, 54, 186, 186], fill=(154, 114, 72, 255), outline=INK, width=5)
    d.line([(62, 120), (178, 120)], fill=(96, 68, 40, 175), width=4)
    out.append(("pk_concrete_park_stool.png", "Round Concrete & Wood Park Stool", finish(im, 120, 120, 406), True, ["park", "stool", "seat", "modular"]))

    # 7. Bare Empty Timber Sandbox (100% opaque warm sand!)
    im = hi(320, 320); d = ImageDraw.Draw(im)
    d.rounded_rectangle([36, 36, 604, 604], radius=12, fill=(138, 96, 56, 255), outline=INK, width=7)
    d.rectangle([86, 86, 554, 554], fill=(222, 202, 152, 255), outline=INK, width=5)
    # Soft opaque sand dune ripples
    d.polygon(blob(280, 290, 160, 130, n=32, amp=0.12, seed=407), fill=(210, 188, 138, 255))
    d.polygon(blob(385, 365, 110, 86, n=28, amp=0.12, seed=417), fill=(228, 210, 162, 255))
    # 4 corner seat boards
    for pts in [
        [(36, 36), (176, 36), (36, 176)], [(604, 36), (464, 36), (604, 176)],
        [(36, 604), (176, 604), (36, 464)], [(604, 604), (464, 604), (604, 464)],
    ]:
        d.polygon(pts, fill=(158, 114, 70, 255), outline=INK)
    out.append(("pk_bare_empty_sandbox.png", "Bare Empty Timber Sandbox", finish(im, 320, 320, 407), True, ["park", "playground", "sandbox", "bare", "modular"]))

    # 8. Kids Turreted Sandcastle
    im = hi(160, 160); d = ImageDraw.Draw(im)
    d.polygon(blob(160, 160, 112, 108, n=32, amp=0.08, seed=408), fill=(208, 184, 132, 255), outline=(124, 102, 66, 220))
    d.rounded_rectangle([94, 94, 226, 226], radius=12, fill=(224, 202, 150, 255), outline=INK_SOFT, width=4)
    for tx, ty in [(98, 98), (222, 98), (98, 222), (222, 222), (160, 160)]:
        d.ellipse([tx - 28, ty - 28, tx + 28, ty + 28], fill=(234, 214, 164, 255), outline=INK_SOFT, width=4)
    d.polygon([(160, 152), (192, 136), (160, 120)], fill=(192, 58, 54, 255), outline=INK)
    out.append(("pk_sandcastle.png", "Kids Turreted Sandcastle", finish(im, 160, 160, 408), False, ["park", "beach", "playground", "sandcastle", "modular"]))

    # 9. Striped Playground Beach Ball
    im = hi(110, 110); d = ImageDraw.Draw(im)
    cols = [(216, 64, 62), (242, 214, 82), (68, 146, 208), (242, 238, 226), (86, 174, 98), (236, 136, 54)]
    for i, c in enumerate(cols):
        d.pieslice([34, 34, 186, 186], start=i * 60, end=(i + 1) * 60, fill=(*c, 255), outline=INK, width=4)
    d.ellipse([96, 96, 124, 124], fill=(246, 242, 234, 255), outline=INK, width=4)
    out.append(("pk_beach_ball_striped.png", "Striped Playground Beach Ball", finish(im, 110, 110, 409), True, ["park", "beach", "toy", "ball", "modular"]))

    # 10. Red Toy Pail & Blue Plastic Shovel
    im = hi(150, 130); d = ImageDraw.Draw(im)
    # Shovel
    d.line([(68, 134), (176, 124)], fill=(54, 126, 188, 255), width=16)
    d.ellipse([36, 108, 108, 166], fill=(64, 142, 206, 255), outline=INK, width=5)
    # Red pail
    d.ellipse([166, 76, 266, 176], fill=(196, 56, 54, 255), outline=INK, width=6)
    d.ellipse([186, 96, 246, 156], fill=(138, 38, 36, 255), outline=INK, width=4)
    out.append(("pk_toy_bucket_shovel.png", "Kids Toy Pail & Shovel", finish(im, 150, 130, 410), False, ["park", "beach", "toy", "sandbox", "modular"]))

    # 11. Bare Timber Raised Garden Bed (tilled dark soil only!)
    im = hi(410, 244); d = ImageDraw.Draw(im)
    d.rounded_rectangle([26, 26, 794, 462], radius=10, fill=(134, 92, 54, 255), outline=INK, width=7)
    d.rectangle([68, 68, 752, 420], fill=(82, 58, 40, 255), outline=INK, width=5)
    for y in range(118, 404, 48):
        d.line([(82, y), (738, y)], fill=(60, 40, 26, 185), width=6)
        d.line([(82, y + 12), (738, y + 12)], fill=(106, 78, 54, 130), width=4)
    out.append(("pk_bare_raised_garden_bed.png", "Bare Raised Garden Soil Bed", finish(im, 410, 244, 411), True, ["park", "garden", "farm", "soil", "bare", "modular"]))

    # 12. Leafy Red Tomato Plant Bush
    im = hi(130, 130); d = ImageDraw.Draw(im)
    for ox, oy, rx, ry, sd in [(-24, -18, 52, 44, 1), (26, -12, 48, 42, 2), (-14, 24, 50, 44, 3), (22, 22, 46, 40, 4)]:
        d.polygon(blob(130 + ox, 130 + oy, rx, ry, n=20, amp=0.18, seed=420 + sd), fill=(68, 126, 56, 255), outline=INK)
    for tx, ty in [(106, 110), (154, 118), (124, 152), (146, 146), (118, 92)]:
        d.ellipse([tx - 15, ty - 15, tx + 15, ty + 15], fill=(204, 48, 44, 255), outline=INK, width=3)
    out.append(("pk_tomato_plant_bush.png", "Garden Tomato Plant Bush", finish(im, 130, 130, 412), False, ["park", "garden", "plant", "tomato", "modular"]))

    # 13. Fresh Leafy Green Cabbage Head
    im = hi(110, 110); d = ImageDraw.Draw(im)
    d.polygon(blob(110, 110, 74, 68, n=26, amp=0.16, seed=413), fill=(82, 142, 66, 255), outline=INK)
    d.polygon(blob(110, 110, 50, 46, n=22, amp=0.14, seed=414), fill=(128, 182, 102, 255), outline=INK_SOFT)
    d.polygon(blob(110, 110, 26, 24, n=18, amp=0.12, seed=415), fill=(182, 216, 148, 255), outline=INK_SOFT)
    out.append(("pk_cabbage_head_plant.png", "Garden Leafy Cabbage Plant", finish(im, 110, 110, 413), False, ["park", "garden", "plant", "cabbage", "modular"]))

    # 14. Ripe Orange Garden Pumpkin on Vine
    im = hi(130, 130); d = ImageDraw.Draw(im)
    for ox, oy, sd in [(-36, -26, 1), (36, 28, 2), (-24, 34, 3)]:
        d.polygon(blob(130 + ox, 130 + oy, 42, 34, n=18, amp=0.18, seed=430 + sd), fill=(64, 118, 52, 255), outline=INK)
    d.ellipse([72, 72, 188, 188], fill=(224, 122, 38, 255), outline=INK, width=5)
    for k in range(6):
        a = k * (math.tau / 6)
        d.line([(130, 130), (130 + math.cos(a) * 56, 130 + math.sin(a) * 56)], fill=(156, 74, 24, 190), width=4)
    d.ellipse([118, 118, 142, 142], fill=(78, 92, 44, 255), outline=INK, width=4)
    out.append(("pk_garden_pumpkin_vine.png", "Garden Pumpkin on Leafy Vine", finish(im, 130, 130, 414), False, ["park", "garden", "pumpkin", "farm", "modular"]))

    # 15. Galvanized Metal Watering Can (crisp metallic handle!)
    im = hi(130, 110); d = ImageDraw.Draw(im)
    d.arc([32, 70, 96, 150], 90, 270, fill=INK, width=16)
    d.arc([35, 73, 93, 147], 90, 270, fill=(154, 164, 170, 255), width=8)
    d.line([(146, 110), (222, 78)], fill=INK, width=20)
    d.line([(146, 110), (222, 78)], fill=(146, 156, 162, 255), width=12)
    d.ellipse([212, 62, 240, 92], fill=(168, 178, 184, 255), outline=INK, width=4)
    d.ellipse([66, 66, 158, 158], fill=(146, 156, 162, 255), outline=INK, width=6)
    d.ellipse([86, 86, 138, 138], fill=(76, 116, 142, 255), outline=INK, width=4)
    out.append(("pk_metal_watering_can.png", "Galvanized Garden Watering Can", finish(im, 130, 110, 415), False, ["park", "garden", "tool", "watering-can", "modular"]))

    return out


# =============================================================================
# PACK 5: DISTRICT STREETS, ALLEYS, YARDS & VIGIL CANDLES SPLITS (22 pieces)
# =============================================================================
def build_street_splits():
    out = []

    # 1. Bare Weathered Wooden Vendor Pushcart (empty bed — load with anything!)
    im = hi(380, 260); d = ImageDraw.Draw(im)
    soft_shadow_poly(im, [(125, 115), (615, 115), (615, 410), (125, 410)], off=(10, 14), blur=12)
    d.rounded_rectangle([38, 182, 155, 206], radius=6, fill=(122, 86, 56, 255), outline=INK, width=4)
    d.rounded_rectangle([38, 314, 155, 338], radius=6, fill=(122, 86, 56, 255), outline=INK, width=4)
    for wy in (92, 418):
        d.rounded_rectangle([285, wy - 14, 475, wy + 14], radius=10, fill=(76, 62, 54, 255), outline=INK, width=4)
        d.line([(320, wy), (440, wy)], fill=(142, 108, 76, 255), width=6)
    d.rounded_rectangle([136, 108, 628, 412], radius=12, fill=(138, 98, 64, 255), outline=INK, width=5)
    for y in range(138, 405, 34):
        d.line([(144, y), (620, y)], fill=(96, 66, 42, 190), width=3)
    d.rounded_rectangle([142, 100, 622, 132], radius=10, fill=(156, 62, 58, 255), outline=INK, width=4)
    for sx in range(165, 610, 48):
        d.rectangle([sx, 103, sx + 22, 129], fill=(232, 220, 196, 230))
    out.append(("str_bare_wooden_vendor_cart.png", "Bare Wooden Street Vendor Cart", finish(im, 380, 260, 501), True, ["street", "market", "cart", "bare", "modular"]))

    # 2. Wooden Crate of Twine-Bundled Beeswax Tapers
    im = hi(160, 110); d = ImageDraw.Draw(im)
    d.rounded_rectangle([34, 34, 286, 186], radius=8, fill=(116, 82, 52, 255), outline=INK, width=5)
    for cx in range(52, 270, 26):
        d.rounded_rectangle([cx, 48, cx + 18, 172], radius=4, fill=(242, 230, 198, 255), outline=(146, 124, 88, 210), width=2)
    d.line([(42, 110), (278, 110)], fill=(144, 62, 54, 255), width=7)
    out.append(("str_beeswax_taper_crate.png", "Crate of Beeswax Vigil Tapers", finish(im, 160, 110, 502), True, ["street", "temple", "candles", "crate", "modular"]))

    # 3. Tray of Colored Glass Memorial Jars & Brass Coin Box
    im = hi(160, 110); d = ImageDraw.Draw(im)
    d.rounded_rectangle([34, 34, 286, 186], radius=8, fill=(108, 76, 48, 255), outline=INK, width=5)
    for jx, jy, jcol in [
        (72, 74, (186, 48, 54)), (114, 74, (206, 144, 44)), (156, 74, (186, 48, 54)),
        (72, 142, (62, 118, 158)), (114, 142, (186, 48, 54)), (156, 142, (206, 144, 44)),
    ]:
        d.ellipse([jx - 18, jy - 18, jx + 18, jy + 18], fill=(*jcol, 245), outline=INK, width=3)
        d.ellipse([jx - 10, jy - 10, jx + 10, jy + 10], fill=(246, 236, 210, 255))
    d.rounded_rectangle([198, 58, 266, 162], radius=6, fill=(172, 136, 68, 255), outline=INK, width=4)
    d.line([(232, 60), (232, 160)], fill=(108, 82, 38, 200), width=3)
    out.append(("str_memorial_jars_crate.png", "Tray of Vigil Jars & Coin Box", finish(im, 160, 110, 503), True, ["street", "temple", "candles", "jars", "modular"]))

    # 4-6. Galvanized Flower Buckets (Crimson Roses, White Lilies, Golden Marigolds!)
    for fname, label, cols, sd in [
        ("str_flower_bucket_roses.png", "Bucket of Crimson Roses", [(186, 42, 52), (208, 58, 66), (156, 32, 42)], 504),
        ("str_flower_bucket_lilies.png", "Bucket of White Lilies", [(240, 232, 216), (228, 218, 198), (248, 244, 232)], 505),
        ("str_flower_bucket_marigolds.png", "Bucket of Golden Marigolds", [(228, 158, 44), (242, 184, 62), (204, 126, 34)], 506),
    ]:
        im = hi(120, 120); d = ImageDraw.Draw(im)
        rng = random.Random(sd)
        d.ellipse([44, 44, 196, 196], fill=(122, 130, 134, 255), outline=INK, width=5)
        d.ellipse([56, 56, 184, 184], fill=(64, 92, 50, 255))
        for _ in range(11):
            a = rng.uniform(0, math.tau); dist = rng.uniform(6, 46)
            draw_flower(d, 120 + math.cos(a) * dist, 120 + math.sin(a) * dist, 14, rng.choice(cols), ang=a)
        out.append((fname, label, finish(im, 120, 120, sd), True, ["street", "market", "flowers", "bucket", "modular"]))

    # 7. Berlin "H" Haltestelle Tram Signpost
    im = hi(110, 110); d = ImageDraw.Draw(im)
    d.ellipse([54, 54, 166, 166], fill=(58, 72, 66, 255), outline=INK, width=5)
    d.ellipse([70, 70, 150, 150], fill=(238, 196, 68, 255), outline=(44, 88, 62, 255), width=7)
    d.line([(92, 88), (92, 132)], fill=(38, 78, 54, 255), width=8)
    d.line([(128, 88), (128, 132)], fill=(38, 78, 54, 255), width=8)
    d.line([(92, 110), (128, 110)], fill=(38, 78, 54, 255), width=8)
    out.append(("str_tram_stop_signpost.png", "Berlin 'H' Tram Stop Signpost", finish(im, 110, 110, 507), True, ["street", "tram", "sign", "berlin", "modular"]))

    # 8. Bare Verdigris Tram Rain Canopy & Slatted Bench (no curb slab!)
    im = hi(300, 170); d = ImageDraw.Draw(im)
    d.rounded_rectangle([72, 94, 528, 246], radius=10, fill=(116, 78, 50, 255), outline=INK, width=5)
    for y in (132, 170, 208):
        d.line([(80, y), (520, y)], fill=(72, 48, 32, 200), width=4)
    canopy = Image.new("RGBA", im.size, (0, 0, 0, 0))
    cd = ImageDraw.Draw(canopy)
    cd.rounded_rectangle([32, 42, 568, 298], radius=16, fill=(76, 118, 108, 155), outline=(44, 62, 58, 245), width=6)
    for x in range(86, 550, 62):
        cd.line([(x, 46), (x, 294)], fill=(54, 82, 76, 210), width=5)
    cd.line([(38, 170), (562, 170)], fill=(48, 72, 66, 230), width=8)
    im.alpha_composite(canopy)
    out.append(("str_bare_tram_canopy_bench.png", "Bare Glass Canopy & Waiting Bench", finish(im, 300, 170, 508), True, ["street", "tram", "bench", "canopy", "bare", "modular"]))

    # 9. Standalone Cast-Iron Street Litter Bin
    im = hi(100, 100); d = ImageDraw.Draw(im)
    d.ellipse([48, 48, 152, 152], fill=(64, 72, 70, 255), outline=INK, width=5)
    d.ellipse([66, 66, 134, 134], fill=(38, 42, 40, 255))
    out.append(("str_cast_iron_litter_bin.png", "Cast-Iron Street Litter Bin", finish(im, 100, 100, 509), True, ["street", "trash", "bin", "urban", "modular"]))

    # 10. Bare Corrugated-Tin Backyard Lean-To Shed (empty timber apron!)
    im = hi(360, 260); d = ImageDraw.Draw(im)
    soft_shadow_poly(im, [(56, 62), (650, 62), (650, 444), (56, 444)], off=(12, 14), blur=12)
    d.rounded_rectangle([54, 290, 656, 456], radius=10, fill=(116, 94, 72, 255), outline=INK, width=5)
    for y in (346, 402):
        d.line([(62, y), (648, y)], fill=(82, 64, 46, 185), width=4)
    d.rounded_rectangle([52, 56, 662, 322], radius=8, fill=(108, 114, 116, 255), outline=INK, width=5)
    for x in range(74, 654, 24):
        d.line([(x, 62), (x, 316)], fill=(78, 84, 86, 200), width=5)
        d.line([(x + 6, 62), (x + 6, 316)], fill=(142, 148, 150, 140), width=3)
    for rx, ry, rr, col in [(165, 148, 56, (148, 88, 52, 125)), (468, 212, 68, (136, 78, 46, 120)), (312, 108, 50, (82, 116, 64, 130))]:
        d.polygon(blob(rx, ry, rr, rr * 0.72, n=22, amp=0.18, seed=int(rx)), fill=col)
    out.append(("str_bare_tin_lean_to_shed.png", "Bare Tin & Timber Backyard Shed", finish(im, 360, 260, 510), True, ["yard", "shed", "bare", "working-class", "modular"]))

    # 11. Black Coal Heap & Iron Coal Shovel
    im = hi(170, 140); d = ImageDraw.Draw(im)
    d.polygon(blob(152, 146, 102, 68, n=28, amp=0.18, seed=511), fill=(44, 44, 48, 255), outline=INK)
    rng = random.Random(511)
    for _ in range(32):
        cx, cy = rng.uniform(76, 224), rng.uniform(98, 192)
        d.ellipse([cx - 10, cy - 8, cx + 10, cy + 8], fill=(66, 68, 74, 225), outline=(28, 28, 32, 200))
    d.line([(236, 76), (294, 212)], fill=(144, 106, 68, 255), width=10)
    d.rounded_rectangle([216, 48, 258, 92], radius=5, fill=(92, 96, 100, 255), outline=INK, width=4)
    out.append(("str_coal_heap_shovel.png", "Backyard Coal Heap & Shovel", finish(im, 170, 140, 511), False, ["yard", "coal", "fuel", "shovel", "modular"]))

    # 12. Neatly Stacked Split Firewood Rack
    im = hi(190, 110); d = ImageDraw.Draw(im)
    for row in range(3):
        for lx in range(44, 324, 48):
            ly = 42 + row * 46
            d.rounded_rectangle([lx, ly, lx + 42, ly + 34], radius=10, fill=(142, 102, 66, 255), outline=INK, width=4)
            d.line([(lx + 8, ly + 17), (lx + 34, ly + 17)], fill=(104, 72, 46, 180), width=3)
    out.append(("str_split_firewood_rack.png", "Stacked Split Firewood Logs", finish(im, 190, 110, 512), True, ["yard", "firewood", "wood", "camp", "modular"]))

    # 13. Single Closed Galvanized Garbage Can
    im = hi(130, 130); d = ImageDraw.Draw(im)
    d.ellipse([48, 48, 212, 212], fill=(128, 136, 138, 255), outline=INK, width=6)
    d.ellipse([68, 68, 192, 192], fill=(148, 156, 158, 255), outline=(76, 82, 84, 210), width=4)
    d.rounded_rectangle([104, 114, 156, 146], radius=6, fill=(92, 98, 100, 255), outline=INK, width=4)
    out.append(("str_galvanized_bin_closed.png", "Closed Galvanized Garbage Can", finish(im, 130, 130, 513), True, ["alley", "trash", "bin", "urban", "modular"]))

    # 14. Single Open Overflowing Galvanized Garbage Can (askew lid!)
    im = hi(150, 140); d = ImageDraw.Draw(im)
    d.ellipse([44, 58, 202, 216], fill=(116, 124, 126, 255), outline=INK, width=6)
    d.ellipse([62, 76, 184, 198], fill=(56, 52, 48, 255))
    d.polygon([(84, 114), (144, 102), (160, 162), (94, 174)], fill=(214, 206, 184, 245), outline=INK_SOFT)
    d.ellipse([136, 136, 166, 166], fill=(82, 126, 78, 245), outline=INK, width=3)
    d.ellipse([104, 38, 256, 190], fill=(138, 146, 148, 255), outline=INK, width=5)
    d.rounded_rectangle([156, 98, 204, 126], radius=5, fill=(88, 94, 96, 255), outline=INK, width=4)
    out.append(("str_galvanized_bin_open.png", "Open Galvanized Garbage Can", finish(im, 150, 140, 514), True, ["alley", "trash", "bin", "urban", "modular"]))

    # 15. Twine-Tied Stack of Old Newspapers
    im = hi(110, 110); d = ImageDraw.Draw(im)
    d.rounded_rectangle([46, 46, 174, 174], radius=8, fill=(218, 208, 186, 255), outline=INK, width=5)
    d.line([(50, 110), (170, 110)], fill=(138, 92, 56, 240), width=6)
    d.line([(110, 50), (110, 170)], fill=(138, 92, 56, 240), width=6)
    out.append(("str_tied_newspaper_bundle.png", "Twine-Tied Newspaper Bundle", finish(im, 110, 110, 515), True, ["alley", "paper", "newspaper", "clutter", "modular"]))

    # 16. Single Tied Burlap Alley Trash Sack
    im = hi(140, 130); d = ImageDraw.Draw(im)
    d.polygon(blob(140, 130, 92, 78, n=26, amp=0.14, seed=516), fill=(142, 122, 92, 255), outline=INK)
    d.ellipse([120, 110, 160, 150], fill=(102, 82, 58, 255), outline=INK, width=4)
    out.append(("str_alley_burlap_trash_bag.png", "Tied Burlap Alley Trash Sack", finish(im, 140, 130, 516), True, ["alley", "trash", "sack", "urban", "modular"]))

    # 17. Bare Ancient Melted Wax Crust Mound (no candles — place your own!)
    im = hi(260, 220); d = ImageDraw.Draw(im)
    d.polygon(blob(260, 220, 206, 164, n=48, amp=0.14, seed=517), fill=(176, 148, 106, 232), outline=(92, 72, 48, 190))
    d.polygon(blob(254, 214, 156, 122, n=42, amp=0.16, seed=518), fill=(214, 192, 150, 238), outline=(124, 102, 70, 180))
    d.polygon(blob(264, 210, 102, 80, n=36, amp=0.17, seed=519), fill=(238, 226, 196, 242), outline=(154, 132, 100, 175))
    out.append(("vigil_bare_wax_crust_mound.png", "Bare Melted Vigil Wax Mound", finish(im, 260, 220, 517), False, ["temple", "wax", "candle", "vigil", "bare", "modular"]))

    # 18. Small Cluster of 5 Lit Beeswax Vigil Tapers
    im = hi(140, 140); glow = hi(140, 140)
    for i, (cx, cy, r) in enumerate([(140, 136, 20), (104, 124, 16), (174, 128, 17), (118, 168, 15), (162, 166, 16)]):
        draw_candle(im, glow, cx, cy, r, lit=True, seed=530 + i)
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(12)))
    out.append(("vigil_candle_cluster_lit.png", "Lit Beeswax Vigil Candle Cluster", finish(im, 140, 140, 518), False, ["temple", "candle", "vigil", "light", "modular"]))

    # 19-20. Single Glowing Red & Amber Memorial Glass Vigil Jars
    for fname, label, jcol, sd in [
        ("vigil_memorial_glass_jar_red.png", "Red Glass Memorial Vigil Jar", (186, 46, 54), 519),
        ("vigil_memorial_glass_jar_amber.png", "Amber Glass Memorial Vigil Jar", (206, 144, 44), 520),
    ]:
        im = hi(110, 110); glow = hi(110, 110)
        draw_candle(im, glow, 110, 110, 32, lit=True, jar=jcol, seed=sd)
        im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(12)))
        out.append((fname, label, finish(im, 110, 110, sd), False, ["temple", "candle", "vigil", "jar", "memorial", "modular"]))

    # 21. Single Crimson Remembrance Rose & Pebble-Weighted Prayer Slip
    im = hi(130, 110); d = ImageDraw.Draw(im)
    d.polygon([(44, 108), (154, 86), (172, 164), (62, 186)], fill=(230, 214, 178, 248), outline=INK_SOFT)
    d.line([(68, 124), (138, 110)], fill=(122, 104, 82, 165), width=3)
    d.line([(72, 144), (134, 132)], fill=(122, 104, 82, 150), width=3)
    d.ellipse([96, 128, 122, 150], fill=(116, 112, 104, 255), outline=INK, width=3)
    draw_flower(d, 186, 108, 24, (182, 46, 56), ang=-0.65)
    out.append(("vigil_remembrance_rose_note.png", "Remembrance Rose & Prayer Note", finish(im, 130, 110, 521), False, ["temple", "vigil", "flower", "rose", "note", "modular"]))

    # 22. Dark Brass Votive Candle Dish (5 lit tapers inside!)
    im = hi(160, 160); glow = hi(160, 160); d = ImageDraw.Draw(im)
    d.ellipse([66, 66, 254, 254], fill=(74, 62, 54, 255), outline=INK, width=6)
    d.ellipse([86, 86, 234, 234], fill=(122, 102, 76, 255), outline=(48, 38, 32, 210), width=4)
    for i, (cx, cy, r) in enumerate([(160, 160, 20), (130, 138, 15), (190, 140, 16), (134, 186, 15), (186, 184, 16)]):
        draw_candle(im, glow, cx, cy, r, lit=True, seed=550 + i)
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14)))
    out.append(("vigil_brass_votive_bowl.png", "Brass Votive Candle Offering Bowl", finish(im, 160, 160, 522), True, ["temple", "candle", "vigil", "brass", "modular"]))

    return out


def save_qa(entries, out_path: Path, cols: int = 5):
    rows = (len(entries) + cols - 1) // cols
    cw, ch = 260, 200
    sheet = Image.new("RGBA", (cols * cw, rows * ch), (28, 30, 38, 255))
    d = ImageDraw.Draw(sheet)
    for y in range(0, rows * ch, 14):
        for x in range(0, cols * cw, 14):
            if ((x // 14) + (y // 14)) % 2 == 0:
                d.rectangle([x, y, x + 13, y + 13], fill=(42, 46, 56, 255))
    for i, (fname, _, im, _, _) in enumerate(entries):
        r, c = divmod(i, cols)
        sc = min((cw - 24) / max(1, im.width), (ch - 40) / max(1, im.height))
        nw, nh = max(1, int(im.width * sc)), max(1, int(im.height * sc))
        th = im.resize((nw, nh), Image.Resampling.LANCZOS)
        sheet.alpha_composite(th, (c * cw + (cw - nw) // 2, r * ch + (ch - 22 - nh) // 2))
        d.rectangle([c * cw, (r + 1) * ch - 22, (c + 1) * cw - 1, (r + 1) * ch - 1], fill=(16, 18, 24, 232))
        d.text((c * cw + 5, (r + 1) * ch - 17), fname.replace(".png", ""), fill=(235, 240, 248, 255))
    sheet.convert("RGB").save(out_path, "PNG")


def main():
    apt = build_apartment_splits()
    for fname, _, im, _, _ in apt:
        im.save(APT_DIR / fname, "PNG", optimize=True)
    save_qa(apt, SCRATCH / "qa_splits_apartment.png", cols=5)

    pk = build_park_splits()
    for fname, _, im, _, _ in pk:
        im.save(PK_DIR / fname, "PNG", optimize=True)
    save_qa(pk, SCRATCH / "qa_splits_park.png", cols=5)

    dst = build_street_splits()
    for fname, _, im, _, _ in dst:
        im.save(DST_DIR / fname, "PNG", optimize=True)
    save_qa(dst, SCRATCH / "qa_splits_streets.png", cols=5)

    print(f"Generated modular splits: apartment={len(apt)}, park={len(pk)}, streets={len(dst)} (total={len(apt)+len(pk)+len(dst)})")

    meta = []
    for subdir, entries in [
        ("props/messy_apartment", apt),
        ("props/neighborhood_park", pk),
        ("props/district_streets", dst),
    ]:
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
    with open(SCRATCH / "meta_splits_proc.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"Wrote {len(meta)} metadata entries -> {SCRATCH / 'meta_splits_proc.json'}")


if __name__ == "__main__":
    main()
