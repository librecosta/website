"""Finish the editable Harvest source and export its baked, batched GLB in Blender."""

import argparse
import json
import math
from pathlib import Path
import struct
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from surfaces import apply_surfaces, atlases, dish_axes, image_nodes, surface_uvs


LIGHTS = tuple(Vector(v).normalized() for v in (
    (-.50, -.34, .80), (-.57, -.26, .79), (-.43, -.42, .80), (-.55, -.46, .80),
))
AMBIENT_SAMPLES = tuple(
    Vector((math.sqrt(u) * math.cos(i * 2.39996323),
            math.sqrt(u) * math.sin(i * 2.39996323), math.sqrt(1 - u)))
    for i in range(12) for u in [(i + .5) / 12]
)


def baked_light(tree, point, normal):
    """Cosine-weighted local sky visibility and soft directional visibility in scene units."""
    start = point + normal * .018
    tangent = normal.orthogonal().normalized()
    bitangent = normal.cross(tangent)
    occluded = 0
    for v in AMBIENT_SAMPLES:
        direction = v.x * tangent + v.y * bitangent + v.z * normal
        distance = tree.ray_cast(start, direction, 1.45)[3]
        if distance is not None:
            occluded += (1 - distance / 1.45)**2
    occlusion = occluded / len(AMBIENT_SAMPLES)
    daylight = sum(max(0, normal.dot(direction)) for direction in LIGHTS) / len(LIGHTS)
    direct = sum(max(0, normal.dot(direction)) for direction in LIGHTS
                 if tree.ray_cast(start, direction, 25)[3] is None) / len(LIGHTS)
    # The orbit lights supply the main shading. Bake the lost daylight and contact response only.
    return max(.55, 1 - .49 * occlusion - .27 * (daylight - direct))


def collect_geometry(island, *, project_uvs=surface_uvs, keep_bevels=lambda obj: False):
    # The smallest edge chamfers are subpixel at the viewer's initial framing. Keep
    # the authored modifiers in the .blend and the larger silhouettes in the GLB.
    for obj in island.all_objects:
        for modifier in obj.modifiers:
            if modifier.type == 'BEVEL' and modifier.width < .02 and not keep_bevels(obj):
                modifier.show_viewport = False
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    vertices, triangles, corners = [], [], []
    for obj in sorted(island.all_objects, key=lambda item: item.name):
        if obj.type not in {'MESH', 'CURVE'}:
            continue
        item = obj.evaluated_get(depsgraph)
        mesh = item.to_mesh()
        mesh.calc_loop_triangles()
        frame = item.matrix_world
        orientation = frame.to_3x3().inverted().transposed()
        offset = len(vertices)
        vertices.extend(frame @ vertex.co for vertex in mesh.vertices)
        dish = dish_axes(obj)
        uvs = {}
        for face in mesh.polygons:
            material = mesh.materials[face.material_index]
            for i, uv in zip(face.loop_indices, project_uvs(obj, mesh, face, material, dish), strict=True):
                uvs[i] = uv
        for tri in mesh.loop_triangles:
            material = mesh.materials[tri.material_index]
            indices = tuple(i + offset for i in tri.vertices)
            triangles.append(indices)
            corners.append((material, tuple((uvs[i], (orientation @ mesh.corner_normals[i].vector).normalized())
                                            for i in tri.loops)))
        item.to_mesh_clear()
    return vertices, triangles, corners


def gltf_materials(images):
    surface = bpy.data.materials.new('Harvest · atlas PBR')
    surface.use_nodes = True
    pigment, shader = image_nodes(surface, images)
    surface.node_tree.links.new(pigment.outputs['Color'], shader.inputs['Base Color'])
    materials = [surface]
    for name, tint, intensity in [('Amber', (1, .56, .25, 1), .16), ('Signal', (.22, .76, .61, 1), .14)]:
        material = bpy.data.materials.new('Harvest · ' + name.lower() + ' glass')
        material.use_nodes = True
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value = .36
        shader.inputs['Emission Color'].default_value = tint
        shader.inputs['Emission Strength'].default_value = intensity
        materials.append(material)
    return materials


