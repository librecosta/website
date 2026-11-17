"""Surveyed terrain, masonry quay and walkable grade changes for Discovery Harbor."""

import math
import random

from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import delaunay_2d_cdt

from fabric import rectangle, slab
from geometry import beam, block, faceted_rock, lantern, material, mesh, railing, rod
from terrain import stairs


COAST = [
    (-13.15,-2.6),(-12.2,-4.85),(-10.4,-6.95),(-8.8,-7.80),(-7.05,-7.22),
    (-5.30,-6.38),(-3.51,-5.92),(-1.88,-5.60),(.03,-5.43),(2.11,-5.54),
    (4.28,-6.11),(6.12,-6.83),(8.37,-7.23),(10.53,-6.49),(12.22,-4.67),
    (13.03,-2.48),(12.72,.05),(12.19,2.66),(10.83,5.00),(8.92,6.74),
    (6.15,7.57),(3.40,8.23),(.40,8.45),(-2.40,8.20),(-5.50,8.04),
    (-8.44,7.15),(-10.64,5.40),(-12.28,3.34),(-13.03,.87),
]
CIVIC = [
    (-5.52,-1.8),(-4.38,-2.95),(2.50,-2.95),(4.94,-2.52),(5.96,-1.74),
    (6.02,1.4),(5.8,3.75),(5.14,5.9),(3.96,6.89),(1.5,7.43),
    (-1.65,7.45),(-4.15,7.04),(-5.35,5.75),(-5.92,3.7),(-5.86,.66),
]
WEST = [
    (-11,-.96),(-10.15,-2.69),(-8.05,-2.96),(-6.58,-1.88),(-6.40,.6),
    (-6.53,2.87),(-7.37,4.86),(-8.67,5.45),(-10.25,4.51),(-11.40,2.38),
]
EAST = [
    (6.44,-2.35),(8.24,-3.01),(10.20,-2.64),(11.75,-1.24),(11.66,1.1),
    (11.22,3.62),(10.08,5.47),(8.23,5.78),(6.77,4.72),(6.39,2.70),
]
HEADLAND = [
    (7.04,-5.14),(8.55,-5.95),(10.05,-5.69),(11.38,-4.15),
    (11.03,-3.01),(9.9,-2.63),(8.22,-2.93),(7.23,-3.79),
]
QUAY = [(-9.0,-6.41),(-7.20,-5.96),(-5.20,-5.47),(-3.04,-5.18),(-.84,-5.03),
        (1.84,-5.03),(4.04,-5.30),(6.14,-5.84),(7.93,-6.22),(9.78,-5.69)]

COURT_Z = 3.38
WEST_Z = 2.64
EAST_Z = 2.80
HEADLAND_Z = 2.09
QUAY_Z = 1.20
DOCK_Z = .78

STAIRS = (
    ('Civic stair',(.54,-5.43,QUAY_Z),(.54,-2.95,COURT_Z),2.06,13),
    ('West stepped crossing',(-7.08,.39,WEST_Z),(-5.86,.39,COURT_Z),1.28,5),
    ('East stepped crossing',(7.18,-1.18,EAST_Z),(5.96,-1.18,COURT_Z),1.25,4),
    ('Belvedere stair',(8.93,-3.68,HEADLAND_Z),(8.93,-2.97,EAST_Z),1.26,5),
    ('Landing steps',(-7.42,-6.92,DOCK_Z),(-7.42,-6.33,QUAY_Z),1.42,3),
)


def inside(x, y, outline):
    return sum((ay > y) != (by > y) and x < ax + (bx-ax)*(y-ay)/(by-ay)
               for (ax,ay),(bx,by) in zip(outline,outline[1:]+outline[:1])) % 2


