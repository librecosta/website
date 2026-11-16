"""Build the Harvest art source in a fresh Blender session."""

import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))

from geometry import (beam, block, collection, conduit, faceted_rock, lantern, lathe,
                      material, object_in, rod)
from architecture import collector_tower, instruments, sorting_house, press_workshop, calibration_shed
from terrain import connections, geology, plantings, sample_height


VIEWS = {
    'front': ((4,-4,2.4),None,None),
    'rear': ((-4,5,2.9),None,None),
    'top': ((0,-.25,8),None,None),
    'collector': ((5,-3.55,2.7),(1.72,3.05,8.37),10.7),
    'workshop': ((3.7,-5,2.38),(-.31,-2.53,4.40),16.2),
}


def crate(name, x, y, z, size, group, rotation=0):
    w, d, h = size
    def b(label, offset, dim, key, tone=0):
        dx,dy,dz=offset
        p=(x+math.cos(rotation)*dx-math.sin(rotation)*dy,
           y+math.sin(rotation)*dx+math.cos(rotation)*dy,z+dz)
        o=block(name+' · '+label,p,dim,group,key,tone,bevel=.012)
        o.rotation_euler.z=rotation
    b('board core',(0,0,h/2),(w-.055,d-.054,h-.065),'timber')
    for j in range(4):
        for dy in (-d/2,d/2):
            b('wall slat',((j-1.5)*w/4,dy,h/2),(w/4-.012,.05,h-.04),'plank',j)
        b('lid plank',((j-1.5)*w/4,0,h),(w/4-.013,d+.027,.054),'plank',j+1)
    for dx in (-w*.40,w*.40):
        for dy in (-d*.48,d*.48):
            b('iron strap',(dx,dy,h/2),(.067,.070,h+.042),'iron')
        b('lid clasp',(dx,0,h+.046),(.062,d+.037,.041),'iron')


def barrel(x,y,z,group,s=1):
    rings=[(.23,0),(.27,.078),(.302,.26),(.297,.48),(.242,.63)]
    lathe('Freight · oak stave cask',(x,y,z),[(r*s,h*s) for r,h in rings],group,'plank',12,vary=True)
    for h,r in ((.066,.264),(.24,.307),(.49,.294),(.58,.265)):
        lathe('Freight · cask hoop',(x,y,z+s*h),[(s*r,0),(s*r,.048*s)],group,'iron',12)
    lathe('Freight · endgrain bung',(x,y,z+.629*s),[(.046*s,0),(.046*s,.046*s)],group,'endgrain',8)


def freight(lands, pier, group):
    x,y,z=3.65,-9.67,1.06
    block('Dock crane · bolted sole',(x,y,z+.13),(.66,.64,.25),pier,'iron')
    beam('Dock crane · oak kingpost',(x,y,z+.21),(x,y,z+2.43),.27,.27,pier,'timber')
    tip=(1.50,-10.27,z+2.19)
    beam('Dock crane · lifting jib',(x+.22,y+.06,z+2.25),tip,.208,.29,pier,'plank')
    beam('Dock crane · diagonal compression brace',(x,y,z+1.00),(x-1.34,y-.42,z+2.23),.13,.14,pier,'timber')
    for h in (1.29,2.22):
        block('Dock crane · bolted iron collar',(x,y,z+h),(.32,.34,.16),pier,'iron')
    rod('Dock crane · winding axle',(x-.25,y,z+1.29),(x+.34,y,z+1.29),.151,pier,'copper',12)
    for q in (x-.22,x+.31):
        rod('Dock crane · drum flange',(q-.05,y,z+1.29),(q+.05,y,z+1.29),.259,pier,'iron',12)
    conduit('Dock crane · hoist line',[(x-.11,y-.04,z+1.46),(x-.11,y-.04,z+2.37),tip,(tip[0],tip[1],z+.59)],
            .032,pier,'iron')
    lathe('Dock crane · hook block',(tip[0],tip[1],z+.59),[(.081,0),(.108,.081),(.081,.22)],pier,'brass',8)
    conduit('Dock crane · lifting hook',[(tip[0],tip[1],z+.62),(tip[0],tip[1],z+.46),
            (tip[0]-.07,tip[1],z+.395),(tip[0]-.17,tip[1],z+.45)],.06,pier,'iron')
    for xx,yy,h in ((1.50,-11.08,.52),(2.14,-11.17,.42),(3.29,-9.07,.47)):
        crate('Dock freight',xx,yy,1.06,(.56,.57,h),pier,rotation=.12)
    barrel(3.54,-10.78,1.06,pier,.81)
    barrel(3.13,-10.85,1.06,pier,.61)
    for i,(xx,yy) in enumerate(((-5.82,-4.24),(-5.95,-3.70),(-2.12,-3.71),(3.55,-3.90),(5.31,-3.71))):
        zz=sample_height(lands,xx,yy)
        crate('Courtyard freight',xx,yy,zz,(.58,.55,.48),group,rotation=.21*(i-2))
    barrel(-2.15,-3.01,2.80,group)
    barrel(-1.96,-2.51,2.8,group,.74)
    # Low pressure main leaves the ridge on retaining brackets and crosses a service yard.
    conduit('Service line · collector return',[(.62,2.44,6.42),(.24,1.92,5.53),(-.02,.98,4.81),
             (-.31,.01,3.82),(-.57,-.80,3.31),(-1.46,-.82,3.94)],.174,group,'copper',True)
    for x,y,z in ((.24,1.92,5.53),(-.02,.98,4.81),(-.31,.01,3.82),(-.57,-.80,3.31)):
        zz=min(z-.16,sample_height(lands,x,y,ceiling=z)-.07)
        beam('Collector return · cleat',(x,y,zz),(x,y,z),.115,.138,group,'iron')
    for y in (-2.12,-1.88):
        conduit('Service line · buried transfer',[
            (-1.48,y,4.11),(-1.21,y,3.17),(-.89,y,2.99),(1.85,y,2.99),
            (2.29,y,3.15),(2.52,y,3.99)],.122,group,'copper',True)
    for i in range(9):
        x=-.79+i*.295
        block('Service trench · removable oak cover',(x,-2.0,3.10),(.282,.57,.095),group,'plank',i)
    for x in (-.25,1.21):
        block('Service trench · worked stone edge',(x,-1.66,2.84),(1.43,.10,.13),group,'stone')
    # Isolated cliff boulders at only two points, clear of the shipping route.
    for i,(x,y,s) in enumerate([(-10.74,-5.53,.48),(8.01,-7.41,.41),(8.41,-7.13,.30)]):
        faceted_rock('Shoal · detached stone',(x,y,-.16),(s*1.33,s*.89,s*.9),group,'cliff',27+i)


