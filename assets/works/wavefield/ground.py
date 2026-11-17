"""Closed coastal geology and connected maintenance walks for Echo Cape."""

import math
import random

from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import delaunay_2d_cdt

from fabric import rectangle, slab
from geometry import beam, block, collection, faceted_rock, lantern, material, mesh, railing
from terrain import stairs, terraces


WEST = (-9.54, -3.64, -6.83, 4.70, 4.42)
EAST = (7.08, -3.39, 10.03, 4.33, 4.30)
WALKS = (
    ((-7.44, -5.45, 3.08), (-5.73, -5.26, 3.08)),
    ((-5.73, -5.26, 3.08), (-1.17, -5.84, 2.52)),
    ((-1.17, -5.84, 2.52), (3.06, -5.98, 2.52)),
    ((4.45, -5.98, 2.52), (7.91, -5.13, 3.18)),
)
STAIRS = (
    ('West gantry stair', (-8.15, -5.03, 3.08), (-8.15, -3.64, 4.42), 1.27, 8),
    ('East gantry stair', (8.61, -4.70, 3.18), (8.61, -3.39, 4.30), 1.29, 7),
    ('Quay to shore stair', (3.75, -8.91, .62), (3.75, -7.45, 1.43), 1.23, 6),
    ('Shore to valley stair', (3.75, -7.45, 1.43), (3.75, -6.67, 2.52), 1.23, 6),
)


def hill(x, y, cx, cy, sx, sy):
    return math.exp(-((x - cx) / sx) ** 2 - ((y - cy) / sy) ** 2)


def relief(x, y):
    west = 2.57 * hill(x, y, -7.7, 1.36, 4.60, 4.1)
    east = 2.45 * hill(x, y, 8.0, .03, 4.05, 4.92)
    back = .92 * hill(x, y, -.40, 5.65, 5.93, 1.85)
    cut = 1.08 * hill(x, y, -.50, .52, 3.37, 4.6)
    rubble = .54*hill(x,y,1.4,-3.2,2.46,1.12) + .42*hill(x,y,-3.83,1.2,1.33,3.18)
    bank = .24 * math.sin(x * .65 + y * .71) + .19 * math.cos(x * .79 - y * 1.54)
    return 1.30 + west + east + back - cut + bank + rubble


