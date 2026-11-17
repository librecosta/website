"""Build and render the editable Wave Loom at Echo Cape."""

import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / 'harvest'), str(HERE.parent / 'sofaraway')]
from geometry import MATERIALS, METALS, PALETTE, collection, object_in
from ground import coast, landscape, routes
from loom import build_surface
from station import loom_support, observation, workshop
from studio import lights, render_device, vertices, view


VIEWS = {
    'front': ((6.1,-14.5,8.25),None,None),
    'rear': ((-7.6,12.7,7.75),None,None),
    'top': ((0,-.001,1),None,None),
    'surface': ((2.55,-10.6,5.85),(.0,.03,6.21),18.8),
    'structure': ((-7.35,-11.1,5.8),(-7.96,.64,5.05),11.15),
}


def palette():
    MATERIALS.clear()
    PALETTE.update({
        'grass': ('7c8b74','839078','929980','768773','849179'),
        'cliff': ('95948b','a49b8c','858f8d','95988d','a3a397','a29b8a'),
        'shale': ('6c7475','7c8078','73777a','73847c'),
        'talus': ('b3ada1','a79e8b','b6b19d','aea99e'),
        'stone': ('b5b2a5','bcbbac','a9ac9f','c4c0b3','afaf9f','9faaa6'),
        'pine': ('506c61','617a69','6c8275','788a76'),
        'leaves': ('819481','8c9c85','637d70'),
        'plank': ('89796a','a08d76','99856e','ab9880','93816e'),
        'timber': ('594d44','756956','62574a'),
        'bark': ('625649','716759'),
        'graphite': ('2e3b43','41484c','4c5558'),
        'iron': ('3c4b53','4b565b','514f4c'),
        'steel': ('8296a1','748a96','607987'),
        'slate': ('617079','6b777c','4c626c','778585','5c6971'),
        'zinc': ('8d9b9b','a7b0ad','929eaa','7e969e'),
        'roof': ('617078','677a84','566a75','70808a','5f6d77'),
        'ivory': ('d1d3c9','c1cccd'),
        'azure': ('526e7c','6f8798','86a6b3','456573','a6b4ba'),
        'brass': ('9f8267','aa9274','ae9a7f'),
        'ochre': ('b69c6c','bba67e','ae9874'),
        'amber': ('ffd196',),
    })
    METALS.update({'graphite':.24,'steel':.58,'zinc':.44,'iron':.44,'roof':.37,'slate':.22})


def make():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    palette()
    scene = bpy.context.scene
    scene.name = 'Wavefield — The Wave Loom · Echo Cape'
    island = collection('WAVEFIELD • Island asset')
    land = collection('01 · Folded terrain and coastal erosion',island)
    trails = collection('02 · Landing, valley walk and side access',island)
    wave = collection('03 · Continuous suspended wave field',island)
    rig = collection('04 · Non-symmetrical tension assemblies',island)
    west = collection('05 · Calibration workshop',island)
    east = collection('06 · Observation station',island)
    plants = collection('07 · Wind-shaped junipers and low scrub',island)
    review = collection('08 · Orthographic review cameras and lights')
    _, ground = coast(land)
    routes(ground,trails)
    build_surface(wave)
    for side,label in ((-1,'West · compact triangular frame'),(1,'East · extended outboard frame')):
        loom_support(side,ground,collection(label,rig))
    workshop(ground,west)
    observation(east)
    landscape(ground,plants)
    bpy.context.view_layer.update()
    points = vertices(island.all_objects)
    for name,(angle,target,scale) in VIEWS.items():
        cam = view(name,angle,target,scale,points,review)
        if name == 'front':
            scene.camera = cam
    lights(scene,review)
    scene.cycles.samples = 72
    scene.view_settings.exposure = .22

    fill = bpy.data.lights.new('Soft silver grazing light','AREA')
    fill.energy = 630
    fill.color = (.74,.88,1)
    fill.shape = 'RECTANGLE'
    fill.size = 12
    fill.size_y = 3
    light = object_in(fill.name,fill,review)
    light.location = (-1,1.4,12.3)
    light.rotation_euler = (Vector((.3,-.72,6.42))-light.location).to_track_quat('-Z','Y').to_euler()
    bounce = bpy.data.lights.new('Warm calibration bench bounce','AREA')
    bounce.energy = 33
    bounce.color = (1,.76,.49)
    bounce.size = .68
    practical = object_in(bounce.name,bounce,review)
    practical.location = (-9.85,3.13,5.89)
    practical.rotation_euler = (Vector((-10.13,3.82,5.12))-practical.location).to_track_quat('-Z','Y').to_euler()
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.region_3d.view_perspective = 'CAMERA'
                space.shading.color_type = 'MATERIAL'
                space.overlay.show_overlays = False
    scene['Art stage'] = 'WEB-V0.1-W4-WF1'
    scene['Provenance'] = 'Original LibreCosta environment, geometry, shaders and lighting.'
    return scene


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--output',type=Path,default=HERE)
    cli.add_argument('--renders',nargs='*',choices=VIEWS)
    cli.add_argument('--draft',action='store_true')
    cli.add_argument('--device',choices=['CPU','CUDA','OPTIX'],default='CPU')
    args = cli.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.output.mkdir(parents=True,exist_ok=True)
    scene = make()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str((args.output/'wavefield.blend').resolve()),compress=True)
    render_device(scene,args.device)
    if args.draft:
        scene.cycles.samples = 26
        scene.render.resolution_percentage = 66
    if args.renders:
        out = args.output/'renders'
        out.mkdir(exist_ok=True)
        for name in args.renders:
            scene.camera = bpy.data.objects['Camera · '+name]
            scene.render.filepath = str((out/f'{name}.png').resolve())
            bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
