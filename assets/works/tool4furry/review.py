"""Render the Makers' Studio and four original islands at a common scale."""

import argparse
from pathlib import Path
import sys

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'sofaraway'))
from compare import CELL, render_case


def assemble(paths, output):
    w,h=CELL
    background=np.array((19,24,30),dtype=np.float32)/255
    sheet=np.ones((h*2,w*3,4),dtype=np.float32)
    sheet[:,:,:3]=background
    offsets=((0,h),(w,h),(2*w,h),(w//2,0),(w+w//2,0))
    for path,(x,y) in zip(paths,offsets,strict=True):
        image=bpy.data.images.load(str(path),check_existing=False)
        pixels=np.empty(w*h*4,dtype=np.float32)
        image.pixels.foreach_get(pixels)
        rgba=pixels.reshape((h,w,4))
        sheet[y:y+h,x:x+w,:3]=rgba[:,:,:3]*rgba[:,:,3:4]+background*(1-rgba[:,:,3:4])
        bpy.data.images.remove(image)
    image=bpy.data.images.new('The Makers’ Studio scale comparison',width=w*3,height=h*2,alpha=False)
    image.file_format='PNG'
    image.filepath_raw=str(output)
    image.pixels.foreach_set(sheet.ravel())
    image.save()


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--source',type=Path,default=HERE/'tool4furry.blend')
    cli.add_argument('--scratch',type=Path,required=True)
    cli.add_argument('--output',type=Path,required=True)
    cli.add_argument('--device',choices=['CPU','CUDA','OPTIX'],default='CPU')
    args=cli.parse_args(sys.argv[sys.argv.index('--')+1:])
    args.scratch.mkdir(parents=True,exist_ok=True)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    references=(
        ('Tool4Furry / T1',args.source,'TOOL4FURRY'),
        ('Harvest / H2',HERE.parent/'harvest'/'harvest.blend','HARVEST'),
        ('Liquid Glass / L2',HERE.parent/'liquid-glass'/'liquid-glass.blend','LIQUID GLASS'),
        ('SoFarAway / S2',HERE.parent/'sofaraway'/'sofaraway.blend','SOFARAWAY'),
        ('GopherAtlas / G2',HERE.parent/'gopher-atlas'/'gopher-atlas.blend','GOPHER ATLAS'),
    )
    paths=[]
    for i,(label,source,prefix) in enumerate(references):
        path=(args.scratch/f'{i+1}.png').resolve()
        render_case(label,source.resolve(),prefix,0,path,args.device)
        paths.append(path)
    assemble(paths,args.output.resolve())


if __name__=='__main__':
    main()
