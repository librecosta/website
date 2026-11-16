"""Harvest's packed surface atlases and UVs, shared by the source and GLB."""

import math
from zlib import crc32

import bpy
import numpy as np
from mathutils import Vector


CELLS = (
    ('cliff', .88, 0), ('grass', .89, 0), ('wood', .77, 0), ('endgrain', .83, 0),
    ('plaster', .92, 0), ('roof', .68, .23), ('copper', .61, .44), ('dish', .56, .51),
    ('iron', .68, .39), ('brass', .52, .52), ('glass', .32, .07), ('plain', .87, 0),
)
CELL = 128
SIDE = 4 * CELL
MARGIN = 7
SURFACES = {
    'cliff': 'cliff', 'shale': 'cliff', 'talus': 'cliff', 'stone': 'cliff', 'mortar': 'cliff',
    'grass': 'grass', 'soil': 'grass', 'plank': 'wood', 'timber': 'wood', 'bark': 'wood',
    'endgrain': 'endgrain', 'plaster': 'plaster', 'roof': 'roof', 'copper': 'copper',
    'dish': 'dish', 'iron': 'iron', 'brass': 'brass', 'glass': 'glass',
}
CELL_INDEX = {name: i for i, (name, _, _) in enumerate(CELLS)}


def surface(material):
    return SURFACES.get(material.name.split()[0].lower(), 'plain')


