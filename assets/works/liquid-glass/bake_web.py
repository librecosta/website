"""Finish the editable Refraction Atelier and export its baked Draco GLB."""

import argparse
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from receiver import CENTER, HORIZONTAL, VERTICAL

sys.path.insert(0, str(HERE.parent / 'harvest'))
from bake_web import baked_light, collect_geometry, export_glb
from surfaces import atlas, atlases, image_nodes, surface_uvs


ASSET = 'Liquid Glass'
UV = 'Atelier surface and optical thickness'
LENS = 'Objective · enclosed crown glass with polished edge'
SURFACES = {
    'cliff': 'cliff', 'shale': 'cliff', 'talus': 'cliff', 'stone': 'cliff', 'sand': 'cliff',
    'grass': 'grass', 'bark': 'wood', 'timber': 'wood', 'plank': 'wood',
    'plaster': 'plaster', 'roof': 'roof', 'bronze': 'copper', 'brass': 'brass',
    'zinc': 'iron', 'frame': 'iron',
}
# Base tint, roughness, index of refraction, optical depth, absorption tint, density.
GLASSES = {
    'Crown':      ((.95, .995, .980), .057, 1.49, 1.10, (.78, .96, .94), .16),
    'Crown edge': ((.77, .950, .894), .110, 1.49, .34, (.44, .86, .78), .33),
    'Clear':      ((.96, .993, .984), .058, 1.47, .105, (.82, .96, .94), .11),
    'Soft':       ((.90, .963, .940), .300, 1.46, .290, (.79, .91, .88), .18),
    'Prismatic':  ((.79, .942, .904), .103, 1.51, .430, (.41, .86, .80), .36),
    'Window':     ((.92, .981, .970), .086, 1.47, .067, (.84, .95, .93), .13),
    'Rooflight':  ((.88, .950, .927), .250, 1.46, .100, (.79, .92, .89), .16),
}
GLASS_PREFIX = 'Atelier glass · '


def is_glass(material):
    return material.name.startswith(GLASS_PREFIX)


def crown_thickness():
    # The L1 back and front curves enclose .38 + .72 * (1 - r²) Blender units.
    axis = (np.arange(512) + .5) / 256 - 1
    depth = (.38 + .72 * np.clip(1 - axis[:, None]**2 - axis[None, :]**2, 0, 1)) / 1.10
    pixels = np.ones((512, 512, 4), dtype=np.float32)
    pixels[:, :, 1] = depth
    return atlas('Atelier · objective thickness', pixels, 'Non-Color')


def optical_material(kind):
    name = GLASS_PREFIX + kind
    if material := bpy.data.materials.get(name):
        return material
    color, roughness, ior, thickness, tint, density = GLASSES[kind]
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_backface_culling = True
    material.diffuse_color = (*color, .35)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['IOR'].default_value = ior
    shader.inputs['Transmission Weight'].default_value = 1
    output = nodes.get('Material Output')
    volume = nodes.new('ShaderNodeVolumeAbsorption')
    volume.location = (0, -320)
    volume.inputs['Color'].default_value = (*tint, 1)
    volume.inputs['Density'].default_value = density
    links.new(volume.outputs['Volume'], output.inputs['Volume'])

    group = bpy.data.node_groups.get('glTF Material Output')
    if group is None:
        group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        group.interface.new_socket(name='Thickness', in_out='INPUT', socket_type='NodeSocketFloat')
        group.nodes.new('NodeGroupInput')
    settings = nodes.new('ShaderNodeGroup')
    settings.node_tree = group
    settings.label = 'Web transmission depth'
    settings.location = (390, -320)
    settings.inputs['Thickness'].default_value = thickness
    if kind == 'Crown':
        depth = nodes.new('ShaderNodeTexImage')
        depth.image = crown_thickness()
        depth.extension = 'EXTEND'
        depth.location = (-640, -320)
        channels = nodes.new('ShaderNodeSeparateColor')
        channels.location = (-300, -320)
        links.new(depth.outputs['Color'], channels.inputs['Color'])
        scale = nodes.new('ShaderNodeMath')
        scale.operation = 'MULTIPLY'
        scale.location = (-100, -320)
        scale.inputs[1].default_value = thickness
        links.new(channels.outputs['Green'], scale.inputs[0])
        links.new(scale.outputs[0], settings.inputs['Thickness'])
    return material


def source_glass(obj, material):
    kind = material.name.rsplit(' · ', 1)[1]
    if obj.name == LENS:
        return optical_material('Crown' if kind == 'Clear' else 'Crown edge')
    if ' · solid test specimen' in obj.name:
        return optical_material(kind)
    return optical_material('Window' if kind == 'Clear' else 'Rooflight')


def project_uvs(obj, mesh, face, material, _dish=None):
    if obj.name == LENS:
        points = [mesh.vertices[mesh.loops[i].vertex_index].co - CENTER for i in face.loop_indices]
        return [(.5 + p.dot(HORIZONTAL) / 3.86, .5 + p.dot(VERTICAL) / 3.86) for p in points]
    name = SURFACES.get(material.name.split()[0].lower(), 'plain')
    return surface_uvs(obj, mesh, face, material, surface_name=name)


