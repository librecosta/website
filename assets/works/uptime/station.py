"""Coastal control room, records wing and the maintenance workshop."""

import math

from mathutils import Vector

from fabric import panel, rectangle, slab
from geometry import beam, block, collection, conduit, material, railing, rod
from ridge import COURT_Z, SUMMIT_Z, paving
from tower import glazing, warm_light


def glazed_bays(name, a, b, sills, bays, group):
    a,b = Vector(a),Vector(b)
    low, high = sills
    cross = low+(high-low)*.60
    for i in range(bays+1):
        p = a.lerp(b,i/bays)
        beam(name+' · jamb',(*p,low-.033),(*p,high+.034),.104,.095,group,'iron',bevel=.012)
        if i == bays:
            break
        q = a.lerp(b,(i+1)/bays)
        for rise, head in ((low,cross),(cross,high)):
            panel(name+' · storm glass',[(*p,rise),(*q,rise),(*q,head),(*p,head)],group,glazing(),.03,.005)
    for z in (low,cross,high):
        beam(name+' · sill and transom',(*a,z),(*b,z),.078,.104,group,'metal',bevel=.012)


def plinth(name, x0, y0, x1, y1, group, top=COURT_Z):
    x,y = (x0+x1)/2,(y0+y1)/2
    slab(name+' · keyed foundation',rectangle(x,y,x1-x0,y1-y0,.08),top-.34,top-.055,group,'mortar',1,.020)
    paving(name+' · raised interior floor',(x0,y0,x1,y1),top,group,'stone',.56)
    for i in range(round((x1-x0)/.48)):
        n = round((x1-x0)/.48)
        pitch = (x1-x0)/n
        p = x0+pitch*(i+.5)
        block(name+' · ashlar foundation face',(p,y0+.054,top-.145),(pitch-.015,.16,.24),
              group,'limestone',i,.013)


def standing_seam(name, x0, x1, rows, group):
    n = round((x1-x0)/.28)
    pitch = (x1-x0)/n
    for i in range(n):
        p,q = x0+pitch*(i+.022),x0+pitch*(i+.979)
        for j,((y0,z0),(y1,z1)) in enumerate(zip(rows,rows[1:])):
            panel(name+' · folded zinc pan',[(p,y0,z0),(q,y0,z0),(q,y1,z1),(p,y1,z1)],
                  group,material('roof',i+j),.107,.016)
            beam(name+' · raised seam',(q,y0,z0+.049),(q,y1,z1+.049),.038,.040,
                 group,'metal',i,.007)
        if i%2 == 0:
            for y,z in (rows[0],rows[-1]):
                block(name+' · exposed rafter end',((p+q)/2,y,z-.121),(.142,.268,.182),group,'timber',i,.018)
    for x in (x0,x1):
        for (y0,z0),(y1,z1) in zip(rows,rows[1:]):
            beam(name+' · folded verge',(x,y0,z0),(x,y1,z1),.124,.126,group,'iron',bevel=.017)
    for y,z in rows:
        beam(name+' · ridge and gutter pressings',(x0,y,z+.015),(x1,y,z+.015),.114,.126,group,'roof',3,.018)


def table(name, x, y, width, group, top=COURT_Z+.77):
    block(name+' · oiled work top',(x,y,top),(width,.64,.098),group,'plank',1,.023)
    for offset in (-width*.38,width*.38):
        for d in (-.225,.225):
            block(name+' · square timber leg',(x+offset,y+d,(top+COURT_Z)/2),
                  (.11,.11,top-COURT_Z),group,'timber',1,.015)
            beam(name+' · diagonal knee brace',(x+offset,y+d,top-.26),(x+offset*.79,y+d,top-.045),
                 .073,.078,group,'timber',bevel=.011)
        beam(name+' · stretcher',(x+offset,y-.25,top-.47),(x+offset,y+.25,top-.47),.082,.086,group,'timber')


