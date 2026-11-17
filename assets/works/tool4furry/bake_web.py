"""Finish the Makers' Studio source and export its baked Draco GLB in Blender."""

import argparse
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'harvest'))
from bake_web import baked_light, collect_geometry, export_glb
from surfaces import atlases, image_nodes, surface_uvs


ASSET = "Makers' Studio"
UV = 'Makers Studio surface atlas'
SURFACES = {
    'cliff': 'cliff', 'shale': 'cliff', 'talus': 'cliff', 'grass': 'grass',
    'pine': 'grass', 'leaves': 'grass', 'bark': 'wood',
    'stone': 'plaster', 'ivory': 'plaster', 'mortar': 'cliff',
    'timber': 'wood', 'plank': 'wood', 'roof': 'roof', 'lightroof': 'roof',
    'zinc': 'iron', 'iron': 'iron', 'graphite': 'roof', 'brass': 'brass',
}
GRADES = {
    'plank': (1.035, .99, .95), 'timber': (1.04, .985, .95),
    'lightroof': (1.19, 1.22, 1.26), 'roof': (.96, .98, 1.025),
    'iron': (.96, .98, 1.02), 'zinc': (1.04, 1.06, 1.08),
    'stone': (1.025, 1.015, .99), 'shale': (.985, 1, 1.01),
}
GLAZING = {
    'Clear workshop glazing': ((.40, .52, .60, 1), .10, .16),
    'Diffuse clerestory glazing': ((.48, .57, .63, 1), .29, .33),
}
LAMP = (1, .69, .40, 1)


def pigment_key(material):
    return material.name.split()[0].lower()


def batch(material):
    if material.name in GLAZING:
        return material.name
    return 'lamps' if pigment_key(material) == 'amber' else 'opaque'


def project_uvs(obj, mesh, face, material, _dish=None):
    surface = SURFACES.get(pigment_key(material), 'plain')
    if surface == 'wood' and abs(face.normal.z) > .96:
        size = obj.dimensions
        if size.z > 1.35 * max(size.x, size.y):
            surface = 'endgrain'
    return surface_uvs(obj, mesh, face, material, surface_name=surface)


def prepare_source(island, images):
    materials = set()
    for obj in island.all_objects:
        if obj.type not in {'MESH', 'CURVE'}:
            continue
        materials.update(obj.data.materials)
        if obj.type != 'MESH':
            continue
        mesh = obj.data
        layer = mesh.uv_layers.get(UV) or mesh.uv_layers.new(name=UV)
        mesh.uv_layers.active = layer
        layer.active_render = True
        for face in mesh.polygons:
            material = mesh.materials[face.material_index]
            for loop, uv in zip(face.loop_indices, project_uvs(obj, mesh, face, material), strict=True):
                layer.uv[loop].vector = uv

    for material in sorted(materials, key=lambda mat: mat.name):
        shader = material.node_tree.nodes.get('Principled BSDF')
        key = batch(material)
        if key in GLAZING:
            shader.inputs['Roughness'].default_value = GLAZING[key][1]
            shader.inputs['Specular IOR Level'].default_value = .39
            continue
        if key == 'lamps':
            shader.inputs['Emission Color'].default_value = LAMP
            shader.inputs['Emission Strength'].default_value = .28
            continue
        if material.get('Studio surface'):
            continue

        surface = pigment_key(material)
        pigment = material.diffuse_color[:3]
        if surface in {'roof', 'lightroof'}:
            gray = .2126 * pigment[0] + .7152 * pigment[1] + .0722 * pigment[2]
            pigment = tuple(value * .25 + gray * .75 for value in pigment)
        grade = GRADES.get(surface, (1, 1, 1))
        color = tuple(value * gain for value, gain in zip(pigment, grade, strict=True))
        material.diffuse_color = (*color, 1)
        if surface in SURFACES:
            image, shader = image_nodes(material, images)
            multiply = material.node_tree.nodes.new('ShaderNodeMixRGB')
            multiply.label = 'Editable workshop pigment'
            multiply.location = (-260, 260)
            multiply.blend_type = 'MULTIPLY'
            multiply.inputs[0].default_value = 1
            multiply.inputs[1].default_value = material.diffuse_color
            link = material.node_tree.links.new
            link(image.outputs['Color'], multiply.inputs[2])
            link(multiply.outputs[0], shader.inputs['Base Color'])
        material['Studio surface'] = True


