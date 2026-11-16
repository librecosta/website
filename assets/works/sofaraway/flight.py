"""An open-sided miniature of an enclosed octagonal flight corridor."""

from mathutils import Vector

from fabric import (beam, block, collection, glazing, interpolate, lathe, material, panel,
                    railing, rectangle, rod, slab)
from terrain import footings


# X station, centre Y / Z, cross-section half width / height.
ROUTE = (
    (-10.35,.51,6.54,1.59,1.71), (-8.23,.47,6.55,1.83,1.88),
    (-6.27,.39,6.55,1.92,1.87), (-3.34,.26,6.60,1.84,1.86),
    (-.57,.23,6.72,1.96,1.94), (2.38,.41,6.83,2.08,2.00),
    (5.36,.68,6.73,2.06,1.95), (8.05,.94,6.55,1.94,1.80),
    (10.77,1.12,6.39,1.83,1.74), (12.88,1.36,6.36,1.99,1.84),
)
PITCH = tuple(station[0] for station in ROUTE)
OUTLINE = ((-.52,-1), (.52,-1), (1,-.51), (1,.53),
           (.52,1), (-.52,1), (-1,.53), (-1,-.51))


def rail_point(x, corner, scale=1.0):
    y,z,w,h = interpolate(ROUTE,x)
    u,v = OUTLINE[corner % 8]
    return Vector((x,y+u*w*scale,z+v*h*scale))


def belt_point(x, face, u, scale=1.0):
    return rail_point(x,face,scale).lerp(rail_point(x,face+1,scale),u)


def strip(name, a, b, face, start, end, scale, group, mat, thickness, bevel=0):
    corners = [belt_point(a,face,start,scale),belt_point(a,face,end,scale),
               belt_point(b,face,end,scale),belt_point(b,face,start,scale)]
    return panel(name,corners,group,mat,thickness,bevel)


def collar(name, x, width, group, metal, end=False):
    # An outside section, matching inside return and corner fastening plate.
    for face in range(8):
        outside = [rail_point(x,face,1.055),rail_point(x,face+1,1.055)]
        inside = [rail_point(x,face,.944),rail_point(x,face+1,.944)]
        quad = [outside[0],outside[1],inside[1],inside[0]]
        panel(name+' · octagonal section',quad,group,material(metal,face),width,.018)
        # The flush conduit seats are inset from the load-bearing section.
        accent = [rail_point(x+width*.56,face,.943),rail_point(x+width*.56,face+1,.943)]
        beam(name+' · inner gasket',*accent,.050,.054,group,'iron',1,.010)
        if end or face in {0,2,4,6}:
            start = rail_point(x+width*.58,face,.925).lerp(rail_point(x+width*.58,face+1,.925),.12)
            finish = rail_point(x+width*.58,face,.925).lerp(rail_point(x+width*.58,face+1,.925),.55)
            beam(name+' · recessed rhythm light',start,finish,.044,.046,group,'signal' if face%4 else 'amber',1,.01)
        if face in {1,3,5,7}:
            point=rail_point(x-width*.36,face,1.052)
            block(name+' · cast splice shoe',point,(width+.16,.128,.148),group,'bronze',face,.019)
            for dx in (-width*.33,width*.33):
                lathe(name+' · exposed bolt',point+Vector((dx,0,.080)),[(.046,0),(.041,.034)],
                      group,'brass',6)


