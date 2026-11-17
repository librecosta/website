"""Faceted island geology, landing, walkways and planted pockets."""

import math
import random

from mathutils import Vector

from geometry import (RNG, PALETTE, beam, block, collection, faceted_rock, lantern,
                      lathe, material, mesh, railing, rod)


def terraces(name, anchors, levels, group, seed, center=(0,0)):
    """Loft surveyed cliff rings with flat benches and angular rock faces."""
    rng=random.Random(seed)
    points=[]
    for a,b in zip(anchors,anchors[1:]+anchors[:1]):
        points.extend((Vector(a),Vector(a).lerp(Vector(b), rng.uniform(.39,.61))))
    count=len(points)
    center=Vector(center)
    verts=[]
    for inset,z,jag,_ in levels:
        for i,point in enumerate(points):
            radial=(point-center).normalized()
            p=point.lerp(center,inset)+radial*rng.uniform(-jag,jag)
            dz=rng.uniform(-jag*.76,jag*.76)
            verts.append((p.x,p.y,z+dz))
    mats=[]
    faces=[]
    indices=[]
    def face(sequence, key):
        shade=material(key,rng.randrange(len(PALETTE[key])))
        if shade not in mats:
            mats.append(shade)
        indices.append(mats.index(shade))
        faces.append(sequence)
    face(tuple(reversed(range(count))),'shale')
    for j in range(len(levels)-1):
        palette=levels[j+1][3]
        for i in range(count):
            k=(i+1)%count
            a,b,c,d=j*count+i,j*count+k,(j+1)*count+i,(j+1)*count+k
            if (i+2*j)%3==0:
                face((a,b,d),palette)
                face((a,d,c),palette)
            else:
                face((a,b,c),palette)
                face((b,d,c),palette)
    first=(len(levels)-1)*count
    # The ground cap stays planar so buildings, paths and foundations share a datum.
    for i in range(count):
        a,b=Vector(verts[first+i]),Vector(verts[first+(i+1)%count])
        p=a.lerp(Vector((center.x,center.y,a.z)),.42)
        if i%2:
            p=p.lerp(b,.21)
        verts.append(tuple(p))
    inner=len(verts)-count
    verts.append((center.x,center.y,verts[first][2]))
    for i in range(count):
        j=(i+1)%count
        face((first+i,first+j,inner+i),'grass')
        face((first+j,inner+j,inner+i),'grass')
        face((inner+i,inner+j,len(verts)-1),'grass')
    return mesh(name,verts,faces,group,mats,indices)


def geology(group):
    outline=[(-11.9,-2.5),(-9.4,-6.4),(-5.7,-8.7),(-1.7,-8.4),(1.1,-7.8),
             (4.4,-8.8),(7.7,-7.3),(10.3,-4.7),(11.6,-.8),(10.3,3.6),
             (7.1,7.7),(2.6,8.8),(-2.0,7.4),(-6.2,7.3),(-9.9,4.2),(-12.5,.7)]
    lower=terraces('Island · closed fractured coastal mass',outline,
                   [(.19,-2.08,.27,'shale'),(.054,-.65,.35,'shale'),(0,.02,.26,'cliff'),
                    (.04,.50,.12,'talus'),(.14,.63,.10,'talus'),(.17,1.72,.40,'cliff'),
                    (.227,2.46,.27,'cliff'),(.258,2.8,0,'grass')],group,41)
    upper_outline=[(-2.0,1.40),(-.52,.20),(2.2,-.26),(4.6,.12),(6.1,1.57),(6.56,3.9),
                   (5.8,5.54),(4.1,6.4),(1.68,6.5),(-.75,5.57),(-2.23,3.7)]
    upper=terraces('Collector ridge · shelf, rock seam and summit',upper_outline,
                   [(0,2.68,.07,'cliff'),(.06,3.45,.20,'cliff'),(.17,4.00,.20,'shale'),
                    (.20,4.14,.10,'grass'),(.23,4.66,.16,'cliff'),(.28,5.35,0,'grass')],
                   group,54,(2.04,3.28))
    return lower,upper


def sample_height(lands, x, y, ceiling=20):
    values=[]
    for land in lands:
        hit, point, _, _ = land.ray_cast(Vector((x,y,ceiling)),Vector((0,0,-1)))
        if hit:
            values.append(point.z)
    return max(values,default=-1.12)


