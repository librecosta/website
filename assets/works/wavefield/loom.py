"""A continuous, hand-shaped surface with a finite two-direction weave."""

import math

import bpy
from mathutils import Vector

from geometry import collection, mesh
from ground import hill


SPAN = 7.57
WARP = 33
WEFT = 45


def point(u, v):
    x = SPAN * u + .28 * v * (1 - u*u)
    y = v * (3.06 + .44 * (1 - u*u)) + .42 * u + .34 * math.sin(math.pi*u)
    west = 2.96 * hill(x, y-.32*x, -2.85, -.18, 2.39, 1.91)
    front = 2.57 * hill(x, y+.30*x, 2.40, -.88, 2.73, 1.46)
    rear = 1.78 * hill(x, y-.20*x, 4.94, 1.42, 2.22, 1.32)
    notch = .67 * hill(x, y, -.11, 1.08, 1.75, 1.32)
    shelf = .21 * math.sin(.94*x + .75*y) - .13 * math.sin(1.8*y - .37*x)
    taper = (1 - abs(u)**4)**1.28
    z = 5.41 + .32*u + .108*v + taper * (west + front + rear - notch + shelf)
    return Vector((x, y, z))


def smoothstep(start, end, value):
    t = min(1, max(0, (value-start)/(end-start)))
    return t*t*(3-2*t)


def optic(u, v):
    # A forward arc and portions of two separated peaks catch the same soft light.
    focus = math.exp(-((v + .30 + .16*u) / .53)**2)
    edge = smoothstep(0, .36, 1-abs(v)) * smoothstep(0, .22, 1-abs(u))
    crown = smoothstep(6.10, 8.0, point(u, v).z)
    windows = .80 * math.exp(-((u+.36)/.27)**2) + .94 * math.exp(-((u-.32)/.205)**2)
    glint = min(1, crown * windows * (.20+.80*focus))
    return edge, focus, glint


def fiber_material():
    mat = bpy.data.materials.new('Drawn fibre · cold silver and steel blue')
    mat.diffuse_color = (.25,.42,.58,1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = nodes.get('Principled BSDF')
    color = nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Fibre tint'
    color.location = (-360, 20)
    shader.inputs['Roughness'].default_value = .45
    shader.inputs['Metallic'].default_value = .23
    shader.inputs['Emission Strength'].default_value = .12
    mat.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
    mat.node_tree.links.new(color.outputs['Color'], shader.inputs['Emission Color'])
    return mat


def filaments(name, longitudinal, count, segments, group, mat):
    coords, faces, colors = [], [], []
    radial = 6
    axes = [2*i/(count-1)-1 for i in range(count)]
    ts = [2*i/segments-1 for i in range(segments+1)]
    z_axis = Vector((0, 0, 1))
    for index, fixed in enumerate(axes):
        uv = [(t, fixed) if longitudinal else (fixed, t) for t in ts]
        centers = [point(u,v) for u,v in uv]
        start = len(coords)
        for i, ((u,v), center) in enumerate(zip(uv, centers, strict=True)):
            tangent = (centers[min(segments,i+1)] - centers[max(0,i-1)]).normalized()
            right = tangent.cross(z_axis).normalized()
            normal = right.cross(tangent)
            edge, focus, glint = optic(u,v)
            if longitudinal:
                edge_line = index in (0, count-1)
                radius = .013 + .012*edge + .009*glint + .005*edge_line
                strength = .23 + .36*edge + .44*glint
                dark, light = (.16,.28,.40), (.64,.81,.93)
            else:
                radius = .008 + .0055*edge + .0015*focus
                strength = .19 + .26*edge + .12*glint
                dark, light = (.11,.19,.26), (.35,.52,.63)
            mix = glint * (.68 if longitudinal else .29)
            tint = tuple(strength * (a+(b-a)*mix) for a,b in zip(dark,light,strict=True))
            for side in range(radial):
                phi = math.tau*side/radial
                coords.append(center + radius*(right*math.cos(phi)+normal*math.sin(phi)))
                colors.append((*tint,1))
            if i:
                a, b = start+(i-1)*radial, start+i*radial
                for side in range(radial):
                    next_side = (side+1)%radial
                    faces.append((a+next_side,a+side,b+side,b+next_side))
        faces.append(tuple(range(start,start+radial)))
        tip = len(coords)-radial
        faces.append(tuple(range(tip,tip+radial))[::-1])
    obj = mesh(name, coords, faces, group, [mat])
    attr = obj.data.color_attributes.new(name='Fibre tint', type='FLOAT_COLOR', domain='POINT')
    attr.data.foreach_set('color',[c for tint in colors for c in tint])
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices)==4
    obj['Strands'] = count
    return obj


def veil(group):
    mat = bpy.data.materials.new('Open weave · silver-blue organza')
    mat.diffuse_color = (.11,.23,.30,.20)
    mat.use_nodes = True
    mat.surface_render_method = 'DITHERED'
    nodes = mat.node_tree.nodes
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.115,.24,.33,1)
    shader.inputs['Roughness'].default_value = .61
    shader.inputs['Metallic'].default_value = .18
    shader.inputs['Sheen Weight'].default_value = .32
    shader.inputs['Sheen Tint'].default_value = (.22,.37,.48,1)
    density = nodes.new('ShaderNodeAttribute')
    density.attribute_name = 'Weave coverage'
    density.location = (-520,-45)
    mix = nodes.new('ShaderNodeMixShader')
    mix.location = (260,80)
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    transparent.location = (0,200)
    link = mat.node_tree.links.new
    link(density.outputs['Fac'],mix.inputs[0])
    link(transparent.outputs[0],mix.inputs[1])
    link(shader.outputs[0],mix.inputs[2])
    link(mix.outputs[0],nodes.get('Material Output').inputs['Surface'])
    points, faces, coverage = [], [], []
    columns, rows = 96, 64
    for j in range(rows+1):
        v = 2*j/rows-1
        for i in range(columns+1):
            u = 2*i/columns-1
            p = point(u,v)
            p.z -= .014
            points.append(p)
            edge, focus, glint = optic(u,v)
            coverage.append(edge * (.07+.15*focus+.14*glint))
            if i and j:
                index = len(points)-1
                faces.append((index-columns-2,index-columns-1,index,index-1))
    obj = mesh('Continuous open-weave carrier',points,faces,group,[mat])
    density = obj.data.attributes.new('Weave coverage','FLOAT','POINT')
    density.data.foreach_set('value',coverage)
    for face in obj.data.polygons:
        face.use_smooth = True


def build_surface(group):
    fibres = collection('Editable longitudinal and transverse fibres',group)
    mat = fiber_material()
    filaments('Warp · 33 continuous silver-blue strands',True,WARP,96,fibres,mat)
    filaments('Weft · 45 continuous recessed strands',False,WEFT,48,fibres,mat)
    veil(group)
