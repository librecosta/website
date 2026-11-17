"""Finish the G1 Observatory source and export a baked Draco GLB in Blender."""

import argparse
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
# Harvest supplies the shared corner bake, material atlas and glTF exporter.
sys.path.insert(0, str(HERE.parent / 'harvest'))
from bake_web import baked_light, collect_geometry, export_glb
from surfaces import atlases, image_nodes, surface_uvs


ASSET = 'Atlas Observatory'
UV = 'Atlas Observatory surface atlas'
SURFACES = {
    'cliff': 'cliff', 'shale': 'cliff', 'talus': 'cliff', 'grass': 'grass',
    'pine': 'grass', 'leaves': 'grass', 'stone': 'plaster', 'plaster': 'plaster',
    'mortar': 'cliff', 'roof': 'roof', 'zinc': 'iron', 'iron': 'iron',
    'copper': 'copper', 'brass': 'brass', 'timber': 'wood', 'plank': 'wood',
    'green': 'iron', 'glass': 'glass', 'water': 'glass',
}
GRADES = {
    'stone': (1.035, 1.015, .985), 'plaster': (1.015, 1.0, .975),
    'roof': (.95, .99, 1.05), 'zinc': (.93, .97, 1.01),
    'timber': (1.035, .96, .91), 'plank': (1.025, .99, .955),
    'cliff': (1.0, 1.0, .98), 'shale': (.97, .99, 1.02),
}
GLASS = (.36, .55, .55, 1)
AMBER = (1, .60, .27, 1)


def pigment_key(material):
    return material.name.split()[0].lower()


def batch(material):
    if material.get('Atlas glazing'):
        return 'glazing'
    return 'lamps' if pigment_key(material) == 'amber' else 'opaque'


def project_uvs(obj, mesh, face, material, _dish=None):
    key = pigment_key(material)
    surface = SURFACES.get(key, 'plain')
    # Preserve the grain on the long faces and reveal end grain at timber joints.
    if surface == 'wood' and abs(face.normal.z) > .96 and 'deck' not in obj.name.lower():
        dimensions = obj.dimensions
        if dimensions.z > 1.35 * max(dimensions.x, dimensions.y):
            surface = 'endgrain'
    return surface_uvs(obj, mesh, face, material, surface_name=surface)


def prepare_source(island, images):
    materials = set()
    for obj in island.all_objects:
        if obj.type != 'MESH':
            continue
        mesh = obj.data
        layer = mesh.uv_layers.get(UV) or mesh.uv_layers.new(name=UV)
        mesh.uv_layers.active = layer
        layer.active_render = True
        for face in mesh.polygons:
            material = mesh.materials[face.material_index]
            materials.add(material)
            for index, uv in zip(face.loop_indices, project_uvs(obj, mesh, face, material), strict=True):
                layer.uv[index].vector = uv

    for material in sorted(materials, key=lambda item: item.name):
        nodes = material.node_tree.nodes
        shader = nodes.get('Principled BSDF')
        kind = batch(material)
        if kind == 'glazing':
            shader.inputs['Base Color'].default_value = GLASS
            shader.inputs['Roughness'].default_value = .15
            continue
        if kind == 'lamps':
            shader.inputs['Emission Color'].default_value = AMBER
            shader.inputs['Emission Strength'].default_value = .26
            continue
        if material.get('Observatory surface'):
            continue
        grade = GRADES.get(pigment_key(material), (1, 1, 1))
        color = tuple(channel * gain for channel, gain in zip(material.diffuse_color[:3], grade, strict=True))
        material.diffuse_color = (*color, 1)
        image, shader = image_nodes(material, images)
        multiply = nodes.new('ShaderNodeMixRGB')
        multiply.label = 'Editable stone, timber and roof pigments'
        multiply.location = (-260, 260)
        multiply.blend_type = 'MULTIPLY'
        multiply.inputs[0].default_value = 1
        multiply.inputs[1].default_value = material.diffuse_color
        link = material.node_tree.links.new
        link(image.outputs['Color'], multiply.inputs[2])
        link(multiply.outputs[0], shader.inputs['Base Color'])
        material['Observatory surface'] = True


