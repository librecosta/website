"""Image registration, colour proofing and material handling fixtures."""

from architecture import ANNEX, STUDIO
from fabric import slab, rectangle
from geometry import beam, block, lathe, mesh, material, rod


def board(name, x, y, z, w, h, group, variant=0):
    """Physical sample prints on shallow panels, viewed from the south."""
    block(name+' · closed backing',(x,y+.028,z+h/2),(w,.10,h),group,'timber',0,.017)
    block(name+' · warm mounting paper',(x,y-.030,z+h/2),(w-.084,.025,h-.085),group,'paper',0,.009)
    span=w-.25
    base=z+.13
    low=-span/2
    rect=[(-.5,0),(.5,0),(.5,1),(-.5,1)]
    motifs = (
        ('printblue',rect,0),
        ('printlilac',[(-.50,0),(.50,0),(.50,.61),(.29,.74),(-.17,.40),(-.50,.68)],1),
        ('printbrown',[(-.50,0),(.50,0),(.50,.29),(.19,.17),(-.16,.45),(-.50,.19)],2),
        ('ivory',[(-.19,.76),(-.15,.83),(-.056,.87),(.004,.80),(-.035,.73),(-.14,.70)],3),
    ) if variant == 0 else (
        ('lavender',rect,0),
        ('graphite',[(-.50,0),(.07,0),(.33,.27),(.13,.69),(-.17,.83),(-.50,.66)],1),
        ('paper',[(-.10,.14),(.50,.14),(.50,.53),(.32,.72),(.13,.52)],2),
        ('printbrown',[(-.40,.76),(-.31,.93),(-.23,.92),(-.13,.76),(-.27,.68)],3),
    )
    for key,outline,layer in motifs:
        points=[(x+u*span,y-.046-layer*.002,base+v*(h-.25)) for u,v in outline]
        mesh(name+' · layered proof ink',points,[tuple(range(len(points)))],group,[material(key,variant)])
    for side in (-1,1):
        xx=x+side*(w/2-.076)
        block(name+' · small pin',(xx,y-.056,z+h-.076),(.06,.034,.06),group,'brass',0,.009)


def bench(name,x,y,z,w,d,group,drawers=False):
    for direction in (-1,1):
        xx=x+direction*(w/2-.12)
        for s in (-1,1):
            yy=y+s*(d/2-.105)
            block(name+' · rubber foot',(xx,yy,z+.037),(.14,.14,.073),group,'iron',2,.014)
            block(name+' · square leg',(xx,yy,z+.47),(.107,.108,.835),group,'iron',1,.013)
        beam(name+' · lower stretcher',(xx,y-d/2+.08,z+.30),(xx,y+d/2-.08,z+.30),.09,.094,group,'iron')
    beam(name+' · longitudinal stringer',(x-w/2+.10,y+d*.31,z+.38),
         (x+w/2-.10,y+d*.31,z+.38),.079,.085,group,'iron')
    slab(name+' · rounded worktop',rectangle(x,y,w,d,.106),z+.862,z+1.017,group,'plank',1,.021)
    if drawers:
        block(name+' · under-bench cabinet',(x+w*.20,y+.03,z+.61),(w*.37,d*.82,.537),group,'graphite',1,.031)
        for row in range(3):
            zz=z+.44+row*.154
            block(name+' · full-extension drawer',(x+w*.20,y-d*.396,zz),(w*.36,.057,.134),group,'graphite',row,.011)
            block(name+' · recessed lavender pull',(x+w*.20,y-d*.44,zz+.014),(.215,.048,.03),group,'lavender',0,.009)


def stool(x,y,z,group):
    lathe('Stool · round seat',(x,y,z+.69),[(.24,0),(.265,.035),(.24,.081)],group,'plank',12)
    for dx,dy in ((-.20,-.14),(.20,-.14),(0,.22)):
        beam('Stool · splayed support',(x+dx,y+dy,z),(x+dx*.62,y+dy*.62,z+.707),.061,.064,group,'iron')
    lathe('Stool · foot hoop',(x,y,z+.24),[(.197,0),(.217,0),(.217,.037),(.197,.037)],
          group,'iron',12,closed=True)


