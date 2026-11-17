"""Finish the editable Beatline and export its baked Draco GLB from Blender."""

import argparse
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'harvest'))
from bake_web import baked_light, collect_geometry, export_glb
from surfaces import atlases, image_nodes, surface_uvs


ASSET = 'Beatline'
UV = 'Beatline surface atlas'
GLASS = 'Flight glass · '
SURFACES = {
    'cliff': 'cliff', 'shale': 'cliff', 'talus': 'cliff', 'stone': 'cliff',
    'grass': 'grass', 'pine': 'grass', 'leaves': 'grass', 'bark': 'wood',
    'timber': 'wood', 'plank': 'wood', 'ivory': 'plaster', 'roof': 'roof',
    'zinc': 'iron', 'steel': 'iron', 'iron': 'iron', 'oxide': 'copper',
    'bronze': 'copper', 'brass': 'brass',
}
# Linear pigment grades keep the original variation while separating structural roles.
GRADES = {
    'graphite': (.67, .75, .82), 'iron': (.77, .85, .91), 'steel': (.87, .95, 1.03),
    'zinc': (1.02, 1.04, 1.07), 'roof': (.83, .89, .96),
    'oxide': (1.08, 1.02, .95), 'bronze': (1.05, .97, .86),
    'cliff': (1.03, .99, .94), 'shale': (.94, .97, 1.01),
}
EMISSION = {
    'signal': ((.18, .78, .65), .58),
    'beat': ((.30, .66, .82), .35),
    'amber': ((.98, .48, .15), .37),
}
# Tint, roughness, IOR, optical depth, absorption color, density.
OPTICS = {
    'canopy': ((.78, .91, .96), .115, 1.46, .068, (.72, .90, .97), .19),
    'control': ((.87, .97, .98), .082, 1.46, .064, (.64, .88, .91), .28),
    'iris': ((.81, .97, .92), .095, 1.48, .102, (.48, .89, .77), .34),
    'crystal': ((.92, .97, 1), .058, 1.49, .102, (.68, .88, .97), .22),
    'frosted guides': ((.84, .95, .92), .235, 1.46, .130, (.63, .89, .82), .28),
}
# Tint and opacity for the layered flight glazing in the Web viewer.
FLIGHT_GLAZING = {
    'canopy': ((.25, .53, .63), .17),
    'iris': ((.22, .56, .49), .28),
    'crystal': ((.31, .63, .69), .24),
    'frosted guides': ((.57, .80, .73), .39),
}


def pigment_key(material):
    return material.name.split()[0].lower()


def glass_kind(material):
    return material.name[len(GLASS):] if material.name.startswith(GLASS) else None


def configure_glass(material, kind):
    if material.get('Beatline optical depth'):
        return
    tint, roughness, ior, depth, absorption, density = OPTICS[kind]
    material['Beatline optical depth'] = depth
    material.use_backface_culling = True
    material.diffuse_color = (*tint, .42)
    nodes = material.node_tree.nodes
    link = material.node_tree.links.new
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*tint, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['IOR'].default_value = ior
    shader.inputs['Specular IOR Level'].default_value = .34
    shader.inputs['Transmission Weight'].default_value = 1
    volume = nodes.new('ShaderNodeVolumeAbsorption')
    volume.location = (0, -320)
    volume.inputs['Color'].default_value = (*absorption, 1)
    volume.inputs['Density'].default_value = density
    link(volume.outputs['Volume'], nodes.get('Material Output').inputs['Volume'])

    group = bpy.data.node_groups.get('glTF Material Output')
    if group is None:
        group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        group.interface.new_socket(name='Thickness', in_out='INPUT', socket_type='NodeSocketFloat')
        group.nodes.new('NodeGroupInput')
    settings = nodes.new('ShaderNodeGroup')
    settings.node_tree = group
    settings.location = (320, -320)
    settings.inputs['Thickness'].default_value = depth


