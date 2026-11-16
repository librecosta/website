"""Render Beatline and the five references in an equal-scale contact sheet."""

import argparse
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))

from fabric import collection, object_in
from studio import FRONT, lights, render_device, vertices, view


ISLANDS=HERE.parents[2]/'public'/'works'/'islands'
CELL=(760,650)


def caption(label, camera, group):
    data=bpy.data.curves.new(label,'FONT')
    data.body=label
    data.size=.46
    text=object_in(label,data,group)
    text.parent=camera
    text.location=(-14,11.45,-3)
    ink=bpy.data.materials.new('Review caption')
    ink.use_nodes=True
    shader=ink.node_tree.nodes.new('ShaderNodeEmission')
    shader.inputs['Color'].default_value=(.80,.84,.87,1)
    ink.node_tree.links.new(shader.outputs[0],ink.node_tree.nodes.get('Material Output').inputs['Surface'])
    data.materials.append(ink)


def bounds(points):
    return (Vector(tuple(min(p[i] for p in points) for i in range(3))),
            Vector(tuple(max(p[i] for p in points) for i in range(3))))


def render_case(label,path,prefix,rotation,output,device):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if prefix:
        bpy.ops.wm.open_mainfile(filepath=str(path))
        asset = next(group for group in bpy.data.collections if group.name.startswith(prefix+' •'))
        objects=list(asset.all_objects)
        for obj in list(bpy.context.scene.objects):
            if obj not in objects:
                bpy.data.objects.remove(obj,do_unlink=True)
    else:
        bpy.ops.import_scene.gltf(filepath=str(path))
        objects=list(bpy.context.scene.objects)
    rig=collection('Equal-scale review')
    pivot=object_in('Comparison scale',None,rig)
    for obj in objects:
        if obj.parent is None:
            obj.parent=pivot
    pivot.rotation_euler.z=math.radians(rotation)
    bpy.context.view_layer.update()
    lo,hi=bounds(vertices(objects))
    factor=23/max(hi-lo)
    pivot.scale=(factor,)*3
    pivot.location=Vector((0,0,3.5))-(lo+hi)*factor*.5
    bpy.context.view_layer.update()
    scene=bpy.context.scene
    scene.camera=view('reference',FRONT,None,30.7,vertices(objects),rig)
    lights(scene,rig)
    caption(label,scene.camera,rig)
    render_device(scene,device)
    scene.cycles.samples=24
    scene.render.resolution_x,scene.render.resolution_y=CELL
    scene.render.filepath=str(output)
    bpy.ops.render.render(write_still=True)


def assemble(paths, output):
    width,height=CELL
    result=np.ones((height*2,width*3,4),dtype=np.float32)
    background=np.array((19,24,30),dtype=np.float32)/255
    for i,path in enumerate(paths):
        image=bpy.data.images.load(str(path),check_existing=False)
        rgba=np.empty(width*height*4,dtype=np.float32)
        image.pixels.foreach_get(rgba)
        rgba=rgba.reshape((height,width,4))
        x,y=(i%3)*width,(1-i//3)*height
        result[y:y+height,x:x+width,:3]=rgba[:,:,:3]*rgba[:,:,3:4]+background*(1-rgba[:,:,3:4])
        bpy.data.images.remove(image)
    image=bpy.data.images.new('Beatline reference contact sheet',width=width*3,height=height*2,alpha=False)
    image.file_format='PNG'
    image.filepath_raw=str(output)
    image.pixels.foreach_set(result.ravel())
    image.save()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=HERE/'sofaraway.blend')
    parser.add_argument('--scratch',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--device',choices=['CPU','CUDA','OPTIX'],default='CPU')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    args.scratch.mkdir(parents=True,exist_ok=True)
    refs=(
        ('SoFarAway / S1',args.source,'SOFARAWAY',0),
        ('Harvest / H2',HERE.parent/'harvest'/'harvest.blend','HARVEST',0),
        ('Liquid Glass / L2',HERE.parent/'liquid-glass'/'liquid-glass.blend','LIQUID GLASS',0),
        ('Bay / Wenz GLB',ISLANDS/'bay.glb',None,85),
        ('Foundry / Wenz GLB',ISLANDS/'foundry.glb',None,24),
        ('Signal / Wenz GLB',ISLANDS/'signal.glb',None,45),
    )
    panels=[]
    for i,(label,path,prefix,rotation) in enumerate(refs,1):
        panel=(args.scratch/f'{i}.png').resolve()
        render_case(label,path.resolve(),prefix,rotation,panel,args.device)
        panels.append(panel)
    assemble(panels,args.output.resolve())


if __name__=='__main__':
    main()
