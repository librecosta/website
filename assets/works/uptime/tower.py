"""Octagonal stone watchtower with a cantilevered gallery and a caged signal room."""

import math

import bpy
from mathutils import Vector

from fabric import panel, rectangle, slab, tapered
from geometry import beam, block, collection, conduit, lathe, material, railing, rod
from ridge import SUMMIT_Z, TOWER_XY


def glazing():
    name = 'Vigil · coastal glazing'
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    glass = bpy.data.materials.new(name)
    glass.diffuse_color = (.34, .49, .51, .14)
    glass.use_nodes = True
    nodes = glass.node_tree.nodes
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.34, .49, .51, 1)
    shader.inputs['Roughness'].default_value = .24
    shader.inputs['Specular IOR Level'].default_value = .24
    mix = nodes.new('ShaderNodeMixShader')
    mix.inputs[0].default_value = .125
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    transparent.inputs['Color'].default_value = (1,1,1,1)
    wire = glass.node_tree.links.new
    wire(transparent.outputs[0], mix.inputs[1])
    wire(shader.outputs[0], mix.inputs[2])
    wire(mix.outputs[0], nodes.get('Material Output').inputs['Surface'])
    return glass


def warm_light(name, pos, target, energy, size, group):
    light = bpy.data.lights.new(name, 'AREA')
    light.color = (1, .72, .45)
    light.energy = energy
    light.size = size
    obj = bpy.data.objects.new(name, light)
    group.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()


def polygon(radius, z=0):
    x, y = TOWER_XY
    return [Vector((x+math.cos(a)*radius, y+math.sin(a)*radius, z))
            for a in (math.radians(-112.5)+i*math.tau/8 for i in range(8))]


def course(name, lower, upper, group, key, tone, edge=.025):
    r0, z0 = lower
    r1, z1 = upper
    return tapered(name, polygon(r0,z0), polygon(r1,z1), group, material(key,tone), edge)


def face_point(face, radius, z, t):
    points = polygon(radius,z)
    return points[face].lerp(points[(face+1)%8],t)


def wall_piece(name, side, bottom, top, span, group, key, tone, deep=.19):
    r0,z0 = bottom
    r1,z1 = top
    a,b = span
    lower = [face_point(side,r0,z0,a),face_point(side,r0,z0,b),
             face_point(side,r0-deep,z0,b),face_point(side,r0-deep,z0,a)]
    upper = [face_point(side,r1,z1,a),face_point(side,r1,z1,b),
             face_point(side,r1-deep,z1,b),face_point(side,r1-deep,z1,a)]
    return tapered(name, lower, upper, group, material(key,tone), .013)


def tower_foot(group):
    group = collection('Tower · battered piers and ashlar base', group)
    course('Foundation · bottom key', (2.11,SUMMIT_Z-.35), (2.11,SUMMIT_Z+.10), group, 'mortar', 1, .033)
    course('Foundation · sloped toe course', (2.13,SUMMIT_Z+.03), (2.04,5.59), group, 'limestone', 1, .024)
    x,y = TOWER_XY
    slab('Entry · projecting threshold', rectangle(x,y-1.70,1.48,.39,.06), 5.39, 5.58, group, 'stone', 1)
    for i, angle in enumerate(math.radians(-112.5)+i*math.tau/8 for i in (0,2,3,5,6,7)):
        direction = Vector((math.cos(angle),math.sin(angle),0))
        pos = Vector((x,y,0))+direction*1.91
        bot = [(pos.x+p*direction.x-q*direction.y,pos.y+p*direction.y+q*direction.x,5.42)
               for p,q in ((-.33,-.20),(.29,-.20),(.32,.20),(-.33,.20))]
        top = [(pos.x+p*direction.x-q*direction.y,pos.y+p*direction.y+q*direction.x,7.08+.37*(i%2))
               for p,q in ((-.30,-.15),(.09,-.15),(.10,.15),(-.30,.15))]
        tapered('Masonry · battered corner pilaster', bot, top, group, material('limestone',i+1), .023)
        for z,r in ((5.66,2.22),(6.20,2.19),(6.75,2.12)):
            step = Vector((x,y,z))+direction*r
            stone = block('Masonry · keyed pier course', step, (.27,.44,.14), group, 'stone', i, .018)
            stone.rotation_euler.z = angle


