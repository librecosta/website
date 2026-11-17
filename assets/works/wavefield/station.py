"""Rigid tension hardware, calibration workshop and observation platform."""

import math

import bpy
from mathutils import Vector

from fabric import panel
from geometry import beam, block, collection, conduit, lantern, lathe, material, railing, rod
from ground import EAST, WEST, apron, footing
from loom import SPAN, WARP, point


def spindle(name, start, end, radius, group, skin='iron'):
    a, b = Vector(start), Vector(end)
    d = b - a
    edge = min(.047,d.length*.24)
    profile = ((radius*.87,0),(radius,edge),(radius,d.length-edge),(radius*.87,d.length))
    return lathe(name,a,profile,group,skin,14,d)


def bolt(name, start, axis, size, group):
    a, d = Vector(start), Vector(axis).normalized()
    rod(name+' · washer', a,a+d*size*.21,size*.76,group,'zinc',10)
    rod(name+' · hex head',a+d*size*.20,a+d*size*.67,size*.59,group,'steel',6)


def loom_support(side, tree, group):
    west = side < 0
    deck = WEST[-1] if west else EAST[-1]
    axis = Vector((side*.171,0,0))
    low, high = point(side,-1)+axis, point(side,1)+axis
    direction = (high-low).normalized()
    roller_radius = .180
    spindle('Warp take-up drum',low-direction*.17,high+direction*.19,roller_radius,group,'steel')
    spindle('Under-slung tension beam',low-Vector((0,0,.31)),high-Vector((0,0,.31)),.096,group,'iron')
    for t in (0,1):
        p = low.lerp(high,t)
        spindle('Machined end collar',p-direction*.074,p+direction*.074,.213,group,'iron')
        spindle('Visible bearing axle',p-direction*.33,p+direction*.33,.087,group,'brass')
    for index in range(WARP):
        v = 2*index/(WARP-1)-1
        x,y,z = point(side,v)
        block('Warp · ceramic capture guide',(x+side*.016,y,z),(.109,.105,.071),
              group,'ivory' if index%4 else 'steel',index,.013)
        if index % 4 == 0:
            block('Drum · guide shoe',(x+side*.19,y,z+.173),(.19,.109,.055),group,'graphite',0,.009)
            bolt('Guide shoe fastener',(x+side*.22,y,z+.206),(0,0,1),.046,group)

    for j, t in enumerate((.105,.89)):
        head = low.lerp(high,t)
        y = head.y
        toes = ((side*(SPAN+.88),y-.30),(side*(SPAN+.59),y+.37)) if west else (
            (side*(SPAN+1.46),y-.48),(side*(SPAN+.67),y+.42))
        for k,(x,yf) in enumerate(toes):
            footing('Gantry · buried anchor stone',x,yf,deck-.09,.54,tree,group)
            block('Gantry · rolled footplate',(x,yf,deck+.046),(.51,.39,.092),group,'graphite',k,.019)
            for dx in (-.172,.172):
                for dy in (-.123,.123):
                    bolt('Foundation anchor',(x+dx,yf+dy,deck+.097),(0,0,1),.076,group)
            end = head + Vector((side*(.23+.07*k),(-.14 if k==0 else .14),.025))
            beam('Gantry · tapered-looking channel leg',(x,yf,deck+.11),end,.191,.304,group,'iron',k,.022)
            cap = Vector((x,yf,deck+.11)).lerp(end,.49)
            beam('Gantry · silver inner flange',cap,end,.062,.324,group,'zinc',k,.011)
            beam('Gantry · triangulated knee tie',(x,yf,deck+.34),head-Vector((0,0,.33)),
                 .085,.133,group,'steel',1,.013)
        block('Bearing housing',head+Vector((side*.237,0,0)),(.36,.34,.41),group,'graphite',1,.043)
        spindle('Bearing housing · bronze bush',head+Vector((side*.15,-.191,.025)),
                head+Vector((side*.15,.191,.025)),.116,group,'brass')
        for offset in (-.105,.105):
            bolt('Bearing housing bolt',head+Vector((side*.423,offset,-.075)),(side,0,0),.067,group)
        jack = head + Vector((side*(.88 if west else 1.14),-.16,-.67))
        pin = head + Vector((side*.21,-.16,-.10))
        spindle('Tension adjustment jack',jack,jack.lerp(pin,.72),.117,group,'zinc')
        spindle('Polished hydraulic rod',jack.lerp(pin,.68),pin,.062,group,'steel')
        a,b = jack.lerp(pin,.28),jack.lerp(pin,.42)
        spindle('Threaded jack ferrule',a,b,.138,group,'iron')
        for dy in (-.09,.09):
            offset = Vector((0,dy,0))
            rod('Jack trunnion',pin+offset,pin+offset*1.72,.081,group,'brass',10)
        conduit('Hydraulic return',(tuple(jack),tuple(jack+Vector((side*.29,.12,-.20))),
                                   (jack.x+side*.25,jack.y+.19,deck+.16)),.047,group,'graphite',True)
        # The two banks have different bracing and different accessible controls.
        if not west:
            x = head.x+.95
            beam('East · rear counter-strut',(x,y,deck+.18),(x+.41,y+.55,deck+.89),
                 .12,.18,group,'iron')
        block('Service position marker',head+Vector((side*.421,-.062,.114)),(.025,.083,.045),
              group,'ochre',j,.008)


