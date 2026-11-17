"""Workbench gray study, orthographic views and two deterministic H.264 clips."""

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True

import bpy
from mathutils import Quaternion

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from kinematics import last_frame, load_parameters, parameter_hash


def check_video_framing(scene, start, stop):
    corners = scene.camera.data.view_frame(scene=scene)
    x0, x1 = min(v.x for v in corners), max(v.x for v in corners)
    y0, y1 = min(v.y for v in corners), max(v.y for v in corners)
    view = scene.camera.matrix_world.inverted()
    bounds = [float("inf"), float("inf"), -float("inf"), -float("inf")]
    objects = [o for o in bpy.data.collections["WitnessCore"].objects if o.type == "MESH"]
    for frame in range(start, stop + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        for obj in objects:
            transform = view @ obj.matrix_world
            for vertex in obj.data.vertices:
                co = transform @ vertex.co
                u, v = (co.x - x0) / (x1 - x0), (co.y - y0) / (y1 - y0)
                bounds = [min(bounds[0], u), min(bounds[1], v), max(bounds[2], u), max(bounds[3], v)]
    if min(bounds[:2]) < 0 or max(bounds[2:]) > 1:
        raise RuntimeError(f"Video would crop the model: {bounds}")
    return {"frames_checked": stop - start + 1, "uv_bounds": bounds, "pass": True}


def render_previews(parameters, videos=True):
    scene = bpy.context.scene
    if scene.get("parameters_sha256") != parameter_hash(parameters):
        raise RuntimeError("Source and parameters differ; rebuild the asset before rendering")
    output = ROOT / "previews"
    output.mkdir(exist_ok=True)
    scene.render.image_settings.media_type = "IMAGE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.resolution_x = parameters["preview"]["still_size"]
    scene.render.resolution_y = parameters["preview"]["still_size"]
    end = last_frame(parameters)
    idle_end = 1 + round(parameters["motion"]["idle_seconds"] * parameters["motion"]["fps"])
    shots = [
        ("three-quarter", "ThreeQuarter", 1),
        ("front-orthographic", "FrontOrthographic", end),
        ("oblique-side", "ObliqueSide", 1),
        ("pose-moderate", "ThreeQuarter", None),
        ("side-orthographic", "SideOrthographic", 1),
        ("top-orthographic", "TopOrthographic", 1),
        ("pose-idle-mid", "ThreeQuarter", 1 + (idle_end - 1) // 2),
        ("alignment-end", "ThreeQuarter", end),
    ]
    manifest = {"engine": scene.render.engine, "blender_version": bpy.app.version_string,
                "parameters_sha256": parameter_hash(parameters),
                "source_sha256": hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
                "render_environment": "Local Steam Blender background process; Workbench studio lighting; no image generation",
                "stills": [], "videos": []}
    for name, camera, frame in shots:
        scene.camera = bpy.data.objects[camera]
        scene.frame_set(frame if frame is not None else 1)
        overrides = []
        if frame is None:
            for r, angle in zip(parameters["rings"], parameters["preview"]["moderate_joint_degrees"]):
                pivot = bpy.data.objects[r["pivot"]]
                overrides.append((pivot, pivot.animation_data.action, pivot.animation_data.action_slot))
                pivot.animation_data.action = None
                pivot.rotation_quaternion = Quaternion(r["axis_local"], math.radians(angle))
            bpy.context.view_layer.update()
        scene.render.filepath = str(output / (name + ".png"))
        bpy.ops.render.render(write_still=True)
        for pivot, action, slot in overrides:
            pivot.animation_data.action = action
            pivot.animation_data.action_slot = slot
        manifest["stills"].append({"file": name + ".png", "camera": camera, "frame": frame,
                                    "joint_degrees_override": parameters["preview"]["moderate_joint_degrees"] if frame is None else None,
                                    "size": [scene.render.resolution_x, scene.render.resolution_y]})
    if videos:
        scene.camera = bpy.data.objects["ThreeQuarter"]
        scene.render.resolution_x = parameters["preview"]["video_width"]
        scene.render.resolution_y = parameters["preview"]["video_height"]
        # Blender's AUTO camera fit uses horizontal scale for landscape output.
        scene.camera.data.ortho_scale = parameters["preview"]["camera_ortho_scale"] * max(
            1, scene.render.resolution_x / scene.render.resolution_y)
        scene.render.image_settings.media_type = "VIDEO"  # Blender 5.2 separates media type from format.
        scene.render.image_settings.file_format = "FFMPEG"
        scene.render.ffmpeg.format = "MPEG4"
        scene.render.ffmpeg.codec = "H264"
        scene.render.ffmpeg.constant_rate_factor = "HIGH"
        scene.render.ffmpeg.ffmpeg_preset = "GOOD"
        scene.render.ffmpeg.gopsize = parameters["motion"]["fps"]
        scene.render.ffmpeg.audio_codec = "NONE"
        for name, start, stop in [("idle-rotation", 1, idle_end - 1),
                                  ("precision-alignment", idle_end, end)]:
            scene.frame_start, scene.frame_end = start, stop
            framing = check_video_framing(scene, start, stop)
            scene.render.filepath = str(output / (name + ".mp4"))
            bpy.ops.render.render(animation=True)
            # Decode the written container through Blender's own movie reader.
            clip = bpy.data.movieclips.load(str(output / (name + ".mp4")), check_existing=False)
            if tuple(clip.size) != (scene.render.resolution_x, scene.render.resolution_y):
                raise RuntimeError(f"Encoded video dimensions differ: {name}")
            if clip.frame_duration != stop - start + 1:
                raise RuntimeError(f"Encoded video frame count differs: {name}")
            manifest["videos"].append({"file": name + ".mp4", "frames": [start, stop],
                                       "decoded_frame_count": clip.frame_duration,
                                       "size": list(clip.size), "fps": scene.render.fps,
                                       "full_object_framing": framing,
                                       "seconds": (stop - start + 1) / scene.render.fps})
            bpy.data.movieclips.remove(clip)
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("R1-B2 PREVIEWS COMPLETE", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--stills-only", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    render_previews(load_parameters(), videos=not args.stills_only)
