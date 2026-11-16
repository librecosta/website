"""Faulted sandstone shelves, a lined service shaft and connected access routes."""

import math
import random

import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from fabric import (PALETTE, beam, block, collection, faceted_rock, lantern, lathe, material,
                    mesh, railing, rectangle, rod, slab)


SHAFT = (-4.65, -2.65)
SECTORS = 32


def shelf(name, center, radius, height, group, seed, shaft=False):
    """A closed rock body with stratified cliff edges and an optional recessed inner wall."""
    rng = random.Random(seed)
    x, y = center
    points = []
    for i in range(SECTORS):
        angle = (i + rng.uniform(-.19, .19)) * math.tau / SECTORS
        u, v = math.cos(angle), math.sin(angle)
        rx = radius[0] if u < 0 else radius[1]
        ry = radius[2] if v < 0 else radius[3]
        jag = .96 + .085 * math.sin(angle * 5 + .7) + rng.uniform(-.075, .075)
        points.append((u, v, rx * u * jag, ry * v * jag, rng.uniform(-1, 1)))

    def upper_z(wx, wy):
        if shaft:
            return height + .10 * math.sin(wx * .8) - .055 * max(0, -wy - 2.5)
        return height + .18 * math.cos(wx + wy * .4)

    verts, loops = [], []

    def contour(f):
        loops.append(len(verts))
        verts.extend(f(u, v, dx, dy, noise) for u, v, dx, dy, noise in points)

    if shaft:
        contour(lambda u, v, dx, dy, n: (x + 1.03*u, y + 1.03*v, -.27 + n * .055))
        contour(lambda u, v, dx, dy, n: (x + 1.11*u, y + 1.11*v, 1.42 + n * .12))
        contour(lambda u, v, dx, dy, n: (x + 1.24*u, y + 1.24*v, height + n * .055))
    else:
        contour(lambda u, v, dx, dy, n: (x + dx*.17, y + dy*.17, upper_z(x, y) + n * .13))
    contour(lambda u, v, dx, dy, n: (x + dx*.56, y + dy*.57, upper_z(x+dx*.56, y+dy*.57) + n*.19))
    contour(lambda u, v, dx, dy, n: (x + dx*.82, y + dy*.83, height - .23 + n*.39))
    contour(lambda u, v, dx, dy, n: (x + dx, y + dy, height - .91 + n*.38))
    contour(lambda u, v, dx, dy, n: (x + dx*1.05, y + dy*1.065, height - 1.89 + n*.51))
    contour(lambda u, v, dx, dy, n: (x + dx*.91 + .24, y + dy*.92 - .25, height - 3.04 + n*.39))
    contour(lambda u, v, dx, dy, n: (x + dx*.81 + .29, y + dy*.84 - .22, height - 3.59 + n*.23))
    contour(lambda u, v, dx, dy, n: (x + dx*.53 + .69, y + dy*.58 - .38, height - 5.06 + n*.34))
    contour(lambda u, v, dx, dy, n: (x + dx*.25 + .47, y + dy*.29 - .34, height - 5.43 + n*.18))
    if shaft:
        # The landing route follows a cut in the cliff shoulder before its first switchback.
        for i,(vx,vy,vz) in enumerate(verts):
            if vy < -4.12 and -10.18 < vx < -7.76 and vz > .6:
                cut=math.exp(-((vx+8.91)/.94)**4-((vy+5.02)/.76)**2)
                verts[i]=(vx,vy+.19*cut,vz-.48*cut)

    by_band = ((['shale', 'cliff'] if shaft else []) +
               ['grass', 'grass', 'cliff', 'cliff', 'cliff', 'talus', 'shale', 'shale'])
    keys = ('cliff', 'shale', 'talus', 'grass')
    mats = [material(key, i) for key in keys for i in range(len(PALETTE[key]))]
    first = {key: sum(len(PALETTE[k]) for k in keys[:i]) for i, key in enumerate(keys)}

    def tone(key):
        return first[key] + rng.randrange(len(PALETTE[key]))

    faces = [tuple(range(SECTORS))]
    colors = [tone('shale' if shaft else 'grass')]
    for band, (lower, upper) in enumerate(zip(loops, loops[1:])):
        key = by_band[band]
        for i in range(SECTORS):
            j = (i + 1) % SECTORS
            a, b, c, d = lower+i, lower+j, upper+i, upper+j
            triangles = ((a,b,d),(a,d,c)) if rng.random() < .52 else ((a,b,c),(b,d,c))
            faces.extend(triangles)
            colors.extend(tone(key if key != 'grass' or rng.random() > .13 else 'cliff') for _ in triangles)
    faces.append(tuple(reversed(range(loops[-1], loops[-1]+SECTORS))))
    colors.append(tone('shale'))
    obj = mesh(name, verts, faces, group, mats, colors)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    return BVHTree.FromPolygons(verts, faces)


