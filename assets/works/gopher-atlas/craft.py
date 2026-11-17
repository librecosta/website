"""Small architectural sections, roof assemblies and display furniture."""

from dataclasses import dataclass
import math
from pathlib import Path
import sys

from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE.parent / 'harvest'), str(HERE.parent / 'sofaraway')]
from geometry import (MATERIALS, METALS, PALETTE, beam, block, collection, conduit, faceted_rock,
                      lantern, lathe, material, mesh, railing, rod)
from fabric import panel, slab


def palette():
    MATERIALS.clear()
    PALETTE.update({
        'cliff': ('898e8c', '9ea299', '7d8586', '9b9e96', 'a8a697', '868784'),
        'shale': ('5d686c', '687379', '6f7675', '7a7e76', '626e70'),
        'talus': ('a3a398', 'b4ae9b', '9b9e95', 'b0ada0', '879595'),
        'grass': ('879679', '8c9776', '9aa180', '929480', '7b8a74'),
        'pine': ('476254', '547261', '617e65', '6e8666'),
        'leaves': ('6a816a', '80936f', '909d79', '9fa887'),
        'stone': ('c6bdab', 'd0c5ae', 'b9b5a5', 'd9cdb6', 'c8c5b6', 'b9bcaf'),
        'plaster': ('d7ceb9', 'd3cbb5', 'c7c0ae', 'ded6c1', 'e9ddc4'),
        'mortar': ('86897e', '9a9e93', '9f9f91'),
        'roof': ('3b565e', '405e64', '456269', '4c6769', '426067', '4a646a', '3d585f'),
        'zinc': ('758886', '849490', '627674', '77908b'),
        'green': ('425f53', '506a57', '6c8373'),
        'copper': ('886d57', '96765b', 'a18465', '795e4d'),
        'timber': ('765e4b', '685542', '806752', '584a41'),
        'plank': ('9b7b60', 'a2896d', '896e59', 'b49b7b'),
        'brass': ('ba9a64', 'ab8e61', 'd2b482'),
        'iron': ('424e50', '4c5859', '536466'),
        'paper': ('dec9a4', 'e0d4b9', 'f2e4c3', 'c0baab'),
        'books': ('89704d', '634c43', '557069', '7e8e84', '9e8463', 'a89a7b', 'b19d88', '767a68'),
        'water': ('4f7478', '567e80', '658c89'),
        'amber': ('ffd594',),
    })
    METALS.update({'zinc': .46, 'roof': .27, 'iron': .38, 'copper': .47})
    lamp = material('amber').node_tree.nodes.get('Principled BSDF')
    lamp.inputs['Emission Strength'].default_value = .34


def glaze():
    glass = material('glass', 2)
    if glass.get('Atlas glazing'):
        return glass
    glass.diffuse_color = (.20, .33, .31, .30)
    nodes = glass.node_tree.nodes
    links = glass.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.53, .69, .65, 1)
    shader.inputs['Roughness'].default_value = .18
    shader.inputs['Transmission Weight'].default_value = .86
    clear = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    mix.inputs[0].default_value = .32
    links.new(clear.outputs[0], mix.inputs[1])
    links.new(shader.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], nodes.get('Material Output').inputs['Surface'])
    glass['Atlas glazing'] = True
    return glass


@dataclass(frozen=True)
class Bay:
    u: float
    width: float
    sill: float
    height: float
    arch: float = 0
    infill: str = 'window'


@dataclass(frozen=True)
class Face:
    x: float
    y: float
    z: float
    yaw: float = 0

    def at(self, u, v, d=0):
        c, s = math.cos(self.yaw), math.sin(self.yaw)
        return (self.x + u*c - d*s, self.y + u*s + d*c, self.z + v)

    def section(self, name, outline, offset, depth, group, key, tone=0, bevel=.012):
        return panel(name, [self.at(u, v, offset) for u, v in outline], group,
                     material(key, tone), depth, bevel)

    def piece(self, name, u, v, offset, span, height, depth, group, key, tone=0, bevel=.015):
        obj = block(name, self.at(u,v,offset), (span,depth,height), group, key, tone, bevel)
        obj.rotation_euler.z = self.yaw
        return obj


