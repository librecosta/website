"""Irregular limestone island, retaining masonry, paths and planting."""

import math
import random

from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import delaunay_2d_cdt

from fabric import (PALETTE, beam, block, faceted_rock, lathe, material, mesh,
                    octagon, quad, railing, slab)


SHORE = [(-10.0,-3.1),(-8.6,-6.0),(-6.6,-7.35),(-3.8,-8.1),(-1.3,-7.85),
         (1.05,-8.25),(3.7,-7.5),(5.1,-6.15),(7.1,-5.9),(8.9,-4.3),
         (9.45,-1.6),(10.2,1.15),(9.25,4.15),(7.8,5.83),(5.9,6.5),
         (3.7,7.45),(1.0,7.15),(-1.25,6.35),(-4.1,6.85),(-6.6,5.75),
         (-8.75,4.19),(-9.2,2.26),(-10.45,.09)]


def inside(x, y, coast):
    crossings = 0
    for (a,b),(c,d) in zip(coast,coast[1:]+coast[:1]):
        if (b > y) != (d > y) and x < a + (c-a)*(y-b)/(d-b):
            crossings += 1
    return crossings % 2 == 1


def elevation(x, y):
    def rise(a,b,sx,sy):
        return math.exp(-((x-a)/sx)**2-((y-b)/sy)**2)
    wave = .084*math.sin(.86*x+.68*y) + .065*math.cos(.71*y-.87*x)
    return (2.23 + wave + 1.92*rise(3.6,2.65,4.85,4.85)
            + .54*rise(-4.9,-.55,5.5,3.9) + 1.33*rise(-3.2,3.7,3.1,2.75)
            - .48*rise(-1.5,-7.15,4.9,2.05) - .39*rise(7.0,-3.8,2.4,3.9))


def dock_cut(x, y):
    # A shallow notch in the cliff receives the lower flight without burying its treads.
    lateral = min(1,max(0,(2.60-abs(x+1.55))/1.45))
    shore = min(1,max(0,(-y-6.50)/.74))
    return .63*lateral*shore


def landscape(group):
    rng = random.Random(32093)
    coast = [Vector((x,y)) for x,y in SHORE]
    contour = [v.lerp(coast[(i+1)%len(coast)], t) for i,v in enumerate(coast) for t in (0,.48)]
    count = len(contour)
    top = [p*.86 for p in contour]
    samples = top.copy()
    for i in range(-8,9):
        for j in range(-7,7):
            x,y = i*1.02+rng.uniform(-.31,.31), j*1.03+rng.uniform(-.32,.32)
            if inside(x,y,[(p.x*.955,p.y*.955) for p in top]):
                samples.append(Vector((x,y)))
    points, _, cap, _, _, _ = delaunay_2d_cdt(samples, [], [list(range(count))], 1, 1e-5)
    lookup = {tuple(v):i for i,v in enumerate(points)}
    edge = [lookup[tuple(p)] for p in top]
    verts = [(v.x,v.y,elevation(v.x,v.y)-dock_cut(v.x,v.y)) for v in points]
    faces = list(cap)
    variants = ('grass','cliff','talus','shale')
    tags = [('grass', rng.randrange(6)) for _ in faces]
    upper = edge
    # The cliff flares at the pale strata and curls inward beneath the waterline.
    for ring,(scale, level, lift) in enumerate(((.97,.52,.90),(1.045,.32,.25),(1.01,.08,-.24),(.88,0,-1.35),(.70,0,-2.05))):
        lower = list(range(len(verts),len(verts)+count))
        for i,p in enumerate(contour):
            s = scale+rng.uniform(-.035,.035)
            z = lift+level*elevation(top[i].x,top[i].y)+rng.uniform(-.18,.18)
            x,y=p.x*s,p.y*s
            verts.append((x,y,z-dock_cut(x,y)))
        for i in range(count):
            j=(i+1)%count
            if (i+ring)%2:
                faces.extend(((upper[i],lower[i],lower[j]),(upper[i],lower[j],upper[j])))
            else:
                faces.extend(((upper[i],lower[i],upper[j]),(upper[j],lower[i],lower[j])))
            key = 'talus' if ring == 1 else 'shale' if ring >=3 else 'cliff'
            tags.extend((key,rng.randrange(len(PALETTE[key]))) for _ in range(2))
        upper = lower
    hub = len(verts)
    verts.append((-.39,.18,-2.31))
    for i in range(count):
        faces.append((upper[(i+1)%count],upper[i],hub))
        tags.append(('shale',i%4))
    slots = [(key,i) for key in variants for i in range(len(PALETTE[key]))]
    obj = mesh('Folded limestone · closed bedrock and turf',verts,faces,group,
               [material(*slot) for slot in slots],[slots.index(tag) for tag in tags])
    tree=BVHTree.FromPolygons([Vector(v) for v in verts],faces)

    def height(x,y):
        p = tree.ray_cast(Vector((x,y,14)), Vector((0,0,-1)))[0]
        return p.z if p is not None else -.78

    return obj,height