def facets(name, outline, levels, cap, spacing, group, seed):
    rng = random.Random(seed)
    edge = []
    for a, b in zip(outline, outline[1:] + outline[:1]):
        edge.extend((Vector(a), Vector(a).lerp(Vector(b), rng.uniform(.38,.62))))
    count = len(edge)
    center = sum(edge, Vector((0,0))) / count
    vertices = [(*p, cap(*p)) for p in edge]
    xmin, xmax = min(x for x,_ in edge), max(x for x,_ in edge)
    ymin, ymax = min(y for _,y in edge), max(y for _,y in edge)
    for j in range(1, math.ceil((ymax-ymin)/spacing)):
        for i in range(1, math.ceil((xmax-xmin)/spacing)):
            x = xmin + (i + rng.uniform(-.28,.28)) * spacing
            y = ymin + (j + rng.uniform(-.28,.28)) * spacing
            if inside(x,y,outline) and min((Vector((x,y))-p).length for p in edge)>.27:
                vertices.append((x,y,cap(x,y)))
    points = [Vector(v[:2]) for v in vertices]
    _, _, triangles, remap, _, _ = delaunay_2d_cdt(points,[],[list(range(count))],1,1e-7,True)
    faces, m, slots = [], [], []

    def add(ids, kind):
        color = material(kind,rng.randrange(16))
        if color not in m:
            m.append(color)
        slots.append(m.index(color))
        faces.append(ids)

    for triangle in triangles:
        ids = tuple(remap[i][0] for i in triangle)
        a,b,c = (points[i] for i in ids)
        if (b-a).cross(c-a) < 0:
            ids = ids[::-1]
        p = (a+b+c)/3
        dry = math.sin(p.x*.81+p.y*.76) + .5*math.cos(p.x*.61-p.y*.91)
        add(ids,'grass' if dry > -.40 else ('sand' if seed == 19 and p.y < -4 else 'earth'))

    upper = 0
    for ring,(inset,z,wobble,kind) in enumerate(levels):
        lower = len(vertices)
        for i, p in enumerate(edge):
            q = p.lerp(center,inset + rng.uniform(-wobble,wobble)*.045)
            vertices.append((*q,z + wobble*math.sin(i*.63+ring)+rng.uniform(-.6,.6)*wobble))
        for i in range(count):
            j=(i+1)%count
            a,b,c,d=upper+i,upper+j,lower+j,lower+i
            pair=((a,d,c),(a,c,b)) if (i+ring)%2 else ((a,d,b),(b,d,c))
            for tri in pair:
                add(tri,kind if rng.random()>.18 else 'cliff')
        upper = lower
    # Triangulate the concave underside using its own outline.
    low_edge = [Vector(vertices[upper+i][:2]) for i in range(count)]
    _, _, underside, mapping, _, _ = delaunay_2d_cdt(low_edge,[],[list(range(count))],1,1e-7,True)
    for tri in underside:
        ids = tuple(mapping[i][0] for i in tri)
        a,b,c = (low_edge[i] for i in ids)
        if (b-a).cross(c-a) > 0:
            ids = ids[::-1]
        add(tuple(upper+i for i in ids),'shale')
    return mesh(name,vertices,faces,group,m,slots)


def land(group):
    def beach(x, y):
        return .72+.13*math.sin(x*.64+y*.5)+.095*math.cos(x*.94-y*.93)+max(0,y)*.029

    layers = [facets('Harbor bedrock · continuous pocket bay',COAST,
              [(-.014,.23,.15,'sand'),(.015,-.29,.19,'cliff'),(.016,-.91,.20,'shale'),
               (.083,-1.63,.17,'cliff'),(.209,-2.17,.11,'shale')],
              beach,1.00,group,19)]
    for name, outline, top, seed in (
        ('Civic bench',CIVIC,COURT_Z,42), ('Guide garden',WEST,WEST_Z,67),
        ('Exhibition ledge',EAST,EAST_Z,97), ('Windward lookout',HEADLAND,HEADLAND_Z,266),
    ):
        layers.append(facets(name+' · stratified limestone',outline,
            [(-.029,top-.53,.18,'earth'),(-.085,top-.98,.24,'cliff'),
             (-.084,max(.36,top-1.65),.23,'talus'),(-.094,.46,.08,'cliff')],
            lambda x,y: top-.052,1.05,group,seed))
    vertices, faces = [], []
    for obj in layers:
        obj.data.calc_loop_triangles()
        start = len(vertices)
        vertices.extend(v.co for v in obj.data.vertices)
        faces.extend(tuple(start+i for i in tri.vertices) for tri in obj.data.loop_triangles)
    return layers, BVHTree.FromPolygons(vertices,faces,all_triangles=True)


