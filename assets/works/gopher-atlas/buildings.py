"""Archive, reading rooms and the inhabited Topics arcade."""

import math

import bpy
from mathutils import Vector

from craft import (Bay, Face, arch_ring, base, beam, block, chair, collection, conduit, desk,
                   facade, lantern, lathe, rod, roof, shelf)
from geometry import object_in
from grounds import HIGH, MIDDLE, tiles


def room(name, x,y,z,w,d,height, group, front, rear, sides, key='plaster', depth=.52):
    base(name,x,y,z,w,d,group,depth)
    facade(name+' · south elevation',Face(x,y-d/2,z),w,height,front,group,key)
    facade(name+' · north elevation',Face(x,y+d/2,z,math.pi),w,height,rear,group,key)
    for side,bays in zip((-1,1),sides,strict=True):
        facade(name+' · '+('west' if side<0 else 'east')+' elevation',
               Face(x+side*w/2,y,z,side*math.pi/2),d,height,bays,group,key)


def downpipe(name, x,y,z,drop, group,side=1):
    conduit(name,[(x,y,z),(x+.13*side,y,z-.14),(x+.17*side,y,z-.30),
                  (x+.17*side,y,drop+.40),(x+.24*side,y+.12,drop+.27)],.084,group,'copper')
    for v in (drop+.62,(z+drop)*.5,z-.41):
        block(name+' · wall strap',(x+.13*side,y,v),(.16,.132,.066),group,'zinc',1,.009)


def room_light(name, group, x,y,z, power, size=1.1):
    light=bpy.data.lights.new(name,'AREA')
    light.energy=power
    light.color=(1,.83,.62)
    light.shape='DISK'
    light.size=size
    obj=object_in(name,light,group)
    obj.location=(x,y,z)


def dressed_column(name,x,y,z,h,group, stone='stone', square=False):
    block(name+' · square footing',(x,y,z+.072),(.46,.46,.144),group,'plaster',1,.029)
    if square:
        block(name+' · chamfered pier',(x,y,z+h/2),(.27,.30,h-.24),group,stone,0,.040)
    else:
        profile=[(.197,.126),(.197,.170),(.146,.23),(.135,h-.23),(.180,h-.172),(.176,h-.123)]
        lathe(name+' · tapered stone shaft',(x,y,z),profile,group,stone,10)
    block(name+' · stone capital',(x,y,z+h-.085),(.405,.445,.17),group,'plaster',2,.033)


def survey_instrument(x,y,z,group):
    """A low alidade fitted to a stone benchmark on the public terrace."""
    lathe('Alidade · engraved station plinth',(x,y,z),[(.47,0),(.47,.14),(.32,.17),
          (.28,.55),(.34,.60),(.38,.64)],group,'stone',12)
    lathe('Alidade · azimuth scale shoulder',(x,y,z+.64),[(.29,0),(.27,.06),(.24,.09)],
          group,'brass',18)
    for j in range(16):
        a=math.tau*j/16
        mark=block('Alidade · radial notch',(x+.245*math.cos(a),y+.245*math.sin(a),z+.727),
                   (.058,.018,.016),group,'iron',j,.004)
        mark.rotation_euler.z=a
    lathe('Alidade · fork pedestal',(x,y,z+.72),[(.125,0),(.10,.12),(.14,.17)],group,'zinc',12)
    for side in (-1,1):
        yy=y+side*.139
        block('Alidade · bearing yoke',(x,yy,z+.947),(.10,.086,.19),group,'brass',1,.020)
        lathe('Alidade · bearing nut',(x,yy,z+.990),[(.062,0),(.062,.037)],group,'brass',8,(0,side,0))
    axis=Vector((.92,.18,.32)).normalized()
    p=Vector((x,y,z+1.02))
    rod('Alidade · sighting barrel',p-axis*.23,p+axis*.33,.086,group,'iron',10)
    for direction in (-1,1):
        d=axis*direction
        lathe('Alidade · objective ferrule',p+d*.25,[(.089,0),(.104,.035),(.105,.070)],
              group,'brass',12,d)
        lathe('Alidade · inset objective',p+d*.319,[(.071,0),(.067,.018)],group,'glass',12,d)