def web_materials(images):
    materials = {}
    for kind in ('opaque', 'lamps', 'glazing'):
        material = bpy.data.materials.new(f'{ASSET} · {kind}')
        material.use_nodes = True
        materials[kind] = material

    opaque = materials['opaque']
    image, shader = image_nodes(opaque, images)
    opaque.node_tree.links.new(image.outputs['Color'], shader.inputs['Base Color'])
    lamp = materials['lamps'].node_tree.nodes.get('Principled BSDF')
    lamp.inputs['Roughness'].default_value = .44
    lamp.inputs['Emission Color'].default_value = AMBER
    lamp.inputs['Emission Strength'].default_value = .26

    # Inset, closed panes use front-face PBR blending, so interior furniture
    # and light remain visible without an additional transmission pass.
    glass = materials['glazing']
    glass.use_backface_culling = True
    glass.surface_render_method = 'BLENDED'
    shader = glass.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = GLASS
    shader.inputs['Roughness'].default_value = .15
    shader.inputs['IOR'].default_value = 1.47
    shader.inputs['Alpha'].default_value = .24
    return materials


def keep_chamfers(obj):
    return obj.name.startswith(('Atlas hall', 'Portico', 'Transept', 'Atlas staircase',
                                'Cartography', 'Relief', 'Curated cabinet', 'Topics'))


def baked_model(island, images):
    vertices, triangles, corners = collect_geometry(island, project_uvs=project_uvs, keep_bevels=keep_chamfers)
    solids = [tri for tri, (mat, _) in zip(triangles, corners, strict=True) if batch(mat) != 'glazing']
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
    normals, tints = [], []
    radiance = {}
    for face, triangle, (material, attributes) in zip(mesh.polygons, triangles, corners, strict=True):
        kind = batch(material)
        face.use_smooth = True
        face.material_index = slots[kind]
        pigment = material.diffuse_color[:3] if kind != 'glazing' else (1, 1, 1)
        for loop, vertex, (uv, normal) in zip(face.loop_indices, triangle, attributes, strict=True):
            shade = 1
            if kind == 'opaque':
                key = (vertex, tuple(round(n, 3) for n in normal))
                if key not in radiance:
                    radiance[key] = baked_light(tree, vertices[vertex], normal)**1.18
                shade = radiance[key]
            tints.extend((*[value * shade for value in pigment], 1))
            uvs[loop].vector = uv
            normals.append(normal)
    colors.data.foreach_set('color', np.asarray(tints, dtype=np.float32))
    mesh.normals_split_custom_set(normals)
    mesh.update()
    obj = bpy.data.objects.new('GopherAtlas — The Atlas Observatory', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, len(triangles)


def validate(gltf):
    groups = [primitive for mesh in gltf['meshes'] for primitive in mesh['primitives']]
    materials = {gltf['materials'][group['material']]['name']: group for group in groups}
    opaque = materials[f'{ASSET} · opaque']
    glass = next(mat for mat in gltf['materials'] if mat['name'] == f'{ASSET} · glazing')
    lamp = next(mat for mat in gltf['materials'] if mat['name'] == f'{ASSET} · lamps')
    if len(groups) != 3 or any('KHR_draco_mesh_compression' not in group['extensions'] for group in groups):
        raise RuntimeError('Expected three Draco-compressed batches.')
    if 'COLOR_0' not in opaque['attributes'] or len(gltf.get('images', [])) != 2:
        raise RuntimeError('The opaque batch must retain its baked color and two PBR atlases.')
    if glass.get('alphaMode') != 'BLEND' or glass.get('doubleSided') or not lamp.get('emissiveFactor'):
        raise RuntimeError('Expected forward-facing blended glazing and independent warm lights.')
    return len(groups)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--blend', type=Path, help='Save the editable source and packed material maps.')
    cli.add_argument('--glb', type=Path, required=True)
    args = cli.parse_args(sys.argv[sys.argv.index('--') + 1:])
    scene = bpy.context.scene
    island = bpy.data.collections['GOPHER ATLAS • Island asset']
    images = atlases(ASSET)
    prepare_source(island, images)
    if args.blend:
        scene['Art stage'] = 'WEB-V0.1-W3-G2'
        scene['Web bake'] = 'Packed PBR atlases, corner-baked ambient occlusion and daylight, separate glass and lamps.'
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()), compress=True)
    obj, triangles = baked_model(island, images)
    groups = validate(export_glb(obj, args.glb.resolve()))
    print(f'GopherAtlas web asset: {triangles:,} triangles, {groups} draw groups, {args.glb.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