def profile(half, spring, cap, segments=10):
    return [(half*math.cos(math.pi*(1-i/segments)), spring+cap*math.sin(math.pi*i/segments))
            for i in range(segments+1)]


def arch_ring(name, face, u, spring, half, cap, band, depth, group, key='stone'):
    inner = profile(half, spring, cap)
    outer = profile(half+band, spring, cap+band)
    for i, (a,b,c,d) in enumerate(zip(inner, inner[1:], outer[1:], outer)):
        corners = [(x+u,y) for x,y in (a,b,c,d)]
        face.section(name+' · dressed voussoir', corners, -.05, depth, group, key, i, .012)


def recess(name, frame, bay, group):
    u, half, sill, spring = bay.u, bay.width/2, bay.sill, bay.sill+bay.height-bay.arch
    is_door = bay.infill in {'door', 'entry'}
    trim = .13 if is_door else .10
    height = spring-sill
    for side in (-1,1):
        x = u + side*(half+trim*.25)
        frame.piece(name+' · cut-stone jamb',x,sill+height*.5,-.057,trim,height,.29,group,'stone',side)
        if is_door:
            frame.piece(name+' · jamb foot',x,sill+.12,-.105,trim+.14,.24,.38,group,'plaster',side)
    if bay.arch:
        arch_ring(name,frame,u,spring,half,bay.arch,trim,.29,group)
        if bay.infill == 'window':
            radial = [(u+x,y) for x,y in profile(half-.025,spring,bay.arch-.025)]
            panel(name+' · arched fanlight',[frame.at(x,y,.07) for x,y in radial],group,glaze(),.023)
            beam(name+' · radial muntin',frame.at(u,spring,.042),
                 frame.at(u,spring+bay.arch,.042),.040,.043,group,'zinc',bevel=.005)
    else:
        frame.piece(name+' · stone lintel',u,spring+.035,-.067,2*half+.27,.14,.30,group,'plaster')
    if is_door:
        frame.piece(name+' · weathered threshold',u,sill+.017,-.16,2*half+.25,.075,.46,group,'stone')
    else:
        frame.piece(name+' · drip sill',u,sill-.01,-.14,2*half+.26,.12,.41,group,'stone')
    if bay.infill == 'entry' or bay.infill == 'open':
        return
    if bay.infill == 'door':
        for j in range(6):
            frame.piece(name+' · inset oak leaf',u+bay.width*((j+.5)/6-.5),sill+height/2,.104,
                        bay.width/6-.014,height,.105,group,'timber',j,.011)
        for v in (sill+.20,sill+height*.68):
            frame.piece(name+' · cross rail',u,v,.035,bay.width-.08,.09,.075,group,'plank')
        for side in (-1,1):
            frame.piece(name+' · pull handle',u+side*.13,sill+height*.53,-.010,.046,.13,.05,group,'brass')
        return
    corners=[(u-half,sill),(u+half,sill),(u+half,spring),(u-half,spring)]
    panel(name+' · inset glass',[frame.at(x,y,.072) for x,y in corners],group,glaze(),.026)
    for offset in (-.48,0,.48):
        frame.piece(name+' · mullion',u+half*offset,sill+height*.5,.033,.042,height,.073,group,'zinc')
    for v in (sill+.05,sill+height*.61,spring-.028):
        frame.piece(name+' · glazing transom',u,v,.035,bay.width,.050,.074,group,'zinc')


