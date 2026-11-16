"""The launch deck, cantilevered control cabin and working maintenance bay."""

from math import sin

from mathutils import Vector

from fabric import (beam, block, collection, conduit, glazing, lantern, lathe, material,
                    panel, railing, rectangle, rod, slab, tapered)
from terrain import footings, ground_at, stair


CABIN = (-8.31,-1.93)


def cabin(group):
    x,y=CABIN
    base=rectangle(x,y,4.38,2.68,.48)
    band=rectangle(x+.15,y-.12,4.49,2.76,.55)
    crown=rectangle(x+.21,y-.10,4.29,2.57,.62)
    slab('Cabin · faced floor',base,4.57,4.74,group,'graphite',1,.045)
    for i,(a,b) in enumerate(zip(base,base[1:]+base[:1])):
        # The east end steps straight onto the service bridge.
        if b[0]==a[0] and a[0]>x:
            continue
        p,q=Vector((*a,4.76)),Vector((*b,4.76))
        length=(q-p).length
        count=3 if length>2 else 2 if length>1 else 1
        for j in range(count):
            u=p.lerp(q,j/count+.013)
            v=p.lerp(q,(j+1)/count-.013)
            panel('Cabin · removable steel apron',[u,v,v+Vector((0,0,.37)),u+Vector((0,0,.37))],
                  group,material('roof',i+j),.135,.017)
        beam('Cabin · sill trim',p+Vector((0,0,.37)),q+Vector((0,0,.37)),
             .094,.097,group,'bronze',i,.014)
    for i in range(8):
        j=(i+1)%8
        a,b=Vector((*band[i],5.13)),Vector((*band[j],5.13))
        c,d=Vector((*crown[i],6.14)),Vector((*crown[j],6.14))
        beam('Cabin · sloping mullion',a,c,.127,.145,group,'iron',i,.019)
        if i==2:
            # Leave an opening under the projecting head at the east end.
            beam('Cabin · door lintel',c,d,.15,.16,group,'iron',i,.016)
            continue
        count=4 if (b-a).length>2 else 2 if (b-a).length>1 else 1
        for k in range(count):
            lo=k/count+.012
            hi=(k+1)/count-.012
            panel('Cabin · laminated observation glass',[a.lerp(b,lo),a.lerp(b,hi),
                  c.lerp(d,hi),c.lerp(d,lo)],group,glazing('control'),.084,.016)
            if k:
                beam('Cabin · intermediate window stile',a.lerp(b,k/count),c.lerp(d,k/count),
                     .068,.089,group,'zinc',i,.013)
        beam('Cabin · exterior window head',c,d,.12,.157,group,'iron',i,.022)
    slab('Cabin · oversailing roof fascia',rectangle(x+.13,y-.04,4.68,2.86,.61),
         6.14,6.33,group,'iron',1,.045)
    upper=rectangle(x+.18,y-.07,3.67,1.94,.53)
    fascia=rectangle(x+.13,y-.04,4.55,2.72,.63)
    roof=tapered('Cabin · pitched roof crown',[(a,b,6.28) for a,b in fascia],
                 [(a,b,6.65+.06*(a-x)) for a,b in upper],group,material('roof',2),.042)
    for tone in (0,1,3,4):
        roof.data.materials.append(material('roof',tone))
    for face in roof.data.polygons:
        face.material_index=face.index%len(roof.data.materials)
    for j in range(4):
        at = y - .62 + j*.35
        beam('Cabin · folded roof rib',(x-1.78,at,6.56),(x+1.97,at,6.77),
             .072,.055,group,'zinc',j,.014)
    block('Cabin · roof intake curb',(x+.20,y+.34,6.82),(1.36,.63,.25),group,'graphite',1,.061)
    for i in range(7):
        block('Cabin · raised intake louvre',(x-.32+.16*i,y+.34,6.962),(.081,.48,.048),
              group,'zinc',i,.008)
    sloped_console(group)


