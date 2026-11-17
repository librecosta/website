"""An open north-light studio, a finishing annex and an outdoor proofing deck."""

from mathutils import Vector
import bpy

from coast import HIGH, MID, deck, founded_post, paving, terrace_base
from fabric import panel, rectangle, slab
from geometry import beam, block, collection, conduit, lantern, lathe, material, object_in, railing, rod


STUDIO, ANNEX = HIGH + .10, MID + .11


def glazing(diffuse=False):
    name = 'Diffuse clerestory glazing' if diffuse else 'Clear workshop glazing'
    glass = bpy.data.materials.get(name)
    if glass:
        return glass
    glass = bpy.data.materials.new(name)
    glass.diffuse_color = (.59,.70,.77,.30)
    glass.use_nodes = True
    nodes = glass.node_tree.nodes
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.83,.91,.97,1)
    shader.inputs['Roughness'].default_value = .17 if diffuse else .074
    shader.inputs['Transmission Weight'].default_value = .88
    shader.inputs['IOR'].default_value = 1.45
    # Keep the rooms readable in the orthographic review cameras.
    clear = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    mix.inputs[0].default_value = .68 if diffuse else .30
    glass.node_tree.links.new(clear.outputs[0],mix.inputs[1])
    glass.node_tree.links.new(shader.outputs[0],mix.inputs[2])
    glass.node_tree.links.new(mix.outputs[0],nodes.get('Material Output').inputs['Surface'])
    return glass


def window(name, a, b, z0, z1, group, panes=2, rails=1, diffuse=False, trim='zinc'):
    a,b = Vector(a),Vector(b)
    length = (b-a).length
    axis = (b-a).normalized()
    outside = Vector((axis.y,-axis.x))
    def point(s,z,out=0):
        p=a+axis*s+outside*out
        return p.x,p.y,z
    for i in range(panes+1):
        x=length*i/panes
        beam(name+' · sectioned jamb',point(x,z0),point(x,z1),.105,.16,group,trim,i,.013)
    for i in range(rails+2):
        z=z0+(z1-z0)*i/(rails+1)
        beam(name+' · framed transom',point(0,z),point(length,z),.16,.086,group,trim,i,.014)
    for i in range(panes):
        for j in range(rails+1):
            left,right=length*i/panes+.040,length*(i+1)/panes-.040
            low,high=z0+(z1-z0)*j/(rails+1)+.037,z0+(z1-z0)*(j+1)/(rails+1)-.037
            panel(name+' · recessed thick glass',
                  [point(left,low,-.026),point(right,low,-.026),point(right,high,-.026),point(left,high,-.026)],
                  group,glazing(diffuse),.025,.003)


def side_section(name, x, contour, group, key, width=.16):
    panel(name,[(x,y,z) for y,z in contour],group,material(key,1) if isinstance(key,str) else key,width,.011)