def records(group):
    z = COURT_Z
    for index,(x,y,width) in enumerate(((-5.66,-1.68,1.91),(-2.83,-1.60,1.56))):
        table('Control · duty workbench',x,y,width,group)
        block('Duty desk · dark leather mat',(x+.02,y-.12,z+.827),(width*.56,.31,.019),group,'iron',index,.010)
        for i in range(3):
            block('Duty desk · bound check log',(x-.32,y+.075,z+.837+.015*i),(.32,.22,.031),
                  group,'linen' if i%2 else 'timber',i,.009)
        for i in range(2):
            pos = (x+.33+i*.29,y+.075,z+.94)
            block('Duty desk · incident annunciator',pos,(.23,.21,.228),group,'metal',i,.020)
            for dx in (-.055,.055):
                rod('Incident annunciator · indicator',(pos[0]+dx,pos[1]-.11,pos[2]+.04),
                    (pos[0]+dx,pos[1]-.138,pos[2]+.04),.021,group,'amber' if dx<0 else 'signal',8)
    for x in (-6.17,-5.47,-4.77):
        block('Records · louvered case',(x,1.06,z+.65),(.65,.45,1.26),group,'timber',1,.028)
        for i in range(6):
            h = z+.19+i*.183
            block('Records · individual drawer',(x,.825,h),(.569,.043,.164),group,'plank',i,.014)
            beam('Records · brass pull',(x-.075,.788,h),(x+.075,.788,h),.031,.035,group,'brass',bevel=.007)
    for i,x in enumerate((-3.22,-2.43)):
        block('Probe cabinet · weather case',(x,1.10,z+.78),(.71,.49,1.52),group,'iron',1,.029)
        for j in range(5):
            height = z+.29+j*.221
            block('Probe cabinet · removable module',(x,.84,height),(.59,.062,.165),group,'metal',i+j,.011)
            for dx in (-.16,-.09,.13):
                rod('Probe cabinet · status stud',(x+dx,.810,height),(x+dx,.778,height),.015,
                    group,'signal' if dx<.10 else 'iron',6)
    for x in (-5.52,-2.81):
        y = -2.35
        block('Control · adjustable stool seat',(x,y,z+.44),(.38,.38,.086),group,'plank',2,.031)
        rod('Control · stool stem',(x,y,z+.06),(x,y,z+.42),.052,group,'iron',8)
        for direction in range(3):
            angle = direction*math.tau/3
            beam('Control · stool splayed foot',(x,y,z+.16),(x+.19*math.cos(angle),y+.19*math.sin(angle),z+.035),
                 .055,.054,group,'iron',bevel=.007)
    for x in (-5.75,-3.86,-2.15):
        rod('Control · lamp tension cable',(x,-.47,5.11),(x,-.47,4.57),.018,group,'iron',6)
        block('Control · opal task light',(x,-.47,4.58),(.45,.133,.069),group,'amber',1,.024)
        block('Control · folded lamp shade',(x,-.47,4.626),(.51,.21,.050),group,'iron',1,.014)
    warm_light('Control room · work light',(-4.69,-1.21,4.92),(-4.18,-.22,2.70),48,2.6,group)


