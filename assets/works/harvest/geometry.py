"""Editable low-poly modeling tools and the Harvest material palette."""

import math
import random

import bpy
from mathutils import Vector


RNG = random.Random(4961)
PALETTE = {
    'cliff': ('918778', '9d9080', '807d70', 'a79982', '76766b', 'b2a48c'),
    'shale': ('666a61', '747467', '7b776b', '69675e'),
    'talus': ('b9a681', 'a89a7e', 'c6b493', 'a79f87'),
    'grass': ('899454', '9da663', '76864d', 'adb474', '8d9d60', 'a4a967'),
    'pine': ('3e5d44', '4a6d49', '56784d', '6b8750', '749250'),
    'leaves': ('77934d', '8ba35c', '9cab57', 'a4b368'),
    'plank': ('895d42', 'a17351', '94664a', 'ad8058', '9f7450'),
    'stone': ('c3b292', 'b1a285', 'cbb89b', 'a7977a', 'c0ae91'),
    'roof': ('3e6560', '49736c', '547c73', '436c67', '5b8176', '587a6f'),
    'copper': ('a96342', 'b4744f', '99583e', 'bf8358', '8a5540', '9b7559'),
    'dish': ('a96b50', 'b4795b', 'a2664e', 'ae7256', 'a26b53', 'b7815e'),
    'timber': ('60412f',),
    'endgrain': ('bb9470',),
    'bark': ('6d5139',),
    'iron': ('374443',),
    'brass': ('d2ad73',),
    'mortar': ('807460',),
    'plaster': ('e6d5b6', 'd6c5a8', 'd8c8aa'),
    'glass': ('203c3e', '2f5153', '476a69'),
    'amber': ('ffd08a',),
    'signal': ('72ddc6',),
    'soil': ('8c785c',),
    'flower': ('d6b575', 'e0ce99', 'ba8561'),
    'canvas': ('d8bb88',),
}


def linear(channel):
    value = int(channel, 16) / 255
    return value / 12.92 if value < .04045 else ((value + .055) / 1.055) ** 2.4


METALS = {'copper': .44, 'dish': .48, 'iron': .34, 'brass': .52, 'roof': .20}
MATERIALS = {}


def material(key, i=0):
    n = i % len(PALETTE[key])
    identifier = (key, n)
    if identifier not in MATERIALS:
        shade = PALETTE[key][n]
        value = tuple(linear(shade[i:i+2]) for i in (0, 2, 4)) + (1,)
        mat = bpy.data.materials.new(f'{key.title()} {n+1:02}')
        mat.diffuse_color = value
        mat.use_nodes = True
        shader = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
        shader.inputs['Base Color'].default_value = value
        shader.inputs['Roughness'].default_value = .26 if key == 'glass' else .63 if key in METALS else .83
        shader.inputs['Metallic'].default_value = METALS.get(key, 0)
        if key in {'amber', 'signal'}:
            shader.inputs['Emission Color'].default_value = value
            shader.inputs['Emission Strength'].default_value = .55 if key == 'amber' else .35
        MATERIALS[identifier] = mat
    return MATERIALS[identifier]


def collection(name, parent=None):
    group = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(group)
    return group


def object_in(name, data, group):
    obj = bpy.data.objects.new(name, data)
    group.objects.link(obj)
    return obj