def facade(name, frame, width, height, bays, group, key='plaster', depth=.24, dressed=True):
    """Construct a thick masonry wall around real rectangular or arched openings."""
    def masonry(label, x0, x1, low, high, tone=0):
        if x1-x0 > .001 and high-low > .001:
            frame.piece(name+' · '+label,(x0+x1)/2,(low+high)/2,depth/2,
                        x1-x0,high-low,depth,group,key,tone,.009)

    end = -width/2
    for i,bay in enumerate(sorted(bays,key=lambda item:item.u)):
        half = bay.width/2
        left,right = bay.u-half,bay.u+half
        if left < end-.001 or right > width/2 or bay.sill+bay.height >= height:
            raise ValueError(f'{name}: an opening intersects another bay or masonry edge')
        masonry('pier',end,left,0,height,i)
        masonry('apron',left,right,0,bay.sill,i+1)
        spring=bay.sill+bay.height-bay.arch
        if bay.arch:
            curve=profile(half,spring,bay.arch)
            for a,b in zip(curve,curve[1:]):
                pts=[(a[0]+bay.u,a[1]),(b[0]+bay.u,b[1]),(b[0]+bay.u,height),(a[0]+bay.u,height)]
                frame.section(name+' · arch spandrel',pts,depth/2,depth,group,key,i,0)
        else:
            masonry('head course',left,right,spring,height,i)
        recess(name+f' · bay {i+1:02}',frame,bay,group)
        end=right
    masonry('end pier',end,width/2,0,height)
    frame.piece(name+' · stepped frieze',0,height-.055,.035,width+.07,.17,depth+.15,group,'stone',1)
    frame.piece(name+' · cornice shadow',0,height+.071,.028,width+.13,.071,depth+.20,group,'mortar',1)
    frame.piece(name+' · coping',0,height+.159,.030,width+.21,.11,depth+.29,group,'plaster',3)
    if dressed:
        for side in (-1,1):
            for j in range(math.ceil(height/.39)):
                w=.28 if j%2 else .42
                x=side*(width/2-w/2)
                z=min(j*.39+.19,height-.20)
                frame.piece(name+' · corner block',x,z,-.035,w,.35,.14,group,'stone',j)


def base(name, x, y, z, w, d, group, depth=.52):
    block(name+' · founded base',(x,y,z-depth*.54),(w+.10,d+.10,depth),group,'mortar',1,.035)
    block(name+' · plinth',(x,y,z-.12),(w+.28,d+.26,.24),group,'stone',0,.042)
    block(name+' · upper course',(x,y,z-.025),(w+.15,d+.13,.12),group,'plaster',1,.020)


def roof(name, x, y, z, w, d, rise, group, yaw=0, ridge=.06, tiles=True, cover='roof'):
    """Full pitched roof, closed gables, laid sheets, ridge cap and drip line."""
    origin = Face(x,y,z,yaw)
    at = lambda u,v,h: Vector(origin.at(u,h,v))
    half, depth = w/2+.23, d/2+.24
    for side in (-1, 1):
        edge = side*depth
        p = [at(-half,edge,0),at(half,edge,0),at(half,ridge,rise),at(-half,ridge,rise)]
        panel(name+' · roof deck', p, group, material(cover,1),.11,.017)
        rows = max(3,round(abs(edge-ridge)/.34)) if tiles else 1
        columns = max(5,round(2*half/(.50 if tiles else .40)))
        for row in range(rows):
            f0,f1 = row/rows,min(1,(row+1.12)/rows)
            v0,v1 = edge+(ridge-edge)*f0,edge+(ridge-edge)*f1
            for j in range(columns+(row%2)):
                a=2*half*(j-.5*(row%2))/columns-half
                b=a+2*half/columns
                a,b=max(-half,a+.012),min(half,b-.012)
                if b-a<.03:
                    continue
                pts=[at(a,v0,rise*f0+.055),at(b,v0,rise*f0+.055),
                     at(b,v1,rise*f1+.046),at(a,v1,rise*f1+.046)]
                tone=(3*j+2*row+(j*row)%5+(side+1)) % len(PALETTE[cover])
                panel(name+' · ' + ('lapping tile' if tiles else 'standing seam sheet'),
                      pts,group,material(cover,tone),.048,.010)
                if not tiles:
                    beam(name+' · rolled seam',pts[0],pts[-1],.045,.047,group,'zinc',j,.010)
        beam(name+' · raked drip edge',at(-half-.04,edge,-.014),at(half+.04,edge,-.014),
             .083,.094,group,'zinc',side)
        for j in range(columns+1):
            u=-half+2*half*j/columns
            beam(name+' · exposed rafter tail',at(u,edge-.02*side,-.096),
                 at(u,edge-.34*side,.002),.086,.078,group,'timber',j)
    beam(name+' · folded ridge cap',at(-half-.06,ridge,rise+.084),at(half+.06,ridge,rise+.084),
         .14,.106,group,'zinc',1,.024)
    for side in (-1,1):
        u=side*(half-.20)
        panel(name+' · closed gable',[at(u,-depth+.10,-.09),at(u,depth-.10,-.09),at(u,ridge,rise)],
              group,material('plaster',1),.14,.012)
        for v in (-depth,depth):
            beam(name+' · barge board',at(side*half,v,0),at(side*half,ridge,rise+.05),
                 .137,.144,group,'timber',0,.015)


