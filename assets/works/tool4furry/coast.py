"""Coastal shelves, foundations and circulation for The Makers' Studio."""

import math
import random

from fabric import slab
from geometry import beam, block, collection, faceted_rock, lantern, lathe, railing, rod
from terrain import sample_height, stairs, terraces


LOW, MID, HIGH = 1.18, 2.64, 3.76
STAIRS = (
    ('Landing stair', (-4.30, -9.1, .73), (-4.30, -7.74, LOW + .10), 1.32, 4),
    ('Shore stair', (-4.30, -6.97, LOW + .10), (-4.30, -4.55, MID + .11), 1.52, 9),
    ('Main stair', (.18, -3.97, MID + .11), (.18, -2.12, HIGH + .10), 1.91, 7),
    ('Annex stair', (-5.68, .58, MID + .11), (-4.04, .58, HIGH + .10), 1.34, 7),
)
BASE = [(-12.1, -2.2), (-10.6, -6.3), (-7.5, -8.4), (-5.67, -8.55),
        (-5.30, -8.03), (-3.24, -8.02), (-2.77, -8.97), (1.1, -8.42), (4.7, -8.00),
        (8.7, -6.1), (11.93, -2.98), (12.67, .76), (10.9, 4.13), (7.1, 6.55),
        (2.7, 7.44), (-1.1, 7.09), (-5.4, 6.87), (-9.5, 5.3), (-11.82, 2.07)]
MIDDLE = [(-10.74, -2.25), (-8.85, -4.08), (-6.3, -4.98), (-5.45, -4.80),
          (-3.43, -4.75), (-.1, -4.85), (2.73, -4.8), (6.23, -4.02), (9.97, -2.02),
          (11.08, 1.12), (9.6, 4.05), (5.57, 5.97), (1.56, 6.40),
          (-2.94, 6.17), (-6.65, 5.41), (-9.73, 3.64), (-10.75, .41)]
UPPER = [(-4.40, -2.14), (-2.4, -2.59), (-.85, -1.99), (1.27, -1.99),
         (3.85, -2.82), (6.39, -2.65), (8.09, -1.81), (9.69, -.44), (9.80, 2.47),
         (7.1, 4.65), (5.38, 5.85), (2.13, 6.07), (-1.54, 5.84), (-4.57, 4.86),
         (-4.76, 2.18), (-3.94, 1.32), (-3.94, -.31), (-4.53, -.88)]


def geology(group):
    coast = terraces('Coastal bedrock · folded western cove', BASE,
                     [(.20, -2.02, .26, 'shale'), (.075, -1.28, .35, 'shale'),
                      (0, -.46, .27, 'cliff'), (.035, .05, .24, 'talus'),
                      (.07, .24, .14, 'cliff'), (.106, .70, .15, 'cliff'),
                      (.071, LOW, 0, 'grass')], group, 288)
    middle = terraces('Work yard · battered rock bench', MIDDLE,
                      [(-.075, 1.03, .09, 'cliff'), (-.04, 1.40, .15, 'talus'),
                       (.018, 1.88, .15, 'shale'), (.056, 2.31, .12, 'cliff'),
                       (.035, MID, 0, 'grass')], group, 129, (-1.0, 1.1))
    summit = terraces('Studio shelf · upper mica seam', UPPER,
                      [(-.011, 2.46, .075, 'cliff'), (.012, 2.87, .11, 'cliff'),
                       (.036, 3.09, .09, 'shale'), (.034, 3.34, .07, 'cliff'),
                       (.035, HIGH, 0, 'grass')], group, 672, (2.41, 2.1))
    outcrops = collection('Sea stacks and exposed split faces', group)
    for i, (x, y, z, a, b, c) in enumerate((
        (-11.12, -5.47, -.11, 1.16, .53, .63), (-8.09, -7.36, .19, .89, .72, .37),
        (-6.28, -8.08, .05, .78, .48, .53), (-2.56, -8.06, -.21, .50, .41, .54),
        (.42, -8.37, -.55, 1.11, .53, .40), (4.06, -7.82, -.60, 1.04, .76, .43),
        (6.75, -6.63, .12, 1.24, .52, .60), (10.50, -4.33, -.16, .88, .63, .62),
        (11.25, -2.72, -.48, 1.13, .69, .43), (12.08, .39, -.56, .82, .57, .81),
        (10.68, 3.77, .14, 1.05, .87, .58), (7.36, 6.38, -.27, 1.05, .73, .62),
        (3.62, 7.11, -.30, .79, .55, .49), (-2.54, 6.99, -.38, .96, .69, .51),
        (-8.13, 5.90, -.34, 1.22, .69, .55), (-11.24, 3.32, -.42, .88, .75, .61),
        (-12.60, .53, -.63, 1.02, .68, .72), (-6.72, -4.85, 1.50, .79, .42, .62),
        (-1.97, -4.96, 1.45, .74, .49, .39), (6.21, -4.50, 1.25, .80, .66, .59),
        (-3.04, -2.48, 2.84, .46, .49, .24), (3.78, -2.67, 3.16, .89, .40, .49),
        (8.21, -2.25, 3.00, .68, .38, .57), (9.08, 3.06, 2.98, .82, .47, .43),
        (8.75,-4.57,1.27,.88,.44,.51),(7.99,-4.81,1.20,.69,.51,.44),
        (3.67,-6.02,1.17,.83,.59,.53),(4.04,-6.27,1.13,.68,.48,.31),
    )):
        faceted_rock('Split coastal stratum', (x, y, z), (a, b, c), outcrops, 'cliff', 410+i)
    for i, (x, y) in enumerate(((-12.85, -3.93), (-9.3, -8.35), (-1.95, -9.35),
                                (7.88, -7.44), (13.1, -.56), (9.26, 6.15))):
        faceted_rock('Detached skerry', (x, y, -.71), (.62, .45, .48), outcrops, 'shale', 466+i)
    return coast, middle, summit


