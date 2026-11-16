"""Build and render the original Refraction Atelier Blender source."""

import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from atelier import court, workshop
from fabric import block, collection, faceted_rock, lathe, object_in, palette
from receiver import optics
from terrain import landing, landscape, pavers, vegetation


FRONT=(4,-4,2.4)
VIEWS={
    'front': (FRONT,None,None),
    'rear': ((-4,5,2.9),None,None),
    'top': ((0,-.37,8),None,None),
    'objective': ((7.8,-3.8,3.02),(3.47,2.4,6.82),9.78),
    'workshop': ((3.8,-6.9,1.54),(-3.81,-.53,4.66),10.8),
}


def orthographic(name, look, target, scale, points, group):
    camera=object_in('Camera · '+name,bpy.data.cameras.new('Camera · '+name),group)
    look=Vector(look).normalized()
    rotation=(-look).to_track_quat('-Z','Y')
    if target is None:
        axis=rotation.inverted()
        projected=[axis@point for point in points]
        lower=Vector(tuple(min(p[i] for p in projected) for i in range(3)))
        upper=Vector(tuple(max(p[i] for p in projected) for i in range(3)))
        target=rotation@((lower+upper)/2)
        span=upper-lower
        if scale is None:
            scale=max(span.x,span.y*1.25)*1.17
    camera.data.type='ORTHO'
    camera.data.ortho_scale=scale
    camera.data.clip_end=200
    camera.location=Vector(target)+look*54
    camera.rotation_euler=rotation.to_euler()
    return camera


def lighting(scene, group):
    for name, pos, target, energy, color, size, length in (
        ('Warm large window',(-9,-12,19),(0,0,3),3600,(1,.91,.79),11,8),
        ('Cool sky return',(12,-5,13),(1,0,4),1980,(.75,.89,1),10,12),
        ('Roof and facet rim',(2,11,17),(0,2,5),2650,(.95,.98,1),9,6),
        ('Tall reflection softbox',(-1,-9,10),(3.6,2.4,7.48),340,(.92,.98,1),1.8,7),
    ):
        light=bpy.data.lights.new(name,'AREA')
        light.energy=energy
        light.color=color
        light.shape='RECTANGLE'
        light.size=size
        light.size_y=length
        obj=object_in(name,light,group)
        obj.location=pos
        obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.world=bpy.data.worlds.new('Temperate sky')
    scene.world.use_nodes=True
    background=next(node for node in scene.world.node_tree.nodes if node.type=='BACKGROUND')
    background.inputs['Color'].default_value=(.62,.69,.76,1)
    background.inputs['Strength'].default_value=.68
    scene.render.engine='CYCLES'
    scene.cycles.use_denoising=True
    scene.cycles.samples=56
    scene.cycles.max_bounces=11
    scene.cycles.transmission_bounces=8
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.19
    scene.render.resolution_x=1350
    scene.render.resolution_y=1080
    scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'


def cargo(group):
    for x,y,z in ((-2.26,-8.79,1.025),(-.83,-8.42,1.025),(-3.92,-2.63,3.198)):
        block('Transit chest · body',(x,y,z+.175),(.48,.39,.35),group,'plank',1,.028)
        block('Transit chest · fitted lid',(x,y,z+.369),(.50,.406,.062),group,'timber',1)
        for side in (-1,1):
            block('Transit chest · wraparound strap',(x+side*.144,y,z+.387),(.047,.428,.054),group,'bronze',2)
            block('Transit chest · corner guard',(x+side*.144,y-.199,z+.205),(.049,.04,.338),group,'frame')
        block('Transit chest · hinge clasp',(x,y-.212,z+.26),(.088,.033,.133),group,'brass')
    for x,y in ((-2.55,-9.05),(-.66,-8.59)):
        lathe('Landing · old iron service cap',(x,y,1.03),[(.073,0),(.081,.03),(.066,.059)],group,'frame',8)


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    palette()
    scene=bpy.context.scene
    scene.name='Liquid Glass — The Refraction Atelier'
    island=collection('LIQUID GLASS • Island asset')
    earth=collection('01 · Limestone topography',island)
    strata=collection('Terrace scree and shoreline outcrops',earth)
    buildings=collection('02 · Refraction atelier, annex and glazed crossing',island)
    structure=collection('03 · Suspended objective and observatory',island)
    testing=collection('04 · Clear, Soft and Prismatic test court',island)
    ways=collection('05 · Stone approaches and timber landing',island)
    plants=collection('06 · Wind-pruned planting',island)
    props=collection('07 · Transit and maintenance props',island)
    rig=collection('08 · Orthographic review rig')
    _,ground=landscape(earth)
    landing(ground,ways)
    workshop(ground,buildings)
    optics(ground,structure)
    court(ground,testing)
    pavers('Maintenance path · north traverse',(-2.52,5.25),(.86,4.62),.66,ground,ways)
    pavers('Maintenance path · eastern edge',(5.95,-.15),(6.58,1.48),.68,ground,ways)
    vegetation(ground,plants,strata)
    cargo(props)
    for i,(x,y) in enumerate(((9.82,-5.0),(10.24,-4.64),(-9.18,-5.97))):
        faceted_rock('Detached foreshore stone',(x,y,-.31),(.57-i*.10,.45,.56-i*.09),strata,'talus',800+i)
    bpy.context.view_layer.update()
    points=[]
    for obj in island.all_objects:
        coords=(vertex.co for vertex in obj.data.vertices) if obj.type=='MESH' else (Vector(co) for co in obj.bound_box)
        points.extend(obj.matrix_world@co for co in coords)
    for name,(look,target,scale) in VIEWS.items():
        camera=orthographic(name,look,target,scale,points,rig)
        if name=='front':
            scene.camera=camera
    lighting(scene,rig)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.color_type='MATERIAL'
                area.spaces.active.region_3d.view_perspective='CAMERA'
                area.spaces.active.overlay.show_overlays=False
    scene['Art stage']='WEB-V0.1-W3-L1'
    scene['Provenance']='Original LibreCosta model. References are stored outside this scene.'
    return scene


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=HERE)
    parser.add_argument('--renders',nargs='*',choices=VIEWS,default=[])
    parser.add_argument('--draft',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.output.mkdir(parents=True,exist_ok=True)
    scene=build()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str((args.output/'liquid-glass.blend').resolve()),compress=True)
    if args.draft:
        scene.cycles.samples=16
        scene.render.resolution_percentage=60
    for name in args.renders:
        renders=args.output/'renders'
        renders.mkdir(exist_ok=True)
        scene.camera=bpy.data.objects['Camera · '+name]
        scene.render.filepath=str((renders/f'{name}.png').resolve())
        bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    main()