def shell(group):
    for i,(a,b) in enumerate(zip(PITCH,PITCH[1:])):
        for corner in range(8):
            beam('Envelope · continuous corner spar',rail_point(a,corner),rail_point(b,corner),
                 .113,.142,group,'iron' if corner in {0,1,2,7} else 'steel',i+corner,.019)
            if corner in {0,1,3,6}:
                beam('Envelope · captive gasket carrier',rail_point(a+.11,corner,.935),
                     rail_point(b-.11,corner,.935),.044,.053,group,'zinc',corner,.010)

        # Slate lowers continue below a lighter glass canopy after the launch shroud.
        for face in (0,1,7):
            for k in range(4 if i not in {0,8} else 3):
                lo=a+(b-a)*k/(4 if i not in {0,8} else 3)+.036
                hi=a+(b-a)*(k+1)/(4 if i not in {0,8} else 3)-.036
                strip('Sleeve · pressed lower armour',lo,hi,face,.027,.973,.966,group,
                      material('graphite' if face==0 else 'steel',i+k+face),.093,.013)
                if face==7:
                    strip('Sleeve · bolt-on face panel',lo+.07,hi-.07,face,.19,.76,1.027,group,
                          material('roof',k+i),.04,.014)
        for face in (2,3,4,5,6):
            if i in {0,1} and (face in {2,3,4} or i==0 and face in {5,6}):
                for k in range(3):
                    lo=a+(b-a)*k/3+.055
                    hi=a+(b-a)*(k+1)/3-.055
                    strip('Launch shroud · standing seam panel',lo,hi,face,.024,.976,1.012,group,
                          material('roof',face+i+k),.09,.011)
                    strip('Launch shroud · folded standing seam',hi-.039,hi+.022,face,.014,.985,
                          1.036,group,material('zinc',face),.038,.009)
                continue
            # Offset openings reveal the internal gate sequence in the display view.
            if face in (2,3,4) or face==5 and i in (2,5,7,8) or face==6 and i in (3,6,8):
                for k in range(2):
                    lo=a+(b-a)*k/2+.07
                    hi=a+(b-a)*(k+1)/2-.07
                    strip('Canopy · solid skyglass glazing',lo,hi,face,.047,.953,.985,group,
                          glazing('canopy'),.068,.012)
                for x in (a+.13,(a+b)/2,b-.13):
                    beam('Canopy · mullion',belt_point(x,face,.019,1.014),belt_point(x,face,.981,1.014),
                         .086,.082,group,'zinc',i,.012)
                for u in (.035,.965):
                    beam('Canopy · perimeter glazing shoe',belt_point(a+.07,face,u,1.014),
                         belt_point(b-.07,face,u,1.014),.054,.052,group,'steel',face,.009)

        # Individual metal carriers beneath muted light strips give the eye a cadence along the flight axis.
        rhythm = (.20,.44,.63,.87) if i in (0,2,5,7) else (.24,.62,.85)
        for lo,hi in ((.12,.44),(.55,.90)) if i%3==2 else ((.12,.89),):
            start=a+(b-a)*lo
            end=a+(b-a)*hi
            beam('Beatline · visible metal light channel',belt_point(start,7,.74,1.056),
                 belt_point(end,7,.74,1.056),.088,.064,group,'iron',2,.011)
            beam('Beatline · pale blue glass ribbon',belt_point(start+.024,7,.74,1.078),
                 belt_point(end-.024,7,.74,1.078),.038,.039,group,'beat' if i<3 else 'signal',i,.007)
        for side in (.12,.88):
            for j,beat in enumerate(rhythm):
                x = a + (b-a)*beat
                length = .24 if j==0 else .123
                start,end = belt_point(x-length/2,0,side,.919),belt_point(x+length/2,0,side,.919)
                beam('Beat guide · metal recess',start,end,.096,.080,group,'iron',2,.015)
                beam('Beat guide · glass strip',start+Vector((.025,0,.042)),end+Vector((-.025,0,.042)),
                     .044,.038,group,'signal' if j else 'amber',1,.008)


def gate_opening(kind, center):
    sizes = {'square': (.77,.69), 'diamond': (1.08,.99),
             'vertical': (.51,1.02), 'horizontal': (1.12,.53)}
    width,height=sizes[kind]
    u,v,c=width,height,.10
    if kind=='diamond':
        profile=((-c,-v+c),(c,-v+c),(u-c,-c),(u-c,c),
                 (c,v-c),(-c,v-c),(-u+c,c),(-u+c,-c))
    else:
        profile=((-u+c,-v),(u-c,-v),(u,-v+c),(u,v-c),
                 (u-c,v),(-u+c,v),(-u,v-c),(-u,-v+c))
    return [center+Vector((0,y,z)) for y,z in profile]