def project_uvs(obj, mesh, face, material, _dish=None):
    return surface_uvs(obj, mesh, face, material, surface_name=SURFACES.get(pigment_key(material), 'plain'))


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

    for material in sorted(materials, key=lambda mat: mat.name):
        if kind := glass_kind(material):
            configure_glass(material, kind)
            continue
        key = pigment_key(material)
        nodes = material.node_tree.nodes
        shader = nodes.get('Principled BSDF')
        if key in EMISSION:
            tint, strength = EMISSION[key]
            shader.inputs['Emission Color'].default_value = (*tint, 1)
            shader.inputs['Emission Strength'].default_value = strength
            continue
        if material.get('Beatline surface'):
            continue
        grade = GRADES.get(key, (1, 1, 1))
        color = tuple(channel * gain for channel, gain in zip(material.diffuse_color[:3], grade, strict=True))
        material.diffuse_color = (*color, 1)
        pigment, shader = image_nodes(material, images)
        multiply = nodes.new('ShaderNodeMixRGB')
        multiply.label = 'Editable surface pigment'
        multiply.location = (-270, 260)
        multiply.blend_type = 'MULTIPLY'
        multiply.inputs[0].default_value = 1
        multiply.inputs[1].default_value = material.diffuse_color
        link = material.node_tree.links.new
        link(pigment.outputs['Color'], multiply.inputs[2])
        link(multiply.outputs[0], shader.inputs['Base Color'])
        material['Beatline surface'] = True


def web_materials(images):
    opaque = bpy.data.materials.new('Beatline · baked opaque PBR')
    opaque.use_nodes = True
    pigment, shader = image_nodes(opaque, images)
    opaque.node_tree.links.new(pigment.outputs['Color'], shader.inputs['Base Color'])
    lamps = {}
    for key, (tint, strength) in EMISSION.items():
        material = bpy.data.materials.new('Beatline · ' + key + ' emitter')
        material.use_nodes = True
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value = .36
        shader.inputs['Emission Color'].default_value = (*tint, 1)
        shader.inputs['Emission Strength'].default_value = strength
        lamps[key] = material

    # Physical transmission sees the opaque buffer. The corridor uses tinted
    # PBR blending so both its banks of glazing and the gates behind them remain
    # visible. Keep true volume transmission on the control observation glass.
    glass = {'control': bpy.data.materials[GLASS + 'control']}
    for kind, (tint, opacity) in FLIGHT_GLAZING.items():
        material = bpy.data.materials.new('Beatline · layered ' + kind)
        material.use_nodes = True
        material.use_backface_culling = True
        material.surface_render_method = 'BLENDED'
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (*tint, 1)
        shader.inputs['Roughness'].default_value = OPTICS[kind][1]
        shader.inputs['IOR'].default_value = OPTICS[kind][2]
        shader.inputs['Specular IOR Level'].default_value = .38
        shader.inputs['Alpha'].default_value = opacity
        glass[kind] = material
    return opaque, lamps, glass


def preserve_chamfers(obj):
    return (any(glass_kind(slot.material) for slot in obj.material_slots)
            or obj.name.startswith(('Sleeve ·', 'Launch shroud · standing seam panel', 'Cabin ·')))