def operations(group):
    z = COURT_Z
    shell = collection('Control · clad frame and folded roof',group)
    interior = collection('Control · accessible interior and furniture',group)
    annex = collection('Records wing · masonry, document store and roof deck',group)
    plinth('Control',-6.92,-3.69,-1.44,1.48,shell)
    for x in (-6.86,-4.90,-3.22,-1.51):
        for y in (-3.63,1.38):
            block('Control · dressed pier base',(x,y,z+.108),(.32,.34,.215),shell,'limestone',1,.028)
            beam('Control · full-depth post',(x,y,z+.14),(x,y,4.84),.21,.26,shell,'timber',bevel=.032)
    for i,(left,right) in enumerate(((-6.76,-4.91),(-3.18,-1.60))):
        block('Control · street-side stone dado',((left+right)/2,-3.63,z+.22),
              (right-left,.207,.43),shell,'limestone',i,.018)
        glazed_bays('Control front', (left,-3.64),(right,-3.64),(z+.435,4.68),3,shell)
    beam('Control entry · top of open double door',(-4.91,-3.64,4.59),(-3.22,-3.64,4.59),.13,.15,shell,'timber')
    for x in (-4.84,-3.30):
        block('Control entry · bronze door stop',(x,-3.71,z+.095),(.093,.15,.19),shell,'brass',0,.015)
    beam('Control · lintel above the full façade',(-6.96,-3.64,4.78),(-1.40,-3.64,4.78),.22,.24,shell,'timber',bevel=.029)
    for x, positions in ((-6.91,(-2.46,-1.23,.05)),(-1.48,(-2.46,-1.54,-.19,.54))):
        for y in positions:
            beam('Control · intermediate upright',(x,y,z+.17),(x,y,4.83),.14,.17,shell,'timber',bevel=.018)
    for i,(a,b) in enumerate(((-3.48,-1.49),(-.20,1.29))):
        block('Control east · limestone sill',(-1.48,(a+b)/2,z+.22),(.23,b-a,.43),shell,'limestone',i,.021)
        glazed_bays('Control east',(-1.49,a),(-1.49,b),(z+.434,4.68),3,shell)
    beam('Control east · transfer doorway header',(-1.48,-1.52,4.67),(-1.48,-.19,4.67),.14,.16,shell,'timber')
    block('Control west · base wall',(-6.84,-1.08,z+.51),(.19,4.78,1.02),shell,'plaster',1,.020)
    glazed_bays('Control west',(-6.86,-3.55),(-6.86,-1.40),(3.34,4.63),3,shell)
    block('Control west · records fire separation',(-6.835,.09,4.014),(.185,2.75,1.34),shell,'plaster',2,.022)
    block('Control rear · continuous masonry wall',(-4.17,1.40,3.01),(5.32,.25,1.39),shell,'limestone',0,.029)
    glazed_bays('Control rear observation strip',(-6.70,1.414),(-1.63,1.414),(3.705,4.70),8,shell)
    for x in (-6.93,-1.46):
        panel('Control · gable infill',[(x,-3.63,4.70),(x,1.44,4.70),(x,1.44,4.91),(x,-.87,5.96)],
              shell,material('plaster',2),.16,.015)
        for y,height in ((-2.89,5.08),(-1.87,5.49),(-.86,5.83),(.23,5.40),(.97,5.09)):
            beam('Control · gable weather strip',(x,y,4.72),(x,y,height),.084,.086,shell,'timber',bevel=.012)
    for y in (-3.58,1.37):
        beam('Control · roof plate',(-7.00,y,4.77),(-1.36,y,4.77),.21,.23,shell,'timber',bevel=.027)
        for x in (-6.85,-4.91,-3.22,-1.50):
            beam('Control · eaves knee brace',(x,y,4.34),(x,y+(-.31 if y<0 else .31),4.79),
                 .105,.133,shell,'timber',bevel=.018)
    standing_seam('Control roof',-7.10,-1.25,[(-4.02,4.90),(-.87,6.09),(1.75,5.00)],shell)
    for x in (-6.97,-1.37):
        conduit('Control · gutter downpipe',[(x,-3.99,4.83),(x,-3.78,4.61),(x,-3.78,2.52),(x,-3.96,2.39)],
                .081,shell,'copper',True)
    for x in (-5.71,-4.18,-2.75):
        block('Control roof · ventilator curb',(x,-.89,6.08),(.82,.38,.17),shell,'iron',0,.018)
        for y in (-1.07,-.72):
            for h in (6.17,6.22,6.27):
                block('Control roof · angled vent louver',(x,y,h),(.70,.057,.035),shell,'metal',2,.007)
        block('Control roof · low profile vent cap',(x,-.89,6.329),(.88,.49,.093),shell,'roof',2,.018)

    rear = collection('Control · back inspection apron and intake',group)
    paving('Rear inspection apron',(-7.0,1.53,-1.44,2.44),z,rear,'stone',.56)
    for x in (-6.82,-5.42,-3.79,-1.53):
        block('Rear masonry · exposed sill buttress',(x,1.50,2.94),(.16,.23,1.24),rear,'stone',1,.016)
    beam('Rear masonry · weather sill',(-6.93,1.548,3.62),(-1.43,1.548,3.62),.143,.095,rear,'stone')
    block('Rear inspection · weatherproof valve box',(-5.98,1.62,3.01),(1.04,.26,.73),rear,'metal',1,.022)
    for k in range(5):
        h=2.76+k*.108
        beam('Rear inspection · pressed shutter',(-6.44,1.775,h),(-5.52,1.775,h),.040,.041,rear,'iron',bevel=.006)
    for x in (-6.43,-5.59):
        rod('Rear inspection · instrument feed',(x,1.66,2.34),(x,1.66,2.76),.041,rear,'copper',8)
    for x in (-4.70,-2.87):
        beam('Rear inspection · rainwater leader',(x,1.54,3.55),(x,1.54,2.39),.068,.066,rear,'copper')
        beam('Rear inspection · turned drain shoe',(x,1.54,2.39),(x,1.85,2.37),.074,.063,rear,'copper')

    plinth('Records wing',-8.44,-1.36,-6.93,1.79,annex)
    block('Records wing · insulated wall',(-8.38,.25,z+1.065),(.20,3.04,2.13),annex,'limestone',2,.028)
    block('Records wing · rear envelope',(-7.66,1.70,z+1.065),(1.58,.21,2.13),annex,'plaster',2,.028)
    for i in range(3):
        block('Records wing · projecting rear pier',(-8.24+i*.56,1.805,z+1.04),(.12,.14,2.08),annex,'stone',i,.016)
    glazed_bays('Records wing · filing room',(-8.28,-1.30),(-7.01,-1.30),(z+.56,4.36),2,annex)
    block('Records wing · stone window base',(-7.66,-1.31,z+.27),(1.47,.23,.53),annex,'limestone',0)
    for i in range(12):
        block('Records wing · roof platform plank',(-8.47+(i+.5)*.136,.23,4.49),(.127,3.21,.126),annex,'plank',i,.015)
    for y in (-1.405,1.86):
        beam('Records wing · continuous deck beam',(-8.54,y,4.42),(-6.81,y,4.42),.175,.15,annex,'iron')
        railing('Records wing · open deck rail',[(-8.51,y,4.55),(-6.89,y,4.55)],annex,height=.53,key='metal')
    for a,b in ((-1.38,-.22),(.50,1.84)):
        railing('Records wing · maintenance edge',[(-8.51,a,4.55),(-8.51,b,4.55)],annex,height=.53,key='metal')
    for y in (-.23,.45):
        rod('Records wing · roof access ladder',(-8.65,y,z),(-8.65,y,4.99),.038,annex,'iron',8)
        for h in (2.47,3.20,4.01,4.58):
            rod('Records wing · ladder anchor',(-8.39,y,h),(-8.65,y,h),.039,annex,'metal',8)
    for j in range(9):
        h = 2.53+j*.228
        rod('Records wing · ladder rung',(-8.65,-.23,h),(-8.65,.45,h),.028,annex,'iron',8)
    block('Records wing · vent housing',(-7.64,1.16,4.72),(.62,.84,.351),annex,'metal',0,.027)
    for h in (4.62,4.72,4.82):
        block('Records wing · vent slot',(-7.64,.72,h),(.51,.041,.042),annex,'iron',1,.006)
    records(interior)


