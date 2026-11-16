"""Render independent, equal-scale references under the same studio rig."""

import argparse
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from build import FRONT, lighting, orthographic
from fabric import collection, object_in


REPO=HERE.parents[2]
ISLANDS=REPO/'public'/'works'/'islands'
CASES=(
    ('Liquid Glass / L1 source',HERE/'liquid-glass.blend','LIQUID GLASS',0),
    ('Harvest / H2 source',HERE.parent/'harvest'/'harvest.blend','HARVEST',0),
    ('Harvest / H2 GLB',ISLANDS/'harvest.glb',None,0),
    ('Bay / GLB',ISLANDS/'bay.glb',None,85),
    ('Foundry / GLB',ISLANDS/'foundry.glb',None,24),
    ('Prism / reference GLB',ISLANDS/'prism.glb',None,30),
)
WIDTH, HEIGHT = 760, 608


def model_points(objects):
    return [ob.matrix_world@vertex.co for ob in objects if ob.type=='MESH' for vertex in ob.data.vertices]


def title(label, camera, group):
    data=bpy.data.curves.new('Comparison label','FONT')
    data.body=label
    data.size=.48
    obj=object_in(label,data,group)
    obj.parent=camera
    obj.location=(-13.8,10.5,-4)
    text=bpy.data.materials.new('Comparison label pigment')
    text.use_nodes=True
    emission=text.node_tree.nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value=(.80,.85,.91,1)
    output=text.node_tree.nodes.get('Material Output')
    text.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
    data.materials.append(text)


def panel(label, path, prefix, bearing, dest):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if prefix:
        bpy.ops.wm.open_mainfile(filepath=str(path))
        asset=next(col for col in bpy.data.collections if col.name.startswith(prefix+' •'))
        objects=list(asset.all_objects)
        for obj in list(bpy.context.scene.objects):
            if obj not in objects:
                bpy.data.objects.remove(obj,do_unlink=True)
    else:
        bpy.ops.import_scene.gltf(filepath=str(path))
        objects=list(bpy.context.scene.objects)
    scene=bpy.context.scene
    group=collection('Comparison rig')
    root=object_in('Comparison transform',None,group)
    for obj in objects:
        if obj.parent is None:
            obj.parent=root
    root.rotation_euler.z=math.radians(bearing)
    bpy.context.view_layer.update()
    points=model_points(objects)
    low=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    scale=21/max(high.x-low.x,high.y-low.y)
    root.scale=(scale,)*3
    root.location=Vector((0,0,3.5))-(high+low)*(.5*scale)
    bpy.context.view_layer.update()
    camera=orthographic('equal-scale comparison',FRONT,None,30,model_points(objects),group)
    scene.camera=camera
    lighting(scene,group)
    title(label,camera,group)
    scene.render.resolution_x=WIDTH
    scene.render.resolution_y=HEIGHT
    scene.cycles.samples=32
    scene.render.filepath=str(dest)
    bpy.ops.render.render(write_still=True)


def assemble(panels, destination):
    # Blender pixel buffers start at the bottom-left corner.
    width,height=WIDTH*3,HEIGHT*2
    output=np.ones((height,width,4),dtype=np.float32)
    background=np.array((20,25,31),dtype=np.float32)/255
    for i,path in enumerate(panels):
        image=bpy.data.images.load(str(path),check_existing=False)
        rgba=np.empty(WIDTH*HEIGHT*4,dtype=np.float32)
        image.pixels.foreach_get(rgba)
        rgba=rgba.reshape((HEIGHT,WIDTH,4))
        x,y=(i%3)*WIDTH,(1-i//3)*HEIGHT
        output[y:y+HEIGHT,x:x+WIDTH,:3]=rgba[:,:,:3]*rgba[:,:,3:4]+background*(1-rgba[:,:,3:4])
        bpy.data.images.remove(image)
    image=bpy.data.images.new('Equal-scale island comparison',width=width,height=height,alpha=False)
    image.filepath_raw=str(destination)
    image.file_format='PNG'
    image.pixels.foreach_set(output.ravel())
    image.save()


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('scratch',type=Path)
    cli.add_argument('output',type=Path)
    args=cli.parse_args(sys.argv[sys.argv.index('--')+1:])
    args.scratch.mkdir(parents=True,exist_ok=True)
    panels=[]
    for i,case in enumerate(CASES):
        dest=(args.scratch/f'panel-{i+1}.png').resolve()
        panel(*case,dest)
        panels.append(dest)
    assemble(panels,args.output.resolve())


if __name__=='__main__':
    main()
