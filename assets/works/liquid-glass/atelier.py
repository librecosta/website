"""The workshop, annex, elevated glazed bridge and outdoor test court."""

import math

from mathutils import Vector

from fabric import (beam, block, collection, conduit, framed_window, glass, glass_panel,
                    lathe, material, mesh, octagon, quad, railing, rod, section, slab)
from terrain import foundation, staircase


LAB_FLOOR = 3.14
RIDGE_FLOOR = 4.74
COURT_FLOOR = 3.21


def roof_plane(name, x0, x1, a, b, group, *, glazed=False):
    y0,z0=a
    y1,z1=b
    tiles=max(1,round((x1-x0)/.45))
    pitch=(x1-x0)/tiles
    outline=[(y0,z0-.12),(y1,z1-.12),(y1,z1),(y0,z0)]
    for i in range(tiles):
        left=x0+pitch*i
        part=section(name+' · standing seam panel',outline,left+.012,left+pitch-.012,group,'roof',i,.017)
        if glazed and i not in {0,tiles-1}:
            part.data.materials[0]=glass('Soft')
        beam(name+' · standing seam',(left,y0,z0+.025),(left,y1,z1+.025),.047,.049,group,'frame',i%3,.01)
    beam(name+' · edge seam',(x1,y0,z0+.026),(x1,y1,z1+.026),.059,.049,group,'frame',1)
    for y,z in (a,b):
        beam(name+' · folded flashing',(x0-.04,y,z),(x1+.04,y,z),.093,.112,group,'bronze',2)


def workbench(name, center, width, group):
    x,y,z=center
    block(name+' · lower stretcher',(x,y,z+.26),(width-.12,.53,.085),group,'timber')
    block(name+' · top',(x,y,z+.92),(width,.74,.113),group,'plank',1,.035)
    block(name+' · felt pad',(x+.12,y,z+.982),(width*.66,.55,.028),group,'felt',1,.008)
    for dx in (-width*.4,width*.4):
        for dy in (-.26,.26):
            block(name+' · leg',(x+dx,y+dy,z+.43),(.105,.105,.86),group,'frame',2)
    for dx in (-width*.20,width*.16):
        block(name+' · drawer',(x+dx,y-.07,z+.74),(width*.31,.54,.19),group,'timber',1)
        beam(name+' · bronze pull',(x+dx-.080,y-.35,z+.745),(x+dx+.080,y-.35,z+.745),.026,.034,group,'brass')


def bench_optics(point, group):
    x,y,z=point
    block('Bench collimator · dovetail',(x,y,z+.045),(1.10,.41,.09),group,'frame')
    for i,dx in enumerate((-.42,-.08,.33)):
        block('Bench collimator · sliding shoe',(x+dx,y,z+.115),(.21,.34,.136),group,'zinc')
        lathe('Bench collimator · fine trim',(x+dx,y,z+.14),[(.039,0),(.039,.22)],group,'brass',8)
        housing=lathe('Bench collimator · objective sleeve',(x+dx-.07,y,z+.34),
                      [(.139,0),(.15,.033),(.15,.133),(.126,.153)],group,'bronze',12,(1,0,0))
        cap=lathe('Bench collimator · glass objective',(x+dx+.081,y,z+.34),
                  [(.106,0),(.116,.013),(.111,.032)],group,'porcelain',12,(1,0,0))
        cap.data.materials[0]=glass('Clear' if i!=1 else 'Prismatic')
        housing.data.materials.append(material('frame'))
        for polygon in housing.data.polygons:
            if polygon.index % 5 == 0:
                polygon.material_index=len(housing.data.materials)-1
    block('Bench collimator · ceramic reflector',(x+.62,y,z+.24),(.045,.32,.38),group,'porcelain')