def archive(parent):
    hall=collection('Main hall · catalog and reference nave',parent)
    wings=collection('Archive wings · reading room, stair hall and roofs',parent)
    interior=collection('Archive contents · catalog stacks and consultation desks',parent)
    observation=collection('Observation terrace · alidade and benchmark',parent)
    z=HIGH+.15
    x,y,w,d,h=2.70,3.36,5.62,3.02,3.08
    windows=[Bay(u,.88,.66,1.81,.39) for u in (-1.63,1.63)]
    room('Atlas hall',x,y,z,w,d,h,hall,[*windows,Bay(0,1.16,0,2.41,.48,'entry')],
         [Bay(u,.73,.71,1.40,.33) for u in (-1.67,0,1.67)],
         [[Bay(0,.77,.57,1.72,.32)],[Bay(0,.67,.67,1.45,.27)]])
    roof('Atlas hall · slate nave',x,y,z+h+.205,w,d,1.22,hall,ridge=.16)
    # Stone plinth and six piers carry a working entrance loggia below the facade.
    gate=Face(x,1.18,z)
    pier_locations=(-2.30,-1.04,1.04,2.30)
    for dx in pier_locations:
        dressed_column('Portico',x+dx,1.235,z,1.87,hall)
    for a,b in zip(pier_locations,pier_locations[1:]):
        arch_ring('Portico · arcade',gate,(a+b)/2,1.76,(b-a)/2-.15,.36,.153,.38,hall)
    block('Portico · concealed transverse ledger',(x,1.24,z+2.235),(5.19,.41,.19),hall,'stone',1,.034)
    for dx in pier_locations:
        beam('Portico · spanning roof joist',(x+dx,.997,z+2.29),(x+dx,1.93,z+2.66),
             .140,.148,hall,'timber',1)
    for i in range(13):
        u=x+(i-6)*.389
        beam('Portico · standing-seam canopy',(u,.97,z+2.345),(u,1.90,z+2.73),
             .388,.086,hall,'roof',i,.012)
        if i%2==0:
            beam('Portico · folded pan seam',(u-.174,1.01,z+2.405),(u-.174,1.88,z+2.769),
                 .031,.037,hall,'zinc',i,.005)
    beam('Portico · copper drip',(x-2.57,.94,z+2.333),(x+2.57,.94,z+2.333),.090,.105,hall,'zinc')
    # Divided clerestory and inset circular stonework distinguish the crossing.
    f=Face(x,1.85,z)
    f.piece('Clerestory · inset head frame',0,2.913,-.027,1.39,.24,.134,hall,'mortar',1)
    for u in (-.42,-.14,.14,.42):
        f.piece('Clerestory · divided upper light',u,2.922,-.110,.21,.155,.040,hall,'glass',1)
    f.piece('Clerestory · projecting stone sill',0,2.776,-.086,1.49,.067,.20,hall,'stone')
    for dx in (-2.42,-.88,.88,2.42):
        f.piece('Archive · facade pilaster',dx,1.52,-.015,.175,2.71,.121,hall,'stone',0,.017)
        f.piece('Archive · facade pilaster cap',dx,2.71,-.048,.232,.104,.17,hall,'stone',3,.016)
    rear=Face(x,4.882,z,math.pi)
    rear.piece('Archive · north continuous upper stone register',0,2.295,-.006,5.57,.072,.15,hall,'stone',2)
    for dx in (-2.39,-.84,.84,2.39):
        rear.piece('Archive · north masonry pilaster',dx,1.225,-.015,.144,2.04,.126,hall,'stone',2)
    downpipe('Atlas hall · north leader',.13,4.98,z+h+.12,z,hall,-1)
    downpipe('Atlas hall · west eave leader',.45,1.18,z+2.29,z,hall,-1)
    # The western stair tower and the east map room change the roof direction and level.
    room('West stair wing',-.62,3.71,z,1.55,2.08,2.34,wings,
         [Bay(0,.61,.64,1.29,.30)],[Bay(0,.69,.61,1.16,.26)],
         [[Bay(-.33,.55,.69,1.16,.235),Bay(.44,.38,.80,1.02,.16)],[]], 'stone',.77)
    roof('West wing · short cross roof',-.62,3.71,z+2.55,2.08,1.55,.74,wings,
         math.pi/2,tiles=False)
    room('East reading transept',6.59,3.55,z,2.53,2.98,2.66,wings,
         [Bay(0,1.20,.55,1.80,.48)],[Bay(0,.83,.67,1.30,.26)],
         [[],[Bay(-.69,.74,.57,1.58,.28),Bay(.69,.74,.57,1.58,.28)]])
    roof('East transept · cross gable',6.59,3.55,z+2.87,2.98,2.53,1.00,wings,
         math.pi/2,ridge=-.17)
    # An oculus cutout in the upper trim is visibly inset over the window below.
    face=Face(6.59,1.796,z)
    for radius,offset in ((.30,-.052),(.236,-.117)):
        lathe('Transept · circular gable molding',face.at(-.17,3.12,offset),
              [(radius,0),(radius,.05),(radius-.06,.06),(radius-.06,0)],
              wings,'stone',14,(0,-1,0),closed=True)
    lathe('Transept · recessed gable glass',face.at(-.17,3.12,-.119),
          [(.176,0),(.176,.016)],wings,'glass',14,(0,-1,0))
    for u in (-.247,-.093):
        face.piece('Transept · oculus stone muntin',u,3.12,-.138,.027,.31,.039,wings,'zinc')
    downpipe('Transept · east eave leader',7.86,4.87,z+2.80,z,wings)
    for xx in (1.13,2.71,4.28):
        shelf('Main archive · folio case',xx,4.40,z,1.28,1.89,interior,9)
    for xx,yy,yaw in ((1.38,3.00,.04),(3.92,3.11,-.07),(6.66,3.01,0)):
        desk('Archive · consultation table',xx,yy,z,1.15,.63,interior,yaw,True)
        chair('Archive · consultation chair',xx-.11,yy-.51,z,interior,yaw+math.pi)
    shelf('Transept · reference wall',6.58,4.52,z,1.80,1.92,interior,12)
    room_light('Archive · quiet room bounce',interior,x,3.05,z+2.95,48,2.1)
    room_light('Transept · reading room bounce',interior,6.42,3.0,z+2.51,32,1.25)
    for xx in (1.05,4.25):
        lantern('Archive entry · recessed light',(xx,1.65,z+1.41),hall)
    for xx in (.91,4.75):
        block('North archive · stone bench',(xx,5.03,z+.405),(.84,.247,.098),wings,'stone',2,.024)
        for dx in (-.26,.26):
            block('North archive · grounded bench leg',(xx+dx,5.03,z+.18),(.105,.222,.36),wings,'mortar')
    survey_instrument(6.47,1.48,z-.014,observation)
    block('Observation · stone reference marker',(7.48,1.40,z+.238),(.18,.20,.476),observation,'stone',3,.023)
    lantern('Observation · low boundary lamp',(7.34,1.32,z),observation)


