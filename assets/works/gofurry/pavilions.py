"""The harbor's open navigation hall, resource loggia and game gallery."""

import math

import bpy
from mathutils import Vector

from fabric import panel, rectangle, slab, tapered
from geometry import beam, block, collection, material, object_in, railing, rod
from harbor import COURT_Z, EAST_Z, HEADLAND_Z, WEST_Z, paving


def ironwork(name, a, b, group, gauge=.078, key='metal'):
    return beam(name, a, b, gauge, gauge, group, key, bevel=gauge*.17)


def light(name, pos, target, power, size, group):
    source=bpy.data.lights.new(name,'AREA')
    source.color=(1,.78,.57)
    source.energy=power
    source.size=size
    obj=object_in(name,source,group)
    obj.location=pos
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def glass():
    name='Harbor glazing · lightly smoked blue'
    existing=bpy.data.materials.get(name)
    if existing:
        return existing
    mat=bpy.data.materials.new(name)
    mat.diffuse_color=(.31,.49,.53,.28)
    mat.use_nodes=True
    nodes=mat.node_tree.nodes
    shader=nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(.31,.49,.53,1)
    shader.inputs['Roughness'].default_value=.22
    transparent=nodes.new('ShaderNodeBsdfTransparent')
    mix=nodes.new('ShaderNodeMixShader')
    mix.inputs[0].default_value=.25
    link=mat.node_tree.links.new
    link(transparent.outputs[0],mix.inputs[1])
    link(shader.outputs[0],mix.inputs[2])
    link(mix.outputs[0],nodes.get('Material Output').inputs['Surface'])
    return mat


def glass_grid(name, a, b, low, high, n, group, opening=None):
    a,b=Vector(a),Vector(b)
    seat=low+(high-low)*.58
    for j in range(n):
        p,q=a.lerp(b,j/n),a.lerp(b,(j+1)/n)
        if j != opening:
            for rise,top in ((low,seat),(seat,high)):
                panel(name+' · clear pane',[(*p,rise),(*q,rise),(*q,top),(*p,top)],group,glass(),.027,.006)
            ironwork(name+' · sash',(*p,seat),(*q,seat),group,.055)
        ironwork(name+' · mullion',(*p,low),(*p,high),group,.086)
    ironwork(name+' · end mullion',(*b,low),(*b,high),group,.086)
    ironwork(name+' · transom',(*a,high),(*b,high),group,.12)
    if opening is None:
        ironwork(name+' · sill',(*a,low),(*b,low),group,.12)


def pier(name, x, y, low, high, side, group, key='stone'):
    block(name+' · base',(x,y,low+.12),(side+.21,side+.18,.24),group,'limestone',0,.026)
    block(name+' · shaft',(x,y,(low+high)/2),(side,side,high-low-.18),group,key,1,.043)
    block(name+' · neck',(x,y,high-.17),(side+.065,side+.065,.09),group,'stone',0)
    block(name+' · bearing cap',(x,y,high-.04),(side+.22,side+.18,.15),group,'limestone',2,.025)