def surface(tree, x, y):
    hit = tree.ray_cast((x,y,12),(0,0,-1))[0]
    return hit.z if hit is not None else -.54


def footing(name, x, y, top, size, tree, group):
    bottom=min(surface(tree,x,y)-.19,top-.20)
    block(name,(x,y,(bottom+top)/2),(size,size,top-bottom),group,'stone',1,.035)


def route(name, points, width, z, group, key='stone'):
    """Pavers follow a common cross section at corners without overlapping."""
    points = [Vector(p) for p in points]
    directions = [(b-a).normalized() for a,b in zip(points,points[1:])]
    normals = [Vector((d.y,-d.x)) for d in directions]
    sides = [normals[0]]
    for a,b in zip(normals,normals[1:]):
        miter=(a+b).normalized()
        sides.append(miter/max(.645,miter.dot(a)))
    sides.append(normals[-1])
    left = [p-s*width/2 for p,s in zip(points,sides,strict=True)]
    right = [p+s*width/2 for p,s in zip(points,sides,strict=True)]
    for i, (a,b) in enumerate(zip(points,points[1:])):
        n = max(1,round((b-a).length/.42))
        for j in range(n):
            start,end=(j+.028)/n,(j+1-.028)/n
            outline = [left[i].lerp(left[i+1],start),right[i].lerp(right[i+1],start),
                       right[i].lerp(right[i+1],end),left[i].lerp(left[i+1],end)]
            slab(name+' · walking slab',outline,z-.118,z,group,key,i+j,.010)
    return left,right


def paving(name, bounds, z, group, key='stone', pitch=.64):
    x0,y0,x1,y1=bounds
    nx,ny=max(1,round((x1-x0)/pitch)),max(1,round((y1-y0)/pitch))
    w,d=(x1-x0)/nx,(y1-y0)/ny
    for j in range(ny):
        cuts=[x0] + [x0+(i+(.37 if j%2 else 0))*w for i in range(1,nx)] + [x1]
        for i,(a,b) in enumerate(zip(cuts,cuts[1:])):
            block(name+' · set paving',((a+b)/2,y0+(j+.5)*d,z-.067),
                  (b-a-.018,d-.018,.134),group,key,2*i+j,.012)


def lamp(name, x, y, z, group):
    rod(name+' · stanchion',(x,y,z),(x,y,z+.72),.045,group,'iron',8)
    lantern(name+' · shade',(x,y,z+.66),group)


