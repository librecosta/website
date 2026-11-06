"""Pure layout of actual renders and actual baked maps."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
ROOT=Path(__file__).resolve().parent
FONT="C:/Windows/Fonts/arial.ttf"
def main():
    tile=(600,450);gap=16;margin=24;label=48
    board=Image.new("RGB",(3*600+2*gap+2*margin,2*(450+label)+gap+2*margin),(25,28,31))
    draw=ImageDraw.Draw(board);font=ImageFont.truetype(FONT,21)
    titles=["A / R1-C BASELINE","B / FINE FORGED","C / STYLIZED TOOLING"]
    for row,shot in enumerate(("medium","close")):
        for col,key in enumerate(("A","B","C")):
            x=margin+col*(600+gap);y=margin+row*(450+label+gap)
            draw.text((x+8,y+12),titles[col]+" / "+shot.upper(),font=font,fill=(231,232,235))
            with Image.open(ROOT/"previews"/(key+"-"+shot+".png")) as im:
                board.paste(ImageOps.contain(im.convert("RGB"),tile,Image.Resampling.LANCZOS),(x,y+label))
    board.save(ROOT/"previews/overview.png",optimize=True)
    board=Image.new("RGB",(3*512+2*gap+2*margin,2*(512+label)+gap+2*margin),(25,28,31))
    draw=ImageDraw.Draw(board)
    for row,key in enumerate(("B","C")):
        for col,ch in enumerate(("basecolor","roughness","normal")):
            x=margin+col*(512+gap);y=margin+row*(512+label+gap)
            draw.text((x+8,y+12),key+" / "+ch.upper()+" / 2048",font=font,fill=(231,232,235))
            with Image.open(ROOT/"textures"/(key+"-"+ch+".png")) as im:
                board.paste(im.convert("RGB").resize((512,512),Image.Resampling.LANCZOS),(x,y+label))
    board.save(ROOT/"previews/texture-overview.png",optimize=True)
    print("Sample medium/close and actual texture contact sheets saved")
if __name__=="__main__":main()