def window_material():
    mat = bpy.data.materials.new('Calibration house · clear architectural glass')
    mat.diffuse_color = (.39,.54,.60,.29)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.72,.85,.88,1)
    shader.inputs['Roughness'].default_value = .13
    shader.inputs['Transmission Weight'].default_value = .90
    glass = nodes.new('ShaderNodeMixShader')
    glass.inputs[0].default_value = .38
    clear = nodes.new('ShaderNodeBsdfTransparent')
    link = mat.node_tree.links.new
    link(clear.outputs[0],glass.inputs[1])
    link(shader.outputs[0],glass.inputs[2])
    link(glass.outputs[0],nodes.get('Material Output').inputs['Surface'])
    return mat


def facade(name, a, b, z, height, bays, group, glass):
    a,b = Vector(a),Vector(b)
    direction = (b-a).normalized()
    outside = Vector((direction.y,-direction.x))
    length = (b-a).length
    def p(t,h,off=0):
        x,y = a + direction*t + outside*off
        return x,y,z+h

    for i in range(bays):
        l,r = i*length/bays,(i+1)*length/bays
        mid = (l+r)*.5
        beam(name+' · coated panel',p(l+.016,.24),p(r-.016,.24),.19,.46,group,'slate',i,.023)
        beam(name+' · foot trim',p(l,.076,.088),p(r,.076,.088),.065,.075,group,'graphite',0,.009)
        for arm in (l+.10,r-.10):
            bolt(name+' · panel clip',p(arm,.36,.118),(*outside,0),.049,group)
        beam(name+' · glazed bay jamb',p(l,.43),p(l,height),.11,.145,group,'iron',i,.010)
        for j,(bottom,top) in enumerate(((.49,1.37),(1.43,height-.051))):
            if top-bottom < .07:
                continue
            panel(name+' · inset glazing',[p(l+.057,bottom),p(r-.057,bottom),p(r-.057,top),p(l+.057,top)],
                  group,glass,.044,.006)
        if i%2==0:
            beam(name+' · thin central mullion',p(mid,.48,.036),p(mid,height-.044,.036),
                 .059,.061,group,'zinc',0,.007)
    beam(name+' · end jamb',p(length,.04),p(length,height),.12,.15,group,'iron',1,.011)
    for h in (.47,1.40,height):
        beam(name+' · rolled horizontal sill',p(0,h,.035),p(length,h,.035),.13,.112,group,'iron',1,.012)


def roof(group):
    x0,x1 = -11.43,-8.42
    y0,y1 = .72,4.63
    edges = ((x0,6.52),(-10.80,6.86),(-9.47,6.67),(x1,6.33))
    for k,((xa,za),(xb,zb)) in enumerate(zip(edges,edges[1:])):
        panel('Workshop · folded roof sheathing',[(xa,y0,za),(xb,y0,zb),(xb,y1,zb),(xa,y1,za)],
              group,material('graphite',2),.15,.021)
        for i in range(12):
            a = y0+(y1-y0)*i/12
            b = y0+(y1-y0)*(i+1)/12
            panel('Workshop · folded zinc tray',[(xa,a+.012,za+.099),(xb,a+.012,zb+.099),
                                                (xb,b-.012,zb+.099),(xa,b-.012,za+.099)],
                  group,material('roof',i+k),.043,.007)
            beam('Roof · standing seam',(xa,a,za+.125),(xb,a,zb+.125),.036,.059,group,'zinc',i,.006)
        for y in (y0-.018,y1+.018):
            beam('Roof · folded end flashing',(xa,y,za+.057),(xb,y,zb+.057),.089,.149,group,'zinc',0,.014)
    for x,z in edges:
        beam('Roof · continuous cap',(x,y0-.07,z+.106),(x,y1+.07,z+.106),.094,.071,group,'zinc',1,.013)
    vent = (-10.82,3.51,6.94)
    block('Roof · folded ventilator plinth',vent,(.59,.99,.18),group,'graphite',0,.033)
    block('Roof · crown weather hood',(vent[0],vent[1],7.105),(.75,1.14,.092),group,'zinc',2,.029)
    for side in (-1,1):
        for i in range(4):
            block('Roof · recessed exhaust louver',(vent[0]+side*.302,vent[1],6.98+i*.029),
                  (.066,.89,.021),group,'iron',0,.005)
    conduit('Roof · recessed gutter downpipe',((x0+.02,4.52,6.48),(-11.25,4.53,6.15),
             (-11.18,4.53,4.68),(-11.27,4.65,4.43)),.069,group,'iron',True)