def quay(group):
    _,right=route('Curved waterfront',QUAY,1.33,QUAY_Z,group)
    for i,(a,b) in enumerate(zip(right,right[1:])):
        # Narrow mortared courses project just enough to keep the shaped shadows legible.
        length=(b-a).length
        for row in range(3):
            z=QUAY_Z-.22-row*.235
            n=max(2,round(length/.50))
            tangent=(b-a).normalized()
            normal=Vector((tangent.y,-tangent.x))
            cuts=[0] + [(j+(.33 if row%2 else 0))/n for j in range(1,n)] + [1]
            for j,(c,d) in enumerate(zip(cuts,cuts[1:])):
                p=a.lerp(b,(c+d)/2)-normal*(.10+.045*row)
                stone=block('Seawall · ashlar course',(*p,z),(length*(d-c)-.022,.38,.226),
                            group,'stone' if row < 2 else 'talus',i+j+row,.014)
                stone.rotation_euler.z=math.atan2(tangent.y,tangent.x)
    for x,y in ((-9.05,-6.43),(-5.44,-6.04),(-2.7,-5.78),(3.48,-5.87),(6.65,-6.62),(9.70,-6.13)):
        rod('Mooring · cast bollard',(x,y,QUAY_Z-.23),(x,y,QUAY_Z+.23),.088,group,'iron',10)
        rod('Mooring · keeper head',(x,y,QUAY_Z+.19),(x,y,QUAY_Z+.255),.13,group,'brass',10)
    for x,y in ((-8.70,-6.20),(-3.30,-5.60),(3.06,-5.69),(7.91,-6.64)):
        lamp('Quay lamp',x,y,QUAY_Z,group)


def landing(tree, group):
    for i in range(11):
        y=-9.10+(i+.5)*.20
        seam=-7.32+(.44 if i%2 else -.36)
        for a,b in ((-9.05,seam),(seam,-5.62)):
            block('Landing · flush-sawn plank',((a+b)/2,y,DOCK_Z-.065),
                  (b-a-.014,.19,.13),group,'plank',i,.009)
    for x in (-8.92,-6.98,-5.75):
        beam('Landing · stringer',(x,-9.01,.63),(x,-6.90,.63),.24,.19,group,'timber')
        for y in (-8.97,-7.81,-7.01):
            rod('Landing · driven pile',(x,y,min(-.32,surface(tree,x,y)-.35)),(x,y,.94),.14,group,'timber',9)
            rod('Landing · bronze collar',(x,y,.80),(x,y,.875),.16,group,'iron',10)
    railing('Landing · windward side',[(-8.93,-8.99,DOCK_Z),(-8.93,-6.97,DOCK_Z)],group,key='metal')
    railing('Landing · working edge',[(-5.72,-8.99,DOCK_Z),(-5.72,-7.05,DOCK_Z)],group,key='metal')

    # A grounded boat on fixed timber skids leaves the boarding lane open.
    def hull_ring(z, scale):
        return [(-6.30+u*scale,-7.90+v*scale,z+.18*abs(v)) for u,v in
                [(-.38,-.61),(-.29,-.96),(0,-1.16),(.27,-.92),(.42,-.52),(.45,.24),
                 (.28,.71),(0,.84),(-.29,.69),(-.44,.22)]]

    rings=(hull_ring(.84,.38),hull_ring(.985,.80),hull_ring(1.21,1),hull_ring(1.19,.87),hull_ring(.996,.68))
    n=len(rings[0])
    faces=[tuple(reversed(range(n)))]
    colors=[0]
    for ring in range(len(rings)-1):
        for i in range(n):
            k=(i+1)%n
            faces.append((ring*n+i,ring*n+k,(ring+1)*n+k,(ring+1)*n+i))
            colors.append((0,1,2,1)[ring])
    faces.append(tuple(4*n+i for i in range(n)))
    colors.append(2)
    mesh('Harbor tender · curved clinker hull',sum(rings,[]),faces,group,
         [material('plank',1),material('azure',1),material('timber')],colors)
    for y in (-8.43,-7.54):
        block('Tender · boat cradle',(-6.30,y,.836),(.94,.16,.112),group,'timber',0,.019)
        block('Tender · thwart',(-6.30,y,1.19),(.65,.16,.068),group,'plank',2,.012)
    beam('Tender · oar',(-6.53,-8.57,1.23),(-6.14,-7.12,1.21),.046,.046,group,'plank')
    block('Tender · oar blade',(-6.11,-7.03,1.21),(.115,.25,.037),group,'plank',2)
    for x,y,tone in ((-8.47,-7.20,0),(-8.17,-7.19,1),(-8.54,-7.53,2)):
        block('Quay · provision crate',(x,y,DOCK_Z+.14),(.30,.34,.28),group,'plank',tone)
        for dx in (-.105,.105):
            block('Quay · crate strap',(x+dx,y,DOCK_Z+.285),(.045,.35,.026),group,'timber',tone)