def sloped_console(group):
    x,y=CABIN
    for i in range(3):
        u=x-1.26+i*1.24
        slab('Control · perimeter console base',rectangle(u,y-.65,1.11,.59,.09),
             4.73,5.13,group,'ivory',i,.031)
        console=block('Control · tilted instrument surface',(u,y-.61,5.23),(1.17,.62,.15),
                      group,'graphite',1,.034)
        console.rotation_euler.x=-.19
        for j in range(2):
            screen=block('Control · recessed glass instrument',(u+(.27 if j else -.27),y-.58,5.303),
                         (.38,.222,.03),group,'signal' if not j else 'iron',i,.014)
            screen.rotation_euler.x=console.rotation_euler.x
        for j in range(5):
            block('Control · flush keys',(u-.39+j*.128,y-.83,5.338),(.072,.044,.024),group,'zinc',j,.006)
        lathe('Control · chair pedestal',(u,y+.19,4.75),[(.22,0),(.08,.06),(.08,.33)],
              group,'iron',10)
        block('Control · seat pan',(u,y+.19,5.06),(.43,.38,.12),group,'oxide',i,.038)
        block('Control · curved seat back',(u,y+.33,5.24),(.41,.09,.38),group,'oxide',i,.040)
    slab('Control · corridor console',rectangle(x-.72,y+.86,2.85,.29),4.75,5.15,group,'zinc',1,.018)
    for j in range(4):
        block('Control · instrumentation rack',(x-1.75+j*.68,y+.88,5.42),(.55,.28,.51),group,'iron',1,.026)
        block('Control · optical readback',(x-1.75+j*.68,y+.722,5.52),(.35,.027,.12),group,'signal',1,.009)


def deck(tree, group):
    x,y=CABIN
    # Angled nose and narrow maintenance balcony leave the rock stairs open.
    outline=[(-10.80,-3.23),(-10.30,-3.62),(-8.67,-3.62),(-8.16,-3.25),
             (-6.08,-3.25),(-5.77,-2.89),(-5.77,-1.18),(-6.41,-.53),
             (-9.91,-.53),(-10.80,-1.28)]
    slab('Launch deck · steel perimeter frame',outline,4.26,4.51,group,'iron',1,.045)
    slab('Launch deck · inset ivory fascia',outline,4.51,4.61,group,'ivory',1,.026)
    for i,(a,b) in enumerate(zip(outline,outline[1:]+outline[:1])):
        for factor in (.28,.72):
            p=Vector((*a,4.39)).lerp(Vector((*b,4.39)),factor)
            block('Launch deck · flush anchor plate',p,(.142,.102,.093),group,'bronze',i,.015)
    for j,(u,v) in enumerate(((-9.91,-2.72),(-7.78,-2.75),(-9.24,-.78),(-6.41,-1.13))):
        base=ground_at(tree,u,v)
        footings('Launch deck pedestal',tree,u,v,base+.17,(.74,.68),group)
        beam('Launch deck · angled cantilever post',(u,v,base+.12),(u+.12,v,4.30),
             .229,.256,group,'steel',j,.04)
        beam('Launch deck · outrigging knee',(u,v,base+.18),(u+.64,v,4.28),
             .11,.145,group,'iron',j,.021)
    railing('Launch deck · front maintenance rail',[(-10.63,-3.19,4.61),(-10.26,-3.52,4.61),
            (-8.72,-3.52,4.61)],group,spacing=.73,height=.50,key='steel')
    railing('Launch deck · shaft-side rail',[(-7.34,-3.13,4.61),(-6.15,-3.13,4.61),
            (-5.90,-2.87,4.61),(-5.90,-2.33,4.61)],group,spacing=.68,height=.50,key='steel')
    stair('Control platform · glazed entry stair',(-7.87,-3.62,3.96),(-7.88,-3.21,4.61),
          .76,6,group,'steel')
    # East-facing door and the approach to the flight sleeve share the same deck level.
    for i in range(10):
        block('Track crossover · open metal grate',(-6.42+i*.098,-1.78,4.627),
              (.068,.81,.045),group,'zinc',i,.005)
    for dy in (-.42,.42):
        beam('Track crossover · bridge chord',(-6.41,-1.78+dy,4.55),(-5.53,-1.78+dy,4.62),
             .092,.112,group,'steel')
    railing('Track crossover · rail',[(-6.18,-2.23,4.63),(-5.51,-2.23,4.70)],
            group,spacing=.70,height=.48,key='iron')
    block('Track crossover · jack door reader',(-5.96,-2.20,4.94),(.12,.14,.53),group,'iron',2)
    block('Track crossover · inset indicator',(-5.96,-2.26,5.10),(.041,.025,.09),group,'signal')
    for p in ((-10.41,-3.15,4.61),(-6.19,-2.95,4.61)):
        lantern('Launch deck · working lamp',p,group)


