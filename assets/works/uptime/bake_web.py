"""Finish the Vigil Station source and bake its production Draco GLB in Blender."""

import argparse
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'harvest'))
from bake_web import baked_light, collect_geometry, export_glb
from surfaces import atlases, image_nodes, surface_uvs


ASSET = 'The Vigil Station'
UV = 'Vigil Station surface atlas'
BAKE_SCENE = 'Vigil Station · Web bake'
GLASS = 'Vigil · coastal glazing'
GLASS_TINT = (.34, .49, .51, 1)
GLASS_OPACITY = .145
LAMPS = {
    'amber': ((1, .60, .30, 1), .23),
    'beacon': ((1, .45, .115, 1), .88),
}
SURFACES = {
    'limestone': 'plaster', 'plaster': 'plaster', 'stone': 'plaster', 'sand': 'plaster',
    'cliff': 'cliff', 'shale': 'cliff', 'talus': 'cliff', 'earth': 'cliff', 'mortar': 'cliff',
    'grass': 'grass', 'leaves': 'grass', 'pine': 'grass',
    'timber': 'wood', 'plank': 'wood', 'bark': 'wood',
    'roof': 'roof', 'copper': 'copper', 'metal': 'iron', 'iron': 'iron', 'brass': 'brass',
}
# Match the Cycles review palette under the single-island viewer's reflected daylight.
WEB_PIGMENT = {
    'roof': (1.36, 1.43, 1.48),
    'copper': (1.36, 1.41, 1.43),
    'limestone': (1.10, 1.12, 1.14),
}
TASK_LIGHTS = {
    'Control room · work light': (3.35, .34),
    'Workshop · low task light': (2.35, .27),
}


def pigment(material):
    return material.name.split()[0].lower()


def batch(material):
    if material.name == GLASS:
        return 'glazing'
    key = pigment(material)
    return key if key in LAMPS else 'surfaces'


def project_uvs(obj, mesh, face, material, _dish=None):
    surface = SURFACES.get(pigment(material), 'plain')
    if surface == 'wood' and abs(face.normal.z) > .96:
        size = obj.dimensions
        if size.z > 1.35 * max(size.x, size.y):
            surface = 'endgrain'
    return surface_uvs(obj, mesh, face, material, surface_name=surface)


def glazing(shader):
    shader.inputs['Base Color'].default_value = GLASS_TINT
    shader.inputs['Roughness'].default_value = .22
    shader.inputs['IOR'].default_value = 1.44


def lamp(shader, kind):
    color, strength = LAMPS[kind]
    shader.inputs['Emission Color'].default_value = color
    shader.inputs['Emission Strength'].default_value = strength
    shader.inputs['Roughness'].default_value = .48


def finish_source(island, images):
    materials = set()
    for obj in island.all_objects:
        if obj.type != 'MESH':
            continue
        mesh = obj.data
        layer = mesh.uv_layers.get(UV) or mesh.uv_layers.new(name=UV)
        layer.active_render = True
        mesh.uv_layers.active = layer
        for face in mesh.polygons:
            material = mesh.materials[face.material_index]
            materials.add(material)
            for loop, uv in zip(face.loop_indices, project_uvs(obj, mesh, face, material), strict=True):
                layer.uv[loop].vector = uv

    for material in sorted(materials, key=lambda item: item.name):
        nodes = material.node_tree.nodes
        shader = nodes.get('Principled BSDF')
        kind = batch(material)
        if kind == 'glazing':
            glazing(shader)
            next(node for node in nodes if node.type == 'MIX_SHADER').inputs[0].default_value = GLASS_OPACITY
        elif kind in LAMPS:
            lamp(shader, kind)
        elif pigment(material) in SURFACES and not material.get(UV):
            texture, shader = image_nodes(material, images)
            multiply = nodes.new('ShaderNodeMixRGB')
            multiply.label = 'Editable station pigment'
            multiply.location = (-260, 260)
            multiply.blend_type = 'MULTIPLY'
            multiply.inputs[0].default_value = 1
            multiply.inputs[1].default_value = material.diffuse_color
            link = material.node_tree.links.new
            link(texture.outputs['Color'], multiply.inputs[2])
            link(multiply.outputs[0], shader.inputs['Base Color'])
            material[UV] = True


def web_materials(images):
    materials = {}
    for name in ('surfaces', 'glazing', *LAMPS):
        material = bpy.data.materials.new(f'{ASSET} · {name}')
        material.use_nodes = True
        materials[name] = material

    surface = materials['surfaces']
    texture, shader = image_nodes(surface, images)
    surface.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])

    glass = materials['glazing']
    glass.surface_render_method = 'BLENDED'
    glass.use_backface_culling = True
    shader = glass.node_tree.nodes.get('Principled BSDF')
    glazing(shader)
    # Front-face blending on the closed panes preserves the room behind them.
    shader.inputs['Alpha'].default_value = GLASS_OPACITY
    for kind in LAMPS:
        lamp(materials[kind].node_tree.nodes.get('Principled BSDF'), kind)
    return materials


def keep_bevel(obj):
    # Keep fine chamfers on the silhouettes, glazed openings and exposed joinery.
    return obj.name.startswith(('Watchtower', 'Canopy', 'Signal room', 'Lamp', 'Control', 'Workshop', 'Gallery'))


def baked_tint(tree, point, normal, task_lights):
    daylight = .10 + .90 * baked_light(tree, point, normal)
    warm = 0
    start = point + normal * .018
    for position, reach, strength in task_lights:
        offset = position - start
        distance = offset.length
        if not .02 < distance < reach:
            continue
        direction = offset / distance
        incidence = normal.dot(direction)
        if incidence > 0 and tree.ray_cast(start, direction, distance)[3] is None:
            warm += strength * incidence * (1 - (distance / reach)**2)**2
    return (daylight * (1 + warm), daylight * (1 + .29 * warm), daylight * (1 - .62 * warm))


