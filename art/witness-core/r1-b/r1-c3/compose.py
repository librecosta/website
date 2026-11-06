"""Layout real renders/maps, and plot sections measured from the saved high mesh."""
import json
import hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps

ROOT=Path(__file__).resolve().parent
OUT=ROOT/"previews"
BG=(22,25,28);FG=(224,227,230);MUTED=(157,167,175)
FONT="C:/Windows/Fonts/arial.ttf"
TITLES={"A":"A / FORGED PLAIN","B":"B / FORGED + PRECISION","C":"C / AGED PRECISION"}


def font(size):return ImageFont.truetype(FONT,size)


def verify_inputs():
    manifest=json.loads((OUT/"manifest.json").read_text(encoding="utf-8"))
    verification=json.loads((ROOT/"verification.json").read_text(encoding="utf-8"))
    digest=hashlib.sha256((ROOT/"surface-language.blend").read_bytes()).hexdigest()
    assert verification["pass"] and digest==verification["source_blend_sha256"]==manifest["source_blend_sha256"]
    assert verification["parameters_sha256"]==manifest["parameters_sha256"]
    assert len(set(manifest["shared_low_geometry_and_uv"].values()))==1
    assert len(manifest["shots"])==16
    fixtures={}
    for shot in manifest["shots"]:
        path=OUT/shot["file"]
        assert hashlib.sha256(path.read_bytes()).hexdigest()==shot["sha256"]
        with Image.open(path) as im:assert list(im.size)==shot["resolution"]==[1440,1080]
        values={key:shot[key] for key in ("camera_matrix","ortho_scale","exposure","samples","light_settings","world_strength","clay_override_no_maps")}
        if shot["camera"] in fixtures:assert fixtures[shot["camera"]]==values
        else:fixtures[shot["camera"]]=values
    (ROOT/"preview-verification.json").write_text(json.dumps({"pass":True,"source_blend_sha256":digest,
        "render_count":16,"all_render_hashes_and_sizes_match":True,"same_camera_lights_exposure_within_each_view":True,
        "shared_low_geometry_and_uv":True,"scope":"Manifest/source/bake verification consistency. Visual review was performed separately."},indent=2)+"\n",encoding="utf-8")


def board(rows,name,tile=(600,450),notes=None):
    gap=16;margin=24;label=62
    width=len(rows[0])*(tile[0]+gap)-gap+2*margin
    height=len(rows)*(tile[1]+label+gap)-gap+2*margin+(50 if notes else 0)
    canvas=Image.new("RGB",(width,height),BG);draw=ImageDraw.Draw(canvas)
    for row,items in enumerate(rows):
        for col,(path,title,subtitle) in enumerate(items):
            x=margin+col*(tile[0]+gap);y=margin+row*(tile[1]+label+gap)
            draw.text((x+7,y+6),title,fill=FG,font=font(21))
            draw.text((x+7,y+34),subtitle,fill=MUTED,font=font(16))
            with Image.open(path) as im:
                if im.mode in ("I;16","I"):
                    im=im.convert("I").point(lambda v:v/257).convert("L")
                im=ImageOps.contain(im.convert("RGB"),tile,Image.Resampling.LANCZOS)
                canvas.paste(im,(x,y+label))
    if notes:draw.text((margin+7,height-34),notes,fill=MUTED,font=font(17))
    canvas.save(OUT/name,optimize=True)


