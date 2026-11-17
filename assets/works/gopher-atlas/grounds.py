"""Surveyed coastal shelves, connected stone routes and the harbor approach."""

import math
import random

from mathutils import Vector

from craft import beam, block, collection, faceted_rock, lantern, lathe, railing, rod
from terrain import sample_height, stairs, terraces


LOW, MIDDLE, HIGH = 1.62, 3.34, 5.31
SHORE = [(-12.30,-2.2),(-11.7,-5.0),(-9.7,-7.35),(-8.36,-8.12),(-7.89,-7.30),
         (-7.78,-6.86),(-5.15,-6.86),(-4.77,-7.34),(-4.4,-8.30),(-1.2,-8.14),
         (1.8,-8.02),(4.2,-8.49),(7.8,-7.87),(10.5,-5.6),
         (12.1,-2.68),(11.7,.6),(10.5,4.3),(8.8,6.4),(5.8,7.77),(2.38,7.42),
         (-.6,8.20),(-4.4,7.75),(-7.6,6.5),(-11.5,3.44),(-12.73,.88)]
MID = [(-10.5,-.95),(-9.0,-2.45),(-6.78,-2.68),(-4.55,-2.58),(-2.67,-2.28),
       (-.78,-2.40),(1.65,-2.60),(4.35,-2.48),(7.2,-2.24),(9.76,-1.15),
       (10.3,1.5),(9.36,4.27),(7.62,6.24),(3.18,6.8),(-.67,6.61),
       (-4.2,6.00),(-7.73,6.13),(-9.47,4.2),(-10.8,1.42)]
UPPER = [(-2.22,1.29),(-.88,.43),(1.48,.49),(3.5,.52),(5.12,.34),(7.68,.32),
         (9.35,1.76),(9.31,4.07),(8.43,5.89),(6.05,6.46),(3.38,6.72),
         (.74,6.28),(-.72,5.91),(-1.02,5.37),(-1.19,4.76),(-2.37,4.05),(-2.53,3.62)]
STAIR_RUNS = (
    ('Quay stair',(-5.83,-7.62,.88),(-5.83,-6.39,1.73),1.35,5),
    ('Lower terrace stair',(-1.65,-4.70,1.73),(-1.65,-2.03,3.47),1.46,10),
    ('Archive staircase',(2.70,-2.17,3.47),(2.70,1.11,5.46),1.70,11),
    ('West gallery stair',(-2.86,5.26,3.47),(-.90,5.26,5.46),1.04,10),
)


def geology(group):
    coast = terraces('Harbor · closed folded coastal bedrock',SHORE,
                     [(.25,-2.20,.24,'shale'),(.11,-1.44,.41,'shale'),(.025,-.67,.36,'cliff'),
                      (0,-.26,.24,'shale'),(.053,.16,.13,'talus'),(.075,.52,.19,'cliff'),
                      (.126,1.16,.19,'cliff'),(.127,LOW,0,'grass')],group,616)
    terraces_mid = terraces('Reading shelf · closed bluff and grassy bench',MID,
                            [(0,1.48,.15,'cliff'),(.04,1.91,.18,'cliff'),(.105,2.36,.18,'shale'),
                             (.072,2.82,.21,'cliff'),(.091,3.14,.09,'talus'),(.103,MIDDLE,0,'grass')],
                            group,713,(0,1.6))
    summit = terraces('Archive ridge · closed slate ledge and summit',UPPER,
                      [(0,3.17,.11,'cliff'),(-.032,3.65,.11,'cliff'),(.067,3.96,.095,'shale'),
                       (.10,4.13,.079,'talus'),(.093,4.78,.14,'cliff'),(.12,HIGH,0,'grass')],
                      group,371,(3.27,3.57))
    rocks = collection('Exposed seams and coastal scree',group)
    formation = (
        (-10.50,-3.85,.48,1.24,.68,.40),(-9.64,-5.37,.58,.75,.52,.37),
        (-11.49,-.96,-.23,1.32,.72,.92),(-12.21,2.18,-.45,.81,.62,.65),
        (-8.33,-7.35,.10,1.13,.58,.36),(-4.00,-7.75,.33,.96,.52,.39),
        (-2.61,-7.69,.43,.54,.41,.31),(1.92,-7.24,.31,1.06,.61,.39),
        (5.13,-7.75,.29,1.13,.59,.48),(7.88,-6.21,.37,1.36,.69,.44),
        (10.33,-3.34,-.18,1.24,.69,.66),(11.48,-1.11,-.45,.62,.70,.49),
        (10.52,2.15,-.30,1.16,.82,.62),(8.72,5.74,.58,1.12,.71,.41),
        (6.38,7.33,.32,.91,.63,.40),(3.49,7.68,.43,.65,.57,.30),
        (-1.72,7.69,.34,.68,.72,.43),(-6.18,7.02,.28,1.19,.67,.35),
        (-8.90,5.12,-.22,1.14,.73,.72),(-3.67,-2.42,2.09,.63,.40,.37),
        (-5.70,-2.13,2.32,.73,.47,.36),(-8.6,-2.05,2.15,1.02,.55,.63),
        (6.17,-2.08,2.41,.56,.39,.48),(7.83,-1.64,2.72,.78,.43,.39),
        (5.49,.15,4.25,.64,.37,.37),(-1.3,.65,4.36,.65,.49,.49),
        (8.37,4.91,4.32,.66,.40,.51),(-2.44,3.55,3.95,.63,.37,.45),
    )
    for i,(x,y,z,a,b,c) in enumerate(formation):
        faceted_rock('Bedrock · exposed angular slab',(x,y,z),(a,b,c),rocks,'cliff',228+i)
    for i,(x,y,z,a) in enumerate(((-12.54,-3.55,-.54,.52),(-8.26,-9.28,-.44,.64),
                                   (-3.26,-8.65,-.49,.45),(8.18,-8.08,-.57,.57),
                                   (12.31,2.69,-.50,.58),(10.75,5.54,-.48,.34),
                                   (-11.82,5.18,-.51,.43))):
        faceted_rock('Coastal skerry',(x,y,z),(a,a*.7,a*.64),rocks,'shale',341+i)
    return coast, terraces_mid, summit


