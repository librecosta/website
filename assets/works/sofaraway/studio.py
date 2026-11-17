"""Orthographic art-review cameras and temperate studio light."""

import bpy
from mathutils import Vector

from fabric import object_in


FRONT = (8,-11,6.05)


def vertices(objects):
    points=[]
    for obj in objects:
        if obj.type=='MESH':
            points.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        elif obj.type=='CURVE':
            points.extend(obj.matrix_world @ Vector(v) for v in obj.bound_box)
    return points


def view(name, look, target, scale, points, group):
    data=bpy.data.cameras.new(name)
    camera=object_in('Camera · '+name,data,group)
    direction=Vector(look).normalized()
    rotation=(-direction).to_track_quat('-Z','Y')
    if target is None:
        inverse=rotation.inverted()
        local=[inverse @ p for p in points]
        lower=Vector(tuple(min(p[i] for p in local) for i in range(3)))
        upper=Vector(tuple(max(p[i] for p in local) for i in range(3)))
        target=rotation @ ((lower+upper)*.5)
        span=upper-lower
        if scale is None:
            scale=max(span.x,span.y*1.275)*1.14
    camera.location=Vector(target)+direction*52
    camera.rotation_euler=rotation.to_euler()
    data.type='ORTHO'
    data.ortho_scale=scale
    data.clip_end=180
    return camera


def lights(scene, group):
    for name, position, target, power, tint, length, width in (
        ('Warm daylight',(-9,-14,22),(0,0,3),4100,(1,.90,.79),13,10),
        ('Cool sky return',(11,-6,15),(2,0,4),2600,(.75,.89,1),12,13),
        ('Long overhead reflection',(-.5,10,22),(0,.8,4.8),3450,(.91,.97,1),23,7),
        ('Low flight sleeve bounce',(10,-11,4),(4,0,5.8),420,(.86,.94,1),6,4),
    ):
        light=bpy.data.lights.new(name,'AREA')
        light.energy=power
        light.color=tint
        light.shape='RECTANGLE'
        light.size=length
        light.size_y=width
        obj=object_in(name,light,group)
        obj.location=position
        obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.world=bpy.data.worlds.new('Soft coastal sky')
    scene.world.use_nodes=True
    ambient=scene.world.node_tree.nodes.get('Background')
    ambient.inputs['Color'].default_value=(.64,.73,.82,1)
    ambient.inputs['Strength'].default_value=.56
    scene.render.engine='CYCLES'
    scene.cycles.samples=48
    scene.cycles.use_denoising=True
    scene.cycles.max_bounces=12
    scene.cycles.transmission_bounces=10
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.18
    scene.render.resolution_x=1380
    scene.render.resolution_y=1080
    scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    scene.render.image_settings.compression=45


def render_device(scene, device):
    if device=='CPU':
        return
    cycles=bpy.context.preferences.addons['cycles'].preferences
    cycles.compute_device_type=device
    cycles.refresh_devices()
    devices=[item for item in cycles.devices if item.type==device]
    if not devices:
        raise RuntimeError(f'No Cycles {device} device was found')
    for item in cycles.devices:
        item.use=item in devices
    scene.cycles.device='GPU'