def arch(name, cx, y, spring, radius, rise, width, depth, group, key='limestone', span=(0,math.pi)):
    """A voussoir course with independent closed stone blocks and a deeper keystone."""
    pieces=13
    for i in range(pieces):
        begin,end=(i+.020)/pieces,(i+.980)/pieces
        a=span[0]+begin*(span[1]-span[0])
        b=span[0]+end*(span[1]-span[0])
        w=width+(.105 if i==pieces//2 else 0)
        cross=[(cx+(radius+w)*math.cos(a),spring+(rise+w*.7)*math.sin(a)),
               (cx+(radius+w)*math.cos(b),spring+(rise+w*.7)*math.sin(b)),
               (cx+radius*math.cos(b),spring+rise*math.sin(b)),
               (cx+radius*math.cos(a),spring+rise*math.sin(a))]
        panel(name+' · voussoir',[ (x,y,z) for x,z in cross ],group,material(key,i+1),depth,.012)


def arcaded_wall(name, xs, y, floor, spring, group, glazed=False):
    for x in xs:
        pier(name+' · pier',x,y,floor,spring,.39,group,'stone')
    for i,(a,b) in enumerate(zip(xs,xs[1:])):
        arch(name,(a+b)/2,y,spring,(b-a)/2-.21,.71,.215,.42,group)
        if glazed and i!=1:
            glass_grid(name+' · sheltered rear windows',(a+.20,y+.05),(b-.20,y+.05),
                       floor+.46,spring,3,group)
            block(name+' · window seat',((a+b)/2,y,floor+.17),(b-a-.36,.37,.34),group,'peach',i,.02)


def barrel_roof(group):
    def roof(u,v):
        x=-1.89+3.39*u+.22*(v-.5)
        y=1.18+5.13*v-.17*(1-u*u)
        z=5.94+1.68*(max(0,1-u*u)**.77)+.23*v+.105*u
        return Vector((x,y,z))

    columns,depths=22,8
    stations=[2*i/columns-1 for i in range(columns+1)]
    for i,(a,b) in enumerate(zip(stations,stations[1:])):
        for j in range(depths):
            lo,hi=(j+.021)/depths,(j+.979)/depths
            strip=[roof(a+.002,lo),roof(b-.002,lo),roof(b-.002,hi),roof(a+.002,hi)]
            tone=0 if (i+3*j)%11==0 else 1+(i+2*j)%5
            panel('Pavilion · folded clay pan',strip,group,material('clay',tone),.114,.016)
    for i,u in enumerate(stations):
        a,b=roof(u,0),roof(u,1)
        offset=Vector((0,0,.055))
        ironwork('Pavilion · clay standing seam',a+offset,b+offset,group,.041,'clay')
        if i%4==2 and 1<i<columns:
            for v in (.148,.85):
                p=roof(u,v)
                q=roof(u+.072,v)
                ironwork('Pavilion · copper tile clips',p+offset,q+offset,group,.044,'brass')
    for v in (0,.115,.31,.51,.71,.90,1):
        lift=Vector((0,0,-.108 if v not in (0,1) else -.035))
        for a,b in zip(stations,stations[1:]):
            p,q=roof(a,v)+lift,roof(b,v)+lift
            beam('Pavilion · curved laminated rib',p,q,.135,.188,group,'timber',bevel=.023)
    for u in (-1,1):
        beam('Pavilion · continuous eave timber',roof(u,0)-Vector((0,0,.14)),
             roof(u,1)-Vector((0,0,.14)),.19,.22,group,'timber')
        beam('Pavilion · copper storm gutter',roof(u,0),roof(u,1),.125,.105,group,'metal')
        pos=roof(u,.91)
        rod('Pavilion · roof drain',(pos.x,pos.y,3.65),pos,.05,group,'metal',8)

    for v in (.11,.9):
        # A lightly tinted clerestory wraps the curved gable above the masonry.
        cut=[-.86,-.71,-.49,-.25,0,.24,.50,.71,.84]
        border=5.865+.15*v
        for a,b in zip(cut,cut[1:]):
            p,q=roof(a,v),roof(b,v)
            c,d=p.copy(),q.copy()
            c.z,d.z=border,border
            p.z-=.12
            q.z-=.12
            panel('Pavilion · vaulted clerestory',[c,d,q,p],group,glass(),.032,.005)
            ironwork('Pavilion · gable stile',c,p,group,.064)
            ironwork('Pavilion · gable sill',c,d,group,.078)
        ironwork('Pavilion · gable end stile',d,q,group,.064)
    return roof


def bench(name, x, y, z, length, group, angle=0, back=True):
    center=Vector((x,y,z))
    axis=Vector((math.cos(angle),math.sin(angle),0))
    normal=Vector((-axis.y,axis.x,0))
    for delta in (-.35,.35):
        q=center+axis*(delta*length)
        p=q.copy()
        p.z+=.39
        ironwork(name+' · bench leg',q,p,group,.12,'stone')
        if back:
            ironwork(name+' · backrest brace',q+normal*.07,p+normal*.19+Vector((0,0,.32)),
                     group,.055,'metal')
    for stripe in (-.14,0,.14):
        q=center+normal*stripe+Vector((0,0,.405))
        board=block(name+' · seat slat',q,(length,.125,.072),group,'plank',1,.015)
        board.rotation_euler.z=angle
    if back:
        for h in (.56,.68):
            q=center+normal*.21+Vector((0,0,h))
            board=block(name+' · back slat',q,(length,.073,.103),group,'plank',2,.016)
            board.rotation_euler.z=angle


def desk(name, x, y, z, width, group):
    block(name+' · cabinet',(x,y,z+.37),(width,.63,.73),group,'timber',1,.044)
    block(name+' · solid top',(x,y,z+.76),(width+.12,.73,.11),group,'plank',2,.022)
    for j in range(7):
        sx=x+(.5+j)*width/7-width/2
        block(name+' · reed front',(sx,y-.326,z+.38),(width/7-.025,.031,.57),group,'plank',j,.006)
    for j in range(3):
        block(name+' · folded visitor map',(x+.19*j-width*.28,y+.01-.03*j,z+.824),
              (.15,.26,.013),group,('peach','ivory','azure')[j],j,.004)


def exhibit(name, x, y, z, width, height, group, tone):
    """A framed landscape study made from painted relief, with no project marks or labels."""
    w,h=width/2,height/2
    block(name+' · frame',(x,y,z),(width+.09,.10,height+.09),group,'timber',1,.023)
    block(name+' · mat',(x,y-.058,z),(width-.02,.027,height-.02),group,'ivory',tone,.006)
    a,b=x-w*.88,x+w*.88
    p,q=z-h*.83,z+h*.83
    panel(name+' · painted sky',[(a,y-.075,p),(b,y-.075,p),(b,y-.075,q),(a,y-.075,q)],
          group,material(('azure','clay','peach')[tone%3],tone),.023)
    for k in range(2):
        f=y-.091-k*.008
        outline=((a,f,p),(b,f,p),(b,f,p+h*(.42+.05*tone)),(x+w*.45,f,p+h*(.98-.17*k)),
                 (x-w*.15,f,p+h*(.60+.21*k)),(x-w*.47,f,p+h*(1.11-.39*k)),(a,f,p+h*.48))
        panel(name+' · land silhouette',outline,group,material(('pine','cliff','azure')[(tone+k)%3],k+1),.010)


def main_hall(group):
    skeleton=collection('Adzed timber and limestone arcades',group)
    canopy=collection('Split clay vault and copper roof drainage',group)
    interior=collection('Navigation desks, maps and sheltered seating',group)
    annex=collection('Raised side loggia and wind screen',group)
    z=COURT_Z
    paving('Pavilion · hewn stone sill',(-5.01,1.48,1.11,6.15),z,skeleton,'limestone',.66)
    xs=(-4.65,-2.79,-.88,1.02)
    for y in (1.75,5.88):
        arcaded_wall('Plaza arcade' if y<3 else 'Garden arcade',xs,y,z,4.88,skeleton,glazed=y>3)
        block('Pavilion · upper lintel',(-1.815,y,5.915),(6.29,.32,.21),skeleton,'limestone',1,.035)
        for x in xs:
            block('Pavilion · timber bracket',(x,y,5.67),(.29,.40,.49),skeleton,'timber',1,.034)
    for x in (-4.65,1.02):
        for y in (2.80,4.76):
            pier('Pavilion side aisle',x,y,z,5.77,.31,skeleton,'timber')
        for y in (2.32,5.26):
            beam('Pavilion · knee-braced eave',(x,y,5.08),(x,y+.42,5.71),.14,.17,skeleton,'timber')
        beam('Pavilion · edge tie',(x,1.63,5.785),(x,6.12,5.785),.20,.25,skeleton,'timber')
    roof=barrel_roof(canopy)
    for y in (1.75,5.88):
        for x in (-4.65,1.02):
            u=-.83 if x<0 else .84
            b=roof(u,(y-1.18)/5.13)-Vector((0,0,.14))
            beam('Pavilion · inclined king brace',(x,y,5.82),b,.15,.18,skeleton,'timber',bevel=.023)
    desk('Information counter',-1.84,3.75,z,1.68,interior)
    desk('Visitor map table',-.15,4.42,z,.85,interior)
    bench('Sheltered bench',-3.87,3.64,z,1.25,interior,angle=math.pi/2)
    for i in range(3):
        x=-3.75+i*.57
        exhibit('Gallery navigation plate',x,5.44,4.42,.42,.59,interior,i)
    for x in (-3.64,-1.79,.06):
        rod('Pavilion · pendant cable',(x,3.73,5.97),(x,3.73,5.23),.023,interior,'metal',6)
        block('Pavilion · opal lamp',(x,3.73,5.14),(.19,.19,.17),interior,'amber',bevel=.04)
        block('Pavilion · pendant shade',(x,3.73,5.23),(.29,.29,.06),interior,'brass',bevel=.05)
    light('Pavilion · amber interior',(0,3.4,5.48),(-1.65,3.72,3.43),55,1.8,interior)

    # A lower limewash wing steps away from the open vault towards the garden circuit.
    paving('Side loggia floor',(1.20,2.06,3.94,5.64),z,annex,'stone',.48)
    for x in (1.28,3.89):
        for y in (2.09,5.61):
            pier('Loggia · end bearing',x,y,z,5.84,.25,annex)
    block('Loggia · garden plinth',(2.56,5.60,z+.13),(2.67,.27,.26),annex,'peach',0)
    glass_grid('Loggia · garden screen',(1.33,5.61),(3.81,5.61),z+.27,5.38,4,annex)
    glass_grid('Loggia · harbor screen',(1.33,2.10),(3.81,2.10),z+.27,5.38,3,annex,opening=1)
    for j in range(12):
        a=1.10+j*.257
        b=a+.246
        panel('Loggia · slate roof leaf',[(a,1.82,5.53),(b,1.82,5.53),(b,5.96,6.22),(a,5.96,6.22)],
              annex,material('zinc',j),.10,.015)
        ironwork('Loggia · standing seam',(a,1.82,5.59),(a,5.96,6.28),annex,.032,'metal')
    for y,eave in ((1.82,5.52),(5.96,6.21)):
        beam('Loggia · continuous fascia',(1.10,y,eave),(4.21,y,eave),.13,.18,annex,'zinc',bevel=.018)
    for x in (1.32,3.89):
        beam('Loggia · pitched edge member',(x,1.97,5.45),(x,5.91,6.14),.21,.18,annex,'timber')
    bench('Loggia · garden bench',3.47,4.49,z,1.37,annex,angle=math.pi/2)
    desk('Loggia · local flyer shelf',2.58,5.28,z,1.32,annex)
    railing('Loggia · open east bay',[(3.92,2.4,z),(3.92,5.24,z)],annex,height=.63,key='metal')

    for i in range(6):
        y=.29+(i+.5)*.295
        block('East sun terrace · transverse board',(2.63,y,z-.054),
              (2.62,.279,.108),annex,'plank',i,.013)
    railing('Loggia · sun terrace edge',[(3.83,.40,z),(3.83,1.44,z)],annex,height=.62,key='metal')
    bench('Loggia · front bench',2.29,.63,z,1.30,annex,angle=0,back=False)


def guide_house(group):
    z=WEST_Z
    paving('Guide loggia · peach stone deck',(-10.59,-.24,-7.08,2.70),z,group,'stone',.55)
    for x in (-10.38,-7.27):
        for y in (-.18,2.56):
            pier('Guide loggia · pier',x,y,z,4.86,.255,group,'timber')
    for y in (-.22,2.61):
        beam('Guide loggia · lintel',(-10.51,y,4.84),(-7.11,y,4.84),.20,.20,group,'timber')
    for x in (-10.30,-7.29):
        for y,direction in ((-.17,1),(2.55,-1)):
            beam('Guide loggia · knee brace',(x,y,4.21),(x,y+.49*direction,4.81),
                 .105,.13,group,'timber')
    # Broad terracotta brow at the uphill end, open under a peach timber-louver canopy.
    for j in range(16):
        x=-10.65+j*.227
        beam('Guide loggia · timber sun louver',(x,-.56,4.91),(x,2.81,5.30),.112,.145,
             group,'plank',j,.019)
    for j in range(14):
        x=-10.62+j*.255
        panel('Guide loggia · sheltered roof leaf',
              [(x,.66,5.065),(x+.246,.66,5.065),(x+.246,2.92,5.385),(x,2.92,5.385)],
              group,material('peach',j),.068,.02)
    for y,z2 in ((-.54,4.9),(2.9,5.33)):
        beam('Guide loggia · roof edge',(-10.69,y,z2),(-6.99,y,z2),.132,.15,group,'clay',1)
    block('Guide loggia · map wall',(-8.84,2.53,z+.93),(3.02,.24,1.86),group,'peach',2,.034)
    block('Guide loggia · sill cap',(-8.84,2.53,z+1.87),(3.13,.30,.11),group,'limestone',1,.023)
    for i in range(3):
        exhibit('Guide loggia · route study',-9.70+i*.87,2.36,z+1.20,.67,.69,group,i)
    desk('Guide station · index drawers',-9.68,1.31,z,1.11,group)
    bench('Guide loggia · shared bench',-10.12,.51,z,1.19,group,angle=-math.pi/2)
    for y in (.66,1.86):
        rod('Guide · lamp tie',(-8.21,y,4.92),(-8.21,y,4.47),.022,group,'metal')
        block('Guide · opal lantern',(-8.21,y,4.40),(.16,.16,.17),group,'amber',0,.029)


def game_hall(group):
    z=EAST_Z
    paving('Game gallery · platform',(6.76,.62,10.48,4.28),z,group,'limestone',.56)
    for x in (6.83,10.42):
        for y in (.68,4.18):
            pier('Gallery · steel and limestone pier',x,y,z,5.02,.26,group)
    block('Gallery · back wall',(8.62,4.15,z+1.10),(3.54,.30,2.20),group,'peach',1,.024)
    for x in (7.05,8.65,10.18):
        block('Gallery · back wall pilaster',(x,4.00,z+1.03),(.137,.10,2.04),group,'limestone',2,.017)
    for a,b in (((6.83,.72),(6.83,3.48)),((10.42,.72),(10.42,3.00))):
        glass_grid('Gallery · corner showcase',a,b,z+.39,4.78,4,group)
    for x,start in ((6.83,3.49),(10.42,3.02)):
        block('Gallery · side bay',(x,(4.15+start)/2,z+1.10),(.23,4.15-start,2.20),
              group,'peach',2,.025)
    for x0,x1 in ((6.84,8.26),(9.60,10.42)):
        block('Gallery · stone sill',((x0+x1)/2,.70,z+.17),(x1-x0,.238,.34),group,'stone',1)
        glass_grid('Gallery · public front',(x0,.69),(x1,.69),z+.34,4.87,2,group)
    # The central doorway opens along the walk; an inner header supports the sunshade.
    ironwork('Gallery · door header',(8.26,.64,4.87),(9.54,.64,4.87),group,.14,'timber')

    creases=((6.51,5.00),(7.85,5.95),(8.59,5.36),(8.84,5.84),(10.77,5.00))
    for i,((a,za),(b,zb)) in enumerate(zip(creases,creases[1:])):
        for j in range(13):
            lo,hi=.38+j*.318,.38+j*.318+.304
            panel('Gallery · folded zinc pan',[(a,lo,za),(b,lo,zb),(b,hi,zb+.025),(a,hi,za+.027)],
                  group,material('zinc',i+j//4),.102,.012)
            ironwork('Gallery · standing seam',(a,lo,za+.044),(b,lo,zb+.044),group,.038,'zinc')
        for y in (.38,4.54):
            beam('Gallery · folded barge trim',(a,y,za),(b,y,zb),.135,.14,group,'metal',bevel=.024)
    for y in (.61,4.18):
        for a,b in zip(creases,creases[1:]):
            xa,za=a
            xb,zb=b
            panel('Gallery · fold gable',[(xa,y,4.90),(xb,y,4.90),(xb,y,zb-.068),(xa,y,za-.068)],
                  group,material('limestone',1),.13,.015)
    for x in (6.71,10.49):
        beam('Gallery · eaves carrier',(x,.43,4.86),(x,4.48,4.86),.22,.23,group,'timber')
    panel('Gallery · peach canvas canopy',[(7.12,-.39,4.41),(10.18,-.39,4.41),
          (10.18,.78,4.82),(7.12,.78,4.82)],group,material('clay',3),.079,.016)
    for x in (7.17,10.13):
        beam('Gallery · awning bracket',(x,.72,4.16),(x,-.38,4.41),.084,.11,group,'metal')
    for i in range(3):
        x=7.44+i*1.17
        exhibit('Gallery · playfield relief',x,3.95,z+1.21,.80,.88,group,i)
    for x,y in ((7.52,2.53),(9.66,2.47)):
        block('Gallery · play table base',(x,y,z+.24),(.72,.67,.47),group,'timber',1,.027)
        block('Gallery · playable display plinth',(x,y,z+.50),(.95,.80,.095),group,'plank',2,.02)
        for j in range(4):
            block('Gallery · small game piece',(x+((j%2)-.5)*.16,y+((j//2)-.5)*.20,z+.574),
                  (.103,.105,.052),group,('azure','clay','ivory','metal')[j],0,.016)
    bench('Gallery · shared seat',8.67,3.31,z,1.19,group,back=False)
    light('Gallery · warm review light',(8.56,2.82,4.85),(8.57,4.00,3.79),30,1.7,group)


def lookout(group):
    z=HEADLAND_Z
    shape=[(8.00,-5.17),(9.65,-5.48),(10.70,-4.72),(10.66,-3.80),(9.42,-3.88),(8.05,-4.33)]
    slab('Headland · dressed stone belvedere',shape,z-.24,z,group,'stone',1,.035)
    railing('Headland · sea parapet',[(*p,z) for p in shape[:4]],group,height=.60,key='metal')
    bench('Belvedere · sea-facing bench',9.85,-4.55,z,1.35,group,angle=math.pi*.20)
    for x,y in ((8.47,-4.40),(10.34,-4.12)):
        pier('Belvedere · timber canopy pier',x,y,z,4.16,.18,group,'timber')
    # Cantilevered lattice preserves walking space along the water side.
    beam('Belvedere · carrying beam',(8.19,-4.44,4.18),(10.65,-4.06,4.18),.17,.24,group,'timber',bevel=.022)
    for i in range(11):
        x=8.24+i*.227
        y=-4.47+i*.037
        beam('Belvedere · open shade lath',(x,y-.88,4.16),(x,y+.47,4.25),.104,.119,group,'plank',i,.014)
    for x,y in ((8.47,-4.4),(10.34,-4.12)):
        beam('Belvedere · underbrace',(x,y,3.66),(x,y-.62,4.13),.09,.10,group,'metal')
    for x,y in ((8.52,-4.83),(9.02,-5.03)):
        block('Belvedere · occasional stool',(x,y,z+.18),(.37,.33,.36),group,'stone',1,.03)


def furniture(group):
    # Seat nodes sit outside all stair approaches and the center of the public court.
    for i,(x,y,a) in enumerate(((-2.74,-2.12,0),(2.52,-2.05,0),(-4.45,-1.40,math.pi/2),
                                 (.41,6.91,math.pi),(-2.20,6.94,math.pi))):
        bench('Gathering court · limestone and timber',x,y,COURT_Z,1.34 if i<3 else 1.17,
              group,angle=a,back=i!=4)
    for x,y,z,a in ((-4.36,.97,COURT_Z,0),(4.31,-.72,COURT_Z,math.pi*.13),
                    (8.00,-2.02,EAST_Z,math.pi*.30)):
        rod('Wayfinding · bronze stanchion',(x,y,z),(x,y,z+.92),.053,group,'metal',8)
        block('Wayfinding · cast base',(x,y,z+.062),(.27,.23,.124),group,'stone',1,.021)
        plate=block('Wayfinding · glazed ceramic blade',(x,y,z+.88),(.41,.068,.22),group,'clay',0,.018)
        plate.rotation_euler.z=a
        rule=block('Wayfinding · edge band',(x,y,z+.975),(.42,.075,.047),group,'ivory',1,.008)
        rule.rotation_euler.z=a
