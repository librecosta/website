"""Build Discovery Harbor and render the editable GoFurry island in Blender."""

import argparse
from pathlib import Path
import sys

import bpy

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent/'harvest'), str(HERE.parent/'sofaraway')]
from geometry import MATERIALS, METALS, PALETTE, collection
from harbor import connections, land, landing, quay, vegetation
from pavilions import furniture, game_hall, guide_house, lookout, main_hall
from studio import lights, render_device, vertices, view


VIEWS = {
    'front': ((6.3,-14.3,9.4),None,None),
    'rear': ((-8.8,13.6,9.4),None,None),
    'top': ((0,-.001,1),None,None),
    'pavilion': ((-6.3,-12.6,6.7),(-1.20,2.98,4.60),12.35),
    'harbor': ((10.6,-15.3,10.5),(.02,-1.70,2.94),25.40),
}


def palette():
    MATERIALS.clear()
    PALETTE.update({
        'grass': ('929a76','9ea580','a7a686','899979','a3a788','a8ae8b'),
        'earth': ('b1a489','b3ad8a','a69d84','a8a087'),
        'sand': ('cabb9e','dbccad','d2c09d','c8b79c','ded2b7'),
        'cliff': ('ada394','a39a89','b6aa96','a8a092','b2aa9b','929184','b6ad9e'),
        'shale': ('827f73','8f8a7c','969080','a09989','827c71'),
        'talus': ('bfb099','b5aa95','cabb9e','c9bca6','c2b5a1'),
        'stone': ('c2b9a5','d1c6b0','bfb39e','d5cbb9','b7aa96','ccc1ac'),
        'limestone': ('e2d6bc','dfcfb8','e7dbc4','d8cbb5','efe2cc','d4c4ae'),
        'bark': ('655741','77664c','675943'),
        'leaves': ('648779','78967e','8e9f77','668573','829b86'),
        'pine': ('527567','5b7c67','6a8a68','6b7f62'),
        'flower': ('dc8b65','f5d9ab','efb28b','fff0d0'),
        'timber': ('6c5043','81614d','775b49','876955'),
        'plank': ('a88b6c','ac9475','baa083','c2aa88','a98c72','b89a7b'),
        'metal': ('405856','516460','53665e','667672'),
        'iron': ('444e4c','555c56','53665f'),
        'brass': ('aa8260','b59172','937052'),
        'zinc': ('6c8b88','6f8d8b','789795','65837f','86a19b'),
        'azure': ('6b9a99','557c7f','96aba0','517479'),
        'peach': ('ffdec2','e8bf9e','d9b297','edc5ab','e3bfa2'),
        'clay': ('e5583d','c96852','d0745b','d58067','bf614b','c97058'),
        'ivory': ('eadfcc','f4e9d3','dbcbb4'),
        'amber': ('ffd5a2','ffdcac'),
    })
    METALS.update({'metal':.29,'brass':.38,'zinc':.33,'iron':.25})


def make():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    palette()
    scene = bpy.context.scene
    scene.name = 'GoFurry — The Discovery Harbor · Rivet Bay'
    island = collection('GOFURRY • Island asset')
    geology = collection('01 · Pocket bay, chalk cliffs and raised coastal shelves',island)
    harbor = collection('02 · Curved quay, masonry and working slip',island)
    walks = collection('03 · Civic plaza, coastal connections and stair flights',island)
    civic = collection('04 · Discovery pavilion',island)
    west = collection('05 · Resource guide loggia',island)
    east = collection('06 · Game discovery gallery',island)
    perch = collection('07 · Community headland lookout',island)
    seating = collection('08 · Benches and wayfinding',island)
    plants = collection('09 · Coastal olive and tide-line vegetation',island)
    studio = collection('10 · Orthographic review and daylight')
    _, tree = land(geology)
    quay(harbor)
    landing(tree,harbor)
    connections(tree,walks)
    main_hall(civic)
    guide_house(west)
    game_hall(east)
    lookout(perch)
    furniture(seating)
    vegetation(tree,plants)
    bpy.context.view_layer.update()
    points = vertices(island.all_objects)
    for name,(angle,target,scale) in VIEWS.items():
        camera=view(name,angle,target,scale,points,studio)
        if name=='front':
            scene.camera=camera
    lights(scene,studio)
    bpy.data.lights['Warm daylight'].color=(1,.92,.83)
    bpy.data.lights['Warm daylight'].energy=4300
    bpy.data.lights['Cool sky return'].energy=2280
    bpy.data.lights['Long overhead reflection'].energy=2710
    bpy.data.lights['Low flight sleeve bounce'].name='Harbor bounce'
    scene.view_settings.exposure=.14
    scene.cycles.samples=72
    scene['Art stage']='WEB-V0.1-W4-GF1'
    scene['Provenance']='Original LibreCosta geometry, materials and lighting. GoFurry brand colors only.'
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                space=area.spaces.active
                space.region_3d.view_perspective='CAMERA'
                space.shading.color_type='MATERIAL'
                space.overlay.show_overlays=False
    return scene


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--output',type=Path,default=HERE)
    cli.add_argument('--renders',nargs='*',choices=VIEWS)
    cli.add_argument('--draft',action='store_true')
    cli.add_argument('--device',choices=['CPU','CUDA','OPTIX'],default='CPU')
    args=cli.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.output.mkdir(parents=True,exist_ok=True)
    scene=make()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str((args.output/'gofurry.blend').resolve()),compress=True)
    render_device(scene,args.device)
    if args.draft:
        scene.cycles.samples=28
        scene.render.resolution_percentage=66
    if args.renders:
        out=args.output/'renders'
        out.mkdir(exist_ok=True)
        for name in args.renders:
            scene.camera=bpy.data.objects['Camera · '+name]
            scene.render.filepath=str((out/f'{name}.png').resolve())
            bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