def roof_leaf(name, x0, x1, a, b, group, key):
    y0,z0=a
    y1,z1=b
    def point(x,t,rise=0):
        return (x,y0+(y1-y0)*t,z0+(z1-z0)*t+rise)
    panel(name+' · closed roofing substrate',[point(x0,0),point(x1,0),point(x1,1),point(x0,1)],
          group,material('timber',1),.16,.021)
    pitch=(x1-x0)/round((x1-x0)/.36)
    for i in range(round((x1-x0)/pitch)):
        x=x0+i*pitch
        panel(name+' · folded roof pan',
              [point(x+.012,0,.11),point(x+pitch-.011,0,.11),
               point(x+pitch-.011,1,.11),point(x+.012,1,.11)],
              group,material(key,i*3+i//5),.039,.007)
        beam(name+' · standing seam',point(x+.010,0,.142),point(x+.010,1,.142),.030,.046,group,key,i,.005)
        if i%2==0:
            for t in (0,1):
                s=.15 if t==0 else .85
                beam(name+' · exposed rafter',point(x+.139,t,-.11),point(x+.139,s,-.13),
                     .085,.125,group,'timber',i,.010)
    for x in (x0-.017,x1+.017):
        beam(name+' · folded verge',point(x,0,.016),point(x,1,.016),.078,.18,group,'iron',1)
    for t in (0,1):
        beam(name+' · boxed drip',point(x0-.07,t,.032),point(x1+.07,t,.032),.154,.147,group,'zinc',2)


def masonry(name, a, b, z0, z1, group, width=.29):
    a,b=Vector(a),Vector(b)
    count = max(1,round((b-a).length/.60))
    rows=max(1,round((z1-z0)/.235))
    for row in range(rows):
        for index in range(count):
            start, end=a.lerp(b,index/count),a.lerp(b,(index+1)/count)
            direction=(end-start).normalized()*.008
            start,end=start+direction,end-direction
            z=z0+(row+.5)*(z1-z0)/rows
            beam(name+' · dressed stone',(*start,z),(*end,z),width,(z1-z0)/rows-.009,group,
                 'stone',row*3+index,.018)


def interior_light(name, location, power, group, size):
    light=bpy.data.lights.new(name,'AREA')
    light.energy=power
    light.color=(1,.82,.67)
    light.size=size
    object_in(name,light,group).location=location


def pendant(x,y,z,group):
    rod('Pendant · stem',(x,y,z+.46),(x,y,z),.018,group,'iron')
    lathe('Pendant · folded shade',(x,y,z),[(.22,0),(.208,.059),(.073,.141),(.064,.159)],
          group,'iron',12)
    lathe('Pendant · amber diffuser',(x,y,z-.017),[(.11,0),(.109,.027)],group,'amber',12)


def main_studio(lands, parent):
    structure=collection('Makers’ hall · cut stone plinth and post frames',parent)
    shell=collection('North-light monitor, rafter plates and folded roofs',parent)
    bright=collection('Workshop fixtures and warm interior lighting',parent)
    z=STUDIO
    # Keep the open facade and the side threshold on one finished floor datum.
    slab('Studio · thick limestone platform',rectangle(.38,1.83,8.99,6.30,.19),z-.28,z-.071,structure,'stone',1,.036)
    for j in range(24):
        x=-4.09+(j+.5)*.374
        block('Studio · long oak floorboards',(x,1.83,z-.039),(.363,6.26,.078),structure,'plank',j,.009)
    for x in (-3.87,-1.70,.45,2.63,4.57):
        for y in (-1.13,4.76):
            founded_post('Main · bedrock foundation',x,y,z-.18,lands,structure,.42,False)
    paving('Studio forecourt',-3.98,-2.12,4.78,-1.35,z,structure,.49)
    masonry('Forecourt west cheek',(-3.96,-2.17),(-3.96,-1.39),z-.32,z-.036,structure,.32)
    masonry('Forecourt retaining edge',(-3.98,-2.12),(-.78,-2.12),z-.35,z-.056,structure,.30)
    masonry('Forecourt retaining edge',(1.14,-2.12),(4.76,-2.12),z-.35,z-.056,structure,.30)
    for a,b in (((-3.94,-2.09),(-.84,-2.09)),((1.18,-2.09),(4.73,-2.09))):
        count=round((b[0]-a[0])/.48)
        width=(b[0]-a[0])/count
        for i in range(count):
            left=a[0]+i*width+.005
            right=left+width-.010
            terrace_base('Forecourt · founded cut-stone skirt',
                         [(left,-2.073),(right,-2.073),(right,-1.76),(left,-1.76)],
                         z-.248,lands,structure)
        railing('Forecourt guard', [(*a,z),(*b,z)],structure,spacing=.64,height=.58,key='iron')

    for x in (-4.02,-1.8,1.42,4.69):
        block('Front bent · founded stone boot',(x,-1.30,z+.115),(.31,.33,.23),structure,'stone',1,.029)
        beam('Front bent · tapered timber post',(x,-1.30,z+.13),(x,-1.30,6.39),.225,.27,structure,'timber')
        for rise in (-1,1):
            if -4.6 < x+rise*.64 < 5:
                beam('Front bent · knee brace',(x,-1.30,5.77),(x+rise*.62,-1.30,6.28),
                     .115,.145,structure,'timber')
    beam('Front · continuous lintel',(-4.22,-1.30,6.33),(4.89,-1.30,6.33),.31,.23,structure,'timber',1)
    for a,b in ((-3.92,-1.90),(1.56,4.55)):
        masonry('Front · limestone sill wall',(a,-1.30),(b,-1.30),z,z+.58,structure)
        window('Front · daylight window',(a,-1.30),(b,-1.30),z+.58,6.20,structure,3,1)
    window('Entrance · overhead fanlight',(-1.68,-1.30),(1.30,-1.30),5.92,6.21,structure,3,0)
    for x in (-1.64,1.27):
        beam('Entrance · recessed door stop',(x,-1.26,z),(x,-1.26,5.94),.115,.142,structure,'iron',1)
    beam('Entrance · flush brass threshold',(-1.70,-1.39,z+.017),(1.32,-1.39,z+.017),.105,.033,structure,'brass')

    # Both flanks have stone sills and light from the display deck or the annex.
    for x in (-4.08,4.84):
        opening=( -.14, 1.31) if x<0 else (-.53,1.25)
        for lo,hi in ((-1.27,opening[0]),(opening[1],4.91)):
            masonry('Flank · sill wall',(x,lo),(x,hi),z,z+.55,structure)
            window('Flank · gridded windows',(x,lo),(x,hi),z+.55,6.37,structure,max(1,round((hi-lo)/1.02)))
        window('Flank · doorway transom',(x,opening[0]),(x,opening[1]),5.94,6.37,structure,2,0)
    paving('Annex door · upper sill',-4.09,-.10,-3.83,1.26,z,structure)

    for a,b in ((-4.08,-1.38),(-1.37,1.48),(1.49,2.34),(3.62,4.84)):
        masonry('North · stone rear wall',(a,4.93),(b,4.93),z,z+1.06,structure)
        window('North · return glazing',(b,4.93),(a,4.93),z+1.06,6.44,structure,max(1,round(b-a)),1)
    beam('North · tied perimeter beam',(-4.16,4.90,6.47),(4.94,4.90,6.47),.24,.19,structure,'timber')
    block('North · flanged service door',(2.98,4.92,z+.992),(1.26,.112,1.98),structure,'timber',1,.026)
    for j in range(6):
        block('North · service door vertical battens',(2.44+j*.216,5.007,z+.99),(.058,.068,1.966),
              structure,'plank',j,.008)
    block('North · inset pull',(2.67,5.07,z+.99),(.062,.075,.195),structure,'brass',0,.014)
    window('North · service fanlight',(3.62,4.93),(2.34,4.93),z+2.01,6.44,structure,2,0)
    deck('North service landing',2.17,4.99,4.15,5.79,z,lands,structure,.22)
    railing('North · service landing guard',[(2.21,5.75,z),(4.11,5.75,z)],structure,spacing=.57,height=.58,key='iron')
    paving('North · maintenance flags',-3.71,5.11,2.14,5.61,z,structure,.48)
    roof_leaf('North service canopy',2.17,4.15,(4.95,6.23),(5.84,6.01),shell,'lightroof')
    for x in (2.27,4.05):
        beam('Service canopy · braced bracket',(x,5.02,5.55),(x,5.70,5.98),.087,.116,shell,'iron',1)

    # The two roof pitches meet a continuous vertical strip of true glazing.
    roof_leaf('South canopy',-4.64,5.37,(-1.73,6.31),(.56,7.27),shell,'lightroof')
    roof_leaf('High north roof',-4.49,5.23,(.67,8.12),(5.27,6.48),shell,'roof')
    window('Monitor · continuous diffuse daylight',(5.16,.62),(-4.40,.62),7.26,8.13,shell,12,0,diffuse=True)
    for x in (-4.08,4.84):
        side_section('Gable · timber tray',x,[(-1.30,6.36),(.56,7.13),(.56,6.36)],shell,'timber')
        side_section('High gable · thick clear lite',x,[(.62,6.37),(4.94,6.37),(.62,8.04)],shell,glazing(),.055)
        for y in (.62,1.68,2.72,3.79,4.91):
            height=8.04-(y-.62)*.377
            beam('High gable · glazing upright',(x,y,6.36),(x,y,height),.079,.128,shell,'zinc',2,.011)
        beam('High gable · raking frame',(x,.62,8.04),(x,4.94,6.37),.137,.170,shell,'timber')
    for x in (-3.42,-1.47,.37,2.25,4.08):
        beam('Interior bent · cross tie',(x,-1.32,6.38),(x,4.96,6.38),.171,.22,shell,'timber',1)
        for y,z1 in ((-1.40,6.44),(.66,8.01),(4.98,6.46)):
            beam('Interior bent · laminated diagonal',(x,2.09,6.37),(x,y,z1),.108,.126,shell,'timber')
        for side in (-1,1):
            block('Bent · recessed splice plate',(x+side*.089,2.09,6.42),(.035,.42,.219),shell,'iron',1,.012)
    for x in (-4.46,5.24):
        conduit('Roof · swan-neck drain',[(x,5.21,6.43),(x,5.03,6.17),(x,5.03,z+.24)],.084,shell,'zinc',True)
    # Short extraction hood supplies the finishing and paper bays on the leeward roof.
    curb=[(2.81,7.36),(3.73,7.02),(3.73,7.61),(2.81,7.87)]
    for x in (-2.83,-.85):
        side_section('Extraction hood · folded cheek',x,curb,shell,'iron',.09)
    block('Extraction hood · flush lower flashing',(-1.84,2.80,7.45),(2.10,.16,.14),shell,'zinc',1,.018)
    for row in range(4):
        height=7.48+row*.085
        beam('Extraction hood · forward weather louver',(-2.83,2.775,height),(-.85,2.775,height),
             .077,.059,shell,'iron',2,.008)
    block('Extraction hood · north shroud',(-1.84,3.70,7.35),(1.97,.108,.50),shell,'graphite',1,.022)
    for row in range(5):
        beam('Extraction hood · offset louver',(-2.83,3.769,7.13+row*.093),(-.85,3.769,7.13+row*.093),
             .091,.061,shell,'zinc',2,.008)
    roof_leaf('Extraction hood · raised cap',-2.98,-.70,(2.74,7.90),(3.82,7.65),shell,'roof')
    for x,y in ((-2.56,1.23),(.57,1.73),(3.30,2.05)):
        pendant(x,y,6.03,bright)
        interior_light('Studio · soft task bounce',(x,y,5.88),33,bright,1.1)
    for x in (-1.89,1.50):
        lantern('Door · hooded working light',(x,-1.45,z+1.12),bright)
    for x in (-4.02,-1.80,1.42,4.69):
        block('Front bent · recessed joint plate',(x,-1.438,6.05),(.169,.046,.335),structure,'iron',1,.016)
        for h in (5.944,6.157):
            lathe('Front bent · hex joint bolt',(x,-1.469,h),
                  [(.036,0),(.036,.027),(.029,.038)],structure,'zinc',6,(0,-1,0))


def finishing_room(lands,parent):
    z=ANNEX
    deck('Finishing room floor',-9.45,-2.42,-5.68,1.39,z,lands,parent,.24)
    for x in (-9.37,-5.75):
        for y in (-2.35,1.32):
            beam('Annex · timber post',(x,y,z),(x,y,5.31 if y<0 else 4.82),.22,.23,parent,'timber')
    masonry('Annex · west stone flank',(-9.37,-2.22),(-9.37,1.28),z,z+.54,parent,.24)
    masonry('Annex · east cheek',(-5.75,-2.22),(-5.75,-.17),z,z+.54,parent,.24)
    window('Annex · east side window',(-5.74,-2.22),(-5.74,-.17),z+.54,4.77,parent,2,1)
    for y in (-1.78,-.66,.59):
        beam('Annex · west-side stud',(-9.38,y,z+.52),(-9.38,y,5.10),.14,.16,parent,'timber')
    window('Annex · side lights',(-9.39,-2.29),(-9.39,1.23),z+.54,4.75,parent,4,1)
    for a,b in ((-9.34,-8.83),(-6.83,-5.76)):
        masonry('Annex · front limestone sill',(a,-2.34),(b,-2.34),z,z+.64,parent,.24)
        window('Annex · front side lights',(a,-2.34),(b,-2.34),z+.64,5.18,parent,1,1)
    masonry('Annex · north retaining wall',(-9.39,1.31),(-5.72,1.31),z,z+.95,parent)
    window('Annex · north light',(-5.73,1.31),(-9.37,1.31),z+.95,4.75,parent,4,1)
    # Keep the east bay clear of glazing so the side stair connects directly.
    window('Annex · east high window',(-5.74,-2.22),(-5.74,1.22),4.77,5.04,parent,4,0)
    roof_leaf('Finishing room',-9.73,-5.42,(-2.73,5.61),(1.71,4.94),parent,'roof')
    for y,h in ((-2.36,5.53),(-1.30,5.37),(-.23,5.20),(.88,5.04)):
        beam('Annex · visible roof joist',(-9.52,y,h-.15),(-5.61,y,h-.15),.12,.19,parent,'timber')
    for x in (-8.64,-7.05):
        beam('Annex · loading awning bracket',(x,-2.34,4.54),(x,-3.05,4.88),.117,.12,parent,'timber')
    roof_leaf('Finishing room · rain awning',-9.18,-6.64,(-3.13,4.91),(-2.40,5.09),parent,'lightroof')
    pendant(-7.74,-.79,4.78,parent)
    interior_light('Finishing room · ambient bench light',(-7.74,-.79,4.56),23,parent,.94)


def proof_deck(lands,parent):
    z=STUDIO
    deck('Proof deck',4.88,-1.39,9.62,2.68,z,lands,parent,.24)
    paving('Proof deck · stone threshold',4.72,-.54,4.89,1.30,z,parent,.39)
    for pairs in (((4.91,-1.34),(9.56,-1.34)),((9.56,-1.34),(9.56,2.62)),((9.56,2.62),(4.90,2.62))):
        railing('Proof deck · timber-capped guard',[(*p,z) for p in pairs],parent,spacing=.75,height=.59,key='iron')
    for x,y in ((5.48,1.87),(9.26,1.87),(5.48,2.46),(9.26,2.46)):
        beam('Proof canopy · narrow steel support',(x,y,z),(x,y,6.18),.12,.17,parent,'iron',1)
        block('Proof canopy · base plate',(x,y,z+.035),(.225,.253,.071),parent,'zinc',1,.011)
    for y in (1.85,2.47):
        beam('Proof canopy · paired channel',(5.27,y,6.16),(9.43,y,6.16),.14,.17,parent,'iron',0)
    for j in range(15):
        x=5.29+j*.294
        beam('Proof canopy · spaced wooden louver',(x,1.69,6.25),(x,2.60,6.25),.112,.091,parent,'timber')
    for x in (5.49,9.24):
        beam('Proof canopy · trussed knee',(x,1.87,5.70),(x+.40 if x<7 else x-.40,1.87,6.16),.075,.086,parent,'zinc')
    for x in (5.68,9.35):
        for y in (-1.15,2.40):
            bottom=min(z-.49,2.54)
            beam('Deck · lateral knee brace',(x,y,bottom),
                 (x+.49 if x<7 else x-.49,y,z-.30),.143,.166,parent,'iron')
