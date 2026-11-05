"""Build only in a new isolated Blender background process, never a live file."""

import argparse
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from kinematics import (action_fcurves, last_frame, load_parameters, orientation_at,
                        parameter_hash, require_safe_parameters)


def closed_ring_mesh(name, s, w, d):
    """16-vertex annulus extrusion, with no overlapping boxes or interior faces."""
    vertices = []
    for y in (-d / 2, d / 2):
        for radius in (s / 2, s / 2 - w):
            vertices.extend((x, y, z) for x, z in (
                (-radius, -radius), (radius, -radius),
                (radius, radius), (-radius, radius)))
    faces = []
    for i in range(4):
        j = (i + 1) % 4
        faces.extend([
            (i, j, j + 4, i + 4),
            (i + 8, i + 12, j + 12, j + 8),
            (i, i + 8, j + 8, j),
            (i + 4, j + 4, j + 12, i + 12),
        ])
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def add_object(name, mesh, collection):
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return obj


def apply_bevel(obj, width, segments):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new("Precision bevel (applied, inward envelope)", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    modifier.use_clamp_overlap = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False


def simple_material(name, color):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    return material


def camera(name, location, scale, collection):
    data = bpy.data.cameras.new(name)
    data.type = "ORTHO"
    data.ortho_scale = scale
    data.clip_start = 0.1
    data.clip_end = 100
    obj = add_object(name, data, collection)
    obj.location = location
    obj.rotation_euler = (-Vector(location)).to_track_quat("-Z", "Y").to_euler()
    return obj


def build(parameters):
    if not bpy.app.background or bpy.data.filepath:
        raise RuntimeError("Use --background --factory-startup in a NEW process; refusing to replace an open file")
    require_safe_parameters(parameters)
    bpy.context.preferences.filepaths.save_version = 0  # This process only, no .blend1 outputs.
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    # Remove unused factory brush assets/materials, not anything from a user's file.
    for data_collection in (bpy.data.brushes, bpy.data.materials):
        for block in list(data_collection):
            data_collection.remove(block)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    scene = bpy.context.scene
    scene.name = "Witness Core - R1-B"
    model = bpy.data.collections.new("WitnessCore")
    rig = bpy.data.collections.new("PreviewRig")
    scene.collection.children.link(model)
    scene.collection.children.link(rig)
    root = add_object("WitnessCore", None, model)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.2
    gray = simple_material("Gray study", parameters["preview"]["gray"])
    white = simple_material("White core study", parameters["preview"]["white"])
    for ring in parameters["rings"]:
        pivot = add_object(ring["pivot"], None, model)
        pivot.parent = root
        pivot.empty_display_type = "PLAIN_AXES"
        pivot.empty_display_size = 0.12
        pivot.rotation_mode = "QUATERNION"
        obj = add_object(ring["name"], closed_ring_mesh(ring["name"], ring["S"], ring["W"], ring["D"]), model)
        obj.parent = pivot
        obj.data.materials.append(gray)
        for key in ("S", "W", "D"):
            obj[key] = ring[key]
        apply_bevel(obj, parameters["bevel"]["width"], parameters["bevel"]["segments"])
        previous = None
        for frame in range(1, last_frame(parameters) + 1):
            q = orientation_at((frame - 1) / parameters["motion"]["fps"], ring, parameters)
            if previous is not None and q.dot(previous) < 0:
                q.negate()
            pivot.rotation_quaternion = q
            pivot.keyframe_insert("rotation_quaternion", frame=frame, group="Independent quaternion rotation")
            previous = q.copy()
        pivot.animation_data.action.name = ring["name"] + " - Idle then precision alignment"
        for curve in action_fcurves(pivot):
            for keyframe in curve.keyframe_points:
                keyframe.interpolation = "LINEAR"
    bpy.ops.mesh.primitive_cube_add(size=parameters["core"]["side"])
    core = bpy.context.object
    core.name = "Core"
    for collection in list(core.users_collection):
        collection.objects.unlink(core)
    model.objects.link(core)
    core.parent = root
    core.data.materials.append(white)
    apply_bevel(core, parameters["core"]["bevel_width"], parameters["bevel"]["segments"])
    core["side"] = parameters["core"]["side"]
    preview = parameters["preview"]
    scene.camera = camera("ThreeQuarter", preview["camera_three_quarter"], preview["camera_ortho_scale"], rig)
    camera("FrontOrthographic", (0, -12, 0), preview["orthographic_scale"], rig)
    camera("SideOrthographic", (12, 0, 0), preview["orthographic_scale"], rig)
    camera("TopOrthographic", (0, 0, 12), preview["orthographic_scale"], rig)
    scene.render.engine = preview["engine"]
    scene.render.resolution_x = preview["still_size"]
    scene.render.resolution_y = preview["still_size"]
    scene.render.resolution_percentage = 100
    scene.render.fps = parameters["motion"]["fps"]
    scene.render.film_transparent = False
    scene.render.image_settings.media_type = "IMAGE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.display.render_aa = "16"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.studio_light = preview["studio_light"]
    shading.color_type = "MATERIAL"
    shading.background_type = "VIEWPORT"
    shading.background_color = preview["background"]
    shading.show_shadows = True
    shading.show_cavity = True
    shading.cavity_type = "BOTH"
    shading.curvature_ridge_factor = 1.1
    shading.curvature_valley_factor = 0.7
    shading.show_specular_highlight = True
    shading.show_object_outline = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.frame_start = 1
    scene.frame_end = last_frame(parameters)
    idle_end = 1 + round(parameters["motion"]["idle_seconds"] * parameters["motion"]["fps"])
    for frame, name in [(1, "IDLE / START"), (idle_end, "ALIGNMENT / START"), (last_frame(parameters), "ALIGNED")]:
        scene.timeline_markers.new(name, frame=frame)
    scene["parameters_sha256"] = parameter_hash(parameters)
    scene["motion_note"] = f"1-{idle_end}: independent idle; {idle_end}-{last_frame(parameters)}: quaternion alignment. Core stable. No handlers/physics."
    scene.unit_settings.system = "NONE"
    scene.unit_settings.scale_length = 1
    scene.frame_set(1)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    bpy.context.view_layer.objects.active = root
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_rotation = scene.camera.rotation_euler.to_quaternion()
                area.spaces.active.region_3d.view_distance = 10
                area.spaces.active.region_3d.view_location = (0, 0, 0)
                area.spaces.active.region_3d.view_perspective = "ORTHO"
                area.spaces.active.shading.color_type = "MATERIAL"
    source_text = bpy.data.texts.new("R1-B - README")
    source_text.write("Generated from parameters.json + build.py. Four closed meshes, three independent quaternion pivots.\n" + scene["motion_note"] + "\nNo auto-run scripts required.\n")
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "witness-core.blend"), compress=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--previews", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    parameters = load_parameters()
    build(parameters)
    from validate import validate_scene
    validate_scene(parameters)
    if args.previews:
        from render_previews import render_previews
        render_previews(parameters)


if __name__ == "__main__":
    main()
