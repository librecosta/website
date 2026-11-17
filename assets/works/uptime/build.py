"""Build and render the original Vigil Station island in Blender."""

import argparse
from pathlib import Path
import sys

import bpy

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), *(str(HERE.parent / name) for name in ('harvest', 'sofaraway', 'gofurry'))]
from geometry import MATERIALS, METALS, PALETTE, collection
from ridge import connections, coast, planting
from station import operations, workshop
from studio import lights, render_device, vertices, view
from tower import watchtower


VIEWS = {
    'front': ((7.5, -15.1, 9.6), None, None),
    'rear': ((-8.2, 13.2, 8.0), None, None),
    'top': ((0, -.001, 1), None, None),
    'tower': ((9.4, -14.0, 6.5), (3.60, 3.38, 9.24), 12.4),
    'station': ((6.0, -15.6, 6.2), (-2.95, -.82, 4.02), 15.2),
}


def palette():
    MATERIALS.clear()
    PALETTE.update({
        'cliff': ('8d8981', '99948a', 'a49d8b', 'a39a89', '8a8c83', 'a8a493', '92968b'),
        'shale': ('737a74', '757570', '84867b', '7d8279', '696f6e'),
        'talus': ('b3a58f', 'a69b88', 'b4ac97', 'bab09c', 'a79f8c'),
        'earth': ('a4a087', 'a29c83', '998f7e', 'aaa28c'),
        'sand': ('b4aa96', 'bbb19b', 'c6bca7', 'aba58f'),
        'grass': ('87917a', '91987f', '9b9e80', '858b74', '99a288'),
        'pine': ('486e64', '537869', '587667', '647f6e', '6c8773'),
        'leaves': ('6d8b79', '7c9279', '849783', '748873', '91a088'),
        'bark': ('655448', '746456', '7c6b59'),
        'limestone': ('d3c9b3', 'ded2ba', 'c6bea8', 'd8d0bf', 'c1b7a4', 'dfd3bd'),
        'plaster': ('c3bca7', 'd3cbbd', 'bbb39e', 'cfc6b4'),
        'stone': ('b2ac9c', 'c3b7a4', 'aca596', 'c0b7a8', 'b3ae9d'),
        'mortar': ('8a8a7d', '969082', '858980'),
        'timber': ('6a5347', '785e4e', '7d6658', '614e44'),
        'plank': ('aa9175', '9b856f', 'b19b83', 'ae9479', '978069'),
        'roof': ('527179', '58777c', '607d82', '567178', '5c747a', '647f81'),
        'metal': ('4b6062', '546d70', '5d7475', '476062'),
        'iron': ('424f51', '4d5859', '566465'),
        'copper': ('57786f', '6b8677', '698880', '668177', '748c7c', '5a7c79'),
        'brass': ('aa825c', 'b79569', 'aa896b'),
        'linen': ('dad2ba', 'd4c7ad', 'd1cabc'),
        'signal': ('8bb4a7',),
        'amber': ('ffcb88', 'eeb26c'),
        'beacon': ('f4ad52',),
    })
    METALS.update({'metal': .28, 'roof': .22, 'copper': .35, 'brass': .43})


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    palette()
    scene = bpy.context.scene
    scene.name = 'LibreCosta Uptime — The Vigil Station'
    island = collection('UPTIME • Island asset')
    rock = collection('01 · Coastal bedrock and raised benches', island)
    routes = collection('02 · Jetty, drainage and access stairs', island)
    watch = collection('03 · Octagonal watchtower and gallery', island)
    control = collection('04 · Control room and records bay', island)
    maintenance = collection('05 · Maintenance shop and covered passage', island)
    flora = collection('06 · Windbreaks and shore planting', island)
    review = collection('07 · Orthographic cameras and daylight')

    _, terrain = coast(rock)
    connections(terrain, routes)
    watchtower(watch)
    operations(control)
    workshop(maintenance)
    planting(terrain, flora)
    bpy.context.view_layer.update()
    points = vertices(island.all_objects)
    for name, (direction, target, scale) in VIEWS.items():
        camera = view(name, direction, target, scale, points, review)
        if name == 'front':
            scene.camera = camera
    lights(scene, review)
    bpy.data.lights['Warm daylight'].color = (1, .93, .85)
    bpy.data.lights['Cool sky return'].energy = 2310
    bpy.data.lights['Long overhead reflection'].energy = 2860
    bpy.data.lights['Low flight sleeve bounce'].name = 'Cliff bounce'
    scene.view_settings.exposure = .15
    scene.cycles.samples = 72
    scene['Art stage'] = 'WEB-V0.1-W4-U1'
    scene['Provenance'] = 'Original LibreCosta geometry, surfaces and lighting. No linked external assets.'
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.shading.color_type = 'MATERIAL'
                area.spaces.active.overlay.show_overlays = False
    return scene


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--output', type=Path, default=HERE)
    cli.add_argument('--renders', nargs='*', choices=VIEWS)
    cli.add_argument('--draft', action='store_true')
    cli.add_argument('--device', choices=['CPU', 'CUDA', 'OPTIX'], default='CPU')
    args = cli.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    args.output.mkdir(parents=True, exist_ok=True)
    scene = build()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str((args.output / 'uptime.blend').resolve()), compress=True)
    render_device(scene, args.device)
    if args.draft:
        scene.cycles.samples = 28
        scene.render.resolution_percentage = 66
    if args.renders:
        target = args.output / 'renders'
        target.mkdir(exist_ok=True)
        for name in args.renders:
            scene.camera = bpy.data.objects['Camera · ' + name]
            scene.render.filepath = str((target / f'{name}.png').resolve())
            bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