def tiles(name, x0, y0, x1, y1, z, group, spacing=.55):
    nx = max(1, round((x1-x0)/spacing))
    ny = max(1, round((y1-y0)/(spacing*.84)))
    w,h = (x1-x0)/nx,(y1-y0)/ny
    for j in range(ny):
        for i in range(nx):
            block(name+' · squared flagstone',(x0+(i+.5)*w,y0+(j+.5)*h,z-.065),
                  (w-.024,h-.026,.13),group,'stone',i*3+j*5,.012)


def path(name, a, b, width, height, group):
    a,b = Vector(a), Vector(b)
    n = max(1, round((b-a).length/.47))
    yaw = math.atan2(a.x-b.x,b.y-a.y)
    for i in range(n):
        x,y = a.lerp(b,(i+.5)/n)
        obj = block(name+' · laid flagstone',(x,y,height-.068),
                    (width,(b-a).length/n-.018,.136),group,'stone',i,.012)
        obj.rotation_euler.z = yaw


def bedrock_supports(name, points, lands, group, size=.26):
    for x,y,z in points:
        floor = min(z-.26,sample_height(lands,x,y,ceiling=z-.05)-.17)
        block(name+' · founded pier',(x,y,(floor+z)/2),(size,size,z-floor),group,'stone',1,.018)
        block(name+' · cap',(x,y,z-.08),(size+.13,size+.12,.18),group,'mortar',2)