def ground_at(tree, x, y):
    point = tree.ray_cast(Vector((x,y,15)), Vector((0,0,-1)))[0]
    return point.z if point is not None else None


def footings(name, tree, x, y, top, size, group):
    width, depth = size
    z = ground_at(tree, x, y)
    if z is None:
        raise ValueError(f'{name} misses the bedrock at {(x, y)}')
    slab(name+' · embedded footing', rectangle(x,y,width+.23,depth+.23), z-.31, top-.13, group, 'stone')
    slab(name+' · dressed bearing', rectangle(x,y,width,depth), top-.13, top, group, 'ivory', 2)


def shaft(group):
    """Shaft lining and a maintenance lift run behind the retaining rim."""
    x,y = SHAFT
    lathe('Shaft · stone coping', (x,y,3.71), [(1.135,0),(1.31,0),(1.40,.11),(1.40,.22),
                                               (1.30,.30),(1.135,.30)], group, 'stone', 16, closed=True)
    lathe('Shaft · iron liner flange', (x,y,3.44), [(1.10,0),(1.222,0),(1.23,.22),(1.10,.22)],
          group, 'iron', 16, closed=True)
    lathe('Shaft · lower bolt flange', (x,y,.72), [(1.0,0),(1.17,0),(1.17,.14),(1.0,.14)],
          group, 'iron', 16, closed=True)
    for i in range(12):
        angle = (i+.5)*math.tau/12
        u,v = math.cos(angle),math.sin(angle)
        beam('Shaft · wall rib', (x+u*1.022,y+v*1.022,.65), (x+u*1.106,y+v*1.106,3.69),
             .085,.085,group,'steel')
        if i in {0,2,4,6,8,10}:
            z=2.40 if i%4 else 1.83
            block('Shaft · service lamp', (x+u*.99,y+v*.99,z), (.10,.10,.19),group,'amber',bevel=.014)
    slab('Shaft · lowered lift floor', rectangle(x+.16,y+.22,1.14,1.18,.13), 1.09, 1.21, group, 'steel')
    for dx in (-.42,.42):
        rod('Lift · guide column', (x+dx,y+.66,.18), (x+dx,y+.66,4.22), .052,group,'zinc')
        block('Lift · guide bearing', (x+dx,y+.66,1.28),(.18,.18,.28),group,'iron')
        for dy in (-.33,.57):
            beam('Lift · steel stanchion', (x+dx,y+dy,1.21), (x+dx,y+dy,1.68), .062,.062,group,'iron')
        beam('Lift · handrail', (x+dx,y-.33,1.67), (x+dx,y+.57,1.67), .058,.058,group,'steel')
    for i in range(9):
        block('Lift · anti-slip tread', (x-.33+i*.119,y+.20,1.224),(.061,1.10,.029),group,'zinc',i, .004)
    for i in range(9):
        angle=math.radians(205+i*21)
        j=math.radians(205+(i+1)*21)
        a=Vector((x+1.52*math.cos(angle),y+1.52*math.sin(angle),4.00))
        b=Vector((x+1.52*math.cos(j),y+1.52*math.sin(j),4.00))
        railing('Shaft coping · fall barrier', [a,b], group,spacing=1.0,height=.52,key='steel')
    for dx in (-.64,.64):
        beam('Lift head · gantry leg', (x+dx,y+.95,3.87), (x+dx,y+.95,4.98), .106,.15,group,'iron')
        beam('Lift head · rear brace', (x+dx,y+1.70,3.81), (x+dx,y+.95,4.91), .075,.087,group,'steel')
    beam('Lift head · crossbeam', (x-.84,y+.95,4.99), (x+.84,y+.95,4.99), .17,.18,group,'iron')
    block('Lift head · winch case', (x,y+.95,4.94), (.37,.36,.29),group,'zinc',2,.035)
    lathe('Lift head · counterweight pulley', (x+.22,y+.95,4.79), [(.17,0),(.17,.095)],group,'bronze',12,(1,0,0))
    rod('Lift head · cable', (x+.24,y+.73,4.78), (x+.24,y+.73,1.25), .021,group,'iron')