def clerestory(y, bottom, glass, group):
    heads = ((-11.19,6.63),(-10.80,6.82),(-9.47,6.63),(-8.71,6.38))
    for (xa,za),(xb,zb) in zip(heads,heads[1:]):
        panel('Workshop · shaped gable glazing',[(xa,y,bottom),(xb,y,bottom),
              (xb,y,zb),(xa,y,za)],group,glass,.047,.004)
        beam('Workshop · roof-to-wall trim',(xa,y,za),(xb,y,zb),.10,.082,group,'iron',1,.013)
    for x,z in heads:
        beam('Workshop · short gable mullion',(x,y,bottom),(x,y,z),.071,.09,group,'graphite',1,.009)


def workbench(name, x, y, z, group):
    for dx in (-.55,.55):
        for dy in (-.22,.22):
            beam(name+' · cast steel leg',(x+dx,y+dy,z),(x+dx,y+dy,z+.77),.093,.11,group,'iron',0,.009)
            block(name+' · caster foot',(x+dx,y+dy,z+.034),(.18,.166,.068),group,'graphite',0,.015)
    block(name+' · chamfered wood worktop',(x,y,z+.81),(1.34,.67,.118),group,'plank',1,.043)
    beam(name+' · low rear brace',(x-.58,y+.21,z+.29),(x+.58,y+.21,z+.29),.08,.11,group,'zinc')


def sample_frame(name, x, y, z, group):
    for i,mat in enumerate(('steel','azure','zinc','slate')):
        h = z+i*.046
        block(name+' · calibration strip',(x+i*.054,y+i*.034,h),(.56,.26,.053),group,mat,i,.014)


def workshop(tree, group):
    z = WEST[-1]
    apron('Calibration house · floating service floor',(-11.48,.70,-8.43,4.78,z),tree,group,wood=True)
    glass=window_material()
    facade('Workshop · south',( -11.19,1.02),(-8.71,1.02),z,1.84,3,group,glass)
    facade('Workshop · rear',(-8.71,4.34),(-11.19,4.34),z,1.87,3,group,glass)
    facade('Workshop · west',(-11.19,4.34),(-11.19,1.02),z,1.94,4,group,glass)
    facade('Workshop · east window',(-8.71,2.70),(-8.71,4.34),z,1.81,2,group,glass)
    for y in (1.02,2.52,4.34):
        beam('Workshop · loadbearing door post',(-8.71,y,z),(-8.71,y,z+1.91),.155,.17,
             group,'graphite',1,.024)
        beam('Workshop · transverse roof tie',(-11.21,y,z+1.87),(-8.69,y,z+1.87),.15,.165,
             group,'iron',1,.013)
        for x in (-11.20,-8.72):
            block('Workshop · bearing plate',(x,y,z+1.72),(.232,.19,.25),group,'iron',1,.017)
            bolt('Workshop · frame bolt',(x-.045,y-.101,z+1.75),(0,-1,0),.069,group)
    for x in (-11.18,-8.69):
        beam('Workshop · continuous eave bearer',(x,.92,z+1.90),(x,4.44,z+1.90),
             .203,.22,group,'graphite',0,.016)
    beam('Workshop · doorway threshold',(-8.65,1.08,z+.036),(-8.65,2.49,z+.036),.176,.073,group,'zinc')
    for y in (1.09,2.45):
        beam('Workshop · door guide',(-8.73,y,z+.11),(-8.73,y,z+1.75),.081,.092,group,'zinc',1)
    panel('Workshop · retracted sliding door',[(-8.71,2.59,z+.14),(-8.71,3.23,z+.14),
          (-8.71,3.23,z+1.68),(-8.71,2.59,z+1.68)],group,material('slate',1),.087,.021)
    for y in (2.67,3.12):
        beam('Sliding door · folded vertical rib',(-8.65,y,z+.19),(-8.65,y,z+1.63),.059,.067,group,'iron',1)
    beam('Sliding door · pull',(-8.60,2.69,z+.86),(-8.60,2.69,z+1.11),.045,.056,group,'zinc')
    clerestory(1.02,z+1.84,glass,group)
    clerestory(4.34,z+1.87,glass,group)
    roof(group)

    inside=collection('Calibration bench, roller jig and sample storage',group)
    workbench('Calibration bench',-10.13,3.82,z,inside)
    for x in (-10.61,-9.65):
        block('Bench · bearing stand',(x,3.82,z+1.04),(.18,.37,.33),inside,'iron',0,.027)
        bolt('Bench · bearing set screw',(x,3.81,z+1.207),(0,0,1),.051,inside)
    for y in (3.72,3.92):
        spindle('Bench · polishing roller',(-10.56,y,z+1.06),(-9.71,y,z+1.06),.079,inside,'steel')
    sample_frame('Bench',-9.76,4.01,z+.92,inside)
    block('Recessed sample cabinet',(-10.91,2.33,z+.62),(.41,1.42,1.10),inside,'graphite',1,.032)
    for i in range(5):
        h=z+.22+i*.194
        block('Cabinet · labeled-by-color drawer face',(-10.675,2.33,h),(.089,1.21,.17),inside,'slate',i,.013)
        beam('Cabinet · recessed steel pull',(-10.623,2.19,h),(-10.623,2.44,h),.042,.054,inside,'steel')
    for x,y in ((-9.8,2.92),(-10.2,1.59)):
        lathe('Calibration stool · machined foot',(x,y,z),((.23,.02),(.235,.079),(.081,.133),(.064,.493)),
              inside,'iron',12)
        lathe('Calibration stool · ash seat',(x,y,z+.46),((.218,0),(.259,.04),(.257,.094),(.221,.12)),
              inside,'plank',11)
    for x in (-10.80,-9.25):
        rod('Workshop · pendant stem',(x,3.13,z+1.87),(x,3.13,z+1.69),.029,inside,'iron')
        lathe('Workshop · spun shade',(x,3.13,z+1.55),((.188,.012),(.184,.061),(.101,.151),(.051,.17)),
              inside,'graphite',12)
        lathe('Workshop · warm diffuser',(x,3.13,z+1.55),((.135,0),(.139,.036),(.117,.05)),
              inside,'amber',12)
    railing('Workshop · exposed service edge',[(-11.39,1.00,z),(-11.39,4.66,z),(-8.59,4.66,z)],
            group,spacing=.63,height=.58,key='iron')


