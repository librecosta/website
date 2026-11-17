"""A solid biconvex objective suspended in a working two-axis cradle."""

import math

from mathutils import Quaternion, Vector

from atelier import RIDGE_FLOOR
from fabric import (aligned_block, arc, beam, block, collection, conduit, glass, lathe,
                    mesh, octagon, railing, rod, section)
from terrain import foundation


CENTER = Vector((3.61,2.40,7.48))
NORMAL = Vector((.58,-.809,.105)).normalized()
HORIZONTAL = Vector((-NORMAL.y,NORMAL.x,0)).normalized()
VERTICAL = NORMAL.cross(HORIZONTAL).normalized()


def objective(group):
    """Two curved optical faces, polished bevel and a closed cylindrical edge."""
    radius=1.93
    steps=64
    # Symmetric curved faces. The path runs from the rear pole to the front pole.
    profile=[(r*radius,-.19-.36*(1-r*r)) for r in (.15,.32,.51,.70,.86,.957,.99)]
    profile.extend(((radius,-.17),(radius,.17)))
    profile.extend((r*radius,.19+.36*(1-r*r)) for r in (.99,.957,.86,.70,.51,.32,.15))
    verts=[]
    for r,depth in profile:
        for j in range(steps):
            t=math.tau*j/steps
            verts.append(CENTER+NORMAL*depth+(HORIZONTAL*math.cos(t)+VERTICAL*math.sin(t))*r)
    faces=[tuple(reversed(range(steps)))]
    slots=[0]
    for i in range(len(profile)-1):
        for j in range(steps):
            k=(j+1)%steps
            a,b=i*steps,(i+1)*steps
            faces.append((a+j,a+k,b+k,b+j))
            slots.append(int(i in {6,7,8}))
    faces.append(tuple(range((len(profile)-1)*steps,len(profile)*steps)))
    slots.append(0)
    lens=mesh('Objective · enclosed crown glass with polished edge',verts,faces,group,
              [glass('Clear'),glass('Prismatic')],slots)
    for face in lens.data.polygons:
        face.use_smooth=True


def optics(ground, parent):
    platform=collection('Observatory terrace · limestone and access',parent)
    floor=RIDGE_FLOOR
    foundation('Observatory terrace',octagon(3.54,2.67,2.83,2.24,.22),floor,ground,platform)
    for j in range(9):
        for i in range(12):
            x,y=.94+i*.466,.70+j*.467
            if (i in (0,11) and j in (0,8)):
                continue
            block('Observatory · ashlar paving',(x,y,floor+.026),(.449,.450,.057),platform,'stone',i*3+j,.011)
    for points in ([(.99,.62,floor),(4.48,.62,floor)],
                   [(5.94,.74,floor),(6.25,1.06,floor),(6.25,4.40,floor),(5.62,4.85,floor)],
                   [(5.60,4.85,floor),(1.52,4.85,floor),(1.05,4.58,floor)]):
        railing('Observatory · guard with landing gap',points,platform,spacing=.83,height=.63,key='frame')
    for x,y in ((1.25,.95),(5.95,4.06)):
        lathe('Observatory · ground lamp',(x,y,floor+.055),[(.12,0),(.083,.10),(.073,.36)],platform,'frame',8)
        lathe('Observatory · opal lamp core',(x,y,floor+.39),[(.074,0),(.079,.11),(.061,.14)],platform,'porcelain',10)
    cradle=collection('Suspended objective · glass and azimuth mechanism',parent)
    pedestal(cradle)
    objective(cradle)
    rim_and_yoke(cradle)
    mount=collection('Optical bench · rear target and service console',parent)
    test_target(mount)