def connections(tree, group):
    for name,a,b,width,count in STAIRS:
        stairs(name,a,b,width,count,group)
        a,b=Vector(a),Vector(b)
        side=Vector((b.y-a.y,a.x-b.x,0)).normalized()
        for t in (.27,.64,.92):
            p=a.lerp(b,t)
            for sign in (-1,1):
                q=p+side*(sign*width*.38)
                footing(name+' · masonry pier',q.x,q.y,p.z-.096,.25,tree,group)

    # Leave a clear sightline and a straight approach from the harbor stair to the arcades.
    paving('Civic court',(-3.56,-2.95,3.29,.29),COURT_Z,group,pitch=.59)
    paving('Civic court',(-3.56,.29,1.32,1.48),COURT_Z,group,pitch=.59)
    route('West guide arcade',[(-5.86,.39),(-3.56,.39)],1.29,COURT_Z,group)
    route('East exhibit bridge',[(3.29,-1.18),(5.96,-1.18)],1.26,COURT_Z,group)
    route('East gallery forecourt',[(7.18,-1.18),(8.29,-1.18)],1.29,EAST_Z,group)
    paving('East gallery · crossing landing',(8.29,-1.825,9.57,-.535),EAST_Z,group,pitch=.48)
    route('Gallery doors',[(8.93,-.535),(8.93,.62)],1.28,EAST_Z,group)
    route('East to headland',[(8.93,-1.825),(8.93,-2.97)],1.22,EAST_Z,group)
    route('Lookout entrance',[(8.93,-3.68),(8.93,-4.08),(9.47,-4.63)],1.20,HEADLAND_Z,group,'plank')
    route('Pavilion garden circuit',[(3.29,-.106),(4.77,-.106),(4.79,2.50),(4.68,4.77),(3.89,6.02),
          (2.62,6.71),(-3.62,6.75),(-4.86,6.40),(-5.42,5.15),(-5.44,4.31),(-5.44,1.035)],.78,COURT_Z,group)
    for points in (
        [(-3.52,-2.87,COURT_Z),(-.49,-2.87,COURT_Z)],
        [(1.58,-2.87,COURT_Z),(3.28,-2.87,COURT_Z)],
        [(-2.95,7.18,COURT_Z),(1.60,7.15,COURT_Z),(3.71,6.70,COURT_Z)],
    ):
        railing('Court · overlook balustrade',points,group,height=.62,key='metal')
    for x,y,z in ((-3.39,-2.69,COURT_Z),(3.16,-2.65,COURT_Z),(-5.38,.93,COURT_Z),
                  (5.42,-1.83,COURT_Z),(7.41,-1.68,EAST_Z),(9.51,-2.62,EAST_Z),(.35,7.15,COURT_Z)):
        lamp('Terrace lamp',x,y,z,group)


