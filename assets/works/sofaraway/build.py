"""Build the editable Beatline island and render its five art-review views."""

import argparse
from pathlib import Path
import sys

import bpy

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))

from control import control
from fabric import collection, palette
from flight import flight
from studio import FRONT, lights, render_device, vertices, view
from terrain import access, landscape, plants, shaft


VIEWS={
    'front': (FRONT,None,None),
    'rear': ((-6,11,6.45),None,None),
    'top': ((0,-.42,9),None,None),
    'flight': ((14,-7.6,4.1),(6.11,.86,5.13),14.9),
    'apertures': ((21,-1.7,1.5),(10.8,1.17,6.16),6.48),
    'control': ((3.75,-9.2,6.1),(-7.67,-.85,4.93),11.75),
}


def create():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    palette()
    scene=bpy.context.scene
    scene.name='SoFarAway — The Beatline'
    island=collection('SOFARAWAY • Island asset')
    earth=collection('01 · Faulted sandstone shelves',island)
    route=collection('02 · Elevated Beatline corridor',island)
    facilities=collection('03 · Launch and control facilities',island)
    access_routes=collection('04 · Landing and maintenance routes',island)
    shaft_group=collection('05 · Subsurface hoist and lined shaft',island)
    planting=collection('06 · Sparse wind-pruned planting',island)
    review=collection('07 · Art review cameras and lighting')
    main,terminal,mid=landscape(earth)
    access(main,terminal,access_routes)
    shaft(shaft_group)
    control(main,terminal,facilities)
    flight(main,terminal,mid,route)
    plants(main,terminal,planting)
    bpy.context.view_layer.update()
    points=vertices(island.all_objects)
    for name,(look,target,scale) in VIEWS.items():
        camera=view(name,look,target,scale,points,review)
        if name=='front':
            scene.camera=camera
    lights(scene,review)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                space=area.spaces.active
                space.shading.color_type='MATERIAL'
                space.region_3d.view_perspective='CAMERA'
                space.overlay.show_overlays=False
    scene['Art stage']='WEB-V0.1-W3-S1'
    scene['Provenance']='Original LibreCosta artwork. SoFarAway game and benchmark assets are visual references.'
    return scene


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=HERE)
    parser.add_argument('--renders',nargs='*',choices=VIEWS)
    parser.add_argument('--device',choices=['CPU','CUDA','OPTIX'],default='CPU')
    parser.add_argument('--draft',action='store_true')
    params=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    params.output.mkdir(parents=True,exist_ok=True)
    scene=create()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str((params.output/'sofaraway.blend').resolve()),compress=True)
    render_device(scene,params.device)
    if params.draft:
        scene.cycles.samples=16
        scene.render.resolution_percentage=60
    if params.renders:
        folder=params.output/'renders'
        folder.mkdir(exist_ok=True)
        for name in params.renders:
            scene.camera=bpy.data.objects['Camera · '+name]
            scene.render.filepath=str((folder/f'{name}.png').resolve())
            bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    main()