def plots():
    sections=json.loads((ROOT/"surface-sections.json").read_text(encoding="utf-8"))
    canvas=Image.new("RGB",(1800,1200),BG);draw=ImageDraw.Draw(canvas)
    draw.text((40,22),"MEASURED HIGH-POLY SECTIONS / actual vertex coordinates",font=font(28),fill=FG)
    draw.text((40,65),"Graphs magnify the relief vertically; all rendered geometry uses its true, unexaggerated scale.",font=font(20),fill=MUTED)
    specs=[("FORGED BODY / A = B = C", "forging",(-1.3,1.3),(-5,5),[("A",(181,203,212))]),
           ("INNER FINISH / A forged, B/C planished", "inner_finish",(-.36,.36),(-2,2),[("A",(161,169,175)),("B",(227,188,131))]),
           ("B/C REAL FINISH CUTS / 0.012 BU pitch", "inner_finish",(-.10,.10),(-.40,-.16),[("B",(227,188,131))])]
    for row,(title,key,xr,yr,series) in enumerate(specs):
        left,top,right,bottom=130,170+row*350,1730,390+row*350
        draw.text((40,top-43),title,font=font(24),fill=FG)
        for i in range(5):
            y=top+i*(bottom-top)/4
            value=yr[1]-i*(yr[1]-yr[0])/4
            draw.line((left,y,right,y),fill=(49,55,61),width=1)
            draw.text((45,y-10),f"{value:.2f}",font=font(17),fill=MUTED)
        for i in range(5):
            x=left+i*(right-left)/4
            value=xr[0]+i*(xr[1]-xr[0])/4
            draw.line((x,top,x,bottom),fill=(39,45,51),width=1)
            draw.text((x-26,bottom+10),f"{value:.2f}",font=font(17),fill=MUTED)
        for variant,color in series:
            data=sections[variant][key]
            points=[]
            for x,y in zip(data["position_BU"],data["normal_offset_BU"]):
                if xr[0]<=x<=xr[1]:
                    px=left+(x-xr[0])/(xr[1]-xr[0])*(right-left)
                    py=bottom-(y*1000-yr[0])/(yr[1]-yr[0])*(bottom-top)
                    points.append((px,max(top,min(bottom,py))))
            if len(points)>1:draw.line(points,fill=color,width=3)
        draw.text((left,bottom+36),"Position (BU)   |   Vertical offset (10^-3 BU)",font=font(18),fill=MUTED)
    canvas.save(OUT/"surface-sections.png",optimize=True)


def main():
    verify_inputs()
    rows=[]
    for shot in ("medium","close"):
        rows.append([(OUT/f"{k}-low-{shot}.png",TITLES[k],f"BAKED LOW POLY / {shot.upper()}") for k in "ABC"])
    board(rows,"overview.png",notes="Matched cameras, light rig and exposure. No craters, damage fields or shader bump in the high-poly sources.")
    rows=[]
    for shot in ("medium","close"):
        for kind in ("high","low"):
            rows.append([(OUT/f"{k}-{kind}-{shot}.png",TITLES[k],f"{kind.upper()} POLY / {shot.upper()}") for k in "ABC"])
    board(rows,"high-low-comparison.png",notes="High = real sculpted mesh. Low = identical nominal coupon with high-to-low UV bakes; AO is not multiplied into GI.")
    board([[(OUT/"A-low-clay.png","NOMINAL LOW / CONTROL","NO MAPS / NO BUMP / NO RELIEF"),
            (OUT/"A-high-clay.png","A / REAL FORGED HIGH","UNIFORM SPECULAR CLAY / NO MAPS"),
            (OUT/"B-high-clay.png","B + C / SAME HIGH MESH","FORGED BODY + PHYSICAL FINISH CUTS")]],
          "geometry-proof.png",notes="One camera and one raking-light setup. No geometry exaggeration. Separate A/B/C high-clay PNGs are retained.")
    board([[(ROOT/"textures"/f"{k}-{ch}.png",TITLES[k],ch.upper()+" / 2048 / "+("8 BIT sRGB" if ch=="basecolor" else "16 BIT DATA"))
            for ch in ("basecolor","roughness","normal","ao")] for k in "ABC"],"texture-overview.png",tile=(384,384),
          notes="Thumbnails of actual baked PNGs. Data maps are displayed at 8-bit here only; source PNG data remains 16-bit.")
    plots()
    print("Real render / bake / measured-section boards saved")


if __name__=="__main__":main()