def learning_notes(parent):
    structure=collection('Workshop · offset-roof learning studio',parent)
    interior=collection('Learning Notes · writing desks and working folios',parent)
    x,y,z,w,d,h=-6.17,.70,MIDDLE+.13,4.44,2.43,2.0
    room('Notes studio',x,y,z,w,d,h,structure,
         [Bay(-1.47,.84,.56,1.10,.19),Bay(0,.89,0,1.74,.23,'entry'),Bay(1.46,.88,.56,1.10,.19)],
         [Bay(u,.86,.50,1.12) for u in (-1.35,0,1.35)],
         [[Bay(0,1.00,.54,1.06)],[Bay(0,1.21,.43,1.21,.23)]])
    roof('Notes studio · offset standing-seam roof',x,y,z+h+.22,w,d,.95,structure,
         ridge=.37,tiles=False)
    block('Notes studio · raised rear flue',(-7.49,1.28,z+2.97),(.43,.36,1.15),
          structure,'mortar',1,.024)
    for j in range(4):
        block('Notes studio · raised masonry flue course',(-7.49,1.28,z+2.58+j*.221),
              (.46,.39,.047),structure,'stone',j,.012)
    block('Notes studio · flue coping',(-7.49,1.28,z+3.54),(.56,.49,.100),structure,'stone',1,.017)
    for side in (-1,1):
        xx=x+side*1.94
        beam('Notes studio · overdoor bracket',(xx,-.55,z+1.64),(xx,-.97,z+1.94),
             .125,.126,structure,'timber')
    for j in range(10):
        xx=x+(j-4.5)*.420
        beam('Notes studio · rain hood pan',(xx,-1.10,z+1.92),(xx,-.52,z+2.09),
             .416,.086,structure,'zinc',j,.012)
    downpipe('Notes studio · rear drain',-4.08,2.00,z+2.17,z,structure)
    for xx,yy,yaw in ((-7.43,.38,-.04),(-5.06,.52,.12)):
        desk('Notes studio · manuscript desk',xx,yy,z,1.21,.63,interior,yaw,True)
        chair('Notes studio · maker chair',xx+.19,yy+.49,z,interior,yaw)
    shelf('Notes studio · reference books',-6.22,1.70,z,1.63,1.47,interior,10)
    room_light('Notes studio · soft interior light',interior,x,.60,z+1.88,34)
    block('Notes studio · stone rinse basin',(-8.43,.05,z+.50),(.44,.40,.215),structure,'stone',3,.028)
    rod('Notes studio · basin support',(-8.43,.05,z),(-8.43,.05,z+.51),.104,structure,'mortar')