def pedestal(group):
    x,y=CENTER.xy
    z=RIDGE_FLOOR
    lathe('Azimuth · anchored octagonal curb',(x,y,z+.044),[(1.35,0),(1.42,.07),(1.42,.16),(1.31,.207)],group,'stone',8)
    for key,tone,profile in (
        ('frame',1,[(1.11,.22),(1.18,.26),(1.18,.44),(1.03,.49)]),
        ('zinc',0,[(1.018,.453),(1.045,.48),(1.045,.556),(1.018,.579)]),
        ('bronze',0,[(.97,.574),(1.04,.61),(1.04,.68),(.93,.73)]),
    ):
        lathe('Azimuth · concentric bearing layer',(x,y,z),profile,group,key,24)
    for i in range(24):
        a=math.tau*i/24
        p=Vector((x+1.10*math.cos(a),y+1.10*math.sin(a),z+.44))
        tooth=block('Azimuth · exposed worm wheel tooth',p,(.16,.105,.102),group,'brass',i%2,.016)
        tooth.rotation_euler.z=a
    for side in (-1,1):
        p=Vector((x,y,z+.67))+HORIZONTAL*(side*.66)
        stop=Vector((x,y,z+.16))+HORIZONTAL*(side*2.25)
        beam('Cradle · cantilever foot',p,stop,.28,.26,group,'frame',1)
        shoe=Vector((stop.x,stop.y,z+.12))
        aligned_block('Cradle · bolted outrigger sole',shoe,(.62,.63,.125),
                      (HORIZONTAL,Vector((-HORIZONTAL.y,HORIZONTAL.x,0)),Vector((0,0,1))),group,'bronze',1)
        for dx in (-.18,.18):
            for dy in (-.19,.19):
                lathe('Cradle · bed stud',shoe+Vector((dx,dy,.067)),[(.044,0),(.048,.032),(.037,.053)],group,'brass',6)
    motor=Vector((x,y,z+.39))+NORMAL*.91+HORIZONTAL*.73
    lathe('Azimuth · geared drive',motor,[(.235,0),(.263,.10),(.25,.52),(.197,.62)],group,'frame',12,HORIZONTAL)
    for i in range(6):
        at=motor+HORIZONTAL*(.13+i*.066)
        lathe('Azimuth · drive cooling fin',at,[(.27,0),(.27,.03)],group,'zinc',12,HORIZONTAL)
    wheel=motor+HORIZONTAL*.65+NORMAL*.107
    upward=Vector((0,0,1))
    cross=HORIZONTAL.cross(upward)
    arc('Azimuth · service handwheel',wheel,upward,cross,.224,.279,.072,(.035,math.tau-.035),group,'bronze',3,26)
    for j in range(3):
        a=math.tau*j/3
        tip=wheel+(upward*math.cos(a)+cross*math.sin(a))*.249
        rod('Azimuth · handwheel spoke',wheel,tip,.034,group,'brass',8)
    lathe('Azimuth · handwheel hub',wheel-HORIZONTAL*.054,[(.095,0),(.087,.116)],group,'frame',10,HORIZONTAL)