def mesh(name, vertices, faces, group, materials, face_materials=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    for m in materials:
        data.materials.append(m)
    if face_materials is not None:
        for face, index in zip(data.polygons, face_materials, strict=True):
            face.material_index = index
    return object_in(name, data, group)


def soft_edges(obj, width):
    if width:
        bevel = obj.modifiers.new('Edge bevel', 'BEVEL')
        bevel.width = width
        bevel.segments = 1
        bevel.limit_method = 'ANGLE'
        bevel.harden_normals = True


def block(name, pos, size, group, key, tone=0, bevel=.02):
    x, y, z = (length/2 for length in size)
    verts = [(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    poles = [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    obj = mesh(name, verts, poles, group, [material(key, tone)])
    obj.location = pos
    soft_edges(obj, bevel)
    return obj


def beam(name, start, end, width, depth, group, key, tone=0, bevel=.018):
    a, b = Vector(start), Vector(end)
    obj = block(name, (a+b)/2, (width, depth, (b-a).length), group, key, tone, bevel)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def lathe(name, pos, profile, group, key, sides=12, axis=(0,0,1), vary=False, closed=False):
    count = len(profile)
    verts = [(radius*math.cos(math.tau*i/sides), radius*math.sin(math.tau*i/sides), z)
             for radius, z in profile for i in range(sides)]
    bands = count if closed else count-1
    faces = [(j*sides+i, j*sides+(i+1)%sides, ((j+1)%count)*sides+(i+1)%sides, ((j+1)%count)*sides+i)
             for j in range(bands) for i in range(sides)]
    if not closed:
        faces.extend((tuple(reversed(range(sides))), tuple(range((count-1)*sides,count*sides))))
    mats = [material(key, i) for i in range(len(PALETTE[key]))]
    tones = [RNG.randrange(len(mats)) if vary else 0 for _ in faces]
    obj = mesh(name, verts, faces, group, mats, tones)
    obj.location = pos
    obj.rotation_euler = Vector(axis).to_track_quat('Z','Y').to_euler()
    return obj


def rod(name, a, b, radius, group, key, sides=8):
    a, b = Vector(a), Vector(b)
    return lathe(name, a, [(radius,0),(radius,(b-a).length)], group, key, sides, b-a)


def conduit(name, points, dia, group, key, collars=False):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 8
    curve.bevel_depth = dia / 2
    curve.bevel_resolution = 1
    curve.use_fill_caps = True
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for point, xyz in zip(spline.bezier_points, points, strict=True):
        point.co = xyz
        point.handle_left_type = 'AUTO'
        point.handle_right_type = 'AUTO'
    obj = object_in(name, curve, group)
    curve.materials.append(material(key))
    if collars:
        for index, (a,b) in enumerate(zip(points, points[1:])):
            a, b = Vector(a), Vector(b)
            if (b-a).length > .25:
                p = a.lerp(b, .5)
                u = (b-a).normalized()*.05
                rod(f'{name} · sleeve {index+1}', p-u,p+u,dia*.68,group,'iron')
    return obj


def faceted_rock(name, pos, scale, group, key='cliff', seed=0):
    rng = random.Random(seed)
    count = rng.choice((5,6,7))
    radius = [rng.uniform(.83,1.18) for _ in range(count)]
    verts = []
    for ring, height in ((.67,-.39),(1,.05),(.58,.73)):
        for i, rad in enumerate(radius):
            a = math.tau*i/count + seed*.32 + height*.23
            verts.append((math.cos(a)*rad*ring*scale[0],math.sin(a)*rad*ring*scale[1],(height+rng.uniform(-.17,.17))*scale[2]))
    verts.append((-.12*scale[0],.07*scale[1],.84*scale[2]))
    faces = [tuple(reversed(range(count)))]
    for j in (0,count):
        for i in range(count):
            k=(i+1)%count
            a,b,c,d = j+i,j+k,j+count+i,j+count+k
            faces.extend(((a,b,c),(b,d,c)))
    faces.extend((2*count+i,2*count+(i+1)%count,3*count) for i in range(count))
    mats = [material(key,i) for i in range(len(PALETTE[key]))]
    obj=mesh(name,verts,faces,group,mats,[rng.randrange(len(mats)) for _ in faces])
    obj.location=pos
    return obj


def railing(name, points, group, spacing=.77, height=.64, key='timber'):
    for i,(a,b) in enumerate(zip(points,points[1:])):
        a,b=Vector(a),Vector(b)
        for j in range(1,3):
            raise_by=Vector((0,0,height * (.48 if j==1 else 1)))
            beam(f'{name} · rail {i+1}.{j}',a+raise_by,b+raise_by,.068,.074,group,key,bevel=.01)
        count=max(1,math.ceil((b-a).length/spacing))
        for j in range(count + (i==len(points)-2)):
            p=a.lerp(b,j/count)
            block(f'{name} · baluster {i+1}.{j+1}',p+Vector((0,0,height*.47)),(.086,.086,height),group,key)


def lantern(name, pos, group, key='amber'):
    x,y,z=pos
    block(name+' · housing',(x,y,z+.17),(.22,.22,.34),group,'iron')
    block(name+' · lens',(x,y,z+.18),(.233,.233,.20),group,key,bevel=.033)
    lathe(name+' · cap',(x,y,z+.32),[(.18,0),(.18,.035),(.083,.12)],group,'iron',8)
    for dx in [-.094,.094]:
        for dy in [-.094,.094]:
            block(name+' · lens frame',(x+dx,y+dy,z+.18),(.022,.022,.26),group,'iron',bevel=0)