def setback_room(group):
    group = collection('Tower · stone shaft and inset joinery', group)
    # The window bays have real wall returns and apertures through two stone stages.
    stages = ((1.95,5.59,1.86,7.40), (1.86,7.46,1.82,9.20))
    for level,(base,low,head,high) in enumerate(stages):
        for face in range(8):
            door = level == 0 and face == 0
            opening = face in ((0,1,3,5,7) if level else (0,2,4,6))
            if not opening:
                wall_piece('Shaft · dressed blind wall',face,(base,low),(head,high),(0,1),group,'limestone',face+level)
                for row in range(3):
                    z = low+.42*(row+1)
                    r = base+(head-base)*(z-low)/(high-low)
                    wall_piece('Shaft · blind wall course', face, (r+.018,z),(r+.018,z+.045),
                               (.08,.92), group, 'stone', face+row, .045)
                continue
            a,b = (.20,.80) if door else (.29,.71)
            sill = low if door else low+.39
            lintel = high-.22 if door else high-.31
            radius = lambda z: base+(head-base)*(z-low)/(high-low)
            for index, span in enumerate(((0,a),(b,1))):
                wall_piece('Shaft · opening pier',face,(base,low),(head,high),span,group,'limestone',face+index+level)
            if not door:
                wall_piece('Shaft · recessed window apron',face,(base,low),(radius(sill),sill),(a,b),
                           group,'stone',face+level)
            wall_piece('Shaft · monolithic lintel',face,(radius(lintel),lintel),(head,high),(a,b),
                       group,'limestone',1)
            for j in range(3):
                z = sill+(lintel-sill)*(.16+j*.33)
                r = radius(z)+.045
                for start,end in ((a-.09,a+.027),(b-.027,b+.09)):
                    wall_piece('Joinery · keyed jamb stone',face,(r,z-.065),(r,z+.065),(start,end),
                               group,'stone',face+j,.09)
            lower_r, upper_r = radius(sill),radius(lintel)
            leaf = [face_point(face,lower_r-.113,sill+.02,t) for t in (a,b)]
            leaf.extend(face_point(face,upper_r-.113,lintel-.018,t) for t in (b,a))
            panel('Access · recessed timber door' if door else 'Shaft · recessed storm window',
                  leaf,group,material('timber',0) if door else glazing(),.075 if door else .035,.007)
            for i in (0,1):
                beam('Joinery · metal jamb',leaf[i],leaf[3-i],.083,.081,group,'iron',bevel=.012)
            for left,right in ((0,1),(3,2)):
                beam('Joinery · casing crosspiece',leaf[left],leaf[right],.080,.076,group,'metal',bevel=.013)
            if door:
                shift = Vector((0,-.052,0))
                for n in range(1,6):
                    u = (n-.02)/6
                    a0,b0 = leaf[0].lerp(leaf[1],u),leaf[3].lerp(leaf[2],u)
                    beam('Entry door · slim joint',a0+shift,b0+shift,.017,.033,group,'iron',bevel=.004)
                for u in (.24,.76):
                    pin = leaf[0].lerp(leaf[1],u)+Vector((0,-.080,.61))
                    rod('Door · bronze pull',pin,pin+Vector((0,0,.24)),.034,group,'brass',8)
            else:
                beam('Window · central mullion',leaf[0].lerp(leaf[1],.51),leaf[3].lerp(leaf[2],.51),
                     .052,.046,group,'metal',bevel=.010)
                beam('Window · projecting drip sill',face_point(face,lower_r+.055,sill,a-.04),
                     face_point(face,lower_r+.055,sill,b+.04), .17,.090,group,'stone',bevel=.016)

    course('Shaft · mid-level shadow line', (1.95,7.365),(1.95,7.49),group,'stone',2)
    course('Shaft · upper cornice', (1.87,9.17),(2.00,9.32),group,'stone',1)
    course('Shaft · corbel spring', (2.00,9.32),(2.13,9.51),group,'limestone',3)
    for face in (2,3,5,6):
        for t in (.18,.82):
            a = face_point(face,1.91,8.76,t)
            b = face_point(face,2.35,9.78,t)
            beam('Shaft · outer gallery compression brace',a,b,.23,.23,group,'limestone',0,.028)
    # Service line emerges at ground level and reaches the lamp deck behind the tower.
    rear = face_point(4,1.98,5.82,.27)
    conduit('Shaft · isolated service riser', [(rear.x+1.0,rear.y,5.54),rear,
            (rear.x,rear.y,8.72),(rear.x-.29,rear.y-.11,9.48)],.105,group,'copper',True)
    for z in (6.04,6.82,7.72,8.53,9.18):
        block('Shaft · riser saddle',(rear.x,rear.y-.018,z),(.22,.23,.066),group,'iron',bevel=.019)


def observation_ring(group):
    group = collection('Tower · bracketed observation gallery',group)
    course('Gallery · stepped bearing',(2.10,9.50),(2.48,9.76),group,'limestone',1,.035)
    course('Gallery · charcoal fascia',(2.50,9.76),(2.56,9.90),group,'iron',0,.026)
    course('Gallery · fine weathered coping',(2.57,9.90),(2.57,10.03),group,'stone',3,.037)
    inner, outer = polygon(1.65,10.038),polygon(2.53,10.038)
    for i in range(8):
        j = (i+1)%8
        for k in range(7):
            a,b = (k+.020)/7,(k+.980)/7
            outline = [inner[i].lerp(inner[j],a),outer[i].lerp(outer[j],a),
                       outer[i].lerp(outer[j],b),inner[i].lerp(inner[j],b)]
            slab('Gallery · radial stone set',[p.xy for p in outline],9.998,10.045,group,'stone',k+i,.008)
        a,b = outer[i],outer[j]
        railing('Gallery · double rail',[a,b],group,height=.66,spacing=.58,key='iron')
        rod('Gallery · bronze pivot boot',a,a+Vector((0,0,.115)),.093,group,'brass',8)
        for t in (.20,.5,.80):
            p = a.lerp(b,t)
            beam('Gallery · open balustrade picket',p+Vector((0,0,.06)),p+Vector((0,0,.59)),
                 .034,.034,group,'metal',bevel=.006)