def workshop(ground, parent):
    group=collection('Main lab · raised clerestory and working arcade',parent)
    z=LAB_FLOOR
    outline=octagon(-4.42,-1.05,2.67,2.17,.075)
    foundation('Workshop podium',outline,z,ground,group)
    for i in range(13):
        for j in range(6):
            # A stone apron in the open bays gives way to a timber working floor.
            block('Lab paving · open arcade',(-6.82+i*.397,-3.05+j*.351,z+.032),
                  (.38,.330,.061),group,'stone',i+2*j,.012)
    for i in range(13):
        block('Lab paving · oiled boards',(-6.82+i*.394,.048,z+.03),(.378,1.83,.060),group,'plank',i,.016)
    for x in (-6.95,-5.19,-3.54,-1.90):
        for y in (-2.92,-.12,1.00):
            head=(6.17 if y==-.12 else 5.59 if y==1 else 5.49)
            block('Main lab · limestone column foot',(x,y,z+.13),(.34,.36,.25),group,'stone',2,.028)
            block('Main lab · load-bearing upright',(x,y,(z+.24+head)/2),(.163,.198,head-z-.24),group,'frame',1,.032)
            block('Main lab · bronze capital',(x,y,head-.055),(.26,.285,.122),group,'bronze',2)
    for y,h in ((-2.92,5.49),(-.12,6.17),(1,5.59)):
        beam('Main lab · transverse header',(-7.04,y,h),(-1.81,y,h),.22,.186,group,'frame')
    for x in (-6.95,-5.19,-3.54,-1.90):
        for a,b in (((x,-2.92,5.48),(x,-.12,6.17)),((x,-.12,5.72),(x,1,5.57))):
            beam('Main lab · tied rafters',a,b,.14,.17,group,'timber',1)
        beam('Main lab · arcade knee brace',(x,-2.92,5.015),(x,-2.43,5.58),.10,.12,group,'timber')
    # Rear doorway is left open between the stacked limestone panels.
    for x,width in ((-6.08,1.73),(-2.93,2.03)):
        for zz,hh,key in ((z+.43,.85,'stone'),(5.35,.48,'plaster')):
            block('Main lab · rear masonry infill',(x,1.0,zz),(width,.23,hh),group,key,1,.027)
        framed_window('Rear workshop window',(x,1.01,4.61),width-.25,1.29,group,panes=3)
    block('Main lab · doorway lintel',(-4.65,1.0,5.39),(1.42,.25,.32),group,'stone',1)
    # One masonry bay anchors the airy front and east elevations.
    block('Main lab · western wall',(-7.05,-1.04,4.36),(.215,4.05,2.42),group,'plaster',2)
    for y in (-2.18,-.91,.39):
        block('Main lab · masonry pilaster',(-7.19,y,4.31),(.2,.16,2.28),group,'stone',1)
    block('Main lab · front cabinet bay sill',(-6.08,-2.94,3.70),(1.51,.235,1.08),group,'stone')
    framed_window('Front cabinet bay',(-6.08,-2.95,4.72),1.47,.91,group,panes=3,kind='Soft')
    block('Main lab · front cabinet bay lintel',(-6.08,-2.94,5.31),(1.52,.2,.28),group,'stone',2)
    framed_window('East drawing room',(-1.90,.40,4.67),1.09,1.30,group,angle=math.pi/2,panes=2)
    block('Main lab · east window apron',(-1.91,.41,3.56),(.215,1.10,.77),group,'stone',1)
    # Discrete roof structures, with a run of vertical glass between the two slopes.
    roof_plane('Tall zinc roof',-7.29,-1.58,(-3.35,5.60),(-.08,6.48),group)
    roof_plane('Low frosted rear canopy',-7.14,-1.69,(-.08,5.98),(1.24,5.73),group,glazed=True)
    for i in range(8):
        framed_window('North clerestory light',(-6.79+.668*i,-.068,6.234),.62,.375,group,panes=1,kind='Soft')
    for x in (-7.11,-1.78):
        profile=[(-3.03,5.50),(1.09,5.50),(1.09,5.65),(-.075,5.91),(-.075,6.38)]
        section('Main lab · end closure',profile,x-.08,x+.075,group,'frame',1,.020)
    # Exterior awning leaves the workbench visible from the south and east.
    roof_plane('Glazed arcade awning',-5.02,-1.72,(-3.92,5.06),(-2.91,5.32),group,glazed=True)
    for x in (-4.94,-1.8):
        beam('Awning · bronze stay',(x,-2.91,5.45),(x,-3.88,5.08),.059,.070,group,'bronze',1)
    interior=collection('Arcade interiors · assembly benches, optics and storage',group)
    workbench('Long alignment station',(-4.34,-2.02,z+.07),2.12,interior)
    workbench('Lens packing station',(-2.65,-.63,z+.07),1.30,interior)
    bench_optics((-4.43,-2.03,z+1.058),interior)
    for i in range(3):
        block('Workbench · stacked sample plate',(-2.82,-.58,z+1.079+i*.068),(.37,.38,.052),interior,'porcelain',i)
    for y in (-2.37,-1.55,-.74):
        for j in range(3):
            block('Cabinet · shelf',(-6.56,y,z+.30+j*.43),(.58,.75,.063),interior,'timber',1)
            if (j+y)%2> .2:
                block('Cabinet · padded specimen case',(-6.57,y-.02,z+.44+j*.43),(.37,.43,.23),interior,'felt',j)
    for x in (-3.11,-5.57):
        lathe('Brazier lamp · workshop pendant',(x,-2.69,5.08),[(.07,0),(.14,.094),(.13,.17)],interior,'bronze',9)
        lathe('Workshop lamp · opal diffuser',(x,-2.69,5.035),[(.096,0),(.124,.064)],interior,'porcelain',9)
        rod('Workshop lamp · cable',(x,-2.69,5.23),(x,-2.69,5.56),.017,interior,'ink',6)
    conduit('Workshop · exterior drain',[(-6.98,1.25,5.70),(-7.16,.96,5.41),(-7.16,.95,3.33),
                                        (-7.13,1.46,3.02)],.105,group,'bronze',True)
    workshop_services(group)
    stack=collection('Annex · optical calibration room',parent)
    annex(ground,stack)


