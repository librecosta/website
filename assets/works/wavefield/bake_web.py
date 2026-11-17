"""Finish the Wave Loom from the editable WF1 scene and export its Draco GLB."""

import argparse
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'harvest'))
from bake_web import baked_light, collect_geometry, export_glb
from surfaces import atlases, image_nodes, surface_uvs

ASSET = 'Wave Loom'
STAGE = 'WEB-V0.1-W4-WF2'
UV = 'Wave Loom surface atlas'
GLASS = 'Calibration house · clear architectural glass'
FIBRES = ('Warp · 33 continuous silver-blue strands', 'Weft · 45 continuous recessed strands')
VEIL = 'Continuous open-weave carrier'
SURFACES = {
    'cliff': 'cliff', 'shale': 'cliff', 'talus': 'cliff', 'grass': 'grass',
    'pine': 'grass', 'leaves': 'grass', 'stone': 'plaster', 'ivory': 'plaster',
    'plank': 'wood', 'timber': 'wood', 'bark': 'wood', 'roof': 'roof',
    'slate': 'roof', 'graphite': 'roof', 'iron': 'iron', 'steel': 'iron',
    'zinc': 'iron', 'azure': 'iron', 'brass': 'brass', 'ochre': 'wood',
}
GRADES = {
    'cliff': (.94, .98, 1.04), 'shale': (.85, .91, 1.02), 'talus': (1.08, 1.04, .96),
    'stone': (1.04, 1.025, .99), 'grass': (.92, 1.025, .94),
    'plank': (1.14, 1.09, 1.035), 'timber': (1.04, 1, .94),
    'graphite': (.94, .98, 1.015), 'steel': (1.035, 1.06, 1.08),
    'roof': (1.05, 1.08, 1.12), 'pine': (.95, .985, .96),
}
LAMP = (1, .62, .32, 1)


def pigment(material):
    return material.name.split()[0].lower()


def batch(material):
    if material.name == GLASS:
        return 'workshop windows'
    return 'warm lamps' if pigment(material) == 'amber' else 'surfaces'


def project_uvs(obj, mesh, face, material, _dish=None):
    surface = SURFACES.get(pigment(material), 'plain')
    return surface_uvs(obj, mesh, face, material, surface_name=surface)


def pbr(name):
    material = bpy.data.materials.new(f'{ASSET} · {name}')
    material.use_nodes = True
    return material, material.node_tree.nodes.get('Principled BSDF')


def glaze(material, shader):
    # Front-only on closed panes, so the opposite wall and the workbench stay readable.
    material.use_backface_culling = True
    material.surface_render_method = 'BLENDED'
    shader.inputs['Base Color'].default_value = (.29, .42, .50, 1)
    shader.inputs['Alpha'].default_value = .18
    shader.inputs['Roughness'].default_value = .23
    shader.inputs['IOR'].default_value = 1.44


def lamps(shader):
    shader.inputs['Base Color'].default_value = (1, .82, .65, 1)
    shader.inputs['Emission Color'].default_value = LAMP
    shader.inputs['Emission Strength'].default_value = .25
    shader.inputs['Roughness'].default_value = .48


def prepare_solids(objects, images):
    materials = set()
    for obj in objects:
        mesh = obj.data
        materials.update(mesh.materials)
        layer = mesh.uv_layers.new(name=UV)
        layer.active_render = True
        for face in mesh.polygons:
            material = mesh.materials[face.material_index]
            for loop, uv in zip(face.loop_indices, project_uvs(obj, mesh, face, material), strict=True):
                layer.uv[loop].vector = uv

    for material in sorted(materials, key=lambda mat: mat.name):
        shader = material.node_tree.nodes.get('Principled BSDF')
        if material.name == GLASS:
            # Keep the original Cycles transparent mix and match the new web tint.
            shader.inputs['Base Color'].default_value = (.29, .42, .50, 1)
            shader.inputs['Roughness'].default_value = .23
            next(node for node in material.node_tree.nodes if node.type == 'MIX_SHADER').inputs[0].default_value = .21
            continue
        key = pigment(material)
        if key == 'amber':
            lamps(shader)
            continue
        grade = GRADES.get(key, (1, 1, 1))
        color = tuple(min(1, value * gain) for value, gain in zip(material.diffuse_color[:3], grade, strict=True))
        material.diffuse_color = (*color, 1)
        shader.inputs['Base Color'].default_value = material.diffuse_color
        if key in SURFACES:
            image, shader = image_nodes(material, images)
            multiply = material.node_tree.nodes.new('ShaderNodeMixRGB')
            multiply.label = 'Editable surface pigment'
            multiply.location = (-90, 270)
            multiply.blend_type = 'MULTIPLY'
            multiply.inputs[0].default_value = 1
            multiply.inputs[1].default_value = material.diffuse_color
            link = material.node_tree.links.new
            link(image.outputs['Color'], multiply.inputs[2])
            link(multiply.outputs[0], shader.inputs['Base Color'])


