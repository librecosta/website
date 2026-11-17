"""Build and render the editable Tool4Furry Makers' Studio island."""

import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / 'harvest'), str(HERE.parent / 'sofaraway')]
from architecture import finishing_room, main_studio, proof_deck
from coast import geology, planting, routes
from geometry import MATERIALS, METALS, PALETTE, collection, object_in
from studio import lights, render_device, vertices, view
from workroom import finishing_furniture, outdoor_proofs, studio_furniture


VIEWS = {
    'front': ((-7.2,-14.5,7.9),None,None),
    'rear': ((8.8,12.8,7.2),None,None),
    'top': ((0,-.001,1),None,None),
    'studio': ((-5.0,-11.8,4.85),(.10,1.26,5.70),13.45),
    'workbench': ((5.6,-9.15,7.5),(5.75,-.34,4.68),10.95),
    'interior': None,
}


def palette():
    MATERIALS.clear()
    PALETTE.update({
        'cliff': ('958e83','a39b8c','838783','b3a999','969385','90908b'),
        'shale': ('666766','77726d','6e706d','777e78','77706b'),
        'talus': ('9d988a','b4a893','aaa393','adb09e'),
        'grass': ('899479','939c81','8f987d','92927d','7c896a'),
        'pine': ('4d6755','56705e','738569','647d64'),
        'leaves': ('768969','839373','9da785'),
        'stone': ('c6baa4','cec4b4','bbb2a1','d3c7b2','c4b8a7'),
        'ivory': ('ede6d9','d9cfc1'),
        'timber': ('5d4940','70584c','665345','795d4d'),
        'plank': ('a08065','a68971','967b67','a99277','936e56'),
        'iron': ('34363d','494750','43464a','3d424d'),
        'graphite': ('3b3743','3d4049','514e58'),
        'zinc': ('81818a','9496a0','848891','737680'),
        'roof': ('4d4d58','626471','53545f','575860','575660','54546a'),
        'lightroof': ('85838c','8d8b96','787782','97949e','8c8299','82818d'),
        'brass': ('b1956c','c7ae7d','a88d69'),
        'amber': ('ffd7a2',),
        'lavender': ('745f8d','ad9ebd','9785ab'),
        'printlilac': ('aa99b9','9a83ac'),
        'printblue': ('818f9c','75879a'),
        'printbrown': ('ab8b79','bf9c8e'),
        'paper': ('e0d5c6','ebdecb','b7ad9f'),
    })
    METALS.update({'iron': .42,'zinc': .36,'roof': .32,'lightroof': .33,'graphite': .12})


def create():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    palette()
    scene=bpy.context.scene
    scene.name='Tool4Furry — The Makers’ Studio'
    island=collection('TOOL4FURRY • Island asset')
    terrain=collection('01 · Three coastal shelves and bedrock',island)
    circulation=collection('02 · Landing, yard and four stair flights',island)
    studio=collection('03 · Main north-light studio',island)
    annex=collection('04 · Finishing and stock room',island)
    proofs=collection('05 · Outdoor proofing and colour samples',island)
    trees=collection('06 · Sheltered planting',island)
    rig=collection('07 · Review cameras and studio lights')
    lands=geology(terrain)
    routes(lands,circulation)
    main_studio(lands,studio)
    finishing_room(lands,annex)
    proof_deck(lands,proofs)
    studio_furniture(collection('Registration table, image review and material library',studio))
    finishing_furniture(collection('Paper finishing, drawers and archive trays',annex))
    outdoor_proofs(collection('Folding display frames and swatch bench',proofs))
    planting(lands,trees)
    bpy.context.view_layer.update()
    points=vertices(island.all_objects)
    for name,framing in VIEWS.items():
        if framing is None:
            data=bpy.data.cameras.new(name)
            camera=object_in('Camera · '+name,data,rig)
            camera.location=(-.62,-1.22,5.61)
            camera.rotation_euler=(Vector((.07,2.75,4.86))-camera.location).to_track_quat('-Z','Y').to_euler()
            data.lens=22
            data.clip_start=.04
            continue
        direction,target,scale=framing
        camera=view(name,direction,target,scale,points,rig)
        if name=='front':
            scene.camera=camera
    lights(scene,rig)
    scene.view_settings.exposure=.22
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                space=area.spaces.active
                space.shading.color_type='MATERIAL'
                space.region_3d.view_perspective='CAMERA'
                space.overlay.show_overlays=False
    scene['Art stage']='WEB-V0.1-W4-T1'
    scene['Provenance']='Original LibreCosta model, surfaces and sample artwork. No external asset links.'
    return scene


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=HERE)
    parser.add_argument('--renders',nargs='*',choices=VIEWS)
    parser.add_argument('--draft',action='store_true')
    parser.add_argument('--device',choices=['CPU','CUDA','OPTIX'],default='CPU')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.output.mkdir(parents=True,exist_ok=True)
    scene=create()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str((args.output/'tool4furry.blend').resolve()),compress=True)
    render_device(scene,args.device)
    if args.draft:
        scene.cycles.samples=20
        scene.render.resolution_percentage=65
    if args.renders:
        output=args.output/'renders'
        output.mkdir(exist_ok=True)
        for name in args.renders:
            scene.camera=bpy.data.objects['Camera · '+name]
            scene.render.filepath=str((output/f'{name}.png').resolve())
            bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    main()