def gate(group, label, x, kind, tone):
    y,z,*_ = interpolate(ROUTE,x)
    center=Vector((x,y,z))
    collar(label+' · replaceable frame',x,.23,group,'zinc' if kind=='iris' else 'steel')
    outer=[rail_point(x,i,.925) for i in range(8)]
    if kind=='iris':
        # The open sector has a real cutout outside the fixed central glass hub.
        inner=[center.lerp(point,.26) for point in outer]
        cut=5
        panel(label+' · fixed central hub',inner,group,glazing('frosted guides'),.13,.020)
        for j in range(8):
            beam(label+' · hub edge',inner[j],inner[(j+1)%8],.031,.042,group,'zinc',j,.008)
    else:
        inner=gate_opening(kind,center)
        cut=None
    for j in range(8):
        if j==cut:
            continue
        k=(j+1)%8
        points=[outer[j],outer[k],inner[k],inner[j]]
        middle=sum(points,Vector())/len(points)
        points=[p.lerp(middle,.013 if cut is not None else .004) for p in points]
        panel(label+' · laminated glass facet',points,group,glazing(tone),.102,.019)
        if cut is not None:
            beam(label+' · polished bevel seam', points[0]+Vector((.054,0,0)),
                 points[3]+Vector((.054,0,0)),.025,.031,group,'signal',j,.006)
        else:
            beam(label+' · solid opening trim',inner[j],inner[k],.049,.061,group,'zinc',j,.011)
            if kind=='diamond' and j%2:
                offset=Vector((.037,0,0))
                beam(label+' · thin reflective edge',inner[j]+offset,inner[k]+offset,.026,.027,
                     group,'beat',j,.005)
        if j in {0,2,4,6}:
            point=outer[j].lerp(outer[k],.42)
            block(label+' · sprung glass mount',point,(.30,.161,.131),group,'bronze',j,.023)
            lathe(label+' · locking screw',point+Vector((.142,0,0)),[(.050,0),(.045,.035)],
                  group,'brass',6,(1,0,0))
    if cut is not None:
        for j in (cut,(cut+1)%8):
            beam(label+' · open sector edge',inner[j],outer[j],.041,.044,group,'zinc',1,.008)


def belly(x, side, lower=False):
    y,z,w,h=interpolate(ROUTE,x)
    return Vector((x,y+w*side*.52,z-h-(.88 if lower else .19)))


def truss(group):
    for side in (-1,1):
        for a,b in zip(PITCH,PITCH[1:]):
            beam('Runway truss · upper chord',belly(a,side),belly(b,side),.151,.163,group,'iron',0,.022)
            beam('Runway truss · lower chord',belly(a,side,True),belly(b,side,True),
                 .171,.18,group,'steel',1,.021)
            mid=(a+b)*.5
            beam('Runway truss · compression diagonal',belly(a,side,True),belly(mid,side),
                 .115,.122,group,'steel',2,.017)
            beam('Runway truss · tension diagonal',belly(mid,side),belly(b,side,True),
                 .090,.108,group,'iron',1,.018)
            beam('Runway truss · short vertical',belly(mid,side),belly(mid,side,True),
                 .088,.094,group,'steel',0,.01)
        for x in PITCH:
            point=belly(x,side,True)
            block('Runway truss · bolted gusset',point,(.36,.199,.225),group,'oxide',2,.034)
            for sign in (-1,1):
                lathe('Runway truss · gusset bolt',point+Vector((sign*.099,side*.108,.02)),
                      [(.037,0),(.034,.027)],group,'brass',6,(0,side,0))
    for x in PITCH:
        beam('Runway truss · transverse cross tie',belly(x,-1,True),belly(x,1,True),
             .134,.14,group,'iron',1,.017)


def pylon(group, tree, x, top_foot, style):
    y=interpolate(ROUTE,x)[0]
    name=['Launch saddle','Fault trestle','Departure saddle'][style]
    footings(name,tree,x,y,top_foot,(1.36 if style!=1 else 1.04,1.73 if style!=1 else 1.26),group)
    for side in (-1,1):
        base=Vector((x,y+side*(.42 if style==1 else .59),top_foot))
        head=belly(x,side,True)-Vector((0,0,.08))
        foot=base+Vector((-.36,0,.09))
        heel=base+Vector((.36,0,.09))
        crown=head+Vector((-.31,0,0))
        toe=head+Vector((.31,0,0))
        slab(name+' · ground gusset',rectangle(x,base.y,.95,.31),top_foot,top_foot+.10,group,'iron')
        for a,b in ((foot,crown),(heel,toe),(foot,toe),(heel,crown)):
            beam(name+' · triangulated steel upright',a,b,.125,.176,group,'steel',style,.023)
        beam(name+' · top bearing shoe',crown,toe,.23,.24,group,'oxide',style,.029)
        beam(name+' · machined load angle',head,head+Vector((0,side*.61,.38)),.12,.16,
             group,'iron',style,.017)
        for at in (foot,heel,crown,toe):
            block(name+' · folded gusset',at,(.25,.23,.25),group,'iron',style,.034)
            lathe(name+' · exposed coupling',at+Vector((0,side*.124,0)),
                  [(.053,0),(.046,.029)],group,'brass',6,(0,side,0))
    l,r=belly(x,-1,True),belly(x,1,True)
    beam(name+' · load-spreading crosshead',l+Vector((0,-.18,-.18)),r+Vector((0,.18,-.18)),
         .28,.31,group,'iron',style,.042)