def cabinets(name,x,y,z,width,height,group,bays=3):
    for side in (-1,1):
        block(name+' · end gable',(x+side*width/2,y,z+height/2),(.072,.52,height),group,'timber',0,.012)
    block(name+' · narrow back',(x,y+.249,z+height/2),(width,.061,height),group,'timber',1,.012)
    for tier in range(5):
        zz=z+.15+tier*(height-.15)/4
        block(name+' · solid partition',(x,y,zz),(width,.51,.056),group,'plank',tier,.01)
        if tier==4:
            continue
        for i in range(bays):
            dx=(i+.5)*width/bays-width/2
            if (tier+i)%3==0:
                block(name+' · archived material tray',(x+dx,y-.03,zz+.126),
                      (width/bays-.053,.38,.197),group,'graphite',i,.015)
                block(name+' · tray handle',(x+dx,y-.242,zz+.136),(.142,.040,.040),group,'zinc',i,.007)
            else:
                for card in range(4):
                    a=card*(width/bays-.12)/4
                    block(name+' · indexed sample folio',(x+dx-width/(2*bays)+.095+a,y+.055,zz+.165),
                          (.071,.34,.272+(card%3)*.038),group,('paper','lavender','printblue','paper')[card],
                          i+card,.007)


def crop_station(group):
    x,y,z=-.98,.58,STUDIO
    bench('Registration table',x,y,z,2.69,1.27,group,True)
    top=z+1.017
    block('Registration · neutral cutting bed',(x-.11,y,top+.014),(2.23,1.08,.028),group,'graphite',0,.012)
    for i in range(17):
        xx=x-1.12+i*.126
        length=.079 if i%4==0 else .047
        block('Registration · ruler tick',(xx,y-.46,top+.033),(.009,length,.006),group,'paper',i,.001)
    for i in range(8):
        yy=y-.35+i*.100
        block('Registration · edge scale',(x-1.16,yy,top+.034),(.054,.009,.006),group,'paper',i,.001)
    for ox,oy,sx,sy in ((.05,-.035,1.10,.67),(.24,-.005,.65,.43)):
        for side in (-1,1):
            block('Registration · adjustable sizing strip',(x+ox,y+oy+side*sy/2,top+.061),
                  (sx+.032,.035,.031),group,'lavender',0,.006)
            block('Registration · adjustable sizing strip',(x+ox+side*sx/2,y+oy,top+.061),
                  (.035,sy,.031),group,'zinc',1,.006)
    for x0 in (x-.90,x+.79):
        beam('Registration · sliding bridge guide',(x0,y-.46,top+.073),(x0,y+.44,top+.073),
             .064,.070,group,'iron',1,.010)
    beam('Registration · clamped transverse bar',(x-.96,y+.22,top+.12),
         (x+.85,y+.22,top+.12),.073,.086,group,'zinc',1,.014)
    block('Registration · rider',(x+.60,y+.22,top+.174),(.19,.18,.117),group,'iron',1,.018)
    lathe('Registration · locking knob',(x+.60,y+.22,top+.23),[(.051,0),(.060,.032),(.046,.057)],
          group,'brass',10)
    stool(x-.33,y+.98,z,group)