def stair(name, start, end, width, count, group, key='stone'):
    a,b = Vector(start),Vector(end)
    step=(b-a)/count
    horizontal=Vector((step.x,step.y,0))
    length=horizontal.length
    arrow=horizontal.normalized()
    side=Vector((-arrow.y,arrow.x,0))
    for i in range(count):
        p=a+step*(i+.5)
        tread=block(name+' · tread', p-Vector((0,0,.09)), (width,length+.035,.20),group,key,i,.016)
        tread.rotation_euler.z=math.atan2(arrow.y,arrow.x)-math.pi/2
        lip=block(name+' · tread nosing', p-arrow*(length*.43)+Vector((0,0,.015)),
                  (width+.045,.075,.034),group,'zinc' if key=='steel' else 'ivory',i,.008)
        lip.rotation_euler.z=tread.rotation_euler.z
    for offset in (-width*.45,width*.45):
        lower, upper = a+side*offset,b+side*offset
        beam(name+' · stringer', lower-Vector((0,0,.16)),upper-Vector((0,0,.16)),.132,.20,group,'iron')
        railing(name+' · guard',[lower,upper],group,spacing=.72,height=.51,key='steel')


def paving(name, tree, route, group):
    for i,(a,b) in enumerate(zip(route,route[1:])):
        start,finish=Vector((*a,0)),Vector((*b,0))
        count=max(2,math.ceil((finish-start).length/.34))
        heading=math.atan2(b[1]-a[1],b[0]-a[0])
        for j in range(count):
            p=start.lerp(finish,j/count)
            z=ground_at(tree,p.x,p.y)
            if z is None:
                raise ValueError(f'{name} crosses air at {(p.x,p.y)}')
            block(name+' · paving',(p.x,p.y,z+.039),(.31,.43,.105),group,'stone',i+j,.016).rotation_euler.z=heading


