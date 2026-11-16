"""Shared rolled sections, material palette and solid sheet construction."""

from bisect import bisect_right
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.append(str(Path(__file__).resolve().parents[1] / 'harvest'))
from geometry import (MATERIALS, METALS, PALETTE, beam, block, collection, conduit, faceted_rock,
                      lantern, lathe, material, mesh, object_in, railing, rod, soft_edges)


def palette():
    MATERIALS.clear()
    PALETTE.update({
        'cliff': ('8f8173', 'aa9985', 'b4a188', '98938e', '807e7a', 'a19785'),
        'shale': ('525d61', '626566', '6d6964', '7b746c', '73746e'),
        'talus': ('ab9c84', 'b5a589', '8f8c7b', 'b8ac94'),
        'grass': ('8b9577', '7d886f', '9da483', 'a4a589', '96967a'),
        'pine': ('405d52', '597460', '607963', '6d856d'),
        'leaves': ('697b66', '7e8f71', '94a281', '9ba78c'),
        'stone': ('b6ac9a', 'c7bba6', 'ada796', 'c9c0ae'),
        'zinc': ('838f91', '9aaca9', '6a7e83'),
        'roof': ('354e54', '466268', '53717a', '607b7e', '405b61'),
        'steel': ('46616d', '52737d', '668486', '5c767e'),
        'iron': ('28383f', '304751', '3a515b', '22363d'),
        'graphite': ('253238', '31444a', '3a484e', '414e52'),
        'ivory': ('ddcdb4', 'd7c8af', 'c9bdac', 'eee2ca'),
        'oxide': ('aa7553', 'bc8d64', '966c52', 'd3a97c'),
        'bronze': ('948164', 'a8926f', '796b57'),
        'brass': ('c4a57d', 'd6ba8e'),
        'plank': ('987c65', 'ac9074', '846c56'),
        'signal': ('69ccb9', '96e4d4'),
        'beat': ('79bbc9', 'a1d0da'),
        'amber': ('f0bb74',),
    })
    METALS.update({'roof': .42, 'steel': .52, 'zinc': .39, 'oxide': .38,
                   'graphite': .18, 'bronze': .61, 'iron': .39})
    for key in ('signal', 'amber', 'beat'):
        for n in range(len(PALETTE[key])):
            shader = material(key, n).node_tree.nodes.get('Principled BSDF')
            shader.inputs['Emission Color'].default_value = material(key,n).diffuse_color
            shader.inputs['Emission Strength'].default_value = .27 if key != 'amber' else .15


def glazing(kind):
    name = 'Flight glass · ' + kind
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    colors = {
        'canopy': ((.84, .95, .98), .095, 1.46, 1.0),
        'control': ((.74, .89, .91), .10, 1.46, .97),
        'iris': ((.65, .92, .88), .085, 1.48, .96),
        'crystal': ((.79, .94, .97), .062, 1.49, .98),
        'frosted guides': ((.84, .96, .94), .155, 1.46, .96),
    }
    tint, roughness, ior, transmission = colors[kind]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*tint, .42)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Transmission Weight'].default_value = transmission
    shader.inputs['Base Color'].default_value = (*tint, 1)
    shader.inputs['IOR'].default_value = ior
    shader.inputs['Roughness'].default_value = roughness
    return mat


def tapered(name, lower, upper, group, mat, bevel=0):
    """Create a solid from equal-size counter-clockwise contours."""
    count = len(lower)
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces.extend((i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count))
    obj = mesh(name, [*lower, *upper], faces, group, [mat])
    soft_edges(obj, bevel)
    return obj


def slab(name, outline, z0, z1, group, key, tone=0, bevel=.016):
    return tapered(name, [(x, y, z0) for x, y in outline], [(x, y, z1) for x, y in outline],
                   group, material(key, tone), bevel)


def panel(name, corners, group, mat, thickness, bevel=0):
    points = [Vector(p) for p in corners]
    normal = (points[1] - points[0]).cross(points[2] - points[0]).normalized()
    offset = normal * (thickness / 2)
    return tapered(name, [p - offset for p in points], [p + offset for p in points], group, mat, bevel)


def rectangle(x, y, width, length, clip=.18):
    """Beveled plan with consistent winding for platforms and equipment."""
    a, b = width / 2, length / 2
    c = min(clip, a * .7, b * .7)
    return [(x + u, y + v) for u, v in ((-a+c, -b), (a-c, -b), (a, -b+c), (a, b-c),
                                       (a-c, b), (-a+c, b), (-a, b-c), (-a, -b+c))]


def interpolate(keys, x):
    index = max(0, min(len(keys) - 2, bisect_right([key[0] for key in keys], x) - 1))
    a, b = keys[index:index + 2]
    factor = min(1, max(0, (x - a[0]) / (b[0] - a[0])))
    return tuple(start + (end - start) * factor for start, end in zip(a[1:], b[1:], strict=True))
