"""Finish Discovery Harbor in Blender and export the baked, batched Draco GLB."""

import argparse
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'harvest'))
from bake_web import baked_light, collect_geometry, export_glb
from surfaces import CELL, CELL_INDEX, MARGIN, SIDE, atlas, atlases, image_nodes, surface_uvs


ASSET = 'Discovery Harbor'
UV = 'Discovery Harbor surface atlas'
BAKE_SCENE = 'Discovery Harbor · Web bake'
GLASS = 'Harbor glazing · lightly smoked blue'
TINT = (.36, .50, .56, 1)
OPACITY = .17
LAMP = (1, .66, .38, 1)
SURFACES = {
    'clay': 'roof', 'peach': 'plaster', 'limestone': 'plaster', 'ivory': 'plaster',
    'stone': 'plaster', 'earth': 'cliff', 'sand': 'dish', 'cliff': 'cliff',
    'shale': 'cliff', 'talus': 'cliff', 'grass': 'grass', 'leaves': 'grass',
    'pine': 'grass', 'timber': 'wood', 'plank': 'wood', 'bark': 'wood',
    'metal': 'iron', 'iron': 'iron', 'zinc': 'iron', 'brass': 'brass',
}


def pigment(material):
    return material.name.split()[0].lower()


def batch(material):
    if material.name == GLASS:
        return 'clear panes'
    return 'warm lamps' if pigment(material) == 'amber' else 'surfaces'


def surface_maps():
    names = (f'{ASSET} · pigment', f'{ASSET} · roughness and metal')
    if all(name in bpy.data.images for name in names):
        return tuple(bpy.data.images[name] for name in names)

    # Use the other islands' atlas layout and detail, with non-metallic clay and shoreline sand.
    base = atlases(f'{ASSET} base')
    color, finish = (np.empty((SIDE, SIDE, 4), dtype=np.float32) for _ in base)
    for image, pixels in zip(base, (color, finish), strict=True):
        image.pixels.foreach_get(pixels.ravel())
        bpy.data.images.remove(image)
    axis = np.clip((np.arange(CELL) - MARGIN) / (CELL - 1 - 2 * MARGIN), 0, 1)
    u, v = np.meshgrid(axis, axis)
    tau = 2 * np.pi
    kiln = np.sin(tau * (u * 3.3 + v * .8)) * np.cos(tau * (v * 2.5 - u * .31))
    grog = np.sin(tau * (u * 22 + v * 13.1)) * np.sin(tau * (v * 28 - u * 9.3))
    ripple = np.cos(tau * (v * 8.2 + .26 * np.sin(tau * u * 1.35)))
    for kind, tone, roughness in (
        ('roof', .966 + .026 * kiln + .011 * grog, .76 + .035 * kiln),
        ('dish', .962 + .022 * ripple + .014 * grog, .93 + .023 * ripple),
    ):
        i = CELL_INDEX[kind]
        y, x = i // 4 * CELL, i % 4 * CELL
        cell = np.s_[y:y + CELL, x:x + CELL]
        color[cell][:, :, :3] = np.clip(tone, 0, 1)[:, :, None] ** (1 / 2.2)
        finish[cell][:, :, 1] = roughness
        finish[cell][:, :, 2] = 0
    return atlas(names[0], color, 'sRGB'), atlas(names[1], finish, 'Non-Color')


def project_uvs(obj, mesh, face, material, _dish=None):
    surface = SURFACES.get(pigment(material), 'plain')
    if surface == 'wood' and abs(face.normal.z) > .96:
        size = obj.dimensions
        if size.z > 1.35 * max(size.x, size.y):
            surface = 'endgrain'
    return surface_uvs(obj, mesh, face, material, surface_name=surface)


def lamps(shader):
    shader.inputs['Emission Color'].default_value = LAMP
    shader.inputs['Emission Strength'].default_value = .24
    shader.inputs['Roughness'].default_value = .48


def source_finish(island, images):
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
        if batch(material) == 'clear panes':
            shader.inputs['Base Color'].default_value = TINT
            shader.inputs['Roughness'].default_value = .22
            next(node for node in nodes if node.type == 'MIX_SHADER').inputs[0].default_value = OPACITY
        elif batch(material) == 'warm lamps':
            lamps(shader)
        elif pigment(material) in SURFACES and not material.get('Harbor surface atlas'):
            texture, shader = image_nodes(material, images)
            multiply = nodes.new('ShaderNodeMixRGB')
            multiply.label = 'Editable harbor pigment'
            multiply.location = (-260, 260)
            multiply.blend_type = 'MULTIPLY'
            multiply.inputs[0].default_value = 1
            multiply.inputs[1].default_value = material.diffuse_color
            link = material.node_tree.links.new
            link(texture.outputs['Color'], multiply.inputs[2])
            link(multiply.outputs[0], shader.inputs['Base Color'])
            material['Harbor surface atlas'] = True

    bpy.data.lights['Warm daylight'].color = (1, .94, .87)
    bpy.data.lights['Cool sky return'].energy = 2450
    bpy.data.lights['Pavilion · amber interior'].energy = 72
    bpy.data.lights['Gallery · warm review light'].energy = 44