def maintenance(tree, group):
    x,y=-9.21,2.32
    base=ground_at(tree,x,y)
    if base is None:
        raise ValueError('Maintenance bay footing misses the stone shoulder')
    footings('Maintenance bay',tree,x,y,base+.14,(2.50,1.35),group)
    floor=base+.14
    slab('Maintenance · open service floor',rectangle(x,y,2.47,1.30),
         floor-.11,floor,group,'graphite',1)
    for u in (-1.10,1.1):
        for v in (-.53,.53):
            leg=(x+u,y+v,floor)
            beam('Maintenance · spare bay column',leg,(leg[0],leg[1],floor+1.19+v*.38),
                 .141,.164,group,'steel',1,.026)
    for i in range(10):
        u=x-1.16+.255*i
        p=[(u-.122,y-.70,floor+1.00),(u+.122,y-.70,floor+1.00),
           (u+.122,y+.71,floor+1.54),(u-.122,y+.71,floor+1.54)]
        panel('Maintenance · sawtooth roof panel',p,group,material('roof',i),.08,.012)
        beam('Maintenance · standing seam',(u-.126,y-.72,floor+1.05),
             (u-.126,y+.72,floor+1.59),.025,.035,group,'zinc',i,.007)
    for i in range(11):
        block('Maintenance · rear wall panel',(x-1.11+.222*i,y+.56,floor+.57),
              (.20,.11,1.15),group,'ivory',i,.016)
    for u in (-1.05,1.05):
        beam('Maintenance · bracket',(x+u,y-.53,floor+.84),(x+u,y+.12,floor+1.28),
             .087,.094,group,'bronze',1,.014)
    beam('Maintenance · hoist jib',(x-.40,y+.22,floor+1.19),(x-.40,y-.95,floor+1.19),
         .127,.15,group,'iron',1)
    lathe('Maintenance · winding drum',(x-.40,y-.73,floor+1.11),[(.14,0),(.14,.22)],
          group,'bronze',10,(1,0,0))
    rod('Maintenance · pulley cable',(x-.31,y-.82,floor+1.12),(x-.31,y-.82,floor+.64),.017,
        group,'iron')
    for i,(u,v) in enumerate(((.52,.11),(.82,.21),(-.68,.26),(-1.01,.01))):
        block('Maintenance · flight equipment case',(x+u,y+v,floor+.17),(.36,.35,.34),
              group,'oxide' if i==2 else 'steel',i,.033)
        block('Maintenance · case lid',(x+u,y+v,floor+.347),(.37,.37,.047),group,'zinc',i,.017)
        for side in (-.125,.125):
            block('Maintenance · case buckle',(x+u+side,y+v-.184,floor+.269),
                  (.054,.038,.106),group,'bronze',i,.009)


def machines(group):
    for dy, tone in ((.05,0),(.27,1),(.50,2)):
        points=[(-10.48,-.15+dy,4.04),(-9.78,-.15+dy,4.04),(-9.29,-.15+dy,4.19),
                (-7.52,-.15+dy,4.19),(-7.09,-.15+dy,4.44),(-7.07,-.15+dy,4.83)]
        conduit('Launch · bundled cooling return',points,.088,group,'oxide' if tone==1 else 'steel',True)
    slab('Launch · pump skid',rectangle(-10.15,-.55,1.25,.75),3.87,4.04,group,'iron',1)
    lathe('Launch · horizontal pressure vessel',(-10.56,-.51,4.28),[(.21,0),(.25,.07),(.25,.80),(.20,.86)],
          group,'zinc',12,(1,0,0))
    for u in (-10.42,-9.94):
        lathe('Launch · vessel cinch',(u,-.51,4.28),[(.245,0),(.267,0),(.267,.075),(.245,.075)],
              group,'bronze',12,(1,0,0),closed=True)
    rod('Launch · vessel bleed tube',(-10.52,-.51,4.49),(-10.52,-.51,4.69),.041,group,'bronze')
    lathe('Launch · shutoff wheel',(-10.52,-.51,4.68),[(.074,0),(.074,.024)],group,'oxide',10)
    for j in range(5):
        block('Launch · steel cable tray link',(-8.10+.24*j,.62,4.09+sin(j*.38)*.045),
              (.19,.23,.08),group,'iron',2,.008)


