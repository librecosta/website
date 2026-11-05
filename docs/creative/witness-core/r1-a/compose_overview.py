"""Arrange the six original PNGs without repainting or cropping their contents."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
CONCEPTS = [
    ("B1", "FRACTURED STELE", "B1-fractured-stele.png"),
    ("B2", "OFFSET STRATA", "B2-offset-strata.png"),
    ("B3", "COUNTERFORM", "B3-counterform.png"),
    ("B4", "FOLDED MANTLE", "B4-folded-mantle.png"),
    ("B5", "PHASE LOCK", "B5-phase-lock.png"),
    ("B6", "HOLLOW AXIS", "B6-hollow-axis.png"),
]


def main():
    tile, label, gap, margin = 768, 52, 24, 32
    board = Image.new(
        "RGB",
        (3 * tile + 2 * gap + 2 * margin,
         2 * (tile + label) + gap + 2 * margin),
        (235, 235, 235),
    )
    draw = ImageDraw.Draw(board)
    font = None
    for font_path in ("C:/Windows/Fonts/arial.ttf", "DejaVuSans.ttf"):
        try:
            font = ImageFont.truetype(font_path, 24)
            break
        except OSError:
            pass
    if font is None:
        font = ImageFont.load_default(size=24)

    for index, (code, title, filename) in enumerate(CONCEPTS):
        x = margin + (index % 3) * (tile + gap)
        y = margin + (index // 3) * (tile + label + gap)
        draw.text((x + 12, y + 12), f"{code} / {title}", font=font, fill=(44, 44, 44))
        with Image.open(ROOT / filename) as image:
            if image.width != image.height:
                raise ValueError(f"Expected square image: {filename}")
            preview = image.convert("RGB").resize((tile, tile), Image.Resampling.LANCZOS)
            board.paste(preview, (x, y + label))

    target = ROOT / "overview.png"
    board.save(target, optimize=True)
    print(f"Saved {target} ({board.width} x {board.height})")


if __name__ == "__main__":
    main()