def workshop_services(group):
    # The vent intersects the standing seam with a raised curb and exposed flashing.
    x,y=-5.56,-.85
    for key,p,size in (('bronze',(x,y,6.23),(1.21,.88,.13)),('stone',(x,y,6.38),(1.05,.69,.41)),
                       ('frame',(x,y,6.64),(1.00,.65,.22))):
        block('Roof extract · '+key,p,size,group,key,1,.025)
    for i in range(5):
        xx=x+(i-2)*.184
        block('Roof extract · louver',(xx,y-.336,6.66),(.049,.067,.248),group,'bronze',2,.008)
    relief=[(y-.446,6.756),(y+.436,6.756),(y+.436,6.81),(y+.07,6.94),(y-.446,6.83)]
    section('Roof extract · folded cap',relief,x-.627,x+.627,group,'roof',3,.019)
    for yy in (-3.19,-3.08):
        beam('Arcade · folded gutter',(-7.25,yy,5.572),(-1.72,yy,5.572),.046,.06,group,'bronze',1,.01)
    for xx in (-6.72,-5.33,-3.94,-2.55):
        beam('Arcade · gutter bracket',(xx,-3.25,5.54),(xx,-2.99,5.63),.045,.055,group,'frame',1)
    for a,b in (((-7.24,-3.18,5.54),(-7.24,-3.02,5.21)),
                ((-7.24,-3.02,5.21),(-7.24,-3.02,3.92)),
                ((-7.24,-3.02,3.92),(-7.27,-3.34,3.51))):
        rod('Arcade · zinc rainwater pipe',a,b,.068,group,'zinc',9)