def vertex_pbr(material, shader, attribute, *, alpha=False):
    color = material.node_tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = attribute
    color.location = (-320, 140)
    links = material.node_tree.links
    links.new(color.outputs['Color'], shader.inputs['Base Color'])
    if alpha:
        links.new(color.outputs['Alpha'], shader.inputs['Alpha'])


def finish_fibres(fibres):
    material, shader = pbr('drawn silver-blue fibre')
    vertex_pbr(material, shader, 'Fibre tint')
    material.use_backface_culling = True
    shader.inputs['Roughness'].default_value = .49
    shader.inputs['Metallic'].default_value = .13
    shader.inputs['Coat Weight'].default_value = .11
    shader.inputs['Coat Roughness'].default_value = .56
    shader.inputs['Emission Color'].default_value = (.22, .34, .49, 1)
    shader.inputs['Emission Strength'].default_value = .036

    finishes = (
        (1.39, (1.41, 1.35, 1.23), (.036, .049, .063)),
        (1.19, (1.19, 1.22, 1.18), (.020, .027, .034)),
    )
    for obj, (expansion, gains, floor) in zip(fibres, finishes, strict=True):
        mesh = obj.data
        color = mesh.color_attributes['Fibre tint']
        mesh.color_attributes.active_color = color
        mesh.color_attributes.render_color_index = 0
        # WF1 uses six vertices around each strand centre. Preserve all centre lines and anchors.
        for start in range(0, len(mesh.vertices), 6):
            ring = [mesh.vertices[index] for index in range(start, start + 6)]
            center = sum((vertex.co for vertex in ring), Vector()) / 6
            for vertex in ring:
                vertex.co = center + (vertex.co - center) * expansion
                old = color.data[vertex.index].color
                tint = (min(1, base + gain * value) for value, gain, base in zip(old[:3], gains, floor, strict=True))
                color.data[vertex.index].color = (*tint, 1)
        mesh.materials[0] = material
        mesh.update()


def finish_veil(obj):
    material, shader = pbr('silver-blue gossamer')
    material.surface_render_method = 'BLENDED'
    material.use_backface_culling = False
    shader.inputs['Roughness'].default_value = .78
    shader.inputs['Metallic'].default_value = .04
    vertex_pbr(material, shader, 'Gossamer tint and coverage', alpha=True)
    mesh = obj.data
    coverage = mesh.attributes['Weave coverage']
    color = mesh.color_attributes.new(name='Gossamer tint and coverage', type='FLOAT_COLOR', domain='POINT')
    mesh.color_attributes.active_color = color
    mesh.color_attributes.render_color_index = 0
    values = []
    for sample in coverage.data:
        density = sample.value
        values.extend((.09 + .22*density, .18 + .33*density, .27 + .39*density, .78*density))
    color.data.foreach_set('color', values)
    mesh.materials[0] = material


def light_source(scene):
    sun = bpy.data.lights['Warm daylight']
    sun.name = 'Soft neutral daylight'
    sun.color = (.91, .96, 1)
    sun.energy = 3950
    sky = bpy.data.lights['Cool sky return']
    sky.color = (.82, .91, 1)
    sky.energy = 2300
    bpy.data.lights['Soft silver grazing light'].energy = 510
    scene.view_settings.exposure = .14


def web_solid_materials(images):
    surface, _ = pbr('surfaces')
    texture, shader = image_nodes(surface, images)
    surface.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    glass, shader = pbr('workshop windows')
    glaze(glass, shader)
    lamp, shader = pbr('warm lamps')
    lamps(shader)
    return {'surfaces': surface, 'workshop windows': glass, 'warm lamps': lamp}