def foundation(name, outline, top, ground, group, key='stone'):
    base = min(ground(x,y) for x,y in outline)-.23
    slab(name+' · retaining body',outline,min(base,top-.38),top-.13,group,key,2)
    slab(name+' · dressed coping',outline,top-.14,top,group,key,1,.045)
    # Ashlar appears at the exposed perimeter while the structural body stays watertight.
    for i, (a,b) in enumerate(zip(outline, outline[1:]+outline[:1])):
        a,b=Vector(a),Vector(b)
        direction=(b-a).normalized()
        outward=Vector((direction.y,-direction.x))
        rows=3
        cols=max(1,math.ceil((b-a).length/.77))
        for row in range(rows):
            z=top-.24-row*.28
            for col in range(cols):
                pitch=(b-a).length/cols
                offset=(col+.5)*pitch + (.17*pitch if row%2 and col<cols-1 else 0)
                p=a+direction*offset+outward*.018
                if z-.1 <= ground(*p):
                    continue
                piece=block(name+' · ashlar',(p.x,p.y,z),(pitch*.95,.12,.249),group,key,(i+row+col)%5,.021)
                piece.rotation_euler.z=math.atan2(direction.y,direction.x)


def staircase(name, start, end, width, steps, ground, group, *, rails=True):
    a,b=Vector(start),Vector(end)
    axis=Vector((b.x-a.x,b.y-a.y,0)).normalized()
    side=Vector((-axis.y,axis.x,0))
    depth=Vector((b.x-a.x,b.y-a.y)).length/steps
    for i in range(steps):
        p=a.lerp(b,(i+.5)/steps)
        top=a.z+(b.z-a.z)*(i+1)/steps
        base=min(top-.22, *(ground(*(p+side*w).xy)-.12 for w in (-width*.43,0,width*.43)))
        shoulder=top-.058
        piece=block(name+' · structural riser',(p.x,p.y,(shoulder+base)/2),
                    (depth+.006,width,shoulder-base),group,'stone',i+2,.025)
        piece.rotation_euler.z=math.atan2(axis.y,axis.x)
        tile=block(name+' · overhanging tread',(p.x,p.y,top-.037),(depth+.053,width+.064,.072),group,'stone',i,.015)
        tile.rotation_euler.z=piece.rotation_euler.z
    if rails:
        for sign in (-1,1):
            lip=side*(width*.46*sign)
            railing(name+' · edge rail',[a+lip,b+lip],group,spacing=.64,height=.69,key='frame')


def pavers(name, start, end, width, ground, group):
    a,b=Vector(start),Vector(end)
    axis=(b-a).normalized()
    pitch=(b-a).length/max(1,round((b-a).length/.42))
    for i in range(round((b-a).length/pitch)):
        p=a+axis*(i+.5)*pitch
        z=ground(*p)
        tile=block(name,(p.x,p.y,z+.025),(pitch-.028,width,.17),group,'stone',i,.034)
        tile.rotation_euler.z=math.atan2(axis.y,axis.x)