def access(main, terminal, group):
    dock = collection('Cliff landing and the lower traverse',group)
    x,y,z=-8.98,-6.32,.70
    for dx in (-.64,.64):
        beam('Landing · cantilever beam',(x+dx,y-.79,z-.13),(x+dx,y+1.92,z-.13),.18,.23,dock,'iron')
        beam('Landing · cliff brace',(x+dx,y-.74,z-.23),(x+dx,y+1.83,z-1.05),.14,.16,dock,'steel')
    for i in range(13):
        block('Landing · deck plank',(x,y+i*.138-.82,z),(1.67,.13,.11),dock,'plank',i,.012)
    railing('Landing · west rail',[(x-.77,y-.75,z+.06),(x-.77,y+.90,z+.06)],dock,key='iron')
    lantern('Landing · bollard lamp',(x+.63,y-.70,z+.06),dock)
    # A paved switchback reaches the control deck, with the lower and upper landings linked.
    stair('Rock stairs · lower flight',(-9.60,y+.72,z+.06),(-8.20,-4.94,3.47),1.0,14,dock)
    footings('Rock stairs · elbow pier',main,-8.20,-4.78,3.46,(1.10,.72),dock)
    slab('Rock stairs · elbow cap',rectangle(-8.20,-4.82,1.12,.60),3.41,3.47,dock,'stone',2)
    stair('Rock stairs · upper flight',(-8.17,-4.67,3.47),(-7.90,-3.65,3.96),.89,6,dock)
    slab('Rock stairs · control landing',rectangle(-7.87,-3.62,1.23,.52),3.66,3.96,dock,'stone')
    for i in range(8):
        p=Vector((-7.75,-2.36,0)).lerp(Vector((-6.07,-3.35,0)),i/7)
        base=ground_at(main,p.x,p.y)
        if base is not None:
            block('Shaft approach · paving',(p.x,p.y,base+.043),(.29,.48,.095),dock,'stone',i)

    crossing=collection('Lower inspection bridge and terminal stairs',group)
    a,b=-2.95,5.43
    y=1.99
    start,end=3.82,2.82
    for x,z,tree in ((a,start,main),(b,end,terminal)):
        footings('Lower crossing pier',tree,x,y,z-.08,(.85,1.27),crossing)
    for side in (-.45,.45):
        beam('Inspection bridge · side stringer',(a,y+side,start-.17),(b,y+side,end-.17),
             .13,.20,crossing,'steel')
        railing('Inspection bridge · open guard',[(a,y+side,start),(b,y+side,end)],
                crossing,spacing=.64,height=.47,key='iron')
    for i in range(52):
        t=i/51
        x,z=a+(b-a)*t,start+(end-start)*t
        block('Inspection bridge · grooved steel tread',(x,y,z-.045),(.153,1.0,.11),crossing,'zinc',i,.007)
        if i%4==0:
            beam('Inspection bridge · under-deck crossmember',(x,y-.52,z-.22),(x,y+.52,z-.22),
                 .082,.12,crossing,'iron')
    for sign in (-1,1):
        beam('Inspection bridge · angled end prop',(a+.09,y+sign*.40,2.83),(a+1.15,y+sign*.43,start-.39),
             .11,.15,crossing,'iron')
        beam('Inspection bridge · angled end prop',(b-.06,y+sign*.40,1.58),(b-1.13,y+sign*.43,end-.18),
             .11,.15,crossing,'iron')
    stair('Terminal · lower walkway stair',(b+.08,y,2.82),(6.38,1.93,2.37),.86,5,crossing,'steel')
    paving('Terminal · maintenance approach',terminal,[(6.40,1.90),(6.38,.54),(6.53,-.71),(7.10,-1.18)],crossing)
    paving('Launch · rear maintenance traverse',main,[(-3.04,2.10),(-3.86,1.82),(-5.41,1.45),(-6.78,1.75)],crossing)


def pine(name, x, y, z, height, group, seed):
    lathe(name+' · trunk',(x,y,z),[(.083,0),(.047,height*.63)],group,'bark',7)
    for layer,(start, radius) in enumerate(((.22,.31),(.43,.26),(.62,.19))):
        crown=lathe(name+' · tier',(x,y,z+height*start),[(height*radius,0),
                    (height*radius*.79,height*.14),(.02,height*.42)],group,'pine',7)
        crown.rotation_euler.z=layer*.37+seed*.73
        for face in crown.data.polygons:
            face.material_index=(face.index+layer+seed)%len(PALETTE['pine'])


def plants(main, terminal, group):
    points = [
        (main,-10.44,.95,1.0),(main,-9.75,2.72,1.14),(main,-9.1,3.82,.78),
        (main,-6.90,3.15,.93),(main,-5.96,2.64,.68),(main,-4.02,2.27,1.13),
        (main,-2.51,2.64,.82),(main,-2.13,-1.23,.76),(main,-3.90,-4.52,.72),
        (terminal,7.52,2.64,.95),(terminal,8.35,2.55,1.11),(terminal,9.51,1.29,.72),
        (terminal,6.36,-.98,.61),(terminal,8.52,-1.08,.66),
    ]
    for i,(tree,x,y,height) in enumerate(points):
        z=ground_at(tree,x,y)
        if z is not None:
            pine('Wind-pruned cypress',x,y,z-.07,height,group,i)
    rng=random.Random(4873)
    for tree,x,y,h in points:
        for i in range(4):
            u,v=x+rng.uniform(-.56,.56),y+rng.uniform(-.48,.48)
            z=ground_at(tree,u,v)
            if z is not None:
                size=rng.uniform(.13,.29)
                faceted_rock('Native scrub', (u,v,z-.035), (size,size*.85,size*h),group,'leaves',rng.randrange(999))