def lamp_room(group):
    group = collection('Tower · signal room and ventilated copper roof', group)
    course('Signal room · raised metal sill',(1.78,10.034),(1.78,10.29),group,'metal',1,.026)
    course('Signal room · crown beam',(1.78,12.04),(1.88,12.24),group,'iron',0,.025)
    for i in range(8):
        for start,end in ((.045,.482),(.518,.953)):
            pane = [face_point(i,1.75,z,t) for z,t in ((10.29,start),(10.29,end),(12.06,end),(12.06,start))]
            door = i == 5 and start > .5
            panel('Signal room · glazed access leaf' if door else 'Signal room · individually glazed pane',
                  pane,group,glazing(),.034,.006)
            if door:
                for t in (start+.026,end-.026):
                    beam('Signal room · access sash',face_point(i,1.785,10.28,t),face_point(i,1.785,12.04,t),
                         .054,.046,group,'iron',bevel=.009)
                pull = face_point(i,1.82,11.11,end-.105)
                rod('Signal room · door pull',pull,pull+Vector((0,0,.17)),.024,group,'brass',8)
        for t in (0,.50):
            a,b = face_point(i,1.77,10.21,t),face_point(i,1.77,12.15,t)
            beam('Signal room · cast wind mullion',a,b,.118,.104,group,'iron',bevel=.012)
            if t == 0:
                rod('Signal room · mullion collar',a,a+Vector((0,0,.21)),.088,group,'brass',8)
                rod('Signal room · mullion upper collar',b-Vector((0,0,.18)),b,.084,group,'metal',8)
        for z in (10.66,11.76):
            beam('Signal room · structural transom',face_point(i,1.766,z,0),face_point(i,1.766,z,1),
                 .071,.083,group,'metal',bevel=.012)
    x,y = TOWER_XY
    rod('Lamp · cast pedestal',(x,y,10.17),(x,y,11.03),.210,group,'iron',10)
    lathe('Lamp · bronze foot',(x,y,10.14),[(.43,0),(.43,.08),(.30,.15),(.22,.22)],group,'brass',12)
    amber = material('beacon')
    shader = amber.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Emission Color'].default_value = amber.diffuse_color
    shader.inputs['Emission Strength'].default_value = 1.18
    lathe('Lamp · caged amber element',(x,y,10.91),[(.33,0),(.42,.16),(.42,.60),(.33,.76)],group,'beacon',12)
    for z,r in ((10.92,.40),(11.12,.46),(11.48,.46),(11.64,.40)):
        lathe('Lamp · machined lens retaining ring',(x,y,z),[(r-.033,0),(r,0),(r,.055),(r-.033,.055)],
              group,'brass',16,closed=True)
    for i in range(6):
        angle = i*math.tau/6
        a = (x+.45*math.cos(angle),y+.45*math.sin(angle))
        rod('Lamp · exterior protective cage',(*a,10.94),(*a,11.61),.026,group,'iron',8)
    warm_light('Signal room · small warm source',(x,y-.38,11.29),(x,y-1.48,10.65),23,1.1,group)
    course('Canopy · drip edge',(1.98,12.18),(2.15,12.37),group,'iron',0,.033)
    lower, knee, upper = polygon(2.15,12.38),polygon(1.69,12.79),polygon(.43,13.42)
    for i in range(8):
        j = (i+1)%8
        for row,(bottom,top) in enumerate(((lower,knee),(knee,upper))):
            for k in range(3):
                a,b = (k+.014)/3,(k+.986)/3
                pan = [bottom[i].lerp(bottom[j],a),bottom[i].lerp(bottom[j],b),
                       top[i].lerp(top[j],b),top[i].lerp(top[j],a)]
                panel('Canopy · standing-seam copper sector',pan,group,material('copper',i+k+row),.084,.015)
                seam = Vector((0,0,.027))
                beam('Canopy · cap seam',bottom[i].lerp(bottom[j],a)+seam,top[i].lerp(top[j],a)+seam,
                     .043,.049,group,'copper',i+2,.009)
        beam('Canopy · radial ridge flashing',knee[i],upper[i],.095,.085,group,'metal',bevel=.015)
    course('Canopy · vent collar',(.46,13.36),(.45,13.53),group,'iron',1,.023)
    course('Canopy · solid rain cap',(.48,13.50),(.28,13.68),group,'copper',2,.021)


def watchtower(group):
    tower_foot(group)
    setback_room(group)
    observation_ring(group)
    lamp_room(group)
