"""Arrange original concept PNGs; add labels without repainting their content."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
VARIANTS = [
    ("A / REFERENCE REFINED", "A-reference-refined.png"),
    ("B / PRECISION", "B-precision.png"),
    ("C / ANCIENT PRECISION", "C-ancient-precision.png"),
]


def main():
    tile, label, gap, margin = 900, 54, 24, 32
    board = Image.new(
        "RGB",
        (3 * tile + 2 * gap + 2 * margin, tile + label + 2 * margin),
        (32, 33, 34),
    )
    draw = ImageDraw.Draw(board)
    font = None
    for font_path in ("C:/Windows/Fonts/arial.ttf", "DejaVuSans.ttf"):
        try:
            font = ImageFont.truetype(font_path, 26)
            break
        except OSError:
            pass
    if font is None:
        font = ImageFont.load_default(size=26)

    for index, (title, filename) in enumerate(VARIANTS):
        x = margin + index * (tile + gap)
        draw.text((x + 12, margin + 12), title, font=font, fill=(226, 226, 224))
        with Image.open(ROOT / filename) as image:
            if image.width != image.height:
                raise ValueError(f"Expected a square original: {filename}")
            preview = image.convert("RGB").resize((tile, tile), Image.Resampling.LANCZOS)
            board.paste(preview, (x, margin + label))

    target = ROOT / "overview.png"
    board.save(target, optimize=True)
    print(f"Saved overview.png ({board.width} x {board.height})")


if __name__ == "__main__":
    main()