def workshop(group):
    shell = collection('Workshop · open bay and roof',group)
    equipment = collection('Workshop · service bench and utilities',group)
    link = collection('Passage · covered transfer and ridge utilities',group)
    z = COURT_Z
    plinth('Workshop',-.61,-2.78,2.68,-.085,shell)
    for x in (-.49,2.55):
        for y in (-2.70,-.15):
            height = 4.19 if y<0 else 4.64
            block('Workshop · bearing pad',(x,y,z+.105),(.30,.30,.21),shell,'stone',1,.021)
            beam('Workshop · bolted post',(x,y,z+.17),(x,y,height),.191,.21,shell,'timber',bevel=.026)
    block('Workshop · rear stonework',(1.06,-.18,3.24),(3.02,.22,1.80),shell,'plaster',1,.025)
    glazed_bays('Workshop east', (2.55,-2.51),(2.55,-.28),(3.00,4.11),3,shell)
    block('Workshop · east sill',(2.54,-1.44,2.64),(.25,2.48,.63),shell,'limestone',3,.023)
    block('Workshop · west skirting',(-.49,-2.01,2.69),(.21,1.08,.72),shell,'limestone',1,.024)
    glazed_bays('Workshop west',(-.49,-2.55),(-.49,-1.47),(3.06,4.12),2,shell)
    for y in (-1.46,-.21):
        beam('Workshop · transfer door jamb',(-.49,y,z+.02),(-.49,y,4.14),.095,.102,shell,'timber')
    beam('Workshop · transfer door header',(-.49,-1.46,4.14),(-.49,-.21,4.14),.13,.16,shell,'timber')
    for x0,x1 in ((-.44,.21),(1.95,2.49)):
        block('Workshop · front service pilaster',((x0+x1)/2,-2.71,3.27),(x1-x0,.24,1.86),shell,'stone',1,.023)
    beam('Workshop · wide door header',(-.54,-2.72,4.18),(2.63,-2.72,4.18),.22,.25,shell,'timber')
    standing_seam('Workshop roof',-.77,2.86,[(-3.05,4.28),(-.025,4.74)],shell)
    for x in (-.45,2.55):
        beam('Workshop · front angle brace',(x,-2.69,3.62),(x,-2.34,4.24),.115,.118,shell,'timber')
    table('Service · repair bench',1.52,-.62,1.43,equipment,top=3.12)
    block('Service · bench vise body',(1.98,-.88,3.25),(.22,.24,.27),equipment,'iron',1,.027)
    beam('Service · vise retaining screw',(1.88,-1.03,3.26),(2.105,-1.03,3.26),.049,.053,equipment,'brass')
    for x in (.91,1.12,1.35):
        beam('Service · workbench tool',(x,-.83,3.18),(x+.13,-.60,3.18),.037,.040,equipment,'metal',bevel=.006)
    block('Service · removable drawer unit',(.19,-.69,2.71),(.68,.47,.78),equipment,'iron',1,.021)
    for i in range(4):
        h = 2.45+i*.155
        block('Service · drawer front',(.19,-.935,h),(.62,.06,.139),equipment,'metal',i,.012)
        beam('Service · folded drawer pull',(.06,-.976,h),(.32,-.976,h),.036,.036,equipment,'iron',bevel=.008)
    warm_light('Workshop · low task light',(1.06,-1.16,4.17),(1.06,-.54,2.46),23,1.35,equipment)

    # This short canopy shields the exterior passage between two separate fire-rated buildings.
    plinth('Transfer',-1.44,-1.47,-.61,-.22,link)
    for x in (-1.225,-.81):
        for y in (-1.40,-.29):
            beam('Transfer · steel canopy post',(x,y,z),(x,y,4.10),.091,.096,link,'metal',bevel=.012)
    standing_seam('Transfer · lean-to',-1.42,-.621,[(-1.62,4.11),(-.05,4.28)],link)
    railing('Transfer · rear floor guard',[(-1.39,-.24,z),(-.65,-.24,z)],link,height=.57,key='iron')
    conduit('Services · isolated tower feed',[(.88,-.18,3.20),(1.15,.79,2.65),(1.55,1.12,2.73),
            (1.55,1.08,4.86),(1.95,1.19,5.39),(2.10,2.77,SUMMIT_Z+.31)],.106,link,'copper',True)
    for h in (2.70,3.11,3.68,4.22,4.78):
        beam('Services · wall-mounted saddle',(1.55,1.07,h),(1.55,1.28,h),.146,.071,link,'iron',bevel=.010)
    for x,y in ((-.31,-2.13),(.03,-2.16)):
        block('Service · replacement parts crate',(x,y,z+.185),(.22,.38,.37),equipment,'plank',2,.017)
        block('Service · crate lid',(x,y,z+.375),(.24,.40,.058),equipment,'timber',1,.013)
