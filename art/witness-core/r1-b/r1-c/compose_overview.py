"""Arrange actual rendered PNGs; no repaint, grading or generated pixels."""
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps

ROOT=Path(__file__).resolve().parent
PREV=ROOT/"previews"

def board(items,cols,tile,label,out):
    rows=(len(items)+cols-1)//cols
    gap,margin=18,24
    w,h=tile
    image=Image.new("RGB",(cols*w+(cols-1)*gap+2*margin,
                          rows*(h+label)+(rows-1)*gap+2*margin),(24,26,29))
    draw=ImageDraw.Draw(image)
    font=ImageFont.truetype("C:/Windows/Fonts/arial.ttf",22)
    for i,(title,path) in enumerate(items):
        x=margin+(i%cols)*(w+gap); y=margin+(i//cols)*(h+label+gap)
        draw.text((x+8,y+12),title,fill=(222,223,225),font=font)
        with Image.open(path) as source:
            thumb=ImageOps.contain(source.convert("RGB"),tile,Image.Resampling.LANCZOS)
            image.paste(thumb,(x+(w-thumb.width)//2,y+label+(h-thumb.height)//2))
    image.save(out,optimize=True)

def main():
    board([
        ("R1-B2 / ORIGINAL WORKBENCH",ROOT.parent/"previews/three-quarter.png"),
        ("R1-C / BLACKENED MONUMENT METAL",PREV/"hero.png"),
        ("R1-C / PRECISION ALIGNMENT",PREV/"aligned-front.png"),
        ("OUTER / FORGED MICRO SURFACE",PREV/"outer-surface-closeup.png"),
        ("INNER / MACHINED REVEAL",PREV/"inner-precision-closeup.png"),
        ("CORE / MESH EMISSION + METAL",PREV/"core-light.png"),
    ],3,(600,600),52,PREV/"overview.png")
    board([
        ("SAME CYCLES STUDIO / GRAY CONTROL",PREV/"clay-control.png"),
        ("SAME CYCLES STUDIO / MATERIAL STUDY",PREV/"hero.png"),
    ],2,(720,720),52,PREV/"matched-comparison.png")
    board([
        ("EMISSION 0 / SAME LIGHTS + EXPOSURE",PREV/"core-unlit-control.png"),
        ("EMISSION 0.7 / ACTUAL CYCLES GI",PREV/"core-light.png"),
    ],2,(800,600),52,PREV/"core-light-comparison.png")
    print("R1-C overview + matched controls saved")

if __name__=="__main__":
    main()