def paving(name, x0, y0, x1, y1, z, group, pitch=.51):
    nx, ny = max(1, round((x1-x0)/pitch)), max(1, round((y1-y0)/pitch))
    w, d = (x1-x0)/nx, (y1-y0)/ny
    for j in range(ny):
        for i in range(nx):
            block(name, (x0+w*(i+.5), y0+d*(j+.5), z-.056),
                  (w-.023, d-.022, .112), group, 'stone', i+2*j, .014)


def founded_post(name, x, y, top, lands, group, width, timber=True):
    ground = min(top-.18, sample_height(lands, x, y, top-.06)-.16)
    z = (top+ground)/2
    block(name, (x,y,z), (width,width,top-ground), group, 'timber' if timber else 'stone', 0, .024)
    if timber and ground>-.65:
        block(name+' · stone shoe', (x,y,ground+.21), (width+.13,width+.13,.43), group, 'stone', 1, .038)


def terrace_base(name, outline, top, lands, group):
    ground=min(sample_height(lands,x,y,top-.03) for x,y in outline)
    bottom=min(top-.13,ground-.14)
    courses=max(1,math.ceil((top-bottom)/.29))
    rise=(top-bottom)/courses
    for i in range(courses):
        z=bottom+i*rise
        slab(name+' · stone course',outline,z,z+rise-.008,group,'stone',i,.016)


def deck(name, x0, y0, x1, y1, top, lands, group, pitching=.26):
    count = max(1, round((y1-y0)/pitching))
    pitch = (y1-y0)/count
    for i in range(count):
        block(name+' · larch boards', ((x0+x1)/2,y0+(i+.5)*pitch,top-.062),
              (x1-x0,pitch-.018,.124), group, 'plank', i, .011)
    for frac in (.12,.50,.88):
        x = x0+(x1-x0)*frac
        beam(name+' · deck joist', (x,y0,top-.22), (x,y1,top-.22), .21,.23,group,'timber',1)
        for y in (y0+.19,y1-.19):
            founded_post(name+' · pier',x,y,top-.31,lands,group,.21)


