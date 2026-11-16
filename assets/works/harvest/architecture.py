"""The collector tower, sorting house and press workshop."""

import math

from mathutils import Vector

from geometry import (beam, block, collection, conduit, lantern, lathe, material,
                      mesh, railing, rod)
from terrain import sample_height


def window(name, center, width, height, group, yaw=0, lit=False, arched=False, door=False):
    x,y,z=center
    def at(u,v,h):
        return x+math.cos(yaw)*u-math.sin(yaw)*v, y+math.sin(yaw)*u+math.cos(yaw)*v,z+h
    def frame(label,u,h,w,d,t,key,tone=0):
        obj=block(name+' · '+label,at(u,-.04,h),(w,d,t),group,key,tone,bevel=.013)
        obj.rotation_euler.z=yaw
        return obj
    arch=min(width*.47,height*.26) if arched else 0
    rail=(height-arch)/2
    frame('recess',0,-arch/2,width+.17,.12,height-arch+.13,'mortar')
    if door:
        for j in range(5):
            frame('door leaf',width*((j+.5)/5-.5),-arch/2,width/5-.017,.1,height-arch,'plank',j)
        frame('iron latch',width*.28,-height*.07,.055,.19,.17,'iron')
        for a in (-.28,.27):
            frame('cross brace',0,height*a,width,.17,.064,'iron')
    else:
        frame('glazing',0,-arch/2,width,.13,height-arch,'amber' if lit else 'glass',1)
        for u in (-.19,.19):
            frame('mullion',u*width,0,.046,.18,height-arch,'timber')
        frame('transom',0,-arch*.32,width,.18,.05,'timber')
    for u in (-1,1):
        frame('jamb',u*width/2,-arch/2,.086,.19,height-arch+.17,'timber')
    frame('lintel' if not arched else 'spring rail',0,rail,width+.13,.18,.078,'timber')
    frame('sill',0,-height*.5,width+.18,.28,.085,'stone')
    if arched:
        outer=[at(math.cos(math.pi*i/8)*(width/2+.09),-.116,rail+math.sin(math.pi*i/8)*(arch+.075)) for i in range(9)]
        inner=[at(math.cos(math.pi*i/8)*(width/2-.017),-.119,rail+math.sin(math.pi*i/8)*(arch-.035)) for i in range(9)]
        mesh(name+' · voussoir arch',outer+inner,[(i,i+1,i+10,i+9) for i in range(8)],group,
             [material('stone',0),material('stone',1)],[i%2 for i in range(8)])
        glass=[at(math.cos(math.pi*i/8)*width/2,-.077,rail+math.sin(math.pi*i/8)*arch) for i in range(9)]
        mesh(name+' · arched inset',glass,[tuple(range(8,-1,-1))],group,[material('plank' if door else 'amber' if lit else 'glass')])