def web_materials(images):
    materials = {}
    for kind in ('opaque', 'lamps', *GLAZING):
        material = bpy.data.materials.new(f'{ASSET} · {kind}')
        material.use_nodes = True
        materials[kind] = material
    opaque = materials['opaque']
    pigment, shader = image_nodes(opaque, images)
    opaque.node_tree.links.new(pigment.outputs['Color'], shader.inputs['Base Color'])
    lamp = materials['lamps'].node_tree.nodes.get('Principled BSDF')
    lamp.inputs['Roughness'].default_value = .48
    lamp.inputs['Emission Color'].default_value = LAMP
    lamp.inputs['Emission Strength'].default_value = .28

    # Closed panes render only their front-facing surface. Low-opacity PBR keeps the
    # furniture and a second bank of windows readable through overlapping panes.
    for kind, (tint, roughness, opacity) in GLAZING.items():
        glass = materials[kind]
        glass.use_backface_culling = True
        glass.surface_render_method = 'BLENDED'
        shader = glass.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = tint
        shader.inputs['Roughness'].default_value = roughness
        shader.inputs['Alpha'].default_value = opacity
        shader.inputs['IOR'].default_value = 1.45
        shader.inputs['Specular IOR Level'].default_value = .39
    return materials


def baked_model(island, images):
    vertices, triangles, corners = collect_geometry(
        island, project_uvs=project_uvs, keep_bevels=lambda _obj: True,
    )
    solids = [tri for tri, (material, _) in zip(triangles, corners, strict=True)
              if material.name not in GLAZING]
    tree = BVHTree.FromPolygons(vertices, solids, all_triangles=True)
    mesh = bpy.data.meshes.new(f'{ASSET} · evaluated geometry')
    mesh.from_pydata(vertices, [], triangles)
    slots = {}
    for kind, material in web_materials(images).items():
        slots[kind] = len(mesh.materials)
        mesh.materials.append(material)
    uvs = mesh.uv_layers.new(name=UV).uv
    colors = mesh.color_attributes.new(name='Baked pigment and daylight', type='FLOAT_COLOR', domain='CORNER')
    mesh.color_attributes.active_color = colors
    mesh.color_attributes.render_color_index = 0
    radiance, normals, tints = {}, [], []
    for face, triangle, (material, attributes) in zip(mesh.polygons, triangles, corners, strict=True):
        kind = batch(material)
        face.use_smooth = True
        face.material_index = slots[kind]
        tint = (1, 1, 1) if kind in GLAZING else material.diffuse_color[:3]
        for loop, vertex, (uv, normal) in zip(face.loop_indices, triangle, attributes, strict=True):
            light = 1
            if kind == 'opaque':
                cache_key = (vertex, tuple(round(value, 3) for value in normal))
                if cache_key not in radiance:
                    radiance[cache_key] = baked_light(tree, vertices[vertex], normal)
                light = radiance[cache_key]
            tints.extend((*[value * light for value in tint], 1))
            uvs[loop].vector = uv
            normals.append(normal)
    colors.data.foreach_set('color', np.asarray(tints, dtype=np.float32))
    mesh.normals_split_custom_set(normals)
    mesh.update()
    obj = bpy.data.objects.new('Tool4Furry — The Makers’ Studio', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, len(triangles)


def validate(gltf):
    groups = [primitive for mesh in gltf['meshes'] for primitive in mesh['primitives']]
    materials = {mat['name']: mat for mat in gltf['materials']}
    opaque = next(group for group in groups if gltf['materials'][group['material']]['name'] == f'{ASSET} · opaque')
    if len(groups) != 4 or any('KHR_draco_mesh_compression' not in group['extensions'] for group in groups):
        raise RuntimeError('Expected four Draco-compressed material batches.')
    if 'COLOR_0' not in opaque['attributes'] or len(gltf.get('images', [])) != 2:
        raise RuntimeError('The opaque batch must retain baked lighting and two PBR atlases.')
    for kind in GLAZING:
        glass = materials[f'{ASSET} · {kind}']
        if glass.get('alphaMode') != 'BLEND' or glass.get('doubleSided'):
            raise RuntimeError(f'{kind} must retain its front-face PBR blending.')
    if not materials[f'{ASSET} · lamps'].get('emissiveFactor'):
        raise RuntimeError('The lamp batch must retain the warm emissive color.')
    return len(groups)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--blend', type=Path, help='Save the editable source with packed material maps.')
    parser.add_argument('--glb', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    island = bpy.data.collections['TOOL4FURRY • Island asset']
    images = atlases(ASSET)
    prepare_source(island, images)
    if args.blend:
        bpy.context.scene['Art stage'] = 'WEB-V0.1-W4-T2'
        bpy.context.scene['Web bake'] = 'Packed PBR atlases, corner-baked contact and daylight, separate glass and lamps.'
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()), compress=True)
    model, triangles = baked_model(island, images)
    groups = validate(export_glb(model, args.glb.resolve()))
    print(f'Tool4Furry web asset: {triangles:,} triangles, {groups} draw groups, {args.glb.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