def stairs(name, a, b, width, count, group, key='stone', rails=True):
    """Build contiguous treads from the low deck to the high landing."""
    a,b=Vector(a),Vector(b)
    horizontal=Vector((b.x-a.x,b.y-a.y,0))
    run=horizontal.length/count
    side=horizontal.normalized().cross(Vector((0,0,1)))
    heading=math.atan2(-horizontal.x,horizontal.y)
    rise=(b.z-a.z)/count
    for i in range(count):
        p=a+horizontal*((i+.5)/count)
        p.z=a.z+rise*(i+1)
        tread=block(f'{name} · tread {i+1:02}',p-Vector((0,0,(abs(rise)+.13)/2)),
                    (width,run+.018,abs(rise)+.13),group,key,i,bevel=.017)
        tread.rotation_euler.z=heading
    for direction in (-1,1):
        offset=side*direction*(width*.43)
        drop=Vector((0,0,.12))
        beam(name+' · stringer',a+offset-drop,b+offset-drop,.20,.16,group,'timber')
        if rails:
            railing(name+' · handrail',[a+offset,b+offset],group,spacing=.84,height=.56)


def paving(name, points, width, group):
    for i,(a,b) in enumerate(zip(points,points[1:])):
        a,b=Vector(a),Vector(b)
        length=(b-a).length
        angle=math.atan2(a.x-b.x,b.y-a.y)
        n=max(1,round(length/.395))
        for j in range(n):
            p=a.lerp(b,(j+.5)/n)
            obj=block(f'{name} · set {i+1}.{j+1:02}',p,(width,length/n-.029,.124),group,'stone',j+i)
            obj.rotation_euler.z=angle


def connections(land, group):
    pier=collection('Low · landing, freight crane and cargo',group)
    middle=collection('Middle · cobbled cross-court and loading bays',group)
    high=collection('High · switchback and observation footbridge',group)
    lights=collection('Path and transport lanterns',group)
    # All height transitions terminate in a deck or a worked stone landing.
    for j in range(14):
        y=-11.65+j*.208
        block(f'Pier · plank {j+1:02}',(2.39,y,.975),(3.57,.199,.17),pier,'plank',j)
    for x in (1.11,2.39,3.67):
        beam('Pier · spanning joist',(x,-11.81,.83),(x,-8.84,.83),.23,.25,pier,'timber')
        for y in (-11.55,-10.14,-8.98):
            bottom=min(.11,sample_height(land,x,y,ceiling=.86)-.20)
            rod('Pier · driven timber pile',(x,y,bottom),(x,y,1.15),.13,pier,'plank')
            lathe('Pier · iron pile band',(x,y,1.07),[(.15,0),(.15,.065)],pier,'iron',8)
            if x != 2.39:
                beam('Pier · knee brace',(x,y,.31),(2.39,y,.80),.11,.12,pier,'timber')
    for x in (.60,4.18):
        railing('Pier · dock edge',[(x,-11.61,1.06),(x,-8.94,1.06)],pier,spacing=.76,height=.48)
    stairs('Coast stair',(2.39,-8.84,1.06),(2.39,-6.74,2.92),1.52,9,middle)
    # The long landing is a short bridge across the overhang before reaching firm ground.
    for y in (-6.68,-6.20):
        for x in (1.79,2.99):
            bottom=sample_height(land,x,y,ceiling=2.88)-.10
            if bottom<2.58:
                beam('Coast landing · bedrock abutment',(x,y,bottom),(x,y,2.84),.24,.27,middle,'stone')
    block('Coast landing · stone deck',(2.39,-6.27,2.83),(1.51,.94,.18),middle,'stone')
    for x in (1.71,3.07):
        railing('Coast landing · edge',[(x,-6.74,2.92),(x,-5.86,2.92)],middle,height=.56)
    paving('Landward stone sill',[(2.39,-5.80,2.859),(2.39,-5.19,2.859)],1.50,middle)
    paving('Workshop court',[(-5.65,-4.48,2.846),(2.39,-4.48,2.846),(5.84,-4.48,2.846)],1.42,middle)
    paving('Sorting house entry',[(-4.19,-3.77,2.856),(-4.19,-3.50,2.856)],1.42,middle)
    paving('Service bay entry',[(4.49,-3.77,2.853),(4.49,-3.51,2.853)],1.36,middle)
    paving('Calibration passage',[(-5.23,.83,2.861),(-5.23,1.41,2.861)],.90,middle)
    paving('East switchback approach',[(5.84,-4.02,2.853),(6.27,-2.81,2.853),(6.40,-.90,2.853)],1.10,middle)
    stairs('Ridge stair · lower',(6.40,-.90,2.89),(6.40,1.83,4.23),1.12,8,high, 'plank')
    block('Ridge stair · intermediate landing',(6.40,2.08,4.14),(1.18,.52,.19),high,'timber')
    stairs('Ridge stair · upper',(6.49,2.08,4.23),(4.98,2.08,5.49),1.04,7,high,'plank')
    block('Collector summit · squared landing',(4.59,2.08,5.413),(.81,1.04,.154),high,'stone')
    paving('Collector summit walk',[(4.20,2.60,5.408),(4.20,3.32,5.408)],.94,high)
    stairs('Collector entrance',(4.17,3.32,5.46),(3.42,3.32,5.97),.84,3,high,'stone',rails=False)
    for x,y,z in ((6.40,.58,3.69),(6.40,2.08,4.20),(5.58,2.08,4.74)):
        base=min(z-.32,sample_height(land,x,y,ceiling=z)-.09)
        for dx in (-.27,.27):
            beam('Ridge stair · column',(x+dx,y,base),(x+dx,y,z),.14,.16,high,'timber')
            beam('Ridge stair · knee brace',(x+dx,y-.3,z-.5),(x+dx,y,z),.11,.11,high,'timber')
    for x,y,z in [(1.38,-8.93,1.06),(3.41,-8.93,1.06),(-6.16,-4.60,2.86),
                  (1.28,-4.71,2.86),(6.3,-2.31,2.86),(6.77,1.81,4.17)]:
        rod('Walkway · lantern post',(x,y,z),(x,y,z+.73),.05,lights,'iron')
        lantern('Walkway · warm lens',(x,y,z+.66),lights)
    return pier