def coast(group):
    count = 48
    rng = random.Random(4225)
    outline, rim = [], []
    for i in range(count):
        a = math.tau * i / count
        notch = .074 * math.exp(-((a - 4.87) / .32) ** 2)
        ledge = .154 * math.exp(-((a - 5.72) / .34) ** 2)
        radius = 1 + .072 * math.sin(3 * a + .30) + .053 * math.cos(5 * a) - notch + ledge
        spread = radius + rng.uniform(-.026, .026)
        x = 12.15 * spread * math.cos(a) + .29 * math.sin(a)
        y = 8.14 * spread * math.sin(a) + .34 * math.cos(a)
        bank = .25*math.cos(2*a-.40) + .19*math.sin(5*a) + rng.uniform(-.13,.13)
        rim.append((x,y,.39*relief(x,y)+.42+bank))
        outline.append(a)

    def in_rim(x,y):
        return sum((ay>y) != (by>y) and x < (bx-ax)*(y-ay)/(by-ay)+ax
                   for (ax,ay,_),(bx,by,_) in zip(rim,rim[1:]+rim[:1])) % 2

    points = list(rim)
    # The basin follows irregular field sampling, while its exact shoreline is
    # constrained to the same polyline used by the layered cliff shell.
    for row in range(-7,8):
        for col in range(-11,12):
            x,y = col*1.08+rng.uniform(-.37,.37),row*1.04+rng.uniform(-.36,.36)
            if in_rim(x,y) and min(math.hypot(x-a,y-b) for a,b,_ in rim) > .40:
                points.append((x,y,relief(x,y)+rng.uniform(-.20,.20)))
    xy = [Vector(p[:2]) for p in points]
    _, _, mapped_faces, original, _, _ = delaunay_2d_cdt(xy,[],[list(range(count))],1,1e-6,True)

    faces, kinds = [], []
    palette = tuple(material(key, i) for key, colors in
                    (('grass',5),('cliff',6),('shale',4),('talus',4)) for i in range(colors))

    def face(corners, ring):
        a, b, c = (Vector(points[index]) for index in corners)
        normal = (b - a).cross(c - a).normalized()
        if ring == 0:
            x,y,_ = (a+b+c)/3
            dry = math.sin(x*.62-y*.63) + .53*math.cos(x*.27+y*.89) + .24*math.sin(y*2.3)
            if normal.z > .64 and dry < .44:
                color = rng.randrange(5)
            elif normal.z < .62 or dry > .98:
                color = rng.choice((6,7,8,10,11,12,13))
            else:
                color = rng.choice((5,7,8,9,15,16,17))
        else:
            color = rng.choice({
                1: (5, 7, 9, 10, 15, 16, 17, 18),
                2: (6, 7, 8, 15, 16, 17),
                3: (5, 7, 9, 11, 12, 13),
                4: (6, 8, 10, 11, 12, 14),
                5: (11, 12, 13, 14),
                6: (11, 12, 13, 14),
            }[ring])
        faces.append(corners)
        kinds.append(color)

    for tri in mapped_faces:
        polygon = tuple(original[index][0] for index in tri)
        a,b,c = (xy[index] for index in polygon)
        face(polygon if (b-a).cross(c-a)>0 else polygon[::-1],0)
    first = 0
    for ring,(scale,z0,phase,skew) in enumerate(((1.035,.04,1.2,.13),(.968,-.44,1.5,-.16),
            (.996,-1.04,2.6,.03),(.856,-1.93,3.1,-.20),(.680,-2.27,4.2,-.25)),1):
        lower = len(points)
        for a,(x,y,_) in zip(outline,rim,strict=True):
            q = scale + .027*math.sin(5*a+phase)
            z = z0 + .18*math.sin(3*a+phase) + rng.uniform(-.12,.12)
            points.append((x*q+skew,y*q,z))
        for i in range(count):
            next_index = (i+1)%count
            a,b = first+i,first+next_index
            c,d = lower+next_index,lower+i
            pair = ((a, d, b), (b, d, c)) if (ring + i) % 2 else ((a, d, c), (a, c, b))
            for tri in pair:
                face(tri, ring)
        first=lower
    points.append((-.32,.3,-2.42))
    for i in range(count):
        face((len(points)-1,first+(i+1)%count,first+i),6)
    rock = mesh('Echo Cape · continuous folded bedrock', points, faces, group, palette, kinds)

    west = [(-11.14,-.66),(-10.45,-2.48),(-9.54,-3.34),(-7.53,-3.31),(-6.70,-2.11),
            (-6.76,.16),(-7.02,2.39),(-7.46,4.34),(-9.34,4.86),(-11.22,4.52),(-11.56,2.83)]
    east = [(6.87,-2.54),(7.77,-3.05),(9.49,-3.04),(10.13,-2.59),(10.47,-1.02),
            (10.28,1.23),(9.98,3.86),(8.98,4.26),(7.55,3.87),(6.89,2.25),(6.65,.30)]
    ledges = []
    for name,outline,center,top,seed in (('West rock shoulder',west,(-8.8,1.1),3.77,87),
                                        ('East rock shoulder',east,(8.35,.5),3.71,410)):
        ledge = terraces(name+' · split grey stratum',outline,
              [(.065,.52,.22,'shale'),(-.10,1.23,.24,'cliff'),(-.073,1.95,.24,'cliff'),
               (-.067,2.17,.17,'shale'),(-.019,2.72,.22,'cliff'),(.023,3.27,.135,'talus'),
               (.084,top,0,'grass')],group,seed,center)
        ledge.data.calc_loop_triangles()
        start = len(points)
        points.extend(tuple(v.co) for v in ledge.data.vertices)
        faces.extend(tuple(start+i for i in tri.vertices) for tri in ledge.data.loop_triangles)
        ledges.append(ledge)
    return (rock,*ledges), BVHTree.FromPolygons(points, faces, all_triangles=True)


def surface(tree, x, y):
    location = tree.ray_cast((x, y, 14), (0, 0, -1))[0]
    return location.z if location is not None else -1.28


def footing(name, x, y, top, width, tree, group, key='stone'):
    bottom = min(top - .15, surface(tree, x, y) - .31)
    block(name, (x, y, (top + bottom) / 2), (width, width, top - bottom), group, key, 1, .035)


def apron(name, bounds, tree, group, wood=False, posts='stone'):
    x0, y0, x1, y1, z = bounds
    width, length = x1 - x0, y1 - y0
    outline = rectangle((x0 + x1) * .5, (y0 + y1) * .5, width, length, .16)
    slab(name + ' · edge frame', outline, z - .23, z - .088, group, 'iron' if wood else 'stone', 1, .026)
    cols = 1 if wood else max(1, round(width / .63))
    rows = max(1, round(length / (.22 if wood else .60)))
    w, d = width / cols, length / rows
    for i in range(cols):
        for j in range(rows):
            block(name + ' · wearing surface', (x0 + (i + .5) * w, y0 + (j + .5) * d, z - .052),
                  (w - .018, d - .021, .104), group, 'plank' if wood else 'stone', i + 3 * j, .011)
    for x in (x0 + .29, x1 - .29):
        piers = max(2,math.ceil(length/1.55))
        for i in range(piers):
            y = y0 + .25 + i*(length-.5)/(piers-1)
            if posts == 'iron' and surface(tree,x,y) < -.60:
                # At the eastern seaward corner, rake the brace into the bank.
                anchor_y = y + .68
                anchor_z = surface(tree,x,anchor_y)
                footing(name+' · bank socket',x,anchor_y,anchor_z+.16,.35,tree,group)
                beam(name+' · raked shore brace',(x,anchor_y,anchor_z+.08),(x,y,z-.195),
                     .24,.23,group,'iron',1,.02)
            else:
                footing(name+' · support pier',x,y,z-.195,.30 if wood else .56,tree,group,posts)