def prepare_source(island, images):
    opaque = set()
    for obj in island.all_objects:
        if obj.type != 'MESH':
            continue
        mesh = obj.data
        for slot in obj.material_slots:
            if slot.material.name.startswith('Optical glass · '):
                slot.material = source_glass(obj, slot.material)
            elif not is_glass(slot.material):
                opaque.add(slot.material)
        layer = mesh.uv_layers.get(UV) or mesh.uv_layers.new(name=UV)
        mesh.uv_layers.active = layer
        layer.active_render = True
        for face in mesh.polygons:
            material = mesh.materials[face.material_index]
            for i, uv in zip(face.loop_indices, project_uvs(obj, mesh, face, material), strict=True):
                layer.uv[i].vector = uv
    for material in sorted(opaque, key=lambda item: item.name):
        if material.name.split()[0].lower() not in SURFACES:
            continue
        if any(node.type == 'TEX_IMAGE' for node in material.node_tree.nodes):
            continue
        pigment, shader = image_nodes(material, images)
        multiply = material.node_tree.nodes.new('ShaderNodeMixRGB')
        multiply.label = 'Editable material pigment'
        multiply.location = (-260, 260)
        multiply.blend_type = 'MULTIPLY'
        multiply.inputs[0].default_value = 1
        multiply.inputs[1].default_value = material.diffuse_color
        link = material.node_tree.links.new
        link(pigment.outputs['Color'], multiply.inputs[2])
        link(multiply.outputs[0], shader.inputs['Base Color'])


def baked_mesh(island, images):
    def glass_bevel(obj):
        return any(is_glass(slot.material) for slot in obj.material_slots)

    vertices, triangles, corners = collect_geometry(island, project_uvs=project_uvs, keep_bevels=glass_bevel)
    solid = [triangle for triangle, (material, _) in zip(triangles, corners, strict=True) if not is_glass(material)]
    tree = BVHTree.FromPolygons(vertices, solid, all_triangles=True)
    material = bpy.data.materials.new('Atelier · baked opaque PBR')
    material.use_nodes = True
    pigment, shader = image_nodes(material, images)
    material.node_tree.links.new(pigment.outputs['Color'], shader.inputs['Base Color'])
    glass = sorted({mat for mat, _ in corners if is_glass(mat)}, key=lambda mat: mat.name)
    indices = {mat: i for i, mat in enumerate(glass, start=1)}
    mesh = bpy.data.meshes.new('Atelier · evaluated geometry')
    mesh.from_pydata(vertices, [], triangles)
    for surface in [material, *glass]:
        mesh.materials.append(surface)
    uv_data = mesh.uv_layers.new(name=UV).uv
    colors = mesh.color_attributes.new(name='Baked pigment and daylight', type='FLOAT_COLOR', domain='CORNER')
    mesh.color_attributes.active_color = colors
    mesh.color_attributes.render_color_index = 0
    cached_light = {}
    normals, tints = [], []
    for face, triangle, (mat, attributes) in zip(mesh.polygons, triangles, corners, strict=True):
        face.use_smooth = True
        face.material_index = indices.get(mat, 0)
        for i, vertex, (uv, normal) in zip(face.loop_indices, triangle, attributes, strict=True):
            if face.material_index:
                tints.extend((1, 1, 1, 1))
            else:
                key = (vertex, tuple(round(n, 3) for n in normal))
                light = cached_light.get(key)
                if light is None:
                    light = baked_light(tree, vertices[vertex], normal)
                    cached_light[key] = light
                tints.extend((mat.diffuse_color[0] * light, mat.diffuse_color[1] * light,
                              mat.diffuse_color[2] * light, 1))
            uv_data[i].vector = uv
            normals.append(normal)
    colors.data.foreach_set('color', np.array(tints, dtype=np.float32))
    mesh.normals_split_custom_set(normals)
    mesh.update()
    obj = bpy.data.objects.new('Liquid Glass — The Refraction Atelier', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, len(triangles), len(solid)


def validate(gltf):
    required = {'KHR_materials_transmission', 'KHR_materials_volume', 'KHR_materials_ior'}
    glass = {mat['name']: mat for mat in gltf['materials'] if mat['name'].startswith(GLASS_PREFIX)}
    if set(glass) != {GLASS_PREFIX + kind for kind in GLASSES}:
        raise RuntimeError('The GLB is missing one or more authored optical surfaces.')
    for name, mat in glass.items():
        if mat.get('doubleSided') or mat.get('alphaMode', 'OPAQUE') != 'OPAQUE':
            raise RuntimeError(f'{name} must use closed geometry and PBR transmission.')
        if not required.issubset(mat['extensions']):
            raise RuntimeError(f'{name} did not export all optical properties.')
    crown = glass[GLASS_PREFIX + 'Crown']['extensions']['KHR_materials_volume']
    if 'thicknessTexture' not in crown:
        raise RuntimeError('Objective thickness map was not exported.')
    primitives = [p for model in gltf['meshes'] for p in model['primitives']]
    opaque = [p for p in primitives if gltf['materials'][p['material']]['name'] not in glass]
    if len(opaque) != 1 or 'COLOR_0' not in opaque[0]['attributes']:
        raise RuntimeError('Expected a single opaque batch with baked contact and daylight.')
    return len(primitives)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--blend', type=Path, help='Save the editable source with packed material maps.')
    cli.add_argument('--glb', type=Path, required=True)
    cli.add_argument('--render', type=Path, help='Render the source with its L1 studio camera.')
    args = cli.parse_args(sys.argv[sys.argv.index('--') + 1:])
    island = bpy.data.collections['LIQUID GLASS • Island asset']
    images = atlases(ASSET)
    prepare_source(island, images)
    scene = bpy.context.scene
    if args.blend:
        scene['Art stage'] = 'WEB-V0.1-W3-L2'
        scene['Web bake'] = 'Packed surface atlases, opaque contact and daylight, isolated optical transmission.'
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()), compress=True)
    if args.render:
        scene.render.filepath = str(args.render.resolve())
        bpy.ops.render.render(write_still=True)
    obj, triangles, solid = baked_mesh(island, images)
    gltf = export_glb(obj, args.glb.resolve())
    groups = validate(gltf)
    print(f'{triangles:,} triangles ({solid:,} opaque), {groups} draw groups, {args.glb.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