def bake_solids(objects, images):
    scene = bpy.context.scene
    solids = bpy.data.collections.new('Solid bake inputs')
    scene.collection.children.link(solids)
    for obj in objects:
        solids.objects.link(obj)
    vertices, triangles, corners = collect_geometry(solids, project_uvs=project_uvs)
    bpy.data.collections.remove(solids)
    occluders = [triangle for triangle, (mat, _) in zip(triangles, corners, strict=True) if mat.name != GLASS]
    tree = BVHTree.FromPolygons(vertices, occluders, all_triangles=True)
    mesh = bpy.data.meshes.new(f'{ASSET} · baked terrain and structures')
    mesh.from_pydata(vertices, [], triangles)
    slots = {}
    for kind, material in web_solid_materials(images).items():
        slots[kind] = len(mesh.materials)
        mesh.materials.append(material)
    uvs = mesh.uv_layers.new(name=UV).uv
    color = mesh.color_attributes.new(name='Pigment and baked occlusion', type='FLOAT_COLOR', domain='CORNER')
    mesh.color_attributes.active_color = color
    mesh.color_attributes.render_color_index = 0
    radiance, normals, colors = {}, [], []
    for face, triangle, (material, attributes) in zip(mesh.polygons, triangles, corners, strict=True):
        kind = batch(material)
        face.use_smooth = True
        face.material_index = slots[kind]
        for loop, vertex, (uv, normal) in zip(face.loop_indices, triangle, attributes, strict=True):
            tint = (1, 1, 1)
            if kind == 'surfaces':
                key = (vertex, tuple(round(value, 3) for value in normal))
                if key not in radiance:
                    radiance[key] = baked_light(tree, vertices[vertex], normal)
                tint = tuple(value * radiance[key] for value in material.diffuse_color[:3])
            colors.extend((*tint, 1))
            uvs[loop].vector = uv
            normals.append(normal)
    color.data.foreach_set('color', np.asarray(colors, dtype=np.float32))
    mesh.normals_split_custom_set(normals)
    mesh.update()
    model = bpy.data.objects.new('Wavefield — The Wave Loom', mesh)
    scene.collection.objects.link(model)
    return model


def validate(gltf):
    primitives = [primitive for mesh in gltf['meshes'] for primitive in mesh['primitives']]
    groups = {}
    for primitive in primitives:
        material = gltf['materials'][primitive['material']]
        name = material['name'].removeprefix(f'{ASSET} · ')
        groups.setdefault(name, []).append((primitive, material))
        if 'KHR_draco_mesh_compression' not in primitive['extensions']:
            raise RuntimeError(f'{name} is missing Draco compression')
    if set(groups) != {'surfaces', 'warm lamps', 'workshop windows', 'drawn silver-blue fibre', 'silver-blue gossamer'}:
        raise RuntimeError(f'Unexpected material groups: {list(groups)}')
    surface = groups['surfaces'][0][0]
    if 'COLOR_0' not in surface['attributes'] or len(gltf.get('images', [])) != 2:
        raise RuntimeError('The solid surfaces require baked light and both PBR atlases')
    for name, double_sided in [('workshop windows', False), ('silver-blue gossamer', True)]:
        primitive, material = groups[name][0]
        if material.get('alphaMode') != 'BLEND' or material.get('doubleSided', False) != double_sided:
            raise RuntimeError(f'{name} has the wrong alpha or face mode: {material}')
        if double_sided and gltf['accessors'][primitive['attributes']['COLOR_0']]['type'] != 'VEC4':
            raise RuntimeError('The gossamer requires vertex alpha for its feathered edges')
    return len(primitives), sum(gltf['accessors'][p['indices']]['count'] // 3 for p in primitives)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--blend', type=Path, help='Save the editable source and its packed maps.')
    cli.add_argument('--glb', type=Path, required=True)
    options = cli.parse_args(sys.argv[sys.argv.index('--') + 1:])
    scene = bpy.context.scene
    island = bpy.data.collections['WAVEFIELD • Island asset']
    fibres = tuple(bpy.data.objects[name] for name in FIBRES)
    veil = bpy.data.objects[VEIL]
    woven = (*fibres, veil)
    objects = [obj for obj in island.all_objects if obj.type == 'MESH' and obj not in woven]
    images = atlases(ASSET)
    if scene.get('Art stage') != STAGE:
        prepare_solids(objects, images)
        finish_fibres(fibres)
        finish_veil(veil)
        light_source(scene)
        scene['Art stage'] = STAGE
        scene['Web bake'] = 'Packed PBR textures, solid contact and daylight bake, independent fibres and gossamer.'
    if options.blend:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(options.blend.resolve()), compress=True)
    model = bake_solids(objects, images)
    groups, triangles = validate(export_glb(model, options.glb.resolve(), extra_meshes=woven))
    print(f'Wavefield web asset: {triangles:,} triangles, {groups} primitives, {options.glb.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