def baked_mesh(island, images):
    vertices, triangles, corners = collect_geometry(island)
    tree = BVHTree.FromPolygons(vertices, triangles, all_triangles=True)
    mesh = bpy.data.meshes.new('Harvest · evaluated geometry')
    mesh.from_pydata(vertices, [], triangles)
    for material in gltf_materials(images):
        mesh.materials.append(material)
    uv_data = mesh.uv_layers.new(name='Surface atlas').uv
    colors = mesh.color_attributes.new(name='Baked pigment and daylight', type='FLOAT_COLOR', domain='CORNER')
    mesh.color_attributes.active_color = colors
    mesh.color_attributes.render_color_index = 0
    cached_light = {}
    normals, tints = [], []
    for face, triangle, (material, attributes) in zip(mesh.polygons, triangles, corners, strict=True):
        color = material.diffuse_color
        face.use_smooth = True
        face.material_index = {'Amber 01': 1, 'Signal 01': 2}.get(material.name, 0)
        for i, vertex, (uv, normal) in zip(face.loop_indices, triangle, attributes, strict=True):
            key = (vertex, tuple(round(n, 3) for n in normal))
            light = cached_light.get(key)
            if light is None:
                light = baked_light(tree, vertices[vertex], normal)
                cached_light[key] = light
            tints.extend((color[0] * light, color[1] * light, color[2] * light, 1))
            uv_data[i].vector = uv
            normals.append(normal)
    colors.data.foreach_set('color', np.array(tints, dtype=np.float32))
    mesh.normals_split_custom_set(normals)
    mesh.update()
    obj = bpy.data.objects.new('Harvest — The Collector’s Workshop', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, len(triangles)


def export(island, images, output):
    mesh, count = baked_mesh(island, images)
    gltf = export_glb(mesh, output)
    groups = [primitive for model in gltf['meshes'] for primitive in model['primitives']]
    if any('COLOR_0' not in p['attributes'] for p in groups):
        raise RuntimeError('Baked daylight and pigment are missing from the GLB.')
    print(f'Harvest web asset: {count:,} triangles, {len(groups)} draw groups, {output.stat().st_size:,} bytes')


def export_glb(mesh, output):
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format='GLB', use_selection=True,
        export_yup=True, export_animations=False, export_image_format='WEBP', export_jpeg_quality=94,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=9,
        export_draco_position_quantization=14, export_draco_normal_quantization=9,
        export_draco_texcoord_quantization=12, export_draco_color_quantization=9,
        export_vertex_color='ACTIVE',
        export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True,
    )
    with output.open('rb') as handle:
        header = handle.read(20)
        length = struct.unpack_from('<I', header, 12)[0]
        gltf = json.loads(handle.read(length))
    if 'KHR_draco_mesh_compression' not in gltf.get('extensionsUsed', []):
        raise RuntimeError('The Blender exporter did not apply Draco compression.')
    return gltf


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--blend', type=Path, help='Save an editable, textured .blend before exporting.')
    cli.add_argument('--glb', type=Path, required=True)
    cli.add_argument('--render', type=Path, help='Render the source with its existing studio camera.')
    options = cli.parse_args(sys.argv[sys.argv.index('--') + 1:])
    scene = bpy.context.scene
    island = bpy.data.collections['HARVEST • Island asset']
    images = atlases()
    apply_surfaces(island, images)
    if options.blend:
        scene['Art stage'] = 'WEB-V0.1-W3-H2'
        scene['Web bake'] = 'Editable surface UVs and packed atlases. Contact visibility and soft daylight are sampled for the GLB.'
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(options.blend.resolve()), compress=True)
    if options.render:
        scene.render.filepath = str(options.render.resolve())
        bpy.ops.render.render(write_still=True)
    export(island, images, options.glb.resolve())


if __name__ == '__main__':
    main()