def sloping_roof(name, a, b, length, group, palette, rows=4, bays=12):
    """Clad a pitched roof with overlapped, individually editable courses."""
    a,b=Vector(a),Vector(b)
    radial=b-a
    high=Vector((0,1,0))
    orthogonal=radial.cross(high).normalized()
    faces=[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    if orthogonal.z<0:
        orthogonal=-orthogonal
        faces=[tuple(reversed(face)) for face in faces]
    for j in range(rows):
        for k in range(bays):
            head=a+radial*(j/rows)-high*(length*.5-k*length/bays)
            tail=head+radial/rows*1.065
            strip=high*(length/bays-.016)
            top=orthogonal*.072
            verts=[head,tail,tail+strip,head+strip]
            verts+= [p+top for p in verts]
            mesh(f'{name} · panel {j+1}.{k+1:02}',verts,faces,group,[material(palette,(3*j+5*k+j*k)%6)])
    for k in range(bays+1):
        y=-length*.5+k*length/bays
        shift=high*y+orthogonal*.081
        beam(name+' · folded standing seam',a+shift,b+shift,.025,.033,group,palette,k,bevel=.003)
    for y in (-length*.5,length*.5):
        beam(name+' · verge board',a+high*y,b+high*y,.13,.13,group,'plank')
    beam(name+' · gutter',a-high*length*.5,a+high*length*.5,.144,.12,group,'iron')


def plinth(name, x, y, base, w, d, h, group):
    block(name+' · dressed foundation',(x,y,base+h*.49),(w,d,h),group,'mortar',bevel=.045)
    for row in range(3):
        for sy in (-1,1):
            for k in range(8):
                block(name+' · face stone',(x-w/2+(k+.5)*w/8, y+sy*d/2,base+h*(row+.5)/3),
                      (w/8-.025,.12,h/3-.029), group,'stone',k+row*3+sy)
        for sx in (-1,1):
            for k in range(6):
                block(name+' · return stone',(x+sx*w/2,y-d/2+(k+.5)*d/6,base+h*(row+.5)/3),
                      (.12,d/6-.024,h/3-.028),group,'stone',row+k+sx)


def sorting_house(group):
    x,y,z=-4.19,-1.56,2.80
    w,d=5.18,3.80
    front,back=y-d/2,y+d/2
    plinth('Sorting house',x,y,z,w+.10,d+.12,.61,group)
    eaves,peak=5.78,7.54
    verts=[(x-w/2,front,3.41),(x+w/2,front,3.41),(x+w/2,front,eaves),(x+.17,front,peak-.15),(x-w/2,front,eaves)]
    verts+= [(a,back,c) for a,_,c in verts]
    mesh('Sorting house · lime plaster and gables',verts,[(0,1,2,3,4),(9,8,7,6,5)]+
         [(i,i+5,(i+1)%5+5,(i+1)%5) for i in range(5)],group,[material('plaster')])
    left=(x-w/2-.36,y,eaves-.16)
    apex=(x+.17,y,peak)
    right=(x+w/2+.34,y,eaves-.15)
    sloping_roof('Sorting house · west pitch',left,apex,d+.76,group,'roof')
    sloping_roof('Sorting house · east pitch',right,apex,d+.76,group,'roof')
    beam('Sorting house · copper ridge cap',(apex[0],front-.42,peak+.08),(apex[0],back+.42,peak+.08),.16,.20,group,'copper')
    for f,rotation in ((front,0),(back,math.pi)):
        for u in (-w/2,-1.25,1.25,w/2):
            beam('Sorting house · oak post',(x+u,f,3.39),(x+u,f,eaves+.04),.17,.19,group,'timber')
        for height in (3.50,5.45,eaves):
            beam('Sorting house · horizontal oak tie',(x-w/2,f,height),(x+w/2,f,height),.15,.20,group,'timber')
        for a,b in ((-w/2,-1.45),(w/2,1.45)):
            beam('Sorting house · corner brace',(x+a,f-.015,3.61),(x+b,f-.015,4.37),.12,.12,group,'plank',2)
            beam('Sorting house · collar brace',(x+a,f,5.81),(x+b*.8,f,6.50),.14,.13,group,'timber')
        beam('Sorting house · king post',(x+.17,f,5.8),(x+.17,f,7.38),.14,.19,group,'timber')
        window('Sorting house · loft light',(x+.39,f,6.23),.55,.69,group,rotation,arched=True,lit=True)
        for i,u in enumerate((-1.94,1.94)):
            window('Sorting house · lower sash',(x+u,f,4.60),.69,1.18,group,rotation,lit=i==1,arched=True)
    window('Sorting house · double freight doors',(x,front,4.16),1.53,1.83,group,arched=True,door=True)
    window('Sorting house · rear service sash',(x,back,4.49),1.27,1.03,group,math.pi,lit=True)
    window('Sorting house · calibration door',(x-1.04,back,4.29),.72,1.67,group,math.pi,door=True)
    for i in range(3):
        block('Sorting house · calibration threshold',(x-1.04,back+.15+i*.16,3.30-i*.17),(.92,.22,.17),group,'stone',i)
    for side in (-1,1):
        sx=x+side*w*.5
        for i in range(4):
            ty=front+d*i/3
            beam('Sorting house · wall post',(sx,ty,3.44),(sx,ty,eaves),.18,.17,group,'timber')
        for height in (3.47,5.37,eaves):
            beam('Sorting house · wall tie',(sx,front,height),(sx,back,height),.17,.16,group,'timber')
        for i,dy in enumerate((-1.28,0,1.27)):
            window('Sorting house · reading window',(sx,y+dy,4.65),.68,1.19,group,side*math.pi/2,lit=(i+side)%3==0)
        conduit('Sorting house · rainwater downpipe',[(sx+side*.35,back+.32,eaves),(sx+side*.12,back+.16,5.53),
                  (sx+side*.12,back+.15,3.03)],.082,group,'copper',True)
    # A shallow canopy protects the freight threshold and remains structurally legible.
    for xoff in (-1.08,1.08):
        beam('Freight canopy · post',(x+xoff,front-.81,2.86),(x+xoff,front-.81,5.12),.13,.16,group,'timber')
        beam('Freight canopy · diagonal knee',(x+xoff,front-.81,4.62),(x+xoff,front-.30,5.10),.12,.13,group,'timber')
        lantern('Freight canopy · jamb lamp',(x+xoff,front-.19,4.54),group)
    for j in range(10):
        u=x-1.25+(j+.5)*.25
        beam('Freight canopy · sheet',(u,front-1.0,5.10),(u,front-.04,5.44),.252,.08,group,'copper',j,bevel=.007)
    for j in range(4):
        block('Freight threshold',(x,front-.27-j*.13,3.39-j*.15),(2.05,.20,.17),group,'stone',j)
    # The flue retains its own masonry, metal cap and lateral flashing.
    hx,hy=x-1.46,y+.94
    block('Sorting house · masonry chimney',(hx,hy,7.17),(.66,.69,1.47),group,'mortar')
    for j in range(6):
        block('Chimney · stone course',(hx,hy,6.55+j*.232),(.70,.73,.19),group,'stone',j)
    block('Chimney · weathered crown',(hx,hy,7.92),(.86,.86,.18),group,'copper')
    block('Chimney · split cap',(hx,hy,8.05),(.56,.57,.10),group,'iron')


def press_workshop(group):
    x,y,z=4.25,-2.27,2.80
    w,d=3.54,2.48
    front,back=y-d/2,y+d/2
    plinth('Press workshop',x,y,z,w+.08,d+.09,.42,group)
    # Low west bay and a stepped east clerestory share the masonry envelope.
    for u,width,high in ((-.82,1.91,4.78),(.91,1.62,5.36)):
        block('Press workshop · lime infill',(x+u,y,(3.22+high)/2),(width,d,high-3.22),group,'plaster',int(u>0))
        sloping_roof('Press workshop · folded copper shed',(x+u-width/2-.20,y,high+.025),
                     (x+u+width/2+.17,y,high+.43),d+.54,group,'copper',rows=3,bays=8)
        for f in (front,back):
            for h in (3.31,high-.13):
                beam('Press workshop · rail',(x+u-width/2,f,h),(x+u+width/2,f,h),.12,.13,group,'timber')
            for dx in (-width/2,width/2):
                beam('Press workshop · post',(x+u+dx,f,3.2),(x+u+dx,f,high),.14,.13,group,'timber')
    window('Press workshop · apron door',(x+.27,front,3.87),1.04,1.50,group,door=True)
    window('Press workshop · press sight glass',(x-.89,front,4.04),.78,.73,group,lit=True,arched=True)
    window('Press workshop · clerestory',(x+1.12,front,4.91),.90,.45,group,lit=True)
    window('Press workshop · rear sash',(x+.68,back,4.25),1.26,.90,group,math.pi)
    xwall=x+w/2
    for yy in (front,y,back):
        beam('Press workshop · side upright',(xwall,yy,3.22),(xwall,yy,5.30),.13,.17,group,'timber')
    window('Press workshop · side vent',(xwall,y+.35,4.45),.78,.71,group,math.pi/2)
    for h in range(5):
        block('Press workshop · painted ventilation slat',(xwall+.104,y+.35,4.18+h*.116),(.055,.75,.047),group,'roof',h)
    for j in range(3):
        block('Press workshop · stone apron',(x+.25,front-.17-j*.11,3.17-j*.12),(1.40,.22,.15),group,'stone',j)
    # Riveted pressure cylinder, paired pipes and insulated elbows.
    cx,cy=x+1.13,y+.20
    lathe('Press workshop · expansion vessel',(cx,cy,5.65),
          [(.24,0),(.24,.15),(.38,.25),(.38,.66),(.29,.82),(.17,.86)],group,'roof',10,vary=True)
    for h in (5.98,6.27):
        lathe('Expansion vessel · iron binding',(cx,cy,h),[(.397,0),(.397,.065)],group,'iron',10)
    conduit('Press workshop · return pipe',[(cx+.04,cy,6.52),(cx+.53,cy,6.40),(cx+.85,cy,6.01),
            (xwall+.30,cy,4.96),(xwall+.30,cy-.41,4.65)],.14,group,'copper',True)
    lantern('Press workshop · door lens',(x+.92,front-.16,4.38),group)
    skid=collection('Press workshop · return pump and handwheel',group)
    sx,sy=1.76,-2.74
    block('Return pump · stone base',(sx,sy,2.89),(1.12,.71,.18),skid,'stone')
    for dy in (-.24,.24):
        block('Return pump · iron saddle',(sx,sy+dy,3.10),(.53,.13,.28),skid,'iron')
    lathe('Return pump · riveted pressure casing',(sx,sy-.32,3.31),
          [(.24,0),(.28,.08),(.28,.53),(.21,.65)],skid,'roof',12,(0,1,0),vary=True)
    for dy in (-.30,.25):
        lathe('Return pump · raised flange',(sx,sy+dy,3.31),[(.287,0),(.287,.065)],
              skid,'iron',12,(0,1,0))
        for i in range(6):
            angle=i*math.tau/6
            bx=sx+.243*math.cos(angle)
            bz=3.31+.243*math.sin(angle)
            rod('Return pump · flange nut',(bx,sy+dy-.029,bz),(bx,sy+dy+.080,bz),.027,skid,'brass',6)
    ward=(sx,sy-.43,3.31)
    lathe('Return pump · handwheel',ward,[(.145,0),(.205,0),(.209,.051),(.145,.051)],
          skid,'copper',12,(0,1,0),closed=True)
    for i in range(3):
        a=i*math.tau/3
        rod('Return pump · handwheel spoke',(sx,sy-.41,3.31),
            (sx+.18*math.cos(a),sy-.41,3.31+.18*math.sin(a)),.024,skid,'brass',6)
    conduit('Return pump · discharge elbow',[(sx,sy+.08,3.58),(sx+.14,sy+.08,3.75),
            (2.23,sy+.08,3.75),(2.52,sy+.08,3.51)],.106,skid,'copper',True)
    lantern('Return pump · sight indicator',(sx-.15,sy-.065,3.53),skid,'signal')


def calibration_shed(lands, group):
    x,y=-5.22,2.37
    z=sample_height(lands,x,y)
    plinth('Calibration shed',x,y,z,2.47,1.99,.28,group)
    for dx in (-1.12,1.12):
        for dy in (-.86,.86):
            beam('Calibration shed · mortised post',(x+dx,y+dy,z+.20),(x+dx,y+dy,z+2.13+(dx+1.12)*.25),
                 .15,.15,group,'timber')
            beam('Calibration shed · knee',(x+dx,y+dy,z+1.52),(x+dx*.63,y+dy,z+2.08+(dx+1.12)*.25),
                 .095,.105,group,'plank')
    sloping_roof('Calibration shed · cedar roof',(x-1.35,y,z+2.07),(x+1.43,y,z+2.82),2.38,group,'roof',rows=3,bays=7)
    for j in range(12):
        block('Calibration shed · rear lath',(x-1.14+j*.207,y+.88,z+1.11),(.171,.11,1.56),group,'plank',j)
    block('Calibration shed · bench',(x,y+.23,z+1.05),(1.94,.73,.11),group,'plank',4)
    for dx in (-.76,.76):
        beam('Calibration shed · bench leg',(x+dx,y+.24,z+.27),(x+dx,y+.24,z+1.06),.12,.12,group,'timber')
    for j in range(4):
        lathe('Calibration shed · gauge body',(x-.63+j*.43,y-.03,z+1.14),
              [(.12,0),(.117,.18+j*.045),(.086,.23+j*.045)],group,'roof',8)


def collector_tower(group, machine):
    x,y,z=2.0,3.32,5.35
    plinth('Collector keep',x,y,z,2.98,2.87,.58,group)
    # Angled corner piers and stacked sash bands establish the tower's silhouette.
    contour=[(-1.40,-.87),(-.88,-1.35),(.87,-1.35),(1.40,-.87),(1.40,.87),
             (.87,1.35),(-.87,1.35),(-1.40,.87)]
    verts=[(x+dx,y+dy,h) for h in (5.92,8.47) for dx,dy in contour]
    faces=[tuple(reversed(range(8))),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
    mesh('Collector keep · octagonal masonry core',verts,faces,group,
         [material('plaster',i) for i in range(3)],[1,1,2,0,2,0,2,0,2,0])
    for dx,dy in contour:
        beam('Collector keep · tapered oak pier',(x+dx,y+dy,5.91),(x+dx,y+dy,8.60),.14,.16,group,'timber')
    for level in (6.08,7.21,8.17,8.45):
        for a,b in zip(contour,contour[1:]+contour[:1]):
            beam('Collector keep · structural band',(x+a[0],y+a[1],level),
                 (x+b[0],y+b[1],level),.14,.16,group,'plank',1)
    for j,(dx,dy) in enumerate([(0,-1.36),(1.41,0),(0,1.36),(-1.41,0)]):
        angle=j*math.pi/2
        window('Collector keep · upper light',(x+dx,y+dy,7.78),.94,.68,group,angle,lit=j in (0,1),arched=True)
        window('Collector keep · lower bay',(x+dx,y+dy,6.54),.78,1.0,group,angle,lit=j%2==1,door=j==1)
    for u in (-1.21,1.21):
        for v in (-1.00,1.00):
            beam('Collector keep · deck knee brace',(x+u,y+v,8.0),(x+u*1.52,y+v*1.23,8.68),.13,.14,group,'timber')
    block('Collector keep · copper drip ledge',(x,y,8.54),(3.14,2.95,.18),group,'copper',3)
    for j in range(16):
        block('Collector deck · plank',(x-1.94+.251*j,y,8.68),(.242,3.24,.13),group,'plank',j)
    block('Collector deck · roof-hatch surround',(x+1.14,y+.97,8.77),(.82,.86,.09),group,'timber')
    block('Collector deck · hinged roof hatch',(x+1.14,y+.97,8.832),(.70,.73,.070),group,'roof',3)
    for dx in (-.20,.20):
        rod('Collector deck · hatch hinge',(x+1.14+dx-.064,y+1.34,8.89),
            (x+1.14+dx+.064,y+1.34,8.89),.036,group,'iron')
    conduit('Collector deck · hatch grip',[(x+1.02,y+.73,8.87),(x+1.02,y+.73,8.97),
            (x+1.27,y+.73,8.97),(x+1.27,y+.73,8.87)],.034,group,'iron')
    railing('Collector deck · cage',[(x-1.94,y-1.6,8.75),(x+1.94,y-1.6,8.75),
            (x+1.94,y+1.61,8.75),(x-1.94,y+1.61,8.75),(x-1.94,y-1.6,8.75)],group,spacing=.67,key='iron')
    block('Collector deck · steel pedestal',(x-.27,y+.16,8.95),(1.54,1.76,.34),machine,'iron')
    lathe('Collector · slewing bearing',(x-.21,y+.12,9.08),[(.79,0),(.79,.17),(.65,.22)],machine,'copper',16)
    lathe('Collector · lower drive',(x-.21,y+.12,9.28),[(.49,0),(.49,.26),(.37,.43)],machine,'iron',12)
    center=Vector((x-.41,y+.24,10.48))
    normal=Vector((.17,-.79,.59)).normalized()
    wing=normal.cross(Vector((0,0,1))).normalized()
    up=wing.cross(normal)
    q=normal.to_track_quat('Z','Y')
    # The two sides of the yoke carry a pivot trunnion and its geared counterweight.
    for side in (-1,1):
        pivot=center+wing*.84*side-normal*.22
        start=Vector((x-.21,y+.12,9.40))+wing*.68*side
        brace=start.lerp(pivot,.57)+normal*-.21
        beam('Collector · fork leg',start,brace,.228,.223,machine,'iron')
        beam('Collector · curved fork knuckle',brace,pivot,.23,.24,machine,'copper',3)
        rod('Collector · trunnion',pivot-wing*.13,pivot+wing*.13,.24,machine,'brass',12)
        beam('Collector · stiffening link',start+normal*.28,brace,.11,.12,machine,'iron')
    hub=center+wing*.99-normal*.22
    rod('Collector · worm gear spindle',hub-wing*.15,hub+wing*.16,.25,machine,'iron',12)
    for i in range(18):
        a=i*math.tau/18
        p=hub+(normal*math.cos(a)+up*math.sin(a))*.252
        obj=block('Collector · gear tooth',p,(.084,.084,.17),machine,'brass',bevel=.006)
        obj.rotation_euler=wing.to_track_quat('Z','Y').to_euler()
    # A parabolic dish with a separate back skin, rolled rim and feeder quadrupod.
    dish(center,q,1.70,.61,machine)
    rod('Collector · central backing cap',center-normal*.087,center+normal*.049,.111,machine,'copper',12)
    receiver=center+normal*1.12
    rod('Collector · receiver',receiver-normal*.20,receiver+normal*.16,.135,machine,'iron',10)
    rod('Collector · signal glass',receiver+normal*.13,receiver+normal*.27,.098,machine,'signal',10)
    for angle in (.44,2.48,4.58):
        rim=center+q@Vector((1.49*math.cos(angle),1.49*math.sin(angle),.45))
        rod('Collector · articulated feed strut',rim,receiver,.037,machine,'brass')
        lathe('Collector · clevis pin',rim,[(.085,0),(.085,.092)],machine,'iron',8,normal)
    conduit('Collector · power loop',[tuple(receiver-normal*.16),tuple(center+wing*.87-normal*.09),
            (x-.84,y+.29,9.47),(x-.67,y+.37,8.18),(x-1.21,y+.03,6.34)],.085,machine,'iron')
    lantern('Collector deck · signal lens',(x+1.73,y-1.36,8.77),machine,'signal')


def dish(center, rotation, radius, depth, group):
    vertices=[]
    # Two stagger-free skins retain the shallow bowl and its stiffened rim from the rear.
    segments=24
    radii=(.04,.37,.69,1)
    for skin in (-.06,0):
        for r in radii:
            for i in range(segments):
                theta=i*math.tau/segments
                point=Vector((r*radius*math.cos(theta),r*radius*math.sin(theta),depth*r*r+skin))
                vertices.append(tuple(center+rotation@point))
    faces=[]
    tones=[]
    for skin in (0,1):
        for j in range(3):
            for i in range(segments):
                n=(i+1)%segments
                a=skin*4*segments+j*segments
                face=(a+i,a+segments+i,a+segments+n,a+n)
                faces.append(face if skin else tuple(reversed(face)))
                tones.append((i*5+i//3+(skin==0))%6)
    for j in (0,3):
        for i in range(segments):
            n=(i+1)%segments
            a=j*segments
            face=(a+i,a+n,a+4*segments+n,a+4*segments+i)
            faces.append(face if j==3 else tuple(reversed(face)))
            tones.append(3)
    mesh('Collector · rolled copper dish',vertices,faces,group,
         [material('dish',i) for i in range(6)],tones)
    for i in range(12):
        a=i*math.tau/12
        # Shallow ribs follow the back of each pair of panels.
        pts=[center+rotation@Vector((math.cos(a)*r*radius,math.sin(a)*r*radius,depth*r*r-.081))
              for r in (.15,.48,.74,1)]
        for p,q in zip(pts,pts[1:]):
            beam('Collector · radial stiffener',p,q,.053,.07,group,'copper',4,bevel=.006)
    rim=[(radius-.033,depth-.063),(radius+.022,depth-.057),(radius+.037,depth),
         (radius+.016,depth+.034),(radius-.028,depth+.031)]
    lathe('Collector · rolled aperture lip',center,rim,group,'brass',24,rotation@Vector((0,0,1)),closed=True)


def instruments(lands, group):
    x,y=4.54,3.82
    z=sample_height(lands,x,y)
    block('Wind mast · stone footing',(x,y,z+.11),(.98,.91,.22),group,'stone')
    for i,(dx,dy) in enumerate([(-.34,-.32),(.34,-.32),(.34,.32),(-.34,.32)]):
        beam('Wind mast · tapered leg',(x+dx,y+dy,z+.18),(x+dx*.24,y+dy*.24,z+2.0),.08,.09,group,'iron')
        beam('Wind mast · tie',(x+dx,y+dy,z+.32),(x-dx*.53,y+dy*.53,z+1.18),.065,.06,group,'copper')
    rod('Wind mast · spindle',(x,y,z+1.9),(x,y,z+2.74),.055,group,'iron')
    for i in range(3):
        angle=i*math.tau/3
        tip=(x+math.sin(angle)*.36,y+math.cos(angle)*.36,z+2.57)
        rod('Wind mast · anemometer arm',(x,y,z+2.57),tip,.028,group,'brass',8)
        lathe('Wind mast · anemometer shell',tip,[(.070,0),(.14,.062),(.15,.12)],group,'copper',8,
              (math.sin(angle+math.pi/2),math.cos(angle+math.pi/2),0))
    lantern('Wind mast · reading lamp',(x+.33,y-.3,z+.2),group)
    for i,(xx,yy) in enumerate(((.03,2.5),(1.0,4.94))):
        zz=sample_height(lands,xx,yy)
        block('Remote sampler · anchor',(xx,yy,zz+.11),(.95,.78,.22),group,'stone',i)
        for v in (-.25,.25):
            beam('Remote sampler · leg',(xx+v,yy,zz+.18),(xx+v*.67,yy+.11,zz+.89),.11,.12,group,'iron')
        spindle=Vector((xx,yy,zz+.95))
        axis=Vector((-.36,-.54,.76) if i==0 else (.3,.4,.87)).normalized()
        lathe('Remote sampler · horn',spindle,[(.16,0),(.26,.24),(.39,.53),(.31,.55),(.22,.34),(.082,.13)],
              group,'roof',10,axis,closed=True)
        rod('Remote sampler · status lens',spindle+axis*.26,spindle+axis*.45,.071,group,'signal')
