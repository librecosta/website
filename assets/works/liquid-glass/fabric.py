"""Geometry and the material palette for the Refraction Atelier."""

import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.append(str(Path(__file__).resolve().parents[1] / 'harvest'))
from geometry import (PALETTE, METALS, block, beam, collection, conduit, faceted_rock,
                      lathe, material, mesh, object_in, railing, rod, soft_edges)


def palette():
    PALETTE.update({
        'cliff': ('a49f91', '949487', 'b0a999', '899185', 'bbb09c', '969b90'),
        'shale': ('5b655f', '6b7368', '7c8072', '727b6e'),
        'talus': ('b8a88f', 'aa9b84', 'c5b395', 'aa9e89'),
        'grass': ('879663', '96a476', '99a877', '768b65', 'a4af7f', '8b9b71'),
        'stone': ('cbbfa8', 'd4c9b5', 'bab19f', 'e1d6c0', 'c6beac'),
        'plaster': ('e2d8c1', 'e9e1cd', 'd7d1bd'),
        'pine': ('425b4a', '506e56', '65805d', '779169', '88a176'),
        'leaves': ('788d61', '879b6b', '9cad7b', 'afbb8a'),
        'timber': ('614d3e', '79614f', '8c735c'),
        'plank': ('9b8067', 'af9277', '8d735b', 'b0987f'),
        'bronze': ('977c56', 'a48a64', '77684f', 'bd9d6c'),
        'brass': ('ccab77', 'e0c196'),
        'frame': ('435557', '4e6564', '586a66'),
        'roof': ('4e6e6c', '5c7973', '56766e', '68837c', '4f6d69'),
        'zinc': ('8f9691', 'a2a9a0', '73827e'),
        'jade': ('6c9b91', '54827c', '9fb9ad'),
        'ink': ('374743', '576863'),
        'porcelain': ('e2e4d5', 'c6d2c4', 'e8e5d7'),
        'sand': ('b9a285', 'c3ad8c'),
        'felt': ('667b73', '7c8c84'),
    })
    METALS.update({'frame': .32, 'bronze': .62, 'zinc': .42, 'roof': .33})


GLASS = {
    'Clear': ((.91, .99, .964), .040, 1.45),
    'Soft': ((.88, .96, .93), .24, 1.46),
    'Prismatic': ((.76, .94, .91), .095, 1.48),
}


def glass(kind):
    name = f'Optical glass · {kind}'
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    color, roughness, ior = GLASS[kind]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, .32)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Transmission Weight'].default_value = 1
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['IOR'].default_value = ior
    return mat


def section(name, profile, x0, x1, group, key, tone=0, bevel=0):
    """Extrude a counter-clockwise Y/Z outline along X."""
    n = len(profile)
    points = [(x,y,z) for x in (x0,x1) for y,z in profile]
    faces = [tuple(reversed(range(n))), tuple(range(n, n*2))]
    faces.extend((i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n))
    obj = mesh(name, points, faces, group, [material(key,tone)])
    soft_edges(obj, bevel)
    return obj


def slab(name, outline, bottom, top, group, key, tone=0, bevel=0):
    n = len(outline)
    points = [(x,y,z) for z in (bottom,top) for x,y in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n,n*2))]
    faces.extend((i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n))
    obj = mesh(name, points, faces, group, [material(key,tone)])
    soft_edges(obj, bevel)
    return obj


def quad(center, width, depth):
    x,y = center
    return [(x-width/2,y-depth/2), (x+width/2,y-depth/2),
            (x+width/2,y+depth/2), (x-width/2,y+depth/2)]


def octagon(x, y, rx, ry, cut=.25):
    return [(x+dx*rx,y+dy*ry) for dx,dy in ((-1+cut,-1),(1-cut,-1),(1,-1+cut),
            (1,1-cut),(1-cut,1),(-1+cut,1),(-1,1-cut),(-1,-1+cut))]


def glass_panel(name, center, dimensions, kind, group, angle=0, bevel=.025):
    obj = block(name, center, dimensions, group, 'porcelain', bevel=0)
    obj.data.materials[0] = glass(kind)
    obj.rotation_euler.z = angle
    soft_edges(obj, bevel)
    return obj


def framed_window(name, point, width, height, group, *, angle=0, panes=2, kind='Clear'):
    x,y,z = point
    u = Vector((math.cos(angle),math.sin(angle),0))
    v = Vector((-u.y,u.x,0))
    p = Vector(point)

    def piece(label, u0, v0, z0, dims, key, tone=0):
        obj = block(f'{name} · {label}', p+u*u0+v*v0+Vector((0,0,z0)), dims, group, key, tone)
        obj.rotation_euler.z = angle

    glass_panel(f'{name} · {kind} glazing', (x,y,z), (width,.067,height), kind, group, angle, .014)
    for side in (-1,1):
        piece('jamb', side*width/2, 0, 0, (.088,.15,height+.15), 'frame')
        piece('head' if side==1 else 'sill', 0, 0, side*height/2, (width+.16,.20,.085), 'frame')
    for i in range(1,panes):
        piece('mullion', width*(i/panes-.5), -.05, 0, (.052,.075,height), 'bronze', 2)
    piece('transom', 0, -.052, height*.18, (width,.07,.043), 'frame', 1)


def arc(name, center, u, v, r_in, r_out, thickness, angles, group, key, tone=0, segments=28):
    """Solid annular sector with editable flat side faces and a bevel."""
    c, u, v = Vector(center), Vector(u), Vector(v)
    n = u.cross(v).normalized()
    points = []
    for i in range(segments+1):
        angle = angles[0] + (angles[1]-angles[0])*i/segments
        ray = u*math.cos(angle) + v*math.sin(angle)
        points.extend(c+ray*r+n*d for r,d in ((r_in,-thickness/2),(r_out,-thickness/2),
                                             (r_out,thickness/2),(r_in,thickness/2)))
    faces = [(0,1,2,3), tuple(reversed(range(4*segments,4*segments+4)))]
    for i in range(segments):
        for j in range(4):
            k = (j+1)%4
            faces.append((4*i+j,4*(i+1)+j,4*(i+1)+k,4*i+k))
    obj = mesh(name, points, faces, group, [material(key,tone)])
    soft_edges(obj,.022)
    return obj


def aligned_block(name, center, dimensions, axes, group, key, tone=0, bevel=.02):
    obj = block(name, center, dimensions, group, key, tone, bevel)
    obj.rotation_euler = Matrix(axes).transposed().to_euler()
    return obj