def routes(lands, group):
    quay = collection('Landing · timber platform and stone approach', group)
    yard = collection('Work yard · paved circulation and terraces', group)
    deck('Landing',-6.04,-11.18,-2.56,-9.1,.73,lands,quay)
    for side in (-1,1):
        x = -4.30+side*1.60
        railing('Landing edge',[(x,-10.94,.73),(x,-9.33,.73)],quay,spacing=.59,height=.53,key='iron')
        for y in (-10.95,-9.34):
            block('Landing · square mooring post',(x,y,.91),(.19,.19,.58),quay,'timber',1,.026)
    for x in (-5.27,-3.34):
        block('Landing · cast cleat',(x,-10.86,.789),(.265,.057,.118),quay,'iron',1,.016)
        for dx in (-.072,.072):
            block('Landing · cleat foot',(x+dx,-10.86,.759),(.054,.105,.052),quay,'iron',0,.009)
    for i in range(2):
        block('Landing · slatted sample crate',(-5.45,-9.53,.89+i*.291),(.55,.45,.31),
              quay,'timber',1+i,.019)
        for side in (-1,1):
            block('Landing · case skid',(-5.45+side*.203,-9.53,.766+i*.291),(.074,.49,.09),quay,'plank',i)
            block('Landing · crate strap',(-5.45+side*.204,-9.769,.89+i*.291),(.050,.042,.312),quay,'iron',1,.006)
    lathe('Landing · coiled mooring line',(-3.15,-9.63,.74),
          [(.089,0),(.156,0),(.167,.047),(.153,.079),(.11,.085),(.080,.040)],
          quay,'timber',14,closed=True)
    for name, a, b, width, count in STAIRS:
        stairs(name, a, b, width, count, quay if name=='Landing stair' else yard)
    paving('Cove landing stones',-5.12,-7.74,-3.48,-6.97,LOW+.10,quay)
    paving('Lower yard landing',-5.14,-4.55,-3.48,-3.24,MID+.11,yard)
    paving('Workshop crosswalk',-9.50,-3.99,-5.14,-3.24,MID+.11,yard)
    paving('Studio approach flags',-3.48,-4.71,-.78,-3.24,MID+.11,yard)
    paving('Main stair landing',-.78,-4.71,1.14,-3.97,MID+.11,yard)
    paving('East slope walk',1.14,-4.43,4.74,-3.66,MID+.11,yard)
    a,b=(4.74,-4.045),(6.69,-2.962)
    for j in range(5):
        u,v=j/5,(j+1)/5
        x0,x1=a[0]+(b[0]-a[0])*u+.010,a[0]+(b[0]-a[0])*v-.010
        y0,y1=a[1]+(b[1]-a[1])*u,a[1]+(b[1]-a[1])*v
        terrace_base('East · bedded flag foundations',
                     [(x0,y0-.327),(x1,y1-.327),(x1,y1+.30),(x0,y0+.30)],MID+.018,lands,yard)
        slab('East · skewed turning flags',[(x0,y0-.37),(x1,y1-.37),(x1,y1+.37),(x0,y0+.37)],
             MID+.005,MID+.11,yard,'stone',j,.014)
    for x in (6.71,7.12,7.53):
        terrace_base('East · founded lay-by plinth',[(x,-3.365),(x+.40,-3.365),
                     (x+.40,-2.57),(x,-2.57)],MID+.015,lands,yard)
    paving('East · quiet lay-by',6.69,-3.39,7.97,-2.54,MID+.11,yard,.45)
    beam('Lay-by · stone bench seat',(7.75,-3.28,MID+.45),(7.75,-2.65,MID+.45),.312,.145,yard,'stone')
    for y in (-3.22,-2.71):
        block('Lay-by · stone bench foot',(7.75,y,MID+.242),(.21,.18,.28),yard,'mortar',1,.014)
    paving('Finishing room threshold',-8.84,-3.24,-6.87,-2.42,MID+.11,yard)
    for x,y,z in ((-5.34,-7.53,LOW+.10),(-5.24,-4.20,MID+.11),(-.99,-4.24,MID+.11),
                  (1.53,-4.17,MID+.11),(-8.97,-3.14,MID+.11)):
        lantern('Route · hooded amber lamp',(x,y,z),yard)


def planting(lands, group):
    forest = collection('Wind-shaped pines and sheltered copses', group)
    ground = collection('Grass tussocks and moss at rock junctions', group)
    for i, (x,y,h) in enumerate(((-10.62,-1.33,1.89),(-10.98,1.59,2.22),(-8.48,2.72,2.05),
                                  (-6.90,4.12,1.87),(-4.92,5.50,2.04),(-1.12,6.17,1.79),
                                  (4.93,6.48,1.63),(6.75,4.87,2.02),(9.91,3.18,1.85),
                                  (10.44,-.91,2.18),(9.04,-3.88,2.12),(6.34,-4.58,1.62),
                                  (2.84,-6.47,1.74),(-7.64,-5.58,1.8),(-9.05,-4.79,1.7))):
        z = sample_height(lands,x,y)
        root = (x,y,z-.16)
        leader = (x+.15*h, y+.08*h,z+.83*h)
        rod('Pine · leaning trunk',root,leader,h*.065,forest,'timber',7)
        for j,(dx,dy,dz,s) in enumerate(((-.27,-.06,.59,.48),(.29,.06,.75,.41),
                                         (-.10,.17,.91,.37),(.10,-.11,1.07,.32))):
            tip=(x+dx*h,y+dy*h,z+dz*h)
            rod('Pine · branch joint',(x+.04,y,z+.48*h),tip,h*.022,forest,'timber',6)
            f=h*s
            faceted_rock('Pine · hand-shaped crown',tip,(f,f*.80,f*.63),forest,'pine',543+9*i+j)
    rng=random.Random(516)
    for i,(x,y,span) in enumerate(((-10.78,-3.58,.71),(-9.24,4.42,.82),(-5.32,4.49,.66),
                                    (-.42,6.27,.65),(6.33,5.56,.63),(10.87,1.44,.66),
                                    (8.9,-5.32,.65),(4.36,-6.48,.62),(-1.66,-7.42,.61),
                                    (-5.83,-6.91,.50),(-7.65,-6.89,.72),(-3.42,-2.86,.46),
                                    (3.31,-3.27,.57),(8.38,-2.52,.33),(10.15,2.42,.28),
                                    (4.22,-5.88,.68),(2.33,-5.66,.57))):
        for j in range(8):
            r=rng.uniform(.22,span)
            xx,yy=x+math.cos(j*2.4)*r,y+math.sin(j*2.4)*r
            size=rng.uniform(.12,.26)
            faceted_rock('Low coastal foliage',(xx,yy,sample_height(lands,xx,yy)-.03),
                         (size,size*.76,size*.72),ground,'leaves',551+i*9+j)