def annex(ground, group):
    x=-3.92
    floor=RIDGE_FLOOR
    foundation('Calibration annex plinth',octagon(x,3.40,1.57,1.47,.16),floor,ground,group)
    staircase('Workshop to calibration annex',(-4.65,1.11,LAB_FLOOR),(-4.65,2.27,floor),
              1.13,7,ground,group)
    roof_height=6.12
    for px in (-5.38,-2.54):
        for y in (2.27,4.69):
            block('Annex · structural column',(px,y,(roof_height+floor)/2),(.15,.155,roof_height-floor),group,'frame')
    for x0 in (-5.24,-2.72):
        block('Annex · glazed room end cheek',(x0,4.64,5.31),(.43,.20,1.14),group,'plaster')
    framed_window('Annex · north ribbon',(x,4.69,5.51),2.06,.85,group,panes=4,kind='Soft')
    framed_window('Annex · west ribbon',(-5.38,3.47,5.52),2.17,.85,group,angle=math.pi/2,panes=4,kind='Soft')
    block('Annex · southern recess',(-3.28,2.27,5.29),(1.16,.19,1.10),group,'plaster',1)
    framed_window('Annex · southern observation slot',(-3.27,2.15,5.55),.84,.48,group,panes=2,kind='Soft')
    profile=[]
    for i in range(9):
        f=i/8
        profile.append((2.05+2.88*f,6.12+.68*math.sin(math.pi*f)**.77))
    for i,(a,b) in enumerate(zip(profile,profile[1:])):
        relief=[(a[0],a[1]-.12),(b[0],b[1]-.12),b,a]
        section('Annex · ribbed barrel roof',relief,-5.62,-2.27,group,'roof',i,.018)
        beam('Annex · standing seam',(-5.64,a[0],a[1]+.015),(-2.25,a[0],a[1]+.015),.071,.060,group,'bronze',2)
    for y in (2.17,4.72):
        beam('Annex · limestone eave',(-5.65,y,6.10),(-2.25,y,6.10),.18,.19,group,'stone',1)
    workbench('Calibration bench',(-3.99,4.14,4.75),1.50,group)
    bench_optics((-4.10,4.20,5.747),group)
    bridge(ground,collection('Glazed passage · ridge crossing',group))


def bridge(ground, group):
    x0,x1=-2.57,1.51
    cy=3.40
    z=RIDGE_FLOOR
    for y in (cy-.64,cy+.64):
        beam('Bridge · continuous box girder',(x0,y,z-.11),(x1,y,z-.11),.135,.16,group,'frame')
        beam('Bridge · bronze cap rail',(x0,y,z+1.30),(x1,y,z+1.30),.095,.101,group,'bronze',2)
    for x in (-1.58,.63):
        for y in (cy-.53,cy+.53):
            foot=ground(x,y)
            block('Bridge · pier footing',(x,y,foot+.035),(.52,.54,.27),group,'stone',1)
            beam('Bridge · tapered steel pier',(x,y,foot+.06),(x,y,z-.18),.143,.146,group,'frame',2)
        beam('Bridge · pier X bracing',(x,cy-.53,ground(x,cy-.53)+.18),(x,cy+.53,z-.23),.065,.068,group,'frame',1)
        beam('Bridge · pier X bracing',(x,cy+.53,ground(x,cy+.53)+.18),(x,cy-.53,z-.23),.065,.068,group,'frame',1)
    for i in range(15):
        x=x0+(x1-x0)*(i+.5)/15
        block('Bridge · open-joint deck',(x,cy,z-.028),(.255,1.30,.125),group,'stone',i,.012)
    for i in range(5):
        x=x0+(x1-x0)*(i+.5)/5
        for y in (cy-.66,cy+.66):
            framed_window('Bridge bay',(x,y,z+.70),.732,1.11,group,panes=1)
    roof_plane('Bridge roof · west glass pitch',x0-.04,x1+.04,(cy-.72,z+1.29),(cy,z+1.54),group,glazed=True)
    roof_plane('Bridge roof · east glass pitch',x0-.04,x1+.04,(cy,z+1.54),(cy+.72,z+1.29),group,glazed=True)


