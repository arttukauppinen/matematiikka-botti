"""Renders the /ruletti images into <out>/ruletti/ for the Worker's static assets:

- <n>.gif   the wheel spinning until the ball lands in n (n = 0-36); the wheel stops with n at 12 o'clock
- <n>.png   the stopped wheel, the GIF's last frame
- poyta.bin, pelimerkit.bin, poyta.json   the betting table and the chips, as palette indices the Worker draws
  into a PNG (drawTable in ruletti.mjs)

usage: python tools/ruletti.py <out dir> [numbers...]      Pillow 12, see deploy.yml. Numbers render only those GIFs.
"""
import json
import math
import random
import sys
from collections.abc import Callable
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
RED = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
STEP = 360 / len(ORDER)

# wheel GIF: 32 colours at 60 ms a frame keeps one GIF near 1 MB. RL.spin in ruletti.mjs waits MOTION_MS plus a margin
# for the GIF to load before it shows the result.
SIZE = 320
SS = 3  # draw at 3x and shrink, which anti-aliases every edge
COLORS = 32
FRAME_MS = 60
MOTION_MS = 4800
DROP_MS = 1900  # the ball leaves the track and hops over the frets
LAND_MS = 3500  # the ball settles in its pocket; the wheel keeps slowing until MOTION_MS
HOLD_MS = 60000  # a client that loops GIFs anyway keeps showing the result until the message is edited
TRACK_R, POCKET_R = 0.865, 0.51  # ball centre, as a fraction of the wheel radius

FELT = (14, 74, 38)
WOOD_DARK = (58, 32, 14)
WOOD = (110, 64, 28)
CONE = (126, 76, 34)
TRACK = (184, 132, 74)
TRACK_EDGE = (132, 88, 44)
GOLD = (222, 184, 92)
GOLD_DARK = (150, 112, 40)
GOLD_LIGHT = (240, 214, 140)
CELL = {'red': (196, 34, 42), 'black': (26, 26, 28), 'green': (16, 138, 62)}
POCKET = {'red': (150, 24, 32), 'black': (12, 12, 14), 'green': (10, 104, 46)}
WHITE = (246, 244, 236)
FRET = (214, 214, 220)


def color(n: int) -> str:
    return 'green' if n == 0 else 'red' if n in RED else 'black'


def polar(cx: float, cy: float, r: float, deg: float) -> tuple[float, float]:
    """the point r away from (cx, cy) at deg clockwise from 12 o'clock"""
    a = math.radians(deg)
    return cx + r * math.sin(a), cy - r * math.cos(a)


def disc(draw: ImageDraw.ImageDraw, x: float, y: float, r: float, fill) -> None:
    draw.ellipse((x - r, y - r, x + r, y + r), fill=fill)


def wedge(draw: ImageDraw.ImageDraw, c: float, r_out: float, r_in: float, a0: float, a1: float, fill) -> None:
    """a slice of the ring between r_in and r_out from angle a0 to a1"""
    outer = [polar(c, c, r_out, a0 + (a1 - a0) * k / 8) for k in range(9)]
    inner = [polar(c, c, r_in, a1 - (a1 - a0) * k / 8) for k in range(9)]
    draw.polygon(outer + inner, fill=fill)


