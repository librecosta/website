"""The open cartography court and its physical survey furniture."""

import math

from craft import beam, block, collection, desk, lantern, lathe, material, mesh, rod, slab
from grounds import LOW, crate, tiles
from fabric import rectangle


def compass(x,y,z,group):
    lathe('Survey court · compass paving disc',(x,y,z),[(1.36,-.043),(1.36,0)],group,'stone',48)
    for r in (.96,1.25):
        lathe('Survey court · inset bronze ring',(x,y,z),[(r-.018,0),(r,-.006),(r,.009),(r-.018,.009)],
              group,'copper',48,closed=True)
    for i in range(16):
        a=math.tau*i/16
        r=1.17
        mark=block('Survey court · calibrated line',(x+r*math.cos(a),y+r*math.sin(a),z+.005),
                   (.139 if i%4==0 else .084,.020,.015),group,'iron',i,.003)
        mark.rotation_euler.z=a
    for i in range(4):
        a=math.pi/2*i
        rotate=lambda p: (x+p[0]*math.cos(a)-p[1]*math.sin(a),y+p[0]*math.sin(a)+p[1]*math.cos(a))
        outer=(.88,0)
        for v in (-.13,.13):
            outline=[rotate(p) for p in ((.07,0),(.31,v),outer)]
            if v>0:
                outline.reverse()
            slab('Survey court · inlaid dial needle',outline,z-.012,z+.010,group,
                 'brass' if v<0 else 'zinc',i,0)
    lathe('Survey court · datum pin',(x,y,z),[(.15,-.007),(.15,.013)],group,'brass',16)


def relief_table(x,y,z,group):
    base=rectangle(x,y,1.94,1.02,.13)
    slab('Atlas table · heavy base',base,z-.04,z+.14,group,'mortar',1,.028)
    for dx in (-.58,.58):
        block('Atlas table · carved pedestal',(x+dx,y,z+.305),(.31,.65,.64),group,'stone',2,.030)
        block('Atlas table · cradle molding',(x+dx,y,z+.56),(.46,.77,.12),group,'plaster',3,.025)
    top=z+.705
    slab('Atlas table · chamfered working slab',rectangle(x,y,2.02,1.14,.16),
         top-.14,top,group,'stone',3,.025)
    slab('Atlas table · inset sea bed',rectangle(x,y,1.71,.84,.08),
         top-.010,top+.014,group,'water',0,.009)
    contours = (
        ((-.74,-.23),(-.57,-.30),(-.39,-.26),(-.36,-.14),(-.18,-.13),(-.05,-.02),
         (-.12,.10),(-.30,.14),(-.41,.27),(-.57,.20),(-.60,.11),(-.78,.03)),
        ((.05,-.31),(.20,-.27),(.40,-.33),(.60,-.22),(.66,-.08),(.74,.02),(.63,.18),
         (.47,.20),(.35,.33),(.22,.25),(.09,.21),(.16,.10),(.02,.05),(-.01,-.08)),
        ((-.28,.26),(-.19,.23),(-.148,.31),(-.21,.36),(-.32,.34)),
        ((.47,.29),(.58,.25),(.69,.31),(.61,.36),(.51,.35)),
    )
    for i,outline in enumerate(contours):
        height=.037 if i<2 else .025
        world=[(x+a,y+b) for a,b in outline]
        slab('Atlas table · incised coastline',world,top+.013,top+.013+height,group,'talus',i,.004)
        if i<2:
            center=(sum(a for a,b in world)/len(world),sum(b for a,b in world)/len(world))
            for j,f in enumerate((.71,.48,.25),1):
                crest=[(center[0]+(a-center[0])*f,center[1]+(b-center[1])*f) for a,b in world]
                slab('Atlas table · stacked elevation contour',crest,top+.024+height*j,
                     top+.024+height*(j+1),group,'grass' if j<3 else 'stone',j,.005)
    for j in range(12):
        block('Atlas table · engraved reference tick',(x-.77+j*.14,y-.480,top+.013),
              (.020,.071 if j%3==0 else .042,.012),group,'copper',j,.003)
    for yy in (-.454,.454):
        beam('Atlas table · thin map boundary strip',(x-.81,y+yy,top+.015),(x+.81,y+yy,top+.015),
             .015,.026,group,'zinc',1,.003)


def survey_tripod(x,y,z,group):
    for i in range(3):
        a=.40+i*math.tau/3
        foot=(x+.26*math.cos(a),y+.26*math.sin(a),z+.027)
        seat=(x+.062*math.cos(a),y+.062*math.sin(a),z+.68)
        rod('Field instrument · adjustable tripod leg',foot,seat,.025,group,'timber',7)
        rod('Field instrument · screw ferrule',tuple((a+b)/2 for a,b in zip(foot,seat)),seat,
            .031,group,'brass',7)
    lathe('Field instrument · tripod head',(x,y,z+.645),[(.104,0),(.132,.033),(.093,.085)],
          group,'zinc',10)
    rod('Field instrument · compact level barrel',(x-.21,y,z+.776),(x+.21,y,z+.798),.056,
        group,'iron',10)
    for dx in (-.20,.19):
        lathe('Field instrument · brass adjuster',(x+dx,y,z+.787),[(.064,0),(.069,.043)],
              group,'brass',10,(1,0,0))


def courtyard(parent):
    floor=collection('Court · laid stone, compass and retaining wall',parent)
    furniture=collection('Cartography · relief table and field instruments',parent)
    z=LOW+.11
    tiles('Survey court',1.17,-6.89,7.31,-3.65,z,floor,.59)
    for x0,x1 in ((1.22,4.01),(4.05,7.23)):
        count=6
        for row in range(3):
            for i in range(count):
                p=x0+(x1-x0)*((i+.5)/count)
                block('Court · low coursed retaining wall',(p,-3.54,z+.08+row*.143),
                      ((x1-x0)/count-.018,.29,.137),floor,'mortar' if row==0 else 'stone',i+row,.016)
        block('Court · low wall coping',((x0+x1)/2,-3.54,z+.515),
              (x1-x0+.025,.36,.114),floor,'plaster',1,.027)
    for x in (7.13,1.39):
        lantern('Court · low reading lantern',(x,-3.54,z+.576),floor)
    compass(3.24,-5.30,z+.020,furniture)
    relief_table(5.56,-5.53,z,furniture)
    survey_tripod(6.93,-5.91,z,furniture)
    survey_tripod(4.33,-6.47,z,furniture)
    desk('Court · measured drawing bench',5.78,-4.13,z,1.55,.57,furniture,drawers=True)
    crate('Court · weatherproof folio case',6.84,-4.39,z,furniture,.73)
    for x,y in ((2.08,-4.02),(2.48,-4.02)):
        block('Court · bench foot',(x,y,z+.164),(.125,.236,.327),furniture,'mortar',1)
    block('Court · bench seat',(2.28,-4.02,z+.367),(.76,.275,.113),furniture,'stone',3,.026)
