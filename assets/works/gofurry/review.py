"""Render the harbor and six authored islands with a common scale, camera and lights."""

import argparse
from pathlib import Path
import sys

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'sofaraway'))
from compare import CELL, render_case


def contact_sheet(panels, output):
    width,height=CELL
    background=np.array((19,24,30),dtype=np.float32)/255
    sheet=np.ones((height*2,width*4,4),dtype=np.float32)
    sheet[:,:,:3]=background
    for index,path in enumerate(panels):
        image=bpy.data.images.load(str(path),check_existing=False)
        values=np.empty(width*height*4,dtype=np.float32)
        image.pixels.foreach_get(values)
        rgba=values.reshape((height,width,4))
        x,y=(index*width,height) if index<4 else ((index-4)*width+width//2,0)
        sheet[y:y+height,x:x+width,:3]=rgba[:,:,:3]*rgba[:,:,3:4]+background*(1-rgba[:,:,3:4])
        bpy.data.images.remove(image)
    image=bpy.data.images.new('Discovery Harbor · Seven island comparison',width=width*4,height=height*2,alpha=False)
    image.file_format='PNG'
    image.filepath_raw=str(output)
    image.pixels.foreach_set(sheet.ravel())
    image.save()


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--source',type=Path,default=HERE/'gofurry.blend')
    cli.add_argument('--scratch',type=Path,required=True)
    cli.add_argument('--output',type=Path,required=True)
    cli.add_argument('--device',choices=['CPU','CUDA','OPTIX'],default='CPU')
    args=cli.parse_args(sys.argv[sys.argv.index('--')+1:])
    args.scratch.mkdir(parents=True,exist_ok=True)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    refs=(
        ('GoFurry / GF1',args.source,'GOFURRY'),
        ('Harvest / H2',HERE.parent/'harvest'/'harvest.blend','HARVEST'),
        ('Liquid Glass / L2',HERE.parent/'liquid-glass'/'liquid-glass.blend','LIQUID GLASS'),
        ('SoFarAway / S2',HERE.parent/'sofaraway'/'sofaraway.blend','SOFARAWAY'),
        ('GopherAtlas / G2',HERE.parent/'gopher-atlas'/'gopher-atlas.blend','GOPHER ATLAS'),
        ('Tool4Furry / T2',HERE.parent/'tool4furry'/'tool4furry.blend','TOOL4FURRY'),
        ('Wavefield / WF2',HERE.parent/'wavefield'/'wavefield-final.blend','WAVEFIELD'),
    )
    paths=[]
    for i,(label,source,prefix) in enumerate(refs,1):
        panel=(args.scratch/f'{i}.png').resolve()
        render_case(label,source.resolve(),prefix,0,panel,args.device)
        paths.append(panel)
    contact_sheet(paths,args.output.resolve())


if __name__=='__main__':
    main()
