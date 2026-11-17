"""Render the existing benchmarks without placing their geometry in Harvest."""

import math
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build import studio
from geometry import collection


REPO = Path(__file__).resolve().parents[3]
H1_REVISION = '5d1f8b37088bb07ad4a10c1b805ea5240f2c77cb'
BENCHMARKS = {'bay': 85, 'foundry': 24, 'signal': 45}


def reference(model, bearing, output):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(model))
    scene = bpy.context.scene
    root = bpy.data.objects.new('WORKS bearing and scale', None)
    scene.collection.objects.link(root)
    for obj in list(scene.objects):
        if obj != root and obj.parent is None:
            obj.parent = root
    root.rotation_euler.z = math.radians(bearing)
    bpy.context.view_layer.update()
    objects = [obj for obj in scene.objects if obj.type == 'MESH']

    def points():
        return [obj.matrix_world @ v.co for obj in objects for v in obj.data.vertices]

    vertices = points()
    lower = Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
    upper = Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
    size = upper - lower
    factor = 24 / max(size.x, size.y)
    root.scale = (factor,) * 3
    root.location = Vector((0,0,2.4)) - (lower + upper) * factor / 2
    bpy.context.view_layer.update()
    studio(scene, points(), collection('Comparison lighting'))
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 800
    scene.cycles.samples = 16
    for obj in objects:
        obj.data.calc_loop_triangles()
    print(model.stem, len(objects), sum(len(o.data.loop_triangles) for o in objects), flush=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    destination = Path(sys.argv[-1]).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as scratch:
        for name, angle in BENCHMARKS.items():
            model = Path(scratch) / f'{name}.glb'
            with model.open('wb') as output:
                subprocess.run(['git', 'show', f'{H1_REVISION}:public/works/islands/{model.name}'],
                               cwd=REPO, stdout=output, check=True)
            reference(model, angle, destination / f'{name}.png')