def routes(lands, group):
    quay = collection('Harbor · quay and cargo landing',group)
    lower = collection('Lower · quay march and court routes',group)
    middle = collection('Middle · continuous public terrace',group)
    upper = collection('Upper · archive forecourt and garden walks',group)
    for j in range(15):
        yy=-10.17+(j+.5)*.172
        block('Quay · individually laid decking',(-5.83,yy,.81),(2.96,.164,.14),quay,'plank',j,.014)
    for x in (-7.00,-5.83,-4.66):
        beam('Quay · marine timber bearer',(x,-10.22,.69),(x,-7.55,.69),.17,.22,quay,'timber')
        for y in (-10.04,-8.88,-7.83):
            floor=min(-.32,sample_height(lands,x,y,ceiling=.68)-.10)
            rod('Quay · driven pile',(x,y,floor),(x,y,.88),.115,quay,'timber')
            lathe('Quay · iron pile collar',(x,y,.835),[(.14,0),(.14,.065)],quay,'iron',8)
            if x != -5.83:
                beam('Quay · driven pile diagonal',(x,y,.16),(x+(1 if x<-5.83 else -1)*.48,y,.70),
                     .108,.112,quay,'timber')
    for x,y in ((-7.09,-9.86),(-4.57,-9.86),(-7.09,-7.97)):
        lathe('Quay · mooring bit',(x,y,.88),[(.13,0),(.125,.11),(.102,.27),(.144,.29),(.144,.34)],
              quay,'timber',8)
    railing('Quay · landward safety edge',[(-7.24,-9.16,.88),(-7.24,-7.67,.88),(-6.53,-7.67,.88)],
            quay,.65,.44)
    tiles('Quay head landing',-6.54,-6.39,-5.12,-5.67,1.734,lower,.54)
    bedrock_supports('Quay head',[(x,y,1.68) for x in (-6.28,-5.38) for y in (-6.34,-5.93)],lands,lower,.35)
    path('Lower arcade approach',(-6.49,-5.02),(1.17,-5.02),1.30,1.73,lower)
    path('West shoreline walk',(-6.49,-5.18),(-8.78,-4.43),.97,1.742,lower)
    for i,(name,a,b,w,n) in enumerate(STAIR_RUNS):
        collection_name = (lower,middle,upper,upper)[i]
        stairs(name,a,b,w,n,collection_name,rails=True)
        a,b=Vector(a),Vector(b)
        points=[]
        axis=b-a
        side=Vector((-axis.y,axis.x,0)).normalized()
        for factor in (.30,.67,.96):
            p=a.lerp(b,factor)
            for direction in (-1,1):
                x,y,z = p+side*direction*w*.31
                points.append((x,y,z-.11))
        bedrock_supports(name,points,lands,collection_name,.25)
    tiles('Middle promenade',-8.43,-2.02,7.5,-.92,3.47,middle,.60)
    tiles('Learning door forestep',-7.00,-.92,-5.26,-.52,3.47,middle)
    tiles('Reading gallery entrance',-3.40,-.92,-2.18,-.57,3.47,middle)
    tiles('Ridge forecourt',.10,1.10,7.77,1.93,5.46,upper,.58)
    tiles('West ridge landing',-.90,4.74,.23,5.78,5.466,upper,.54)
    bedrock_supports('West ridge landing',[(x,y,5.37) for x in (-.84,.03) for y in (4.85,5.61)],
                     lands,upper,.29)
    bedrock_supports('West stair wing plinth',[(-1.32,4.63,5.26),(-1.16,4.66,5.26)],lands,upper,.34)
    bedrock_supports('Reading hall rear plinth',[(-7.71,5.18,3.28)],lands,middle,.37)
    path('East observatory walk',(7.61,1.90),(7.95,2.87),.85,5.467,upper)
    path('Ridge service path',(7.95,2.87),(7.65,4.95),.84,5.473,upper)
    path('Back archive walk',(7.65,4.95),(5.89,5.12),.89,5.467,upper)
    path('Back garden traverse',(5.89,5.12),(.23,5.26),.88,5.460,upper)
    for name,points,batch in (
        ('Promenade · west overlook',[(-8.65,-2.00,3.47),(-2.54,-2.00,3.47)],middle),
        ('Promenade · center overlook',[(-.75,-2.06,3.47),(1.68,-2.06,3.47)],middle),
        ('Promenade · east overlook',[(3.70,-2.06,3.47),(7.62,-1.97,3.47)],middle),
        ('Ridge · terrace edge',[(.2,1.09,5.46),(1.74,1.09,5.46)],upper),
        ('Ridge · east terrace edge',[(3.64,1.09,5.46),(7.54,1.09,5.46),(8.01,1.78,5.46)],upper),
    ):
        railing(name,points,batch,.69,.54,'zinc')

    for x,y,z,batch in ((-6.87,-7.75,.88,quay),(-4.78,-7.75,.88,quay),
                       (-2.64,-4.81,1.73,lower),(-8.43,-1.73,3.47,middle),
                       (1.29,-1.88,3.47,middle),(4.20,-1.89,3.47,middle),
                       (.20,1.32,5.46,upper),(5.21,1.33,5.46,upper)):
        rod('Civic path · lantern standard',(x,y,z),(x,y,z+.68),.052,batch,'zinc')
        lantern('Civic path · sheltered lens',(x,y,z+.61),batch)
    return quay