def baked_mesh(island, images):
    vertices, triangles, corners = collect_geometry(island, project_uvs=project_uvs, keep_bevels=preserve_chamfers)
    solids = [tri for tri, (mat, _) in zip(triangles, corners, strict=True) if not glass_kind(mat)]
    tree = BVHTree.FromPolygons(vertices, solids, all_triangles=True)
    opaque, lamps, glass = web_materials(images)
    mesh = bpy.data.meshes.new('Beatline · evaluated geometry')
    mesh.from_pydata(vertices, [], triangles)
    slots = {}
    for index, material in enumerate([opaque, *lamps.values(), *glass.values()]):
        mesh.materials.append(material)
        slots[material] = index
    uv_data = mesh.uv_layers.new(name=UV).uv
    colors = mesh.color_attributes.new(name='Baked pigment and daylight', type='FLOAT_COLOR', domain='CORNER')
    mesh.color_attributes.active_color = colors
    mesh.color_attributes.render_color_index = 0
    radiance = {}
    normals, tints = [], []
    for face, triangle, (material, attributes) in zip(mesh.polygons, triangles, corners, strict=True):
        kind = glass_kind(material)
        target = glass[kind] if kind else lamps.get(pigment_key(material), opaque)
        face.use_smooth = True
        face.material_index = slots[target]
        for i, vertex, (uv, normal) in zip(face.loop_indices, triangle, attributes, strict=True):
            if kind:
                tints.extend((1, 1, 1, 1))
            else:
                shade = 1
                if target == opaque:
                    key = (vertex, tuple(round(n, 3) for n in normal))
                    if key not in radiance:
                        radiance[key] = baked_light(tree, vertices[vertex], normal)**1.2
                    shade = radiance[key]
                rgb = material.diffuse_color
                tints.extend((rgb[0] * shade, rgb[1] * shade, rgb[2] * shade, 1))
            uv_data[i].vector = uv
            normals.append(normal)
    colors.data.foreach_set('color', np.array(tints, dtype=np.float32))
    mesh.normals_split_custom_set(normals)
    mesh.update()
    obj = bpy.data.objects.new('SoFarAway — The Beatline', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, len(triangles)


def validate(gltf):
    materials = {mat['name']: mat for mat in gltf['materials']}
    primitives = [primitive for mesh in gltf['meshes'] for primitive in mesh['primitives']]
    opaque = next(primitive for primitive in primitives
                  if gltf['materials'][primitive['material']]['name'] == 'Beatline · baked opaque PBR')
    if 'COLOR_0' not in opaque['attributes'] or len(gltf.get('images', [])) != 2:
        raise RuntimeError('Expected baked lighting and two PBR atlases on the opaque batch.')
    for kind in EMISSION:
        if not any(materials[f'Beatline · {kind} emitter'].get('emissiveFactor', [])):
            raise RuntimeError(f'Missing emission for {kind}.')
    for kind in FLIGHT_GLAZING:
        material = materials['Beatline · layered ' + kind]
        if material.get('alphaMode') != 'BLEND' or material.get('doubleSided'):
            raise RuntimeError(f'{kind} must use a closed, forward-facing blended surface.')
    optics = {'KHR_materials_transmission', 'KHR_materials_volume', 'KHR_materials_ior'}
    control = materials[GLASS + 'control']
    if (control.get('doubleSided') or control.get('alphaMode', 'OPAQUE') != 'OPAQUE'
            or not optics.issubset(control['extensions'])):
        raise RuntimeError('Incomplete glTF volume for control glazing.')
    groups = 1 + len(EMISSION) + len(OPTICS)
    if len(primitives) != groups:
        raise RuntimeError(f'Expected {groups} draw groups.')
    return groups


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--blend', type=Path, help='Save the editable source with packed material maps.')
    cli.add_argument('--glb', type=Path, required=True)
    args = cli.parse_args(sys.argv[sys.argv.index('--') + 1:])
    scene = bpy.context.scene
    island = bpy.data.collections['SOFARAWAY • Island asset']
    images = atlases(ASSET)
    prepare_source(island, images)
    if args.blend:
        scene['Art stage'] = 'WEB-V0.1-W3-S2'
        scene['Web bake'] = 'Packed surface atlases, baked contact and daylight, independent glass and emitter batches.'
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()), compress=True)
    obj, triangles = baked_mesh(island, images)
    gltf = export_glb(obj, args.glb.resolve())
    groups = validate(gltf)
    print(f'SoFarAway web asset: {triangles:,} triangles, {groups} draw groups, {args.glb.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