def bake_mesh(island, images):
    omitted = [modifier for obj in island.all_objects if not keep_bevel(obj)
               for modifier in obj.modifiers
               if modifier.type == 'BEVEL' and modifier.width < .02 and modifier.show_viewport]
    try:
        vertices, triangles, corners = collect_geometry(island, project_uvs=project_uvs, keep_bevels=keep_bevel)
    finally:
        for modifier in omitted:
            modifier.show_viewport = True
    solids = [tri for tri, (mat, _) in zip(triangles, corners, strict=True) if batch(mat) != 'glazing']
    tree = BVHTree.FromPolygons(vertices, solids, all_triangles=True)
    task_lights = [(bpy.data.objects[name].matrix_world.translation, reach, strength)
                   for name, (reach, strength) in TASK_LIGHTS.items()]
    mesh = bpy.data.meshes.new(f'{ASSET} · evaluated triangles')
    mesh.from_pydata(vertices, [], triangles)
    slots = {}
    for kind, material in web_materials(images).items():
        slots[kind] = len(mesh.materials)
        mesh.materials.append(material)
    uv_data = mesh.uv_layers.new(name=UV).uv
    colors = mesh.color_attributes.new(name='Baked pigment and daylight', type='FLOAT_COLOR', domain='CORNER')
    mesh.color_attributes.active_color = colors
    mesh.color_attributes.render_color_index = 0
    radiance, normals, tints = {}, [], []
    for face, triangle, (material, attributes) in zip(mesh.polygons, triangles, corners, strict=True):
        kind = batch(material)
        face.use_smooth = True
        face.material_index = slots[kind]
        color = material.diffuse_color[:3] if kind != 'glazing' else (1, 1, 1)
        gain = WEB_PIGMENT.get(pigment(material), (1, 1, 1))
        for loop, vertex, (uv, normal) in zip(face.loop_indices, triangle, attributes, strict=True):
            light = (1, 1, 1)
            if kind == 'surfaces':
                key = (vertex, tuple(round(value, 3) for value in normal))
                if key not in radiance:
                    radiance[key] = baked_tint(tree, vertices[vertex], normal, task_lights)
                light = radiance[key]
            tints.extend(min(1, channel * shade * correction) for channel, shade, correction in zip(color, light, gain))
            tints.append(1)
            uv_data[loop].vector = uv
            normals.append(normal)
    colors.data.foreach_set('color', np.asarray(tints, dtype=np.float32))
    mesh.normals_split_custom_set(normals)
    mesh.update()
    obj = bpy.data.objects.new('Uptime — The Vigil Station', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def validate(gltf):
    materials = gltf['materials']
    primitives = [primitive for mesh in gltf['meshes'] for primitive in mesh['primitives']]
    groups = {materials[p['material']]['name']: p for p in primitives}
    if len(primitives) != len(groups) or len(groups) != 4 or any(
            'KHR_draco_mesh_compression' not in p['extensions'] for p in primitives):
        raise RuntimeError('Expected four Draco-compressed material batches.')
    solid = groups[f'{ASSET} · surfaces']
    pbr = materials[solid['material']]['pbrMetallicRoughness']
    if not {'COLOR_0', 'TEXCOORD_0'} <= solid['attributes'].keys() or not {
            'baseColorTexture', 'metallicRoughnessTexture'} <= pbr.keys():
        raise RuntimeError('Missing baked shading, surface UVs or PBR atlases.')
    glass = materials[groups[f'{ASSET} · glazing']['material']]
    if glass.get('alphaMode') != 'BLEND' or glass.get('doubleSided'):
        raise RuntimeError('Closed windows must use single-sided PBR blending.')
    if any(not materials[groups[f'{ASSET} · {kind}']['material']].get('emissiveFactor') for kind in LAMPS):
        raise RuntimeError('Missing the emissive beacon or warm interior lamps.')
    count = sum(gltf['accessors'][p['indices']]['count'] // 3 for p in primitives)
    return count, len(primitives)


def remove_previous_bake():
    scene = bpy.data.scenes.get(BAKE_SCENE)
    if scene is None:
        return
    for obj in list(scene.objects):
        mesh = obj.data
        materials = list(mesh.materials)
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.meshes.remove(mesh)
        for material in materials:
            bpy.data.materials.remove(material)
    bpy.data.scenes.remove(scene)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--blend', type=Path, help='Save the editable scene, embedded atlases and web bake.')
    parser.add_argument('--glb', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    scene = bpy.context.scene
    island = bpy.data.collections['UPTIME • Island asset']
    remove_previous_bake()
    images = atlases(ASSET)
    finish_source(island, images)
    model = bake_mesh(island, images)
    args.glb.parent.mkdir(parents=True, exist_ok=True)
    triangles, groups = validate(export_glb(model, args.glb.resolve()))
    if args.blend:
        bake = bpy.data.scenes.new(BAKE_SCENE)
        bake.collection.objects.link(model)
        scene.collection.objects.unlink(model)
        scene['Art stage'] = 'WEB-V0.1-W4-U2'
        scene['Web bake'] = 'Packed PBR atlases, glazing and warm lamps, corner-baked contact AO and daylight.'
        args.blend.parent.mkdir(parents=True, exist_ok=True)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()), compress=True)
    print(f'Uptime web asset: {triangles:,} triangles, {groups} draw groups, {args.glb.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