def plantings(lands, group, stone_group):
    pine=collection('Pines · ridge windbreaks',group)
    broadleaf=collection('Alders · workshop shelter',group)
    understory=collection('Grasses, shrubs and exposed roots',group)
    conifers=[(-8.81,.94,2.92),(-8.22,2.00,2.46),(-7.22,3.67,3.10),(-6.01,4.55,2.56),
              (-4.77,4.47,2.84),(-3.46,4.67,2.65),(-3.40,3.50,2.28),(-1.88,4.72,2.63),
              (.46,5.00,2.28),(4.55,4.97,2.40),(5.04,4.67,1.81),(6.80,3.61,2.34),
              (7.10,2.33,2.11),(7.57,-.85,2.35),(-7.9,-3.08,2.26)]
    for i,(x,y,h) in enumerate(conifers):
        z=sample_height(lands,x,y)
        drift=RNG.uniform(-.28,.28)
        rod('Pine trunk',(x,y,z-.13),(x+drift,y-.10,z+h*.92),h*.076,pine,'bark',7)
        for j in range(4):
            width=h*(.275-j*.055)
            yaw=i*.93+j*.53
            pos=(x+drift*j/4,y-.10*j/4,z+h*(.26+j*.17))
            verts=[(math.cos(k*math.tau/9+yaw)*width*RNG.uniform(.73,1.18),
                    math.sin(k*math.tau/9+yaw)*width*RNG.uniform(.78,1.17),
                    RNG.uniform(-.12,.08)*h) for k in range(9)]
            verts.extend(((drift*.18,0,h*.39),(0,0,.08)))
            faces=[(k,(k+1)%9,9) for k in range(9)]+[((k+1)%9,k,10) for k in range(9)]
            obj=mesh('Pine · wind-cut bough',verts,faces,pine,[material('pine',m) for m in range(5)],
                     [RNG.randrange(5) for _ in faces])
            obj.location=pos
    for i,(x,y,h) in enumerate([(-8.63,-2.29,2.60),(-7.48,-4.14,2.01),(-1.48,-5.21,1.9),
                                 (7.35,-2.69,2.32),(4.45,5.49,1.96),(-7.31,.22,2.67)]):
        z=sample_height(lands,x,y)
        rod('Alder · trunk',(x,y,z-.06),(x-.14,y+.12,z+h*.80),h*.052,broadleaf,'bark',7)
        for j in range(6):
            angle=j*2.40+i
            a=(x-.06,y,z+h*.47)
            b=(x+math.cos(angle)*h*.22,y+math.sin(angle)*h*.22,z+h*(.69+.061*(j%4)))
            rod('Alder · branch',a,b,h*.025,broadleaf,'bark',6)
            size=RNG.uniform(.43,.66)*h*.73
            faceted_rock('Alder · shaped canopy',b,(size,size*.76,size*1.05),broadleaf,'leaves',i*9+j)
    pockets=[(-7.5,-5.2),(-6.3,-5.7),(-1.8,-5.6),(-.5,-5.5),(4.1,-5.65),(6.8,-4.25),
             (7.6,-2.0),(7.5,.35),(6.7,4.37),(4.8,5.42),(1.5,5.62),(-1.76,4.97),(-3.3,5.7),
             (-6.58,4.55),(-8.0,2.5),(-8.9,-.61),(-1.8,.69),(1.13,-4.64)]
    for i,(x,y) in enumerate(pockets):
        for j in range(4):
            dx,dy=RNG.uniform(-.46,.46),RNG.uniform(-.33,.33)
            z=sample_height(lands,x+dx,y+dy)
            s=RNG.uniform(.12,.28)
            faceted_rock('Moss cushion',(x+dx,y+dy,z-.025),(s*1.4,s,.19),understory,'grass',i*13+j)
            for k in range(3):
                angle=RNG.random()*math.tau
                end=(x+dx+math.cos(angle)*s*.72,y+dy+math.sin(angle)*s*.72,z+s*1.14)
                stem=(x+dx,y+dy,z+.025)
                leaf=Vector(end)-Vector(stem)
                transverse=leaf.cross(Vector((0,0,1))).normalized()*s*.16
                middle=Vector(stem).lerp(Vector(end),.45)
                mesh('Grass · pointed blade',[stem,tuple(middle+transverse),end,tuple(middle-transverse)],
                     [(0,1,2),(0,2,3)],understory,[material('leaves',k)])
            if i in (0,4,8,9,13) and j%2==0:
                faceted_rock('Wildflower',(x+dx,y+dy,z+.14),(.067,.065,.057),understory,'flower',i*17+j)
    rocks=[(-10.2,-3.63,1.00),(-9.25,-5.68,.86),(-6.65,-7.36,.92),(-4.42,-7.05,.65),
           (-2.18,-8.65,.89),(-.36,-7.58,.82),(4.89,-7.51,.96),(6.43,-7.03,.90),(7.82,-6.07,.83),
           (8.70,-4.83,.76),(9.97,-2.70,1.01),(10.4,.46,.98),(8.64,4.26,.91),(7.1,6.29,.84),
           (3.59,7.4,.77),(-2.32,6.61,.85),(-6.2,6.24,.9),(-9.32,4.68,.87),(-10.28,2.88,.87),
           (-1.72,1.5,.78),(1.65,.32,.82),(5.67,1.25,.67),(5.97,3.12,.57),(.45,5.69,.73)]
    for i,(x,y,s) in enumerate(rocks):
        z=sample_height(lands,x,y)
        faceted_rock('Talus · fractured outcrop',(x,y,z-.14),(s*1.19,s*.72,s),stone_group,'cliff',i+4)
        for j in range(3):
            dx,dy=RNG.uniform(-.75,.75),RNG.uniform(-.57,.55)
            base=sample_height(lands,x+dx,y+dy)
            s=RNG.uniform(.14,.30)
            faceted_rock('Talus · loose stone',(x+dx,y+dy,base-.024),(s*1.2,s,s*.65),stone_group,'talus',i*21+j)
    # Angled rock ribs interrupt the long cliff banks and make the exposed strata legible.
    for i,(x,y,w,d,h) in enumerate([(-7.95,-5.08,.75,.54,1.45),(-7.47,-5.43,.66,.50,1.30),
                                      (-6.91,-5.80,.52,.58,1.14),(7.66,-4.78,.73,.45,1.21),
                                      (8.19,-4.17,.59,.50,1.38),(8.68,-3.70,.64,.46,.98),
                                      (-2.08,6.37,.92,.44,1.17),(-2.99,6.10,.77,.51,1.35)]):
        z=sample_height(lands,x,y)
        obj=faceted_rock('Cliff · leaning rib',(x,y,z-h*.32),(w,d,h),stone_group,'shale',82+i)
        obj.rotation_euler.y=(-1)**i*.13