def crate(name,x,y,z,group,scale=1):
    block(name+' · box',(x,y,z+.205*scale),(.60*scale,.47*scale,.41*scale),group,'plank',0,.01)
    for j in range(3):
        block(name+' · lid board',(x+(j-1)*.193*scale,y,z+.419*scale),
              (.184*scale,.484*scale,.043*scale),group,'plank',j,.01)
    for dx in (-.225,.225):
        for dy in (-.23,.23):
            block(name+' · corner strap',(x+dx*scale,y+dy*scale,z+.21*scale),
                  (.071*scale,.041*scale,.43*scale),group,'timber',1,.008)


def quay_props(quay):
    for x,y,z,s in ((-6.73,-8.23,.88,1.1),(-6.65,-8.80,.88,.90),(-6.72,-8.22,1.35,.72)):
        crate('Quay · archive freight case',x,y,z,quay,s)
    lathe('Quay · coiled mooring line',(-4.83,-9.09,.89),[(.22,0),(.23,.035),(.20,.067),(.15,.044),(.16,.01)],
          quay,'timber',13,closed=True)


def garden(lands, group):
    canopy=collection('Irregular coastal pines',group)
    understory=collection('Cypress, stones and groundcover',group)
    pines = [(-9.79,.41,2.25),(-9.36,2.35,2.12),(-9.28,4.05,2.02),
             (-7.44,5.97,1.16),(-5.90,6.19,1.84),(-4.48,5.88,1.57),
             (1.46,6.09,2.11),(3.15,6.15,1.97),(6.55,6.14,2.03),(9.12,5.10,1.90),
             (9.35,.99,2.13),(8.55,-.90,1.80),(9.52,-4.19,1.64),
             (-8.55,-3.43,1.82),(-9.51,-4.92,1.62),(-3.90,-6.70,1.34)]
    for i,(x,y,h) in enumerate(pines):
        z=sample_height(lands,x,y)
        sign=-1 if i%3 else 1
        q=Vector((x,y,z-.13))
        top=q+Vector((h*.16*sign,.08,h*.90))
        middle=q.lerp(top,.57)
        rod('Pine · rooted trunk',q,middle,h*.080,canopy,'timber',7)
        rod('Pine · bent crown leader',middle,top,h*.050,canopy,'timber',7)
        for j,(dx,dy,dz,k) in enumerate(((-.40,-.05,.66,.50),(.37,.11,.77,.44),
                                        (-.24,.22,.95,.41),(.08,-.10,1.10,.35))):
            end=q+Vector((h*dx*.56+h*.10*sign,h*dy*.60,h*dz))
            rod('Pine · branch collar',q.lerp(top,.48+j*.10),end,h*.023,canopy,'timber',6)
            faceted_rock('Pine · asymmetric needle mass',end,(h*k,h*k*.75,h*k*.63),
                         canopy,'pine',438+i*9+j)
    for i,(x,y,h) in enumerate(((-8.79,-1.13,1.04),(-3.72,-1.03,.92),(-.86,1.76,1.08),
                                (7.45,.97,1.11),(8.16,2.60,1.1),(1.04,-5.76,.81),
                                (7.25,-3.82,.94),(7.83,-5.85,.75),(-8.43,-5.97,.92))):
        z=sample_height(lands,x,y)
        rod('Cypress · small trunk',(x,y,z-.08),(x,y,z+h*.44),.050,understory,'timber',6)
        faceted_rock('Cypress · cut upright foliage',(x,y,z+h*.47),(h*.20,h*.24,h*.79),
                     understory,'pine',750+i)
    rng=random.Random(817)
    beds=[(-10.1,-1.8,1.22,.56),(-9.12,3.19,.69,.54),(-6.67,5.45,.73,.62),
          (-3.68,5.32,.66,.47),(.63,5.79,.74,.41),(4.74,5.95,.99,.49),
          (8.81,3.75,.52,.60),(8.22,-1.31,.53,.42),(9.14,-3.70,.49,.48),
          (7.87,-6.32,.59,.45),(2.58,-7.20,.61,.41),(-3.93,-5.94,.58,.35),
          (-8.61,-2.78,.63,.41),(-9.78,-4.99,.55,.53)]
    for i,(cx,cy,rx,ry) in enumerate(beds):
        for j in range(8):
            a=j*2.40
            k=rng.uniform(.34,.91)
            x,y=cx+math.cos(a)*rx*k,cy+math.sin(a)*ry*k
            z=sample_height(lands,x,y)
            s=rng.uniform(.14,.28)
            faceted_rock('Groundcover · low slate-edge foliage',(x,y,z-.01),(s,s*.88,s*.67),
                         understory,'leaves',i*10+j+862)