def observation(group):
    z=EAST[-1]
    for path in ([(9.88,-3.23,z),(9.88,4.17,z),(7.18,4.17,z)],
                 [(7.20,-3.20,z),(7.20,3.40,z)],[(7.18,-3.24,z),(7.87,-3.24,z)],
                 [(9.39,-3.24,z),(9.88,-3.24,z)]):
        railing('Observation deck · wind guard',path,group,spacing=.67,height=.58,key='iron')
    x,y=9.25,.76
    workbench('Observation · calibration table',x,y,z,group)
    sample_frame('Observation',x+.21,y-.06,z+.88,group)
    for row in range(5):
        s,t=row/5,(row+1)/5
        a,b = -.235+.499*s,-.235+.499*t
        c,d = .87+.165*s,.87+.165*t
        panel('Observation · graduated sample bed',[(x-.51,y+a,z+c),(x-.08,y+a,z+c),
              (x-.08,y+b-.011,z+d),(x-.51,y+b-.011,z+d)],
              group,material('azure',row),.036,.008)
    for dx in (-.556,-.044):
        beam('Observation · slotted guide',(x+dx,y-.26,z+.881),(x+dx,y+.282,z+1.051),
             .077,.068,group,'steel',1,.010)
        bolt('Observation · exposed guide fixing',(x+dx,y-.19,z+.92),(0,0,1),.057,group)
    for dy in (-.237,.252):
        for dx,h in ((-.55,.89),(-.03,.89)):
            rod('Observation · sight carriage post',(x+dx,y+dy,z+h),(x+dx,y+dy,z+1.19),
                .046,group,'zinc',8)
    rod('Observation · tracer bar',(x-.55,y+.05,z+1.176),(x-.025,y+.05,z+1.176),
        .036,group,'steel',10)
    block('Observation · tracer carriage',(x-.27,y+.05,z+1.188),(.148,.088,.092),
          group,'graphite',0,.014)
    rod('Observation · height stylus',(x-.27,y+.05,z+1.166),(x-.27,y+.05,z+.965),
        .023,group,'brass',8)
    block('Observation · weatherproof instrument cabinet',(9.46,2.77,z+.35),(.61,.61,.68),group,'slate',1,.037)
    panel('Observation · latch lid',[(9.15,2.45,z+.69),(9.77,2.45,z+.69),
          (9.77,3.08,z+.82),(9.15,3.08,z+.82)],group,material('zinc',1),.080,.022)
    beam('Observation · latch bail',(9.33,2.434,z+.49),(9.53,2.434,z+.49),.057,.055,group,'brass')
    lantern('Observation · low light',(9.62,-2.87,z),group)