def curated_articles(parent):
    structure=collection('Reading hall · curated collections wing',parent)
    interior=collection('Curated Articles · archive drawers and reading room',parent)
    x,y,z,w,d,h=-5.78,3.88,MIDDLE+.135,4.09,2.77,2.46
    room('Curated reading hall',x,y,z,w,d,h,structure,
         [Bay(-.98,1.05,.59,1.43,.43),Bay(.97,1.06,.59,1.43,.43)],
         [Bay(u,.72,.65,1.25,.27) for u in (-1.28,0,1.28)],
         [[Bay(0,1.04,.58,1.53,.39)],[Bay(0,1.05,0,1.91,.40,'entry')]],depth=.81)
    roof('Curated hall · slate hip-span',x,y,z+h+.23,w,d,1.07,structure,ridge=-.07,tiles=True,
         cover='zinc')
    # A long folded ridge vent plus separate east entrance canopy give the wing a civic silhouette.
    block('Curated hall · set-back ridge vent',(x+.33,y-.07,z+h+1.26),(1.63,.36,.36),
          structure,'timber',1,.034)
    for i in range(8):
        block('Curated hall · screened ridge opening',(x+.33+(i-3.5)*.188,y-.27,z+h+1.28),
              (.14,.045,.156),structure,'glass',1,.010)
    roof('Curated hall · vent flashing',x+.33,y-.075,z+h+1.421,1.56,.24,.18,structure,
         tiles=False)
    downpipe('Curated hall · east downspout',-3.87,5.20,z+h+.21,z,structure)
    tiles('Curated hall · east threshold',-3.78,3.22,-2.70,4.44,z,structure,.47)
    for xx in (-6.95,-5.80,-4.65):
        face=Face(xx,4.79,z)
        face.piece('Curated cabinet · case body',0,.543,.06,.94,1.086,.44,interior,'timber',1)
        for row in range(5):
            for side in (-1,1):
                u=side*.223
                v=.16+row*.177
                face.piece('Curated cabinet · catalog drawer',u,v,-.182,.411,.156,.08,interior,'plank',row+side,.012)
                face.piece('Curated cabinet · brass label pull',u,v+.009,-.233,.105,.043,.025,interior,'brass',row,.008)
                face.piece('Curated cabinet · blank index slip',u,v+.012,-.249,.051,.023,.008,interior,'paper',row,.002)
        face.piece('Curated cabinet · coopered cap',0,1.104,.038,1.017,.088,.49,interior,'plank',1)
    for xx in (-6.84,-5.15):
        desk('Curated hall · reading table',xx,3.64,z,1.28,.70,interior,drawers=True)
        chair('Curated hall · reader chair',xx-.27,3.11,z,interior,math.pi)
        chair('Curated hall · reader chair',xx+.25,4.16,z,interior)
    room_light('Curated hall · desk bounce',interior,x,3.26,z+2.20,40,1.65)


def topics(parent):
    colonnade=collection('Topics · arcaded public route and display niches',parent)
    z, x= MIDDLE+.13,-2.80
    tiles('Topics · continuous limestone floor',x-.53,-.57,x+.53,4.70,z,colonnade,.45)
    for side in (-1,1):
        xx=x+side*.58
        for j in range(5):
            yy=-.42+j*1.13
            dressed_column('Topics · arcade pier',xx,yy,z,1.69,colonnade,square=True)
        face=Face(xx,1.84,z,side*math.pi/2)
        for y in (.145,1.275,2.405,3.535):
            u=(y-1.84)*side
            arch_ring('Topics · lintel arch',face,u,1.54,.39,.32,.10,.253,colonnade)
        beam('Topics · tie beam',(xx,-.66,z+1.96),(xx,4.28,z+1.96),
             .18,.24,colonnade,'timber')
        for j in range(11):
            yy=-.63+j*.482
            beam('Topics · timber transverse roof tie',(x-.71,yy,z+2.0),(x+.71,yy,z+2.0),
                 .087,.09,colonnade,'timber',j)
    roof('Topics · covered walkway',x,1.82,z+2.07,4.71,1.32,.41,colonnade,math.pi/2,tiles=False)
    for y in (.65,2.67):
        block('Topics · recessed display footing',(x+.29,y,z+.38),(.36,.55,.76),colonnade,'stone',1,.020)
        top=block('Topics · inclined display stone',(x+.28,y,z+.78),(.40,.61,.082),colonnade,'plaster',2,.016)
        top.rotation_euler.y=.22
        slip=block('Topics · bound route folio',(x+.27,y,z+.835),(.25,.37,.022),colonnade,'paper',1,.007)
        slip.rotation_euler.y=.22
    lantern('Topics · sheltered pendant',(x,1.31,z+1.60),colonnade)
    tiles('Topics · north turning landing',-3.48,4.70,-2.87,5.74,z,colonnade,.48)