def departure(group):
    x=12.88
    for face in range(8):
        lip=[rail_point(x,face,1.084),rail_point(x,face+1,1.084)]
        beam('Departure mouth · satin flared rim',*lip,.118,.123,group,'zinc',face,.026)
        if face in {1,3,5,7}:
            a=rail_point(11.63,face,.994)
            b=rail_point(x,face,1.08)
            beam('Departure mouth · flare cheek',a,b,.146,.177,group,'bronze',face,.026)
    for side in (-1,1):
        a=belly(10.77,side,True)
        b=belly(x,side,True)
        block('Departure · sensor head',b+Vector((.12,0,.11)),(.27,.29,.31),group,'iron',2,.043)
        rod('Departure · inset sensor',b+Vector((.246,0,.11)),b+Vector((.267,0,.11)),.079,
            group,'signal',10)
        beam('Departure · outward stay',a+Vector((-.33,0,-.40)),b,.093,.105,group,'bronze',1,.017)


def transfer(group):
    """The widened bay is carried through a single reinforced expansion joint."""
    x=-.57
    for j in range(8):
        a=rail_point(x-.25,j,1.08)
        b=rail_point(x-.25,j+1,1.08)
        c=rail_point(x+.29,j,1.10)
        d=rail_point(x+.29,j+1,1.10)
        panel('Transfer · folded expansion sleeve',[a,b,d,c],group,
              material('oxide' if j in {1,7} else 'roof',j),.083,.018)
        beam('Transfer · compression edge',a,b,.104,.12,group,'zinc',j,.019)
        beam('Transfer · expansion edge',c,d,.082,.096,group,'steel',j,.016)
    for face in (2,6):
        for u in (.20,.80):
            a=belt_point(x-.89,face,u,1.094)
            b=belt_point(x+.92,face,u,1.109)
            mid=a.lerp(b,.49)
            rod('Transfer · sealed hydraulic cylinder',a,mid,.090,group,'steel',10)
            rod('Transfer · polished expansion rod',mid,b,.051,group,'zinc',10)
            for p in (a,b):
                block('Transfer · cast clevis support',p,(.235,.205,.216),group,'oxide',1,.039)
                side=-1 if face==6 else 1
                rod('Transfer · locking pin',p+Vector((0,.06*side,0)),p+Vector((0,.127*side,0)),
                    .057,group,'bronze',8)
    for j in (1,3,5,7):
        beam('Transfer · tapered back-stay',rail_point(x-.26,j,1.10),rail_point(x-1.34,j,1.015),
             .086,.095,group,'iron',j,.015)


def flight(main, terminal, mid, root):
    shell(collection('01 · Continuous octagonal flight envelope',root))
    frames=collection('02 · Rail collars, bulkheads and open departure',root)
    for i,x in enumerate(PITCH):
        collar('Structural collar',x,.34 if i in {0,4,9} else .22,frames,
               'zinc' if i in {0,4,9} else 'steel',i in {0,4,9})
    departure(frames)
    transfer(collection('Instrumented expansion transfer bay',frames))
    glass=collection('03 · Five serviceable glass gates',root)
    for name, x, kind, tint in (
        ('Iris gate',-6.95,'iris','iris'), ('Square gate',-4.68,'square','iris'),
        ('Crystal diamond gate',-.99,'diamond','crystal'), ('Vertical gate',3.50,'vertical','crystal'),
        ('Horizontal gate',9.36,'horizontal','frosted guides'),
    ):
        gate(collection(name,glass),name,x,kind,tint)
    bearing=collection('04 · Pratt trusses and three bedrock bearings',root)
    truss(bearing)
    for tree,x,z,style in ((main,-5.21,3.73,0),(mid,1.66,1.67,1),(terminal,8.31,2.50,2)):
        pylon(bearing,tree,x,z,style)