def landscape(group):
    main = shelf('Launch shoulder · fractured sandstone and service shaft', SHAFT,
                 (7.0,3.84,2.42,7.1),3.72,group,149,shaft=True)
    terminal = shelf('Terminal shelf · lowered fault block', (7.35,.43),
                     (3.56,3.72,3.06,3.19),2.25,group,237)
    mid = shelf('Mid-span buttress · exposed fault pillar', (1.66,.29),
                (1.14,1.21,.94,1.02),1.55,group,617)
    strata = collection('Displaced strata and scree',group)
    for i,(x,y,z,sx,sy,sz,key) in enumerate((
        (-11.32,-2.80,-.64,1.18,.70,1.15,'shale'),(-10.37,-4.48,.14,.80,.81,.92,'cliff'),
        (-9.95,-4.48,.53,.71,.68,.62,'talus'),(-7.33,-4.76,.13,1.07,.68,.63,'cliff'),
        (-6.24,-4.86,1.24,.76,.59,.53,'cliff'),(-5.35,-5.13,-.85,1.07,.72,.63,'shale'),
        (-3.83,-4.73,1.21,.80,.66,.59,'talus'),(-3.18,-3.83,-.65,.93,.62,.68,'shale'),
        (-1.23,-1.70,-.57,.65,.53,1.20,'cliff'),(-.37,-.77,-2.2,.61,.78,.50,'shale'),
        (2.21,-.64,-1.7,.69,.71,.64,'cliff'),(3.78,1.73,-.85,.61,.54,.46,'shale'),
        (5.66,-1.80,-1.66,.92,.76,.67,'shale'),(6.93,-2.25,.40,.90,.65,.59,'cliff'),
        (8.37,-2.47,-.37,.76,.55,.54,'talus'),(9.42,-1.66,-1.06,.94,.78,.65,'shale'),
        (10.67,-.89,.33,.68,.71,.69,'cliff'),(10.42,1.98,-.68,.64,.76,.77,'cliff'),
        (-10.23,3.8,-.34,1.14,.68,.65,'cliff'),(-5.44,4.46,.87,.92,.71,.78,'talus'),
    )):
        faceted_rock('Displaced strata', (x,y,z), (sx,sy,sz),strata,key,811+i)
    for i,(x,y,z,s) in enumerate(((-12.49,-2.95,-1.93,.50),(-11.93,-4.03,-1.76,.37),
                                   (11.12,-1.52,-1.25,.45),(11.69,-1.09,-1.55,.35),
                                   (2.80,-1.40,-2.10,.45),(.06,-1.49,-1.38,.34))):
        faceted_rock('Detached fault scree',(x,y,z),(s,s*.78,s*.74),strata,'shale',50+i)
    for i,(x,y,z,sx,sy,s) in enumerate((
        (-10.23,-4.40,1.39,.72,.52,.29),(-9.90,-4.11,2.32,.95,.38,.21),
        (-6.24,-4.78,2.05,.87,.51,.30),(-5.41,-4.91,-.09,.88,.47,.25),
        (-4.25,-4.65,1.79,1.20,.46,.24),(-3.56,-4.06,.72,.95,.49,.32),
        (5.94,-1.81,.85,.72,.51,.30),(6.78,-2.26,1.17,.91,.58,.25),
        (8.14,-2.36,.59,.81,.51,.23),(8.92,-2.30,-.08,.99,.50,.30),
        (9.30,-1.82,1.0,.88,.44,.26),(-3.50,2.73,1.75,.83,.51,.30),
    )):
        faceted_rock('Horizontal fault ledge', (x,y,z),(sx,sy,s),strata,'talus' if i%3 else 'cliff',443+i)
    return main, terminal, mid
