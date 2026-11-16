"""Build and render The Atlas Observatory from editable Blender geometry."""

import argparse
from pathlib import Path
import sys

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))

from craft import collection, palette
from buildings import archive, curated_articles, learning_notes, topics
from courtyard import courtyard
from grounds import garden, geology, quay_props, routes
from studio import lights, render_device, vertices, view


VIEWS = {
    'front': ((8.1,-14,7.95),None,None),
    'rear': ((-9.6,11,6.8),None,None),
    'top': ((0,-.26,12),None,None),
    'archive': ((7.8,-12,6.1),(2.26,3.04,6.68),13.2),
    'courtyard': ((6.7,-9.6,9.4),(1.10,-2.41,3.12),15.25),
}


def create():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    palette()
    scene=bpy.context.scene
    scene.name='GopherAtlas — The Atlas Observatory'
    island=collection('GOPHER ATLAS • Island asset')
    geo=collection('01 · Sea cliffs and three mountain terraces',island)
    top=collection('02 · Atlas archive and observation platform',island)
    learning=collection('03 · Learning Notes workshop',island)
    reading=collection('04 · Curated Articles reading hall',island)
    arcade=collection('05 · Topics arcades and threshold displays',island)
    mapping=collection('06 · Cartography court',island)
    paths=collection('07 · Harbor, staircases and gardenside routes',island)
    plants=collection('08 · Windswept vegetation',island)
    review=collection('09 · Orthographic review and studio lights')
    lands=geology(geo)
    archive(top)
    learning_notes(learning)
    curated_articles(reading)
    topics(arcade)
    courtyard(mapping)
    quay_props(routes(lands,paths))
    garden(lands,plants)
    bpy.context.view_layer.update()
    points=vertices(island.all_objects)
    for name,(look,target,scale) in VIEWS.items():
        camera=view(name,look,target,scale,points,review)
        if name=='front':
            scene.camera=camera
    lights(scene,review)
    scene.view_settings.exposure=.10
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                space=area.spaces.active
                space.shading.color_type='MATERIAL'
                space.region_3d.view_perspective='CAMERA'
                space.overlay.show_overlays=False
    scene['Art stage']='WEB-V0.1-W3-G1'
    scene['Provenance']='Original LibreCosta geometry and material palette; no external models or textures.'
    return scene


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=HERE)
    parser.add_argument('--renders',nargs='*',choices=VIEWS)
    parser.add_argument('--device',choices=['CPU','CUDA','OPTIX'],default='CPU')
    parser.add_argument('--draft',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.output.mkdir(parents=True,exist_ok=True)
    scene=create()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str((args.output/'gopher-atlas.blend').resolve()),compress=True)
    render_device(scene,args.device)
    if args.draft:
        scene.cycles.samples=16
        scene.render.resolution_percentage=62
    if args.renders:
        renders=args.output/'renders'
        renders.mkdir(exist_ok=True)
        for name in args.renders:
            scene.camera=bpy.data.objects['Camera · '+name]
            scene.render.filepath=str((renders/f'{name}.png').resolve())
            bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    main()