def vegetation(ground, group, rocks):
    rng=random.Random(355)
    pines=[(-7.5,3.15,1.95),(-7.15,4.47,1.50),(-5.85,5.02,2.22),(-5.33,4.81,1.33),
           (-.9,5.27,2.25),(-.23,5.82,1.74),(1.05,6.23,1.92),(6.9,4.86,2.12),
           (7.55,3.81,1.51),(7.75,.78,1.54),(8.23,1.65,1.37),(-7.4,-.55,2.13)]
    for i,(x,y,h) in enumerate(pines):
        z=ground(x,y)
        lathe('Wind-shaped fir · trunk',(x,y,z-.06),[(.12,0),(.085,h*.8)],group,'bark',7)
        for j in range(3):
            r=h*(.27-.048*j)
            profile=[(.10*r,0),(.94*r,.11*h),(r,.15*h),(.46*r,.35*h),(.015,.48*h)]
            lathe('Wind-shaped fir · whorl',(x+.055*j,y+.052*j,z+h*(.24+j*.218)),
                  profile,group,'pine',7+(i+j)%2,vary=True)
    for i,(x,y,r) in enumerate([(-6.75,-4.5,.64),(-7.55,-3.12,.75),(6.76,-4.38,.46),
                               (7.28,-3.66,.56),(6.56,-.38,.56),(-1.9,5.1,.48)]):
        z=ground(x,y)
        lathe('Wind-pruned olive · trunk',(x,y,z-.05),[(.095,0),(.058,r*1.7)],group,'bark',6)
        for j in range(4):
            a=j*2.4
            faceted_rock('Wind-pruned olive · foliage',(x+.31*r*math.cos(a),y+.36*r*math.sin(a),z+r*(1.38+j*.22)),
                         (r*(.58+.10*(j%2)),r*.68,r*.61),group,'leaves',100+i*11+j)
    # Deliberate colonies on the edges of each terrace, clear of steps and work areas.
    for i,(x,y) in enumerate([(-8.01,-2.2),(-7.78,-3.91),(-6.9,-5.04),(-4.19,-5.35),
             (-2.71,-5.63),(-3.3,-6.11),(2.67,-5.3),(5.84,-3.88),(6.05,-2.66),
             (6.8,.29),(6.31,4.28),(7.65,2.71),(5.41,5.09),(-.4,5.13),(-.81,4.73),(-5.41,4.95)]):
        for j in range(5):
            a,b=x+rng.uniform(-.37,.37),y+rng.uniform(-.27,.27)
            z=ground(a,b)
            size=rng.uniform(.09,.195)
            faceted_rock('Low juniper · edge colony',(a,b,z-.019),(size,size*.82,size*.89),group,'leaves',i*5+j)
        if i%2==0:
            faceted_rock('Moss-bound boulder',(x+.30,y+.19,ground(x+.3,y+.19)-.075),(.52,.38,.43),rocks,'cliff',i+320)
    for i,(x,y) in enumerate(SHORE):
        if i in {3,4,5,6}:
            continue
        a,b=x*.91,y*.91
        z=ground(a,b)
        size=rng.uniform(.37,.91)
        faceted_rock('Dislodged limestone block',(a,b,z-.12),(.96*size,size*.77,size*1.03),rocks,'cliff',i+71)
        if i%3==0:
            faceted_rock('Shore spall',(a+.45,b+.40,ground(a+.45,b+.4)-.06),(.29,.235,.26),rocks,'talus',i+190)
    for i,(x,y,rx,ry) in enumerate(((7.48,-5.38,1.10,.39),(8.12,-4.58,.74,.49),
                (8.92,-1.20,.79,.41),(8.87,3.94,1.16,.49),(1.75,6.34,.93,.34),
                (-8.07,-4.84,.89,.50),(-8.86,-3.90,.76,.36),(-9.14,2.38,.78,.32))):
        zz=ground(x,y)
        faceted_rock('Exposed limestone · cleaved tabular ledge',(x,y,zz-.25),(rx,ry,.41),rocks,'talus',513+i)
        faceted_rock('Exposed limestone · darker footing',(x+.11,y-.08,zz-.48),(rx*.93,ry*.94,.29),rocks,'shale',540+i)
        for j in range(3):
            dx=(j-1)*rx*.37
            sprig=seed_sprig(x+dx,y+.17,ground(x+dx,y+.17),i*3+j,group)
            sprig.rotation_euler.z=rng.uniform(-.65,.65)


def seed_sprig(x,y,z,seed,group):
    height=.15+(.052*(seed%4))
    return lathe('Rock crevice · compact thyme',(x,y,z-.02),[(.07,0),(.153,height*.5),(.075,height)],
                 group,'leaves',5,vary=True)


def landing(ground, group):
    x=-1.55
    # Landfall is sunk into the ledge, with bearing posts under the over-water half.
    for i in range(9):
        y=-9.57+i*.18
        block('Landing · oak decking',(x,y,.957),(2.65,.172,.135),group,'plank',i,.022)
    for side in (-1,1):
        px=x+side*1.04
        beam('Landing · longitudinal stringer',(px,-9.65,.82),(px,-8.04,.82),.19,.19,group,'timber')
        for y in (-9.44,-8.71,-8.15):
            zz=min(.37,ground(px,y)-.06)
            lathe('Landing · driven post',(px,y,zz),[(.112,0),(.113,1.23-zz)],group,'timber',8)
            lathe('Landing · bronze cap',(px,y,1.22),[(.143,0),(.143,.065),(.103,.104)],group,'bronze',8)
        beam('Landing · diagonal brace',(px,-9.43,-.35),(px,-8.13,.79),.15,.16,group,'timber')
    for y in (-9.15,-8.5):
        lathe('Landing · mooring cleat',(x-1.09,y,1.03),[(.115,0),(.078,.16),(.12,.21)],group,'iron',8)
    staircase('Shore ascent',(x,-8.04,1.025),(x,-6.90,2.24),1.28,6,ground,group)
    staircase('Upper approach',(x,-6.89,2.24),(x,-5.12,2.68),1.28,7,ground,group)
    foundation('Junction landing',quad((x,-4.88),1.75,.49),2.67,ground,group)
    staircase('Workshop approach',(-2.45,-4.88,2.66),(-3.3,-3.02,3.14),1.16,5,ground,group)
    staircase('Courtyard approach',(-.68,-4.8,2.66),(.62,-4.41,3.165),1.04,4,ground,group,rails=False)