def studio_furniture(group):
    crop_station(group)
    z=STUDIO
    cabinets('Studio · material library',-2.53,4.45,z,2.29,1.85,group,4)
    bench('Studio · digital proofing bench',1.86,3.66,z,2.64,.92,group,True)
    for x,kind in ((1.23,0),(2.53,1)):
        block('Desktop proof · cast pedestal',(x,3.80,z+1.058),(.37,.29,.082),group,'zinc',0,.017)
        rod('Desktop proof · pivot arm',(x,3.84,z+1.077),(x,3.95,z+1.58),.044,group,'iron')
        board('Desktop proof',x,3.80,z+1.32,.99,.66,group,kind)
        block('Desktop proof · control tray',(x,3.45,z+1.043),(.61,.29,.051),group,'graphite',1,.007)
        for row in range(3):
            for i in range(10):
                block('Desktop proof · small controls',(x-.252+i*.056,3.37+row*.058,z+1.073),
                      (.045,.042,.014),group,'iron',row,.002)
    stool(1.38,2.87,z,group)
    stool(2.47,2.85,z,group)
    bench('Studio · shared colour table',3.5,-.31,z,1.51,.84,group)
    for i,key in enumerate(('printblue','printlilac','lavender','printbrown','grass','paper')):
        x=2.98+(i%3)*.32
        y=-.46+(i//3)*.27
        block('Colour table · hand sample',(x,y,z+1.032),(.23,.195,.03),group,key,i,.008)
    for i in range(3):
        block('Colour table · stacked mount board',(3.99,-.06,z+1.026+i*.035),
              (.51,.31,.031),group,'paper',i,.006)


def finishing_furniture(group):
    x,y,z=-7.70,.37,ANNEX
    bench('Finishing · paper preparation bench',x,y,z,2.14,1.14,group,True)
    base=z+1.02
    for s in (-1,1):
        block('Finishing · cradle bearing',(x+s*.74,y+.21,base+.20),(.215,.40,.40),group,'graphite',s,.026)
        for yy in (y+.061,y+.365):
            lathe('Finishing · exposed bearing cap',(x+s*.86,yy,base+.25),
                  [(.062,0),(.065,.025),(.051,.051)],group,'zinc',12,(s,0,0))
    for yy,zz in [(y+.093,base+.18),(y+.344,base+.27)]:
        rod('Finishing · covered pressure roller',(x-.77,yy,zz),(x+.77,yy,zz),.089,group,'iron',16)
    rod('Finishing · offset guide shaft',(x-.80,y-.07,base+.14),(x+.80,y-.07,base+.14),.031,group,'zinc',10)
    block('Finishing · staged paper stock',(x,y-.27,base+.016),(1.05,.37,.03),group,'paper')
    for i in range(3):
        block('Finishing · graphite delivery case',(x+.88+i*.028,-1.69,z+.13+i*.224),
              (.82,.49,.226),group,'graphite',i,.030)
        block('Finishing · case latch',(x+.88+i*.028,-1.954,z+.15+i*.224),(.15,.048,.061),group,'brass',1,.007)
    cabinets('Finishing · stock bins',-7.88,1.03,z,2.25,1.52,group)


def outdoor_proofs(group):
    z=STUDIO
    for x,kind in ((6.37,0),(8.27,1)):
        for s in (-1,1):
            xx=x+s*.59
            beam('Proof stand · folded ladder rail',(xx,1.41,z),(xx,1.78,z+1.97),
                 .078,.082,group,'iron')
            beam('Proof stand · rear kick brace',(xx,2.28,z),(xx,1.80,z+1.61),
                 .065,.071,group,'iron')
            rod('Proof stand · pivot pin',(xx-.062,1.799,z+1.62),(xx+.062,1.799,z+1.62),
                .041,group,'brass')
        beam('Proof stand · mount ledger',(x-.65,1.57,z+.95),(x+.65,1.57,z+.95),.071,.10,group,'timber')
        board('Proof stand · removable sample',x,1.58,z+.98,1.19,.89,group,kind)
    bench('Outdoor · swatch worktop',7.57,-.27,z,2.43,.80,group,True)
    for i,key in enumerate(('graphite','printblue','printlilac','lavender','printbrown','paper')):
        x=6.65+i*.31
        block('Outdoor · swatch tile',(x,-.33,z+1.039),(.23,.31,.044),group,key,i,.010)
    stool(8.14,.51,z,group)