def smoothstep(a, b, value):
    t = np.clip((value - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def surface_detail(name, u, v):
    """Low-contrast, oriented detail. The underlying palette is assigned per panel or facet."""
    wave = np.sin(math.tau * (u * 2.2 + v * 1.13))
    cross = np.cos(math.tau * (u * 4.1 - v * 2.35))
    fine = np.sin(math.tau * (u * 26.7 + v * 31.2)) * np.sin(math.tau * (u * 33.4 - v * 24.8))
    tone = np.ones_like(u)
    oxide = np.zeros_like(u)
    finish = np.zeros_like(u)
    if name == 'cliff':
        strata = np.sin(math.tau * (v * 7.3 + u * .32 + .08 * wave))
        seams = smoothstep(.70, .98, strata) * (.64 + .32 * cross)
        tone = .993 - .11 * seams + .025 * wave + .021 * fine
        oxide = .13 * smoothstep(.57, 1.30, wave + .48 * cross) * smoothstep(.36, .92, v)
    elif name == 'grass':
        tone = .986 + .037 * wave + .022 * cross + .016 * fine
    elif name in {'wood', 'endgrain'}:
        axis = u if name == 'wood' else np.sqrt((u - .48)**2 + ((v - .55) * 1.08)**2)
        fiber = np.sin(math.tau * (16.4 * axis + .15 * wave + .09 * cross))
        grain = smoothstep(.73, 1, fiber) * (.69 + .29 * np.sin(math.tau * (u * 5.7 + v * .53)))
        tone = .997 - .13 * grain + .032 * wave + .012 * fine
        finish = .045 * grain
    elif name == 'plaster':
        tone = .996 + .022 * (wave + cross) + .032 * fine
    elif name == 'roof':
        runoff = np.sin(math.tau * (u * 4.3 + .12 * wave)) * (.6 + .4 * np.cos(math.tau * v))
        tone = .983 + .048 * runoff + .026 * cross + .013 * fine
        oxide = .09 * smoothstep(.12, .93, runoff)
        finish = .038 * wave
    elif name in {'dish', 'copper', 'brass', 'iron'}:
        radial = np.sqrt((u - .5)**2 + (v - .5)**2) * 2
        brushed = np.cos(math.tau * (radial * 18 + .09 * cross if name == 'dish' else u * 21 + .07 * wave))
        tone = .994 + .019 * brushed + .034 * wave + .014 * fine
        if name == 'dish':
            oxide = smoothstep(.78, .98, radial) * (.32 + .19 * wave + .13 * cross)
        elif name == 'copper':
            oxide = .25 * smoothstep(.4, 1.24, wave + .33 * cross)
        elif name == 'brass':
            oxide = .10 * smoothstep(.4, 1, wave)
        finish = .11 * oxide + .035 * wave
    return tone, oxide, finish


def atlas(name, pixels, colorspace):
    existing = bpy.data.images.get(name)
    if existing:
        return existing
    image = bpy.data.images.new(name, width=SIDE, height=SIDE, alpha=False)
    image.colorspace_settings.name = colorspace
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    return image


def atlases():
    axis = np.clip((np.arange(CELL) - MARGIN) / (CELL - 1 - 2 * MARGIN), 0, 1)
    u, v = np.meshgrid(axis, axis)
    color = np.ones((SIDE, SIDE, 4), dtype=np.float32)
    finish = color.copy()
    for index, (name, roughness, metallic) in enumerate(CELLS):
        x, y = index % 4 * CELL, index // 4 * CELL
        tone, oxide, grain = surface_detail(name, u, v)
        # Pale green mineral staining and copper runoff tint the underlying pigment gently.
        patina = (-.34, .025, -.34) if name == 'cliff' else (-.53, .045, .035)
        for c, amount in enumerate(patina):
            value = tone * (1 + amount * oxide)
            color[y:y+CELL, x:x+CELL, c] = np.clip(value, 0, 1)**(1 / 2.2)
        finish[y:y+CELL, x:x+CELL, 1] = np.clip(roughness + grain, 0, 1)
        finish[y:y+CELL, x:x+CELL, 2] = np.clip(metallic - .18 * oxide, 0, 1)
    return atlas('Harvest · surface pigment', color, 'sRGB'), atlas('Harvest · roughness and metal', finish, 'Non-Color')


def dish_axes(obj):
    if not obj.name.startswith('Collector · rolled copper dish'):
        return None
    # Fit the planar projection to the rim of the original receiver.
    points = [vertex.co for vertex in obj.data.vertices]
    if len(points) != 192:
        return None
    rim = points[-24:]
    center = sum(rim, Vector()) / len(rim)
    x, y = rim[0] - center, rim[6] - center
    return center, x.normalized() / x.length, y.normalized() / y.length


def surface_uvs(obj, mesh, face, material, dish):
    name = surface(material)
    index = CELL_INDEX[name]
    points = [mesh.vertices[mesh.loops[i].vertex_index].co for i in face.loop_indices]
    if name == 'dish' and dish:
        center, x, y = dish
        uv = [((p - center).dot(x) * .465 + .5, (p - center).dot(y) * .465 + .5) for p in points]
    elif name == 'plain':
        uv = [(.5, .5)] * len(points)
    else:
        plane = [i for i in range(3) if i != max(range(3), key=lambda i: abs(face.normal[i]))]
        bounds = [(min(p[i] for p in points), max(p[i] for p in points)) for i in plane]
        span = [hi - lo for lo, hi in bounds]
        if name in {'wood', 'roof', 'copper'} and span[0] > span[1]:
            plane.reverse()
            bounds.reverse()
            span.reverse()
        grade = {'cliff': (.43, .56), 'grass': (.43, .43), 'wood': (2.3, .63),
                 'endgrain': (1.7, 1.7), 'plaster': (.79, .79), 'roof': (1.8, .55)}.get(name, (1.05, .74))
        scale = [min(.91, max(.045, extent * pitch)) for extent, pitch in zip(span, grade)]
        seed = crc32(obj.name.encode('utf-8'))
        origin = [(1 - size) * (.17 + .66 * (((seed >> (j * 11)) % 1021) / 1021)) for j, size in enumerate(scale)]
        uv = [tuple(origin[j] + scale[j] * (p[dim] - bounds[j][0]) / max(span[j], 1e-5)
                    for j, dim in enumerate(plane)) for p in points]
    x, y = index % 4 * CELL + MARGIN + .5, index // 4 * CELL + MARGIN + .5
    span = CELL - 1 - 2 * MARGIN
    return [((x + u * span) / SIDE, (y + v * span) / SIDE) for u, v in uv]


def image_nodes(material, images):
    nodes = material.node_tree.nodes
    pigment = nodes.new('ShaderNodeTexImage')
    pigment.location = (-610, 260)
    pigment.image = images[0]
    pigment.extension = 'EXTEND'
    pigment.label = 'Harvest surface pigment atlas'
    finish = nodes.new('ShaderNodeTexImage')
    finish.location = (-610, -40)
    finish.image = images[1]
    finish.extension = 'EXTEND'
    finish.label = 'Harvest finish atlas · G roughness / B metal'
    channels = nodes.new('ShaderNodeSeparateColor')
    channels.location = (-320, -30)
    link = material.node_tree.links.new
    link(finish.outputs['Color'], channels.inputs['Color'])
    shader = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
    link(channels.outputs['Green'], shader.inputs['Roughness'])
    link(channels.outputs['Blue'], shader.inputs['Metallic'])
    return pigment, shader


def apply_surfaces(island, images):
    materials = set()
    for obj in island.all_objects:
        if obj.type != 'MESH':
            continue
        mesh = obj.data
        layer = mesh.uv_layers.get('Harvest surfaces') or mesh.uv_layers.new(name='Harvest surfaces')
        mesh.uv_layers.active = layer
        layer.active_render = True
        dish = dish_axes(obj)
        for face in mesh.polygons:
            material = mesh.materials[face.material_index]
            materials.add(material)
            for i, uv in zip(face.loop_indices, surface_uvs(obj, mesh, face, material, dish), strict=True):
                layer.uv[i].vector = uv
    for material in sorted(materials, key=lambda mat: mat.name):
        if surface(material) == 'plain' or any(node.type == 'TEX_IMAGE' for node in material.node_tree.nodes):
            continue
        pigment, shader = image_nodes(material, images)
        nodes = material.node_tree.nodes
        multiply = nodes.new('ShaderNodeMixRGB')
        multiply.location = (-260, 260)
        multiply.label = 'Editable material pigment'
        multiply.blend_type = 'MULTIPLY'
        multiply.inputs[0].default_value = 1
        multiply.inputs[1].default_value = material.diffuse_color
        link = material.node_tree.links.new
        link(pigment.outputs['Color'], multiply.inputs[2])
        link(multiply.outputs[0], shader.inputs['Base Color'])