def web_materials(images):
    materials = {}
    for name in ('surfaces', 'clear panes', 'warm lamps'):
        material = bpy.data.materials.new(f'{ASSET} · {name}')
        material.use_nodes = True
        materials[name] = material

    surface = materials['surfaces']
    texture, shader = image_nodes(surface, images)
    surface.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])

    glass = materials['clear panes']
    glass.surface_render_method = 'BLENDED'
    glass.use_backface_culling = True
    shader = glass.node_tree.nodes.get('Principled BSDF')
    # The panes are closed volumes. One visible face keeps stacked windows legible.
    shader.inputs['Base Color'].default_value = TINT
    shader.inputs['Alpha'].default_value = OPACITY
    shader.inputs['Roughness'].default_value = .22
    shader.inputs['IOR'].default_value = 1.44

    lamp = materials['warm lamps'].node_tree.nodes.get('Principled BSDF')
    lamp.inputs['Base Color'].default_value = (1, .87, .68, 1)
    lamps(lamp)
    return materials


def keep_bevel(obj):
    # Keep the roof pans, arches, glazed openings and the joinery framing them.
    return obj.name.startswith(('Pavilion', 'Loggia', 'Gallery', 'Guide'))


def bake_mesh(island, images):
    omitted = [modifier for obj in island.all_objects if not keep_bevel(obj)
               for modifier in obj.modifiers
               if modifier.type == 'BEVEL' and modifier.width < .02 and modifier.show_viewport]
    try:
        vertices, triangles, corners = collect_geometry(island, project_uvs=project_uvs, keep_bevels=keep_bevel)
    finally:
        # collect_geometry omits the smallest chamfers from the web mesh only.
        for modifier in omitted:
            modifier.show_viewport = True
    solids = [tri for tri, (material, _) in zip(triangles, corners, strict=True) if material.name != GLASS]
    tree = BVHTree.FromPolygons(vertices, solids, all_triangles=True)
    mesh = bpy.data.meshes.new(f'{ASSET} · evaluated triangles')
    mesh.from_pydata(vertices, [], triangles)
    slots = {}
    for name, material in web_materials(images).items():
        slots[name] = len(mesh.materials)
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
        pigment_color = material.diffuse_color[:3] if kind == 'surfaces' else (1, 1, 1)
        for loop, vertex, (uv, normal) in zip(face.loop_indices, triangle, attributes, strict=True):
            light = 1
            if kind == 'surfaces':
                key = (vertex, tuple(round(value, 3) for value in normal))
                if key not in radiance:
                    radiance[key] = baked_light(tree, vertices[vertex], normal)
                light = radiance[key]
            tints.extend((*(channel * light for channel in pigment_color), 1))
            uv_data[loop].vector = uv
            normals.append(normal)
    colors.data.foreach_set('color', np.asarray(tints, dtype=np.float32))
    mesh.normals_split_custom_set(normals)
    mesh.update()
    obj = bpy.data.objects.new('GoFurry — The Discovery Harbor', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, len(triangles)


def validate(gltf):
    materials = gltf['materials']
    groups = {materials[primitive['material']]['name']: primitive
              for mesh in gltf['meshes'] for primitive in mesh['primitives']}
    if len(groups) != 3 or any('KHR_draco_mesh_compression' not in group['extensions'] for group in groups.values()):
        raise RuntimeError('Expected three Draco-compressed material batches.')
    opaque = groups[f'{ASSET} · surfaces']
    pbr = materials[opaque['material']]['pbrMetallicRoughness']
    if 'COLOR_0' not in opaque['attributes'] or not {'baseColorTexture', 'metallicRoughnessTexture'} <= pbr.keys():
        raise RuntimeError('Missing baked vertex shading or PBR atlases.')
    glass = materials[groups[f'{ASSET} · clear panes']['material']]
    if glass.get('alphaMode') != 'BLEND' or glass.get('doubleSided'):
        raise RuntimeError('Closed windows must use single-sided PBR blending.')
    if not materials[groups[f'{ASSET} · warm lamps']['material']].get('emissiveFactor'):
        raise RuntimeError('Missing warm emissive lighting.')
    return len(groups)


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
    parser.add_argument('--blend', type=Path, help='Save the editable source, packed maps and separate web bake scene.')
    parser.add_argument('--glb', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    scene = bpy.context.scene
    island = bpy.data.collections['GOFURRY • Island asset']
    remove_previous_bake()
    images = surface_maps()
    source_finish(island, images)
    model, triangles = bake_mesh(island, images)
    groups = validate(export_glb(model, args.glb.resolve()))
    if args.blend:
        bake = bpy.data.scenes.new(BAKE_SCENE)
        bake.collection.objects.link(model)
        scene.collection.objects.unlink(model)
        scene['Art stage'] = 'WEB-V0.1-W4-GF2'
        scene['Web bake'] = 'Packed PBR atlases, separate windows and lamps, corner-baked contact AO and daylight.'
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()), compress=True)
    print(f'GoFurry web asset: {triangles:,} triangles, {groups} draw groups, {args.glb.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
