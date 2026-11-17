"""Optional Pillow contact sheet; source PNGs remain unmodified."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent / "previews"
SHOTS = [
    ("R1-B2 / STATIC THREE QUARTER", "three-quarter.png"),
    ("ALIGNED FRONT / f481", "front-orthographic.png"),
    ("NESTED / OBLIQUE SIDE", "oblique-side.png"),
    ("JOINTS / A+2 B+28 C-22", "pose-moderate.png"),
    ("SIDE / f001", "side-orthographic.png"),
    ("TOP / f001", "top-orthographic.png"),
    ("IDLE / f121", "pose-idle-mid.png"),
    ("ALIGNED THREE QUARTER / f481", "alignment-end.png"),
]


def main():
    tile, label, gap, margin = 480, 44, 16, 24
    board = Image.new("RGB", (4 * tile + 3 * gap + 2 * margin,
                              2 * (tile + label) + gap + 2 * margin), (40, 42, 45))
    draw = ImageDraw.Draw(board)
    font = None
    for filename in ("C:/Windows/Fonts/arial.ttf", "DejaVuSans.ttf"):
        try:
            font = ImageFont.truetype(filename, 20)
            break
        except OSError:
            pass
    if font is None:
        font = ImageFont.load_default(size=20)
    for index, (title, filename) in enumerate(SHOTS):
        x = margin + (index % 4) * (tile + gap)
        y = margin + (index // 4) * (tile + label + gap)
        draw.text((x + 10, y + 10), title, font=font, fill=(230, 230, 230))
        with Image.open(ROOT / filename) as image:
            board.paste(image.convert("RGB").resize((tile, tile), Image.Resampling.LANCZOS), (x, y + label))
    board.save(ROOT / "overview.png", optimize=True)
    print("Saved previews/overview.png")


if __name__ == "__main__":
    main()
