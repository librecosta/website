"""Render four website islands at a shared scale in Blender."""

import argparse
from pathlib import Path
import sys

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'sofaraway'))
from compare import CELL, render_case


def assemble(paths, output):
    w,h=CELL
    sheet=np.ones((h*2,w*2,4),dtype=np.float32)
    dark=np.array((19,24,30),dtype=np.float32)/255
    for i,path in enumerate(paths):
        image=bpy.data.images.load(str(path),check_existing=False)
        pixels=np.empty(w*h*4,dtype=np.float32)
        image.pixels.foreach_get(pixels)
        pixels=pixels.reshape(h,w,4)
        x,y=(i%2)*w,(1-i//2)*h
        sheet[y:y+h,x:x+w,:3]=pixels[:,:,:3]*pixels[:,:,3:4]+dark*(1-pixels[:,:,3:4])
        bpy.data.images.remove(image)
    image=bpy.data.images.new('Atlas Observatory reference sheet',width=w*2,height=h*2,alpha=False)
    image.file_format='PNG'
    image.filepath_raw=str(output)
    image.pixels.foreach_set(sheet.ravel())
    image.save()


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--source',type=Path,default=HERE/'gopher-atlas.blend')
    cli.add_argument('--scratch',type=Path,required=True)
    cli.add_argument('--output',type=Path,required=True)
    cli.add_argument('--device',choices=['CPU','CUDA','OPTIX'],default='CPU')
    args=cli.parse_args(sys.argv[sys.argv.index('--')+1:])
    args.scratch.mkdir(parents=True,exist_ok=True)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    references=(
        ('GopherAtlas / G1',args.source,'GOPHER ATLAS'),
        ('Harvest / H2',HERE.parent/'harvest'/'harvest.blend','HARVEST'),
        ('Liquid Glass / L2',HERE.parent/'liquid-glass'/'liquid-glass.blend','LIQUID GLASS'),
        ('SoFarAway / S2',HERE.parent/'sofaraway'/'sofaraway.blend','SOFARAWAY'),
    )
    paths=[]
    for i,(title,source,prefix) in enumerate(references):
        path=(args.scratch/f'{i+1}.png').resolve()
        render_case(title,source.resolve(),prefix,0,path,args.device)
        paths.append(path)
    assemble(paths,args.output.resolve())


if __name__=='__main__':
    main()