def rim_and_yoke(group):
    c,u,v,n=CENTER,HORIZONTAL,VERTICAL,NORMAL
    # Split bronze gasket and offset yoke produce separated silhouettes in the oblique view.
    for i in range(4):
        a=math.tau*i/4+.041
        b=math.tau*(i+1)/4-.041
        arc('Objective · segmented rim casting',c,u,v,1.922,2.058,.28,(a,b),group,'bronze',i,16)
        arc('Objective · inner lip',c+n*.145,u,v,1.917,1.978,.081,(a,b),group,'brass',1,16)
    yoke_center=c+u*.13-v*.11-n*.22
    tilt=Quaternion(v,.155)
    skew=tilt@u
    for i,(a,b) in enumerate(((-2.87,-.44),(-.41,1.31),(1.36,3.06))):
        arc('Gimbal · weathered eccentric outer yoke',yoke_center,skew,v,2.22,2.44,.22,(a,b),group,'frame',i,22)
        arc('Gimbal · raised bronze wear strip',yoke_center+n*.12,skew,v,2.395,2.46,.057,(a+.08,b-.08),group,'bronze',i,22)
    for angle in (-2.79,-1.53,-.58,.46,1.63,2.78):
        ray=u*math.cos(angle)+v*math.sin(angle)
        beam('Gimbal · radial pad carrier',c+ray*1.99,yoke_center+ray*2.31,.145,.11,group,'bronze',2)
        p=c+ray*2.055+n*.164
        lathe('Objective · cap screw and backing washer',p,[(.068,0),(.065,.031),(.043,.054)],group,'brass',8,n)
    for i in range(4):
        a=2.75+.157*i
        arc('Gimbal · stepped counterweight castings',yoke_center,skew,v,2.34,2.56+.032*i,
            .34,(a,a+.14),group,'bronze',2+i%2,4)
    for sign in (-1,1):
        pivot=c+u*(sign*2.36)-n*.11
        for k,(length,radius,key) in enumerate(((.17,.325,'frame'),(.145,.265,'bronze'),(.153,.18,'brass'))):
            at=pivot+u*(sign*(.14*k-.045))
            lathe('Elevation · concentric trunnion cartridge',at,[(radius,0),(radius,length*.70),(.88*radius,length)],
                  group,key,16,u*sign)
        for offset in (-.66,.59):
            foot=Vector((c.x,c.y,RIDGE_FLOOR+.57))+u*sign*.91+n*offset
            knee=pivot-u*sign*.25+Vector((0,0,-.65))+n*(offset*.34)
            beam('Cradle · splayed lower leg',foot,knee,.222,.267,group,'frame',sign+1,.042)
            beam('Cradle · cast upper link',knee,pivot,.265,.233,group,'bronze',1,.037)
            for p in (foot,knee):
                lathe('Cradle · hex-head clevis pin',p+n*.137,[(.095,0),(.095,.045),(.075,.073)],group,'brass',6,n)
        # Short actuator runs parallel to the rear leg, below the glass opening.
        base=pivot-u*sign*1.18-v*1.44-n*.57
        tip=pivot-u*sign*.22-v*.44-n*.16
        rod('Elevation · hydraulic barrel',base,base.lerp(tip,.64),.134,group,'frame',12)
        rod('Elevation · polished ram',base.lerp(tip,.53),tip,.072,group,'zinc',12)
        for p in (base,tip):
            lathe('Elevation · ram pin washer',p+n*.069,[(.103,0),(.102,.051)],group,'bronze',10,n)
    conduit('Elevation · flexible power return', [tuple(c-u*2.50-v*.27-n*.31),tuple(c-u*2.18-v*.99-n*.50),
              tuple(c-u*1.76-v*1.78-n*.81),tuple(c-u*1.32-v*2.27-n*.45)],.071,group,'ink')


def test_target(group):
    u,v,n=HORIZONTAL,VERTICAL,NORMAL
    # Only the upper strip crosses the optical axis; more of the island stays visible through the lens.
    p=CENTER-n*1.47+u*.38-v*.26
    for i in range(9):
        at=p+u*(i-4)*.180
        aligned_block('Rear optical target · ceramic and dark reference slats',at,(.119,1.13,.082),
                      (u,v,n),group,'porcelain' if i%2==0 else 'ink',i,.012)
    for offset in (-.597,.597):
        a,b=p+v*offset-u*.85,p+v*offset+u*.85
        beam('Rear optical target · framed spreader',a,b,.077,.086,group,'frame',1)
    for side in (-1,1):
        edge=p+u*side*.808-v*.572
        foot=Vector((edge.x-.16,edge.y+.24,RIDGE_FLOOR+.07))
        beam('Rear optical target · braced stanchion',foot,edge,.115,.138,group,'frame')
        beam('Rear optical target · rear diagonal',foot+Vector((-.38,.40,0)),edge-v*.34,.066,.073,group,'bronze',2)
        block('Rear optical target · anchor plate',foot,(.36,.29,.084),group,'bronze',2)
    x,y,z=1.92,1.19,RIDGE_FLOOR
    plate=[(-.29,0),(.28,0),(.28,.64),(-.29,.86)]
    section('Service console · sloped bronze housing',[(y+a,z+b) for a,b in plate],x-.35,x+.35,group,'frame',1,.025)
    for side in (-1,1):
        block('Service console · foundation feet',(x+side*.27,y,z+.071),(.13,.71,.124),group,'stone',0)
    for i in range(5):
        lathe('Service console · tactile selector',(x+(i-2)*.103,y-.153,z+.823),
              [(.023,0),(.032,.014),(.03,.047)],group,'brass' if i%2==0 else 'porcelain',8)
    conduit('Service console · armored lead',[(x+.33,y+.18,z+.31),(x+.46,y+.23,z+.12),
              (2.62,1.38,z+.11),(3.00,1.74,z+.24)],.089,group,'bronze',True)