def vegetation(tree, group):
    rng=random.Random(358)
    locations = [(-11.65,-1.32,2.12),(-10.67,-3.21,2.08),(-10.12,2.84,2.54),
        (-11.24,4.1,1.96),(-8.85,5.04,2.34),(-6.90,5.65,2.51),(-5.73,6.74,2.22),
        (-3.28,7.55,1.90),(-.52,7.76,2.10),(2.52,7.73,2.27),(5.24,6.32,2.23),
        (6.78,5.42,2.21),(8.34,5.65,1.91),(11.11,4.03,2.12),(11.70,2.64,1.96),
        (11.34,-2.18,1.84),(10.5,-5.53,1.82),(7.14,-4.1,1.73),(-5.02,-3.02,2.05),
        (4.81,-2.62,1.65),(-12.40,.31,2.0)]
    for index,(x,y,h) in enumerate(locations):
        z=surface(tree,x,y)
        lean=Vector((rng.uniform(-.28,.28),.15+.06*math.sin(index),0))
        root=Vector((x,y,z-.075))
        fork=root+lean*.7+Vector((0,0,h*.62))
        rod('Coastal olive · trunk',root,fork+Vector((0,0,.16*h)),h*.055,group,'bark',8)
        for j in range(4):
            angle=j*2.42+index*1.15
            tip=fork+Vector((math.cos(angle)*h*.29,math.sin(angle)*h*.24,h*(.18+.053*(j%3))))
            rod('Coastal olive · fork',root.lerp(fork,.76),tip,h*.028,group,'bark',6)
            s=h*rng.uniform(.29,.37)
            faceted_rock('Coastal olive · wind-pruned crown',tip,(s*1.28,s,s*.92),group,
                         'leaves' if j else 'pine',seed=index*7+j+17)
    flower_pockets=[(-4.63,-2.16),(3.85,-1.99),(-7.10,2.32),(-10.91,1.88),(11.18,.17),
        (7.63,-2.16),(9.93,-3.12),(-4.60,6.26),(3.22,7.02),(6.23,5.78),(-3.88,-3.65),
        (2.81,-3.62),(-9.55,-4.59),(5.47,-4.77),(-7.37,5.12),(10.69,5.03)]
    for i,(x,y) in enumerate(flower_pockets):
        for j in range(4):
            px,py=x+rng.uniform(-.49,.49),y+rng.uniform(-.35,.35)
            z=surface(tree,px,py)
            s=rng.uniform(.135,.265)
            faceted_rock('Salt-tolerant scrub',(px,py,z-.01),(s*1.35,s,.74*s),group,'grass',i*6+j)
            for k in range(2):
                dx,dy=rng.uniform(-s,s),rng.uniform(-s,s)
                stem=(px+dx,py+dy,z+.9*s)
                rod('Coastal flower stem',(px+dx,py+dy,z-.025),stem,.014,group,'pine',5)
                faceted_rock('Coastal blossom',stem,(.06,.06,.044),group,'flower',i+j+k)
    strand = [(-13.3,-3.76),(-11.84,-5.8),(-10.21,-7.36),(-8.14,-7.59),(-5.04,-6.58),
        (-3.19,-6.17),(-.61,-5.73),(2.80,-6.01),(4.81,-6.63),(7.16,-7.40),(9.04,-7.48),
        (10.86,-6.63),(12.04,-5.29),(13.28,-2.88),(13.13,1.67),(11.96,4.58),
        (9.62,6.59),(6.69,7.7),(4.8,8.37),(-2.77,8.47),(-6.34,8.03),(-10.97,5.61),(-12.8,3.19)]
    for i,(x,y) in enumerate(strand):
        size=rng.uniform(.24,.74)
        for j in range(3):
            px,py=x+j*.32,y+rng.uniform(-.26,.26)
            z=surface(tree,px,py)
            s=size/(j+1)
            faceted_rock('Shore · tide-worn fragment',(px,py,z-.07),(s*1.46,s,.78*s),
                         group,'sand' if j==2 else 'talus',64+i*5+j)
    for i,(x,y,s) in enumerate(((-9.83,-3.01,.46),(-9.12,-3.27,.34),(-8.64,-3.51,.28),
                               (-4.02,-3.38,.39),(-3.28,-3.07,.37),(2.47,-3.37,.31),
                               (3.94,-3.13,.42),(4.43,-3.43,.24),(10.46,-3.68,.34))):
        z=surface(tree,x,y)
        faceted_rock('Terrace · fractured limestone at the toe',(x,y,z-.09),(s*1.60,s*.80,s*.92),
                     group,'talus',142+i)