def court(ground, group):
    z=COURT_FLOOR
    foundation('Test court podium',octagon(3.13,-3.45,2.67,1.71,.155),z,ground,group)
    for i in range(11):
        for j in range(7):
            x,y=.77+.47*i,-4.84+.45*j
            if (i in {0,10}) and (j in {0,6}):
                continue
            block('Court · optical grid paving',(x,y,z+.024),(.445,.425,.06),group,
                  'porcelain' if (i+j)%2 else 'stone',(i+j)%3,.012)
    # Narrow dark datum strips define an actual floor grid without adding labels.
    for i in (2,5,8):
        x=.77+.47*i+.235
        beam('Court · recessed datum', (x,-4.99,z+.058),(x,-2.07,z+.058),.033,.023,group,'ink',1,.006)
    for y in (-4.615,-3.265,-2.365):
        beam('Court · recessed transverse datum',(.67,y,z+.058),(5.65,y,z+.058),.032,.022,group,'bronze',2,.006)
    for i,kind in enumerate(('Clear','Soft','Prismatic')):
        x=1.38+1.53*i
        screen(x,-3.12,z+.06,kind,(.105,.29,.43)[i],(1.32,1.64,1.43)[i],group)
    railing('Court · shore-edge guard',[(1.10,-5.04,z),(5.17,-5.04,z),(5.68,-4.72,z)],
            group,spacing=.79,height=.57,key='frame')
    railing('Court · east edge guard',[(5.72,-4.60,z),(5.72,-2.56,z)],group,spacing=.75,height=.57,key='frame')
    foundation('Observer shelf',quad((5.84,-1.58),1.10,.56),z+.06,ground,group)
    staircase('Ridge approach',(5.34,-1.93,z+.07),(5.26,.70,RIDGE_FLOOR),.91,8,ground,group)
    for x,y in ((.86,-4.94),(5.17,-4.98),(5.65,-2.08)):
        lathe('Court · low opal marker',(x,y,z+.06),[(.107,0),(.086,.13),(.073,.47)],group,'frame',7)
        lathe('Court · opal lens',(x,y,z+.515),[(.081,0),(.078,.078),(.057,.127)],group,'porcelain',9)
    workbench('Field instrument table',(3.66,-2.02,z+.055),1.12,group)
    block('Field table · folded calibration tray',(3.61,-2.00,z+1.037),(.57,.41,.085),group,'bronze',1)
    block('Field table · opal sample', (3.57,-2.03,z+1.108),(.35,.24,.06),group,'porcelain',1)


def screen(x,y,z,kind,depth,height,group):
    w=1.00
    angle=-.19
    opening=z+.24+height/2
    u=Vector((math.cos(angle),math.sin(angle),0))
    v=Vector((-u.y,u.x,0))
    p=Vector((x,y,z))
    b=block(kind+' station · dressed footing',(x,y,z+.081),(1.27,.59,.16),group,'stone',1,.04)
    b.rotation_euler.z=angle
    for sign in (-1,1):
        rail=p+u*sign*(w/2+.065)
        block(kind+' station · pedestal shoe',rail+Vector((0,0,.17)),(.165,.41,.13),group,'bronze',1)
        beam(kind+' station · clip upright',rail+Vector((0,0,.16)),rail+Vector((0,0,.29+height)),.074,.086,group,'frame',1)
        for zz in (.34,height+.10):
            clip=block(kind+' station · pane clamp',rail+Vector((0,0,zz)),(.24,depth+.15,.131),group,'bronze')
            clip.rotation_euler.z=angle
    pane=glass_panel(kind+' · solid test specimen',(x,y,opening),(w,depth,height),kind,group,angle,
                     .055 if kind!='Prismatic' else .122)
    if kind=='Prismatic':
        pane.modifiers[-1].affect='EDGES'
    # A real metal test target behind each screen stays visible through the glass.
    target=p+v*.62
    for j in range(6):
        back=target+u*((j-2.5)*.135)
        h=.85 if j in {0,5} else 1.06
        marker=block(kind+' station · physical contrast target',back+Vector((0,0,h*.5+.16)),
                     (.095,.070,h),group,'porcelain' if j%2 else 'ink',j,.005)
        marker.rotation_euler.z=angle
    foot=block(kind+' station · target rail',target+Vector((0,0,.15)),(.96,.28,.15),group,'frame',1)
    foot.rotation_euler.z=angle