def label(text: str, px: int, fill, stroke: int) -> Image.Image:
    """text on a transparent image just big enough for it; the stroke in the same colour makes the font bold"""
    font = ImageFont.load_default(px)
    box = font.getbbox(text, stroke_width=stroke)
    img = Image.new('RGBA', (box[2] - box[0] + 4, box[3] - box[1] + 4), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((2 - box[0], 2 - box[1]), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=fill)
    return img


def paste_center(img: Image.Image, top: Image.Image, x: float, y: float) -> None:
    img.alpha_composite(top, (round(x - top.width / 2), round(y - top.height / 2)))


# --- the wheel ---------------------------------------------------------------------------------------------------


def bowl(big: int) -> Image.Image:
    """the part that doesn't turn: wooden rim, ball track and the eight deflector diamonds"""
    c, R = big / 2, big / 2
    img = Image.new('RGBA', (big, big), FELT + (255,))
    d = ImageDraw.Draw(img)
    for r, fill in ((0.995, WOOD_DARK), (0.95, WOOD), (0.93, TRACK_EDGE), (0.915, TRACK), (0.765, TRACK_EDGE)):
        disc(d, c, c, R * r, fill)
    for k in range(8):
        a = k * 45 + 22.5
        tips = [polar(c, c, R * 0.835, a), polar(c, c, R * 0.805, a - 2.6), polar(c, c, R * 0.775, a), polar(c, c, R * 0.805, a + 2.6)]
        d.polygon(tips, fill=GOLD, outline=GOLD_DARK)
    return img


def rotor(big: int) -> Image.Image:
    """the part that turns, drawn with pocket 0 at 12 o'clock and transparent outside its rim"""
    c, R = big / 2, big / 2
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    disc(d, c, c, R * 0.75, GOLD_DARK)
    disc(d, c, c, R * 0.74, GOLD)
    for i, n in enumerate(ORDER):
        a0, a1 = i * STEP - STEP / 2, i * STEP + STEP / 2
        wedge(d, c, R * 0.725, R * 0.585, a0, a1, CELL[color(n)])
        wedge(d, c, R * 0.57, R * 0.445, a0, a1, POCKET[color(n)])
    for r, w in ((0.585, 0.016), (0.445, 0.012)):
        d.ellipse((c - R * r, c - R * r, c + R * r, c + R * r), outline=GOLD, width=int(R * w))
    for i in range(len(ORDER)):
        a = i * STEP - STEP / 2
        d.line([polar(c, c, R * 0.57, a), polar(c, c, R * 0.445, a)], fill=FRET, width=int(R * 0.012))
        d.line([polar(c, c, R * 0.725, a), polar(c, c, R * 0.585, a)], fill=GOLD_DARK, width=max(1, int(R * 0.005)))
    disc(d, c, c, R * 0.435, WOOD)
    disc(d, c, c, R * 0.36, CONE)
    for k in range(4):
        d.line([polar(c, c, R * 0.13, k * 90 + 45), polar(c, c, R * 0.42, k * 90 + 45)], fill=WOOD_DARK, width=int(R * 0.012))
    disc(d, c, c, R * 0.15, GOLD_DARK)
    disc(d, c, c, R * 0.13, GOLD)
    for k in range(4):  # the turret's cross
        x, y = polar(c, c, R * 0.30, k * 90)
        d.line([(c, c), (x, y)], fill=GOLD, width=int(R * 0.035))
        disc(d, x, y, R * 0.03, GOLD)
    disc(d, c, c, R * 0.06, GOLD_LIGHT)
    for i, n in enumerate(ORDER):
        text = label(str(n), int(R * 0.085), WHITE, 2).rotate(-i * STEP, resample=Image.BICUBIC, expand=True)
        paste_center(img, text, *polar(c, c, R * 0.655, i * STEP))
    return img


def ball_sprites(R: float) -> list[Image.Image]:
    """the ball, then ever fainter copies of it for the motion trail"""
    r = R * 0.036
    size = math.ceil(r * 2) + 4
    ball = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(ball)
    disc(d, size / 2, size / 2, r, (196, 196, 202))
    disc(d, size / 2 - r * 0.12, size / 2 - r * 0.12, r * 0.82, (252, 252, 252))
    faded = []
    for k in range(1, 9):
        ghost = ball.copy()
        ghost.putalpha(ball.getchannel('A').point(lambda a, k=k: a * (1 - k / 9) * 0.45))
        faded.append(ghost)
    return [ball] + faded


OverTime = Callable[[float], float]


def paths(number: int, rng: random.Random) -> tuple[OverTime, OverTime, OverTime]:
    """the wheel's angle, and the ball's angle and radius, at time t (ms). Angles are clockwise from 12 o'clock."""
    k = ORDER.index(number)
    end = -k * STEP  # the winning pocket stops at 12 o'clock
    turns = rng.uniform(0.75, 0.95) * 360

    def wheel(t: float) -> float:
        return end - turns * (1 - min(t, MOTION_MS) / MOTION_MS) ** 2.2

    # the ball runs the other way: `ahead` degrees past its pocket relative to the wheel, slowing to rest at LAND_MS
    ahead = rng.uniform(3.6, 4.4) * 360
    hops = rng.uniform(2.3, 2.7)

    def ball(t: float) -> float:
        return wheel(t) + k * STEP + ahead * (1 - min(t, LAND_MS) / LAND_MS) ** 2

    def radius(t: float) -> float:
        if t < DROP_MS:
            return TRACK_R
        u = min(1.0, (t - DROP_MS) / (LAND_MS - DROP_MS))
        bounce = abs(math.cos(math.pi * hops * u)) ** 0.7 if u < 1 else 0
        return POCKET_R + (TRACK_R - POCKET_R) * (1 - u) ** 1.4 * bounce

    return wheel, ball, radius


def wheel_frames(number: int) -> list[Image.Image]:
    big = SIZE * SS
    c, R = big / 2, big / 2
    base, top, balls = bowl(big), rotor(big), ball_sprites(R)
    wheel, ball, radius = paths(number, random.Random(number))
    assert abs((ball(MOTION_MS) + 180) % 360 - 180) < 1e-6 and radius(MOTION_MS) == POCKET_R, 'the ball must end in its pocket'
    frames = []
    for t in range(0, MOTION_MS + 1, FRAME_MS):
        img = base.copy()
        img.alpha_composite(top.rotate(-wheel(t), resample=Image.BICUBIC))
        for k in range(len(balls) - 1, -1, -1):  # trail first, the ball on top
            tk = t - FRAME_MS * k / 8
            if tk >= 0:
                paste_center(img, balls[k], *polar(c, c, R * radius(tk), ball(tk)))
        frames.append(img.convert('RGB').resize((SIZE, SIZE), Image.LANCZOS))
    return frames


def write_wheel(number: int, out: Path) -> int:
    frames = wheel_frames(number)
    sample = Image.new('RGB', (SIZE, SIZE * 3))  # one palette from the start, middle and end keeps colours steady
    for i, f in enumerate((frames[0], frames[len(frames) // 2], frames[-1])):
        sample.paste(f, (0, SIZE * i))
    palette = sample.quantize(COLORS, method=Image.Quantize.MEDIANCUT)
    q = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    durations = [FRAME_MS] * (len(q) - 1) + [HOLD_MS]
    q[0].save(out / f'{number}.gif', save_all=True, append_images=q[1:], duration=durations, disposal=1)  # no loop: plays once
    q[-1].save(out / f'{number}.png', optimize=True)
    return (out / f'{number}.gif').stat().st_size


# --- the betting table -------------------------------------------------------------------------------------------

# zero cell, 12 number columns and the 2:1 column; three number rows, the dozens and the even-money row
M, ZERO_W, COL_W, ROW_H, LOW_H = 6, 46, 44, 52, 40
TABLE_W = 2 * M + ZERO_W + 13 * COL_W
TABLE_H = 2 * M + 3 * ROW_H + 2 * LOW_H
TABLE_FELT = (18, 100, 52)
LINE = (238, 230, 204)
CHIP = 30
TIERS = [  # (smallest amount, chip colour, stripe colour, text colour) like casino chips
    (500, (106, 40, 150), (246, 244, 236), (246, 244, 236)),
    (100, (30, 30, 32), (222, 184, 92), (246, 244, 236)),
    (25, (24, 120, 60), (246, 244, 236), (246, 244, 236)),
    (5, (190, 36, 42), (246, 244, 236), (246, 244, 236)),
    (1, (240, 236, 226), (40, 90, 170), (28, 28, 30)),
]
TRANSPARENT = 255  # sprite pixels the Worker skips


def table() -> tuple[Image.Image, dict[str, list[int]]]:
    """the table drawn at 2x and shrunk, and the chip centre of every bet"""
    s = 2
    img = Image.new('RGBA', (TABLE_W * s, TABLE_H * s), TABLE_FELT + (255,))
    d = ImageDraw.Draw(img)
    spots: dict[str, list[int]] = {}

    def cell(key: str, x: int, y: int, w: int, h: int, fill=None, text: str | None = None, px: int = 22) -> None:
        d.rectangle((x * s, y * s, (x + w) * s, (y + h) * s), fill=fill, outline=LINE, width=2 * s)
        if text:
            paste_center(img, label(text, px * s, WHITE, s), (x + w / 2) * s, (y + h / 2) * s)
        spots[key] = [x + w // 2, y + h // 2]

    left = M + ZERO_W
    for j in range(12):
        for i in range(3):
            n = 3 * j + 3 - i
            cell(str(n), left + j * COL_W, M + i * ROW_H, COL_W, ROW_H, CELL[color(n)], str(n))
    for i, key in enumerate(('c3', 'c2', 'c1')):  # columns, named by the row they pay
        cell(key, left + 12 * COL_W, M + i * ROW_H, COL_W, ROW_H, text='2:1', px=15)
    top = M + 3 * ROW_H
    for k in range(3):
        cell(f'd{k + 1}', left + 4 * k * COL_W, top, 4 * COL_W, LOW_H, text=f'{12 * k + 1}-{12 * k + 12}', px=17)
    names = [('low', '1-18'), ('even', 'PARILLINEN'), ('red', ''), ('black', ''), ('odd', 'PARITON'), ('high', '19-36')]
    for k, (key, text) in enumerate(names):
        cell(key, left + 2 * k * COL_W, top + LOW_H, 2 * COL_W, LOW_H, text=text, px=14 if len(text) > 5 else 17)
        if key in ('red', 'black'):
            x, y = spots[key]
            d.polygon([(x * s - 26 * s, y * s), (x * s, y * s - 12 * s), (x * s + 26 * s, y * s), (x * s, y * s + 12 * s)], fill=CELL[key], outline=LINE, width=s)
    x1, y1 = left, M + 3 * ROW_H
    d.polygon([(M * s + 16 * s, M * s), (x1 * s, M * s), (x1 * s, y1 * s), (M * s + 16 * s, y1 * s), (M * s, (M + y1) / 2 * s)], fill=CELL['green'], outline=LINE, width=2 * s)
    paste_center(img, label('0', 22 * s, WHITE, s), (M + ZERO_W / 2 + 3) * s, (M + y1) / 2 * s)
    spots['0'] = [M + ZERO_W // 2 + 3, (M + y1) // 2]
    return img.convert('RGB').resize((TABLE_W, TABLE_H), Image.LANCZOS), spots


def chip(amount: int) -> Image.Image:
    """a chip with the amount on it, coloured like the biggest casino chip it reaches"""
    s = 4
    big = CHIP * s
    c = big / 2
    base, stripe, ink = next((b, st, i) for low, b, st, i in TIERS if amount >= low)
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    disc(d, c, c, c - 1, (12, 12, 12))
    disc(d, c, c, c - 1 - s, base)
    for k in range(6):
        d.pieslice((s + 1, s + 1, big - s - 1, big - s - 1), k * 60 - 12, k * 60 + 12, fill=stripe)
    disc(d, c, c, c * 0.74, base)
    d.ellipse((c - c * 0.66, c - c * 0.66, c + c * 0.66, c + c * 0.66), outline=stripe, width=s)
    paste_center(img, label(str(amount), (13 if amount < 100 else 11) * s, ink, s), c, c)
    return img.resize((CHIP, CHIP), Image.LANCZOS)


def write_table(out: Path) -> None:
    board, spots = table()
    chips = [chip(a) for a in range(1, 501)]
    # one palette for the table and every chip, sampled from the table and a few chips of each colour so that the
    # rare colours (only the 500 chip is purple) get their own entries
    examples = [1, 3, 5, 12, 25, 37, 100, 250, 500] * 4
    sample = Image.new('RGB', (TABLE_W + CHIP * len(examples), TABLE_H), TABLE_FELT)
    sample.paste(board, (0, 0))
    for i, a in enumerate(examples):
        sample.paste(chips[a - 1].convert('RGB'), (TABLE_W + i * CHIP, 0))
    palette = sample.quantize(128, method=Image.Quantize.MEDIANCUT)

    def quantized(img: Image.Image) -> bytes:
        return img.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).tobytes()

    (out / 'poyta.bin').write_bytes(quantized(board))
    sprites = bytearray()
    for img in chips:
        alpha = img.getchannel('A').tobytes()
        sprites += bytes(p if a >= 128 else TRANSPARENT for p, a in zip(quantized(img), alpha))
    (out / 'pelimerkit.bin').write_bytes(sprites)
    meta = {'w': TABLE_W, 'h': TABLE_H, 'chip': CHIP, 'palette': palette.getpalette()[: 3 * 128], 'spots': spots}
    (out / 'poyta.json').write_text(json.dumps(meta))


def main(out_dir: str, only: list[int]) -> None:
    out = Path(out_dir) / 'ruletti'
    out.mkdir(parents=True, exist_ok=True)
    write_table(out)
    numbers = only or ORDER
    with ProcessPoolExecutor() as pool:
        for n, size in zip(numbers, pool.map(write_wheel, numbers, [out] * len(numbers))):
            print(f'{n}.gif {size // 1024} KB')


if __name__ == '__main__':
    main(sys.argv[1], [int(a) for a in sys.argv[2:]])