def studio(scene, model_points, group):
    # WORKS uses a 23-degree orthographic eye. Scale the fit from projected bounds.
    for name,(look,target,scale) in VIEWS.items():
        camera=object_in('Camera · '+name,bpy.data.cameras.new('Camera · '+name),group)
        look=Vector(look).normalized()
        camera.data.type='ORTHO'
        camera.data.lens=45
        camera.data.clip_end=200
        rotation=(-look).to_track_quat('-Z','Y')
        if target is None:
            points=[rotation.inverted()@p for p in model_points]
            lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
            hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
            center=(lo+hi)/2
            target=rotation@center
            span=hi-lo
            scale=max(span.x,span.y*1.25) * (1.21 if name=='top' else 1.18)
        camera.data.ortho_scale=scale
        camera.location=Vector(target)+look*55
        camera.rotation_euler=rotation.to_euler()
        if name=='front':
            scene.camera=camera
    for name,pos,power,color,size in [
        ('Warm key',(-9,-12,19),3400,(1,.86,.69),11),
        ('Cool fill',(12,-7,12),1630,(.68,.82,1),12),
        ('Ridge rim',(2,11,17),2600,(1,.92,.77),9),
    ]:
        light=bpy.data.lights.new(name,'AREA')
        light.energy=power
        light.color=color
        light.shape='DISK'
        light.size=size
        obj=object_in(name,light,group)
        obj.location=pos
        obj.rotation_euler=(Vector((0,0,3))-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.world=bpy.data.worlds.new('Soft daylight')
    scene.world.use_nodes=True
    background=next(node for node in scene.world.node_tree.nodes if node.type=='BACKGROUND')
    background.inputs['Color'].default_value=(.64,.69,.77,1)
    background.inputs['Strength'].default_value=.68
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.26
    scene.render.engine='CYCLES'
    scene.cycles.use_denoising=True
    scene.cycles.samples=32
    scene.render.resolution_x=1250
    scene.render.resolution_y=1000
    scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'


def build():
    scene=bpy.context.scene
    scene.name='Harvest — The Collector’s Workshop'
    asset=collection('HARVEST • Island asset')
    land_group=collection('01 · Island geology',asset)
    outcrops=collection('Talus and fractured shore',land_group)
    buildings=collection('02 · Buildings',asset)
    machinery=collection('03 · Collection and processing',asset)
    shipping=collection('04 · Paths and transport',asset)
    plants=collection('05 · Vegetation',asset)
    props=collection('06 · Workshop and freight props',asset)
    review=collection('07 · Orthographic cameras and studio lights')
    lands=geology(land_group)
    bpy.context.view_layer.update()
    pier=connections(lands,shipping)
    sorting_house(collection('Sorting house · timber frame and cargo bay',buildings))
    press_workshop(collection('Press workshop · split roof and pressure vessel',buildings))
    calibration_shed(lands,collection('Calibration shed · open tool bay',buildings))
    collector_tower(collection('Collector keep · masonry and timber',buildings),
                    collection('Collector receiver · bowl, yoke and drive',machinery))
    instruments(lands,collection('Remote samplers and wind mast',machinery))
    freight(lands,pier,props)
    plantings(lands,plants,outcrops)
    bpy.context.view_layer.update()
    points=[]
    for obj in asset.all_objects:
        vertices=(v.co for v in obj.data.vertices) if obj.type=='MESH' else (Vector(v) for v in obj.bound_box)
        points.extend(obj.matrix_world@v for v in vertices)
    studio(scene,points,review)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                space=area.spaces.active
                space.region_3d.view_perspective='CAMERA'
                space.shading.color_type='MATERIAL'
                space.overlay.show_overlays=False
    scene['Art stage']='WEB-V0.1-W3-H1'
    scene['Source']='Original editable LibreCosta geometry. Review cameras and lights are separate from the island.'
    return scene


def main():
    args=argparse.ArgumentParser()
    args.add_argument('--output',type=Path,default=HERE)
    args.add_argument('--renders',nargs='*',choices=VIEWS,default=[])
    args.add_argument('--draft',action='store_true')
    options=args.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    options.output.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    scene=build()
    bpy.ops.wm.save_as_mainfile(filepath=str((options.output/'harvest.blend').resolve()),compress=True)
    if not options.renders:
        return
    images=options.output/'renders'
    images.mkdir(exist_ok=True)
    if options.draft:
        scene.cycles.samples=10
        scene.render.resolution_percentage=65
    for name in options.renders:
        scene.camera=bpy.data.objects['Camera · '+name]
        scene.render.filepath=str((images/f'{name}.png').resolve())
        bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    main()