def catwalk(start, end, tree, group):
    name = 'Shore walk'
    a, b = Vector(start), Vector(end)
    sideways = Vector((-(b-a).y, (b-a).x, 0)).normalized()
    length = (b-a).length
    count = math.ceil(length / .23)
    for i in range(count):
        center = a.lerp(b, (i + .5) / count)
        center.z -= .053
        board = block(name+' · anti-slip larch tread',center,(length/count-.013,.98,.106),
                      group,'plank',i,.009)
        board.rotation_euler.z = math.atan2(b.y-a.y,b.x-a.x)
    for side in (-1, 1):
        off = sideways * side * .505
        a1, b1 = a + off, b + off
        beam(name + ' · edge stringer', a1 - Vector((0,0,.17)), b1 - Vector((0,0,.17)),
             .12,.21,group,'iron',0,.013)
        railing(name+' · guard',[a1,b1],group,spacing=.83,height=.48,key='iron')
    for j in range(max(2, math.ceil((b-a).length / 1.72))):
        p = a.lerp(b, (j + .21) / max(2, math.ceil((b-a).length / 1.72)))
        left, right = p - sideways * .39, p + sideways * .39
        z = p.z - .175
        beam('Walk · cross bearer', (*left[:2], z), (*right[:2], z), .19,.17,group,'iron')
        for q in (left,right):
            footing('Walk · foundation', q.x,q.y,z,.18,tree,group,'iron')
        lowest = min(z - .22, max(surface(tree,left.x,left.y), surface(tree,right.x,right.y)) + .10)
        if z - lowest > .38:
            for p,q in ((left,right),(right,left)):
                beam('Walk · diagonal trestle tie',(*p[:2],lowest),(*q[:2],z),.068,.078,group,'iron',1)


def routes(tree, group):
    apron('West tension apron', WEST, tree, group)
    apron('East observation apron', EAST, tree, group)
    apron('Landing · larch deck',(2.53,-10.43,4.96,-8.91,.62),tree,group,wood=True,posts='timber')
    for path in ([(-9.39,.61,4.42),(-9.39,-3.52,4.42),(-8.86,-3.52,4.42)],
                 [(-7.44,-3.52,4.42),(-6.99,-3.52,4.42),(-6.99,4.53,4.42),(-8.31,4.53,4.42)]):
        railing('West apron · guard',path,group,spacing=.63,height=.56,key='iron')
    for x in (2.64,4.85):
        railing('Landing · mooring edge', [(x,-10.25,.62),(x,-9.06,.62)], group,
                spacing=.54,height=.47,key='timber')
        block('Landing · mooring bollard', (x,-10.15,.78), (.158,.158,.63),group,'iron',1,.018)

    bridge = collection('Valley maintenance walk and four stair runs', group)
    for start,end in WALKS:
        catwalk(start,end,tree,bridge)
    # Each flight and catwalk ends on a separate full-width timber junction.
    for bounds in ((-8.81,-5.99,-7.49,-5.03,3.08),(7.95,-5.62,9.27,-4.70,3.18),
                   (3.08,-6.67,4.42,-5.46,2.52)):
        apron('Stair junction',bounds,tree,bridge,wood=True,posts='iron')
    for path in ([(-8.74,-5.07,3.08),(-8.74,-5.94,3.08),(-7.51,-5.94,3.08)],
                 [(7.98,-5.57,3.18),(9.21,-5.57,3.18),(9.21,-4.74,3.18)],
                 [(3.09,-5.48,2.52),(4.40,-5.48,2.52)]):
        railing('Junction · exposed guard',path,bridge,spacing=.66,height=.48,key='iron')
    for name,start,end,width,steps in STAIRS:
        stairs(name,start,end,width,steps,bridge)
        midpoint = Vector(start).lerp(Vector(end), .43)
        bottom = min(midpoint.z - .22, surface(tree, midpoint.x,midpoint.y) - .18)
        block(name + ' · stair pier', (midpoint.x,midpoint.y,(midpoint.z+bottom)*.5-.12),
              (.73,.43,midpoint.z-bottom),bridge,'stone',1,.033)
    for x,y,z in ((-8.94,-3.19,4.42),(7.37,-3.14,4.30),(-1.95,-5.42,2.63),
                  (4.82,-5.51,2.67),(2.76,-9.22,.62),(9.65,3.96,4.30)):
        lantern('Route marker',(x,y,z),group)