def shelf(name, x, y, z, width, height, group, bank, yaw=0):
    front=Face(x,y,z,yaw)
    front.piece(name+' · shelf back',0,height/2,.20,width,height,.10,group,'timber',1)
    for side in (-1,1):
        front.piece(name+' · case side',side*(width/2-.044),height/2,.01,.092,height,.43,group,'timber',side)
    for row in range(4):
        v=height*row/4
        front.piece(name+' · shelf',0,v+.06,.01,width,.083,.41,group,'plank',row)
        for j in range(bank):
            dx=width*.80*((j+.5)/bank-.5)
            if (j+row*2)%9==8:
                continue
            h=height*(.11+.025*((j*5+row)%4))
            w=width*(.70+.05*((j+row)%3))/bank
            front.piece(name+' · bound volume',dx,v+.105+h*.5,-.053,w,h,.229,group,'books',3*j+row,.008)
            if (j+row)%4==0:
                front.piece(name+' · spine inlay',dx,v+.075+h*.81,-.170,w*.70,.025,.013,group,'brass',row,.004)
    front.piece(name+' · crown moulding',0,height+.016,.01,width+.12,.097,.46,group,'plank',1)


def desk(name, x, y, z, w, d, group, yaw=0, drawers=False):
    face=Face(x,y,z,yaw)
    face.piece(name+' · work surface',0,.71,0,w,.105,d,group,'plank',1,.034)
    for i,u in enumerate((-w*.41,w*.41)):
        for v in (-d*.35,d*.35):
            face.piece(name+' · trestle upright',u,.325,v,.113,.66,.112,group,'timber',i)
        face.piece(name+' · transverse stretcher',u,.26,0,.117,.085,d*.76,group,'timber',i)
    face.piece(name+' · apron',0,.59,-d*.34,w*.88,.14,.098,group,'timber')
    if drawers:
        for i,u in enumerate((-w*.24,w*.24)):
            face.piece(name+' · drawer face',u,.584,-d*.43,w*.42,.116,.10,group,'plank',i)
            face.piece(name+' · drawer pull',u,.590,-d*.497,.104,.024,.05,group,'brass',i,.008)
    for j in range(3):
        paper=face.piece(name+' · working folio',w*(j-1)*.22,.772+j*.009,(j%2-.5)*d*.24,
                         w*.18,.017,d*.54,group,'paper',j,.004)
        paper.rotation_euler.z += (j-1)*.11


def chair(name,x,y,z,group,yaw=0):
    face=Face(x,y,z,yaw)
    face.piece(name+' · reading seat',0,.341,0,.40,.067,.40,group,'plank',1,.027)
    for u in (-.145,.145):
        for d in (-.149,.149):
            face.piece(name+' · leg',u,.156,d,.053,.325,.056,group,'timber')
        face.piece(name+' · back upright',u,.55,.15,.054,.45,.059,group,'timber')
    for v in (.59,.73):
        face.piece(name+' · back slat',0,v,.15,.367,.085,.055,group,'plank',1)