def compressor(tree, group):
    x,y=-9.82,-3.99
    floor=3.67
    footings('Compressor gallery',tree,x,y,floor,(1.49,.89),group)
    lower=rectangle(x,y,1.48,.88,.14)
    upper=rectangle(x-.05,y-.04,1.43,.91,.13)
    slab('Compressor gallery · stone threshold',lower,floor-.08,floor+.02,group,'ivory',1)
    slab('Compressor gallery · solid rear wall',rectangle(x,y+.35,1.46,.18,.06),
         floor,floor+.68,group,'ivory',0)
    for u in (-.62,.62):
        beam('Compressor gallery · cantilever eave post',(x+u,y-.38,floor),
             (x+u,y-.38,floor+.61),.087,.086,group,'iron',1,.016)
    canopy=tapered('Compressor gallery · standing seam awning',
                 [(a,b,floor+.61+.22*(b-y)) for a,b in lower],
                 [(a,b,floor+.68+.22*(b-y)) for a,b in upper],
                 group,material('oxide',2),.026)
    canopy.data.materials.append(material('oxide',1))
    for face in canopy.data.polygons:
        face.material_index=face.index%2
    for k in range(5):
        u=x-.61+k*.29
        beam('Compressor gallery · folded eave seam',(u,y-.38,floor+.61),
             (u,y+.35,floor+.76),.034,.031,group,'bronze',k,.008)
    for u in (-.43,.16):
        block('Compressor · vibration-isolated mount',(x+u,y-.09,floor+.064),(.47,.49,.12),
              group,'iron',2,.029)
        lathe('Compressor · ribbed cylinder',(x+u-.20,y-.11,floor+.266),
              [(.142,0),(.163,.055),(.163,.36),(.129,.41)],group,'steel',12,(1,0,0))
        for k in range(4):
            lathe('Compressor · cooling rib',(x+u-.15+k*.087,y-.11,floor+.266),
                  [(.166,0),(.166,.031)],group,'zinc',12,(1,0,0))
        conduit('Compressor · copper outlet',
                [(x+u+.24,y-.11,floor+.26),(x+u+.26,y-.11,floor+.50),(x+u+.24,y+.17,floor+.53)],
                .067,group,'oxide')
    beam('Compressor gallery · vent rail',(x-.65,y-.37,floor+.53),(x+.62,y-.37,floor+.53),
         .063,.075,group,'oxide',1,.014)
    stair('Compressor gallery · approach',(-9.02,-4.00,3.69),(-9.81,-4.50,3.66),
          .54,4,group,'steel')


def relay(tree, group):
    x,y=7.85,-1.50
    floor=2.53
    footings('Departure utility pad',tree,x,y,floor,(1.80,1.32),group)
    footprint=rectangle(x,y,1.49,.92,.16)
    slab('Departure relay · raised plinth',footprint,floor,floor+.15,group,'graphite',1)
    slab('Departure relay · stepped equipment case',rectangle(x+.12,y,.99,.89),
         floor+.15,floor+.82,group,'ivory',1,.029)
    block('Departure relay · split face service door',(x-.13,y-.479,floor+.41),
          (.42,.092,.53),group,'roof',2,.022)
    block('Departure relay · narrow face vent',(x+.26,y-.477,floor+.49),
          (.32,.052,.36),group,'iron',0,.012)
    for i in range(5):
        block('Departure relay · angled vent louvre',(x+.26,y-.519,floor+.35+.064*i),
              (.32,.074,.025),group,'zinc',i,.006)
    roof=rectangle(x+.025,y-.025,1.58,1.07,.17)
    tapered('Departure relay · hinged canopy',[(a,b,floor+.78) for a,b in roof],
             [(a,b,floor+.91+abs(b-y)*.26) for a,b in roof],group,material('roof',2),.024)
    for side in (-1,1):
        pt=(x-.66,y+side*.34)
        beam('Departure relay · access brace',(*pt,floor+.09),(*pt,floor+.85),
             .091,.10,group,'bronze',0,.018)
    conduit('Departure relay · flexible flight data conduit',
            [(x+.54,y+.35,floor+.53),(8.44,-.97,2.93),(8.47,-.25,2.57),(8.39,.18,2.69)],
            .10,group,'oxide',True)
    lantern('Departure utility · low working light',(x-.74,y-.51,floor),group)


def control(tree, terminal, root):
    deck(tree,collection('01 · Launch platform and raised crossover',root))
    cabin(collection('02 · Cantilevered control cabin and interior',root))
    maintenance(tree,collection('03 · Maintenance awning and hoist',root))
    machines(collection('04 · Cooling lines and launch machinery',root))
    compressor(tree,collection('05 · Lower compressor gallery',root))
    relay(terminal,collection('06 · Departure relay and cable feed',root))