def landscape(tree, group):
    specs = (
        (-11.11,-1.3,1.21),(-10.49,-3.25,1.36),(-9.59,-4.37,.96),
        (-6.94,-4.48,.84),(-4.58,-4.37,.72),(-2.36,-3.88,1.10),
        (6.97,-3.85,.90),(10.67,-2.25,1.1),(10.88,.10,1.28),(10.57,2.46,.94),
        (8.39,5.18,1.27),(6.55,4.03,1.03),(3.76,5.14,.91),(2.69,5.77,1.24),
        (-1.1,5.82,1.0),(-3.00,4.89,1.32),(-4.35,4.44,1.20),
        (-6.35,5.06,1.04),(-8.0,5.54,1.32),(-10.09,4.55,.89),
    )
    for i,(x,y,scale) in enumerate(specs):
        z = surface(tree,x,y)
        h = scale * (1.42 + .13*(i % 3))
        dx = .17 * math.sin(i*1.15)*scale
        beam('Wind-pruned juniper · angled trunk',(x,y,z-.11),(x+dx,y+.10,z+h*.73),
             .114*scale,.129*scale,group,'bark',i,.007)
        for j,(sx,sy,sz,wx,wy,wz) in enumerate(((.11,.02,.68,.64,.47,.42),(-.25,.16,.44,.53,.37,.31),
                                                (.26,-.16,.47,.52,.38,.34),(.02,.09,.92,.44,.36,.31))):
            tip=(x+(sx+dx)*scale,y+sy*scale,z+sz*h)
            beam('Juniper · scaffold branch',(x,y,z+h*.28),tip,.051*scale,.055*scale,group,'bark',i)
            faceted_rock('Juniper foliage',tip,(wx*scale,wy*scale,wz*scale),group,'pine',721+i*13+j)
    banks = ((-8.1,-6.4),(-5.7,-4.07),(-2.7,-4.79),(.11,-3.35),(5.89,-4.52),(9.81,-3.56),
             (11.4,-1.4),(9.37,5.19),(7.36,4.75),(4.72,5.0),(1.98,6.31),(-2.1,5.29),(-8.99,5.31))
    rng = random.Random(5618)
    for index,(x,y) in enumerate(banks):
        for j in range(5):
            a,b = x+rng.uniform(-.52,.52), y+rng.uniform(-.30,.30)
            scale=rng.uniform(.10,.29)
            faceted_rock('Salt grass and low scrub',(a,b,surface(tree,a,b)-.024),
                         (scale,scale*.77,scale*.52),group,'leaves',index*17+j)
    for i,(x,y,width) in enumerate(((-12.51,-2.2,.77),(-11.55,-4.15,.96),(-9.95,-5.91,1.01),
            (-7.43,-7.03,.66),(-5.28,-7.83,1.05),(-1.16,-8.38,.71),(1.34,-8.24,.51),
            (6.59,-8.09,.88),(8.78,-6.07,.83),(11.11,-4.11,.65),(12.24,-1.57,.85),
            (12.43,1.43,.64),(10.85,4.23,.87),(8.70,5.92,.93),(5.0,7.50,.80),(-7.86,6.00,.83),
            (-3.82,-1.60,.82),(3.05,2.22,.73),(5.61,1.1,.71),(-4.87,3.68,.72))):
        level = surface(tree,x,y)
        z = level - .22 if level > -.5 else -.51
        faceted_rock('Weathered outcrop',(x,y,z),(width,width*.71,width*.61),group,'cliff',i+291)
    ribs = ((-5.18,-2.54,1.15),(-4.64,-1.32,1.31),(-3.66,.43,.80),(-4.32,2.14,1.20),
            (-3.11,3.38,.90),(-2.67,3.87,.61),(1.31,-3.45,1.24),(1.84,-3.06,.96),
            (2.96,-3.38,1.28),(3.62,-2.75,.64),(5.66,2.72,1.34),(6.51,3.02,.84),
            (-10.90,-2.46,1.14),(-11.65,.89,1.33),(10.56,-.58,.99),(10.08,2.82,.88))
    for i,(x,y,w) in enumerate(ribs):
        z = surface(tree,x,y)
        ridge = faceted_rock('Slanted shale seam',(x,y,z-.20),(w,w*.46,w*.65),group,
                             'shale' if i%3==0 else 'talus',242+i)
        ridge.rotation_euler.z = -.60 + .26*math.sin(i*.8)
        ridge.rotation_euler.y = .38
