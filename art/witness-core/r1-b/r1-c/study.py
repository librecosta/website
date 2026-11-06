"""R1-C material study. Read R1-B2; save a separate asset, never a live file."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import tempfile
import time

sys.dont_write_bytecode = True
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
BASE = ROOT.parent
sys.path.insert(0, str(BASE))
from kinematics import action_fcurves, load_parameters, parameter_hash

def read_settings():
    return json.loads((ROOT/"material-parameters.json").read_text(encoding="utf-8"))

def digest(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

def signatures():
    result = {}
    for name in ("RingA", "RingB", "RingC", "Core"):
        obj = bpy.data.objects[name]
        result[name] = digest({"vertices": [list(v.co) for v in obj.data.vertices],
                               "faces": [list(p.vertices) for p in obj.data.polygons]})
    keys = [{"name": r["pivot"], "parent": bpy.data.objects[r["pivot"]].parent.name,
             "curves": [[c.data_path, c.array_index,
                         [[float(k.co.x), float(k.co.y), k.interpolation] for k in c.keyframe_points]]
                        for c in action_fcurves(bpy.data.objects[r["pivot"]])]}
            for r in load_parameters()["rings"]]
    return {"meshes": result, "animation_and_parents": digest(keys)}

def material(name):
    m = bpy.data.materials.new(name)
    m.node_tree.nodes.clear()
    n, l = m.node_tree.nodes, m.node_tree.links
    bs = n.new("ShaderNodeBsdfPrincipled"); bs.location=(500, 0)
    out=n.new("ShaderNodeOutputMaterial"); out.location=(800, 0)
    l.new(bs.outputs["BSDF"], out.inputs["Surface"])
    return m, n, l, bs

def ramp(n, l, source, values, location):
    node=n.new("ShaderNodeValToRGB"); node.location=location
    for elem, value in zip(node.color_ramp.elements, values):
        elem.color=value if isinstance(value, list) else (value, value, value, 1)
    l.new(source, node.inputs["Fac"])
    return node.outputs["Color"]

def noise(n, l, coordinate, scale, location, detail=2):
    node=n.new("ShaderNodeTexNoise"); node.location=location
    node.inputs["Scale"].default_value=scale
    node.inputs["Detail"].default_value=detail
    node.inputs["Roughness"].default_value=.65
    l.new(coordinate, node.inputs["Vector"])
    return node.outputs["Fac"]

def metals(p):
    m,n,l,bs=material(p["outer"]["name"]); q=p["outer"]
    coord=n.new("ShaderNodeTexCoord"); coord.location=(-1000,0)
    age=noise(n,l,coord.outputs["Object"],q["age_noise_scale"],(-800,300))
    color=ramp(n,l,age,[q["base_color_low"],q["base_color_high"]],(-400,320))
    l.new(color,bs.inputs["Base Color"]); bs.inputs["Metallic"].default_value=q["metallic"]
    micro=noise(n,l,coord.outputs["Object"],q["micro_noise_scale"],(-800,-200))
    rough=ramp(n,l,micro,q["roughness"],(-400,80)); l.new(rough,bs.inputs["Roughness"])
    forge=noise(n,l,coord.outputs["Object"],q["forging_noise_scale"],(-800,-480),3)
    b=n.new("ShaderNodeBump"); b.location=(-150,-220)
    b.inputs["Distance"].default_value=q["forging_bump_distance"]
    b.inputs["Strength"].default_value=q["forging_bump_strength"]
    l.new(forge,b.inputs["Height"])
    fine=n.new("ShaderNodeBump"); fine.location=(150,-130)
    fine.inputs["Distance"].default_value=q["micro_bump_distance"]
    fine.inputs["Strength"].default_value=q["micro_bump_strength"]
    l.new(micro,fine.inputs["Height"]); l.new(b.outputs["Normal"],fine.inputs["Normal"])
    l.new(fine.outputs["Normal"],bs.inputs["Normal"])
    outer=m
    m,n,l,bs=material(p["inner"]["name"]); q=p["inner"]
    bs.inputs["Base Color"].default_value=q["base_color"]
    bs.inputs["Metallic"].default_value=q["metallic"]
    bs.inputs["Anisotropic"].default_value=q["anisotropy"]
    coord=n.new("ShaderNodeTexCoord"); coord.location=(-750,0)
    wave=n.new("ShaderNodeTexWave"); wave.location=(-500,0)
    wave.wave_type="BANDS"; wave.bands_direction="Y"
    wave.inputs["Scale"].default_value=q["machining_wave_scale"]
    wave.inputs["Distortion"].default_value=.45
    l.new(coord.outputs["Object"],wave.inputs["Vector"])
    rough=ramp(n,l,wave.outputs["Fac"],q["roughness"],(-200,150)); l.new(rough,bs.inputs["Roughness"])
    bump=n.new("ShaderNodeBump"); bump.location=(170,-120)
    bump.inputs["Distance"].default_value=q["bump_distance"]
    bump.inputs["Strength"].default_value=q["bump_strength"]
    l.new(wave.outputs["Fac"],bump.inputs["Height"]); l.new(bump.outputs["Normal"],bs.inputs["Normal"])
    return outer,m

def core_material(p):
    m,n,l,bs=material(p["name"])
    for socket,key in [("Base Color","base_color"),("Metallic","metallic"),("Roughness","roughness"),
                       ("IOR","ior"),("Transmission Weight","transmission"),
                       ("Emission Color","emission_color"),("Emission Strength","emission_strength")]:
        bs.inputs[socket].default_value=p[key]
    return m

def gpu():
    pref=bpy.context.preferences.addons["cycles"].preferences
    pref.compute_device_type="OPTIX"; pref.get_devices()
    names=[]
    for d in pref.devices:
        d.use=d.type=="OPTIX"
        if d.use: names.append(d.name)
    if not names:
        raise RuntimeError("Requested local OptiX GPU unavailable; no silent renderer switch")
    bpy.context.scene.cycles.device="GPU"
    return names

def aim(obj, target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()

def study_camera(name, location, target, scale, collection):
    data=bpy.data.cameras.new(name); data.type="ORTHO"; data.ortho_scale=scale
    data.clip_start=.05; data.clip_end=100
    obj=bpy.data.objects.new(name,data); collection.objects.link(obj)
    obj.location=location; aim(obj,target)
    return obj

def build(p):
    if not bpy.app.background or bpy.data.filepath:
        raise RuntimeError("Only --background --factory-startup in a new process is accepted")
    bpy.ops.wm.open_mainfile(filepath=str(BASE/"witness-core.blend"))
    scene=bpy.context.scene
    before=signatures()
    bpy.context.preferences.filepaths.save_version=0
    outer,inner=metals(p); core=core_material(p["core"])
    for name in ("RingA","RingB","RingC","Core"):
        obj=bpy.data.objects[name]
        obj.data.materials.clear()
        if name=="Core":
            obj.data.materials.append(core)
        else:
            obj.data.materials.append(outer); obj.data.materials.append(inner)
            for poly in obj.data.polygons:
                center, normal=poly.center,poly.normal
                poly.material_index=1 if normal.x*center.x+normal.z*center.z < -.05 else 0
        for poly in obj.data.polygons:
            poly.use_smooth=True
        bpy.ops.object.select_all(action="DESELECT"); obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        mod=obj.modifiers.new("Face-weighted corner normals, no shape edits","WEIGHTED_NORMAL")
        mod.keep_sharp=True; mod.weight=50
        bpy.ops.object.modifier_apply(modifier=mod.name)
        # Keep explicit planar corner normals; leave smooth weighted bevel normals.
        # Merely toggling flat shading after a custom-normal modifier is insufficient.
        normals=[v.vector.copy() for v in obj.data.corner_normals]
        for poly in obj.data.polygons:
            if max(abs(v) for v in poly.normal) > 1-1e-5:
                for index in poly.loop_indices:
                    normals[index]=poly.normal.copy()
        obj.data.normals_split_custom_set(normals)
    after=signatures()
    if before != after:
        raise RuntimeError("Material authoring changed geometry or animation")
    rig=bpy.data.collections.new("R1-C Studio"); scene.collection.children.link(rig)
    for lp in p["studio"]["lights"]:
        data=bpy.data.lights.new(lp["name"],"AREA")
        data.energy=lp["power_w"]; data.color=lp["color"]; data.shape="RECTANGLE"
        data.size,data.size_y=lp["size"]
        obj=bpy.data.objects.new(lp["name"],data); rig.objects.link(obj)
        obj.location=lp["position"]; aim(obj,(0,0,0))
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,p["studio"]["floor_z"]))
    floor=bpy.context.object; floor.name="Studio ground - preview only"
    for c in list(floor.users_collection): c.objects.unlink(floor)
    rig.objects.link(floor)
    mat,_,_,bs=material("Studio charcoal - preview only")
    bs.inputs["Base Color"].default_value=p["studio"]["floor_color"]
    bs.inputs["Roughness"].default_value=.82
    floor.data.materials.append(mat)
    scene.world=bpy.data.worlds.new("R1-C neutral studio")
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value=p["studio"]["world_color"]
    bg.inputs["Strength"].default_value=p["studio"]["world_strength"]
    # The original hero camera / framing and all asset animation remain intact.
    study_camera("OuterMacro",(4,-8,5.5),(1.55,-.25,1.55),1.65,rig)
    study_camera("InnerMacro",(3,-7,5),(.10,-.05,-.57),1.65,rig)
    study_camera("CoreRelation",(3,-8,3.5),(0,0,0),2.45,rig)
    scene.render.engine="CYCLES"; devices=gpu()
    scene.cycles.samples=p["render"]["still_samples"]
    scene.cycles.use_denoising=True; scene.cycles.seed=p["render"]["seed"]
    scene.cycles.use_animated_seed=False
    scene.cycles.max_bounces=8; scene.cycles.diffuse_bounces=4
    scene.cycles.glossy_bounces=4; scene.cycles.transmission_bounces=6
    scene.render.image_settings.media_type="IMAGE"
    scene.render.image_settings.file_format="PNG"; scene.render.image_settings.color_mode="RGB"
    scene.render.resolution_x=scene.render.resolution_y=p["render"]["still_size"]
    scene.render.resolution_percentage=100; scene.render.fps=p["render"]["fps"]
    scene.view_settings.view_transform=p["render"]["view_transform"]
    scene.view_settings.look=p["render"]["look"]; scene.view_settings.exposure=p["render"]["exposure"]
    if getattr(scene,"compositing_node_group",None) is not None:
        raise RuntimeError("This study expects no compositing effects")
    scene.camera=bpy.data.objects["ThreeQuarter"]; scene.frame_set(1)
    scene["material_parameters_sha256"]=digest(p)
    scene["r1b2_structural_signature"]=json.dumps(before,sort_keys=True)
    scene["r1b2_source_sha256"]=hashlib.sha256((BASE/"witness-core.blend").read_bytes()).hexdigest()
    scene["material_note"]="R1-C: identical R1-B2 geometry/animation; flat planes, smooth bevels, weighted normals; actual mesh-emission GI; no bloom"
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=="VIEW_3D":
                area.spaces.active.shading.type="MATERIAL"
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"witness-core-materials.blend"),compress=True)
    report={"revision":"R1-C","blender_version":bpy.app.version_string,"render_devices":devices,
            "geometry_and_animation_before":before,"geometry_and_animation_after":after,
            "structural_identity":before==after,"material_parameters_sha256":digest(p),
            "r1b2_source_sha256":scene["r1b2_source_sha256"],
            "geometry_changes":"none","normal_changes":"Flat principal planes, smooth bevel patches + weighted corner normals",
            "material_slots":{name:[m.name for m in bpy.data.objects[name].data.materials] for name in before["meshes"]},
            "node_counts":{m.name:len(m.node_tree.nodes) for m in (outer,inner,core)},
            "pass":before==after}
    (ROOT/"preservation-report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    return scene

def render(p,draft=False,video=False,video_only=False,only_shot=None):
    scene=bpy.context.scene
    if scene.get("material_parameters_sha256")!=digest(p):
        raise RuntimeError("Rebuild the study before rendering changed parameters")
    gpu()
    output=Path(tempfile.gettempdir())/"librecosta-r1c-draft" if draft else ROOT/"previews"
    output.mkdir(exist_ok=True)
    shots=[("hero","ThreeQuarter",1)]
    if not draft:
        shots += [("aligned-front","FrontOrthographic",481),
                  ("outer-surface-closeup","OuterMacro",1),("inner-precision-closeup","InnerMacro",1),
                  ("core-light","CoreRelation",1),("core-unlit-control","CoreRelation",1),
                  ("clay-control","ThreeQuarter",1)]
    manifest={"renderer":"Cycles / OptiX","blender_version":bpy.app.version_string,
              "material_parameters_sha256":digest(p),
              "source_sha256":hashlib.sha256((ROOT/"witness-core-materials.blend").read_bytes()).hexdigest(),
              "color_management":p["render"]["view_transform"]+" / "+p["render"]["look"],
              "stills":[],"videos":[]}
    if video_only or only_shot:
        previous=json.loads((output/"manifest.json").read_text(encoding="utf-8"))
        if previous["source_sha256"]!=manifest["source_sha256"]:
            raise RuntimeError("Stills refer to a different source; render the full study")
        manifest=previous
        shots=[] if video_only else [s for s in shots if s[0]==only_shot]
        if only_shot and not shots:
            raise ValueError("Unknown shot: "+only_shot)
    clay,_,_,bs=material("Matched gray control")
    bs.inputs["Base Color"].default_value=(.36,.36,.36,1); bs.inputs["Roughness"].default_value=.5
    white_clay,_,_,bs=material("Matched white core control")
    bs.inputs["Base Color"].default_value=(.92,.92,.92,1)
    core_bs=next(n for n in bpy.data.materials[p["core"]["name"]].node_tree.nodes if n.type=="BSDF_PRINCIPLED")
    for name,cam,frame in shots:
        scene.camera=bpy.data.objects[cam]; scene.frame_set(frame)
        size=([768,768] if draft else [p["render"]["still_size"]]*2 if name in ("hero","clay-control","aligned-front") else p["render"]["detail_size"])
        scene.render.resolution_x,scene.render.resolution_y=size
        scene.cycles.samples=32 if draft else p["render"]["still_samples"]
        saved_slots=[]
        if name=="clay-control":
            for objname in ("RingA","RingB","RingC","Core"):
                obj=bpy.data.objects[objname]
                saved_slots.append((obj,list(obj.data.materials),[f.material_index for f in obj.data.polygons]))
                obj.data.materials.clear()
                obj.data.materials.append(white_clay if objname=="Core" else clay)
                for face in obj.data.polygons: face.material_index=0
        core_bs.inputs["Emission Strength"].default_value=0 if name=="core-unlit-control" else p["core"]["emission_strength"]
        scene.render.filepath=str(output/(name+".png"))
        started=time.perf_counter()
        bpy.ops.render.render(write_still=True)
        for obj,mats,indices in saved_slots:
            obj.data.materials.clear()
            for mat in mats: obj.data.materials.append(mat)
            for face,index in zip(obj.data.polygons,indices): face.material_index=index
        manifest["stills"]=[s for s in manifest["stills"] if s["file"]!=name+".png"]
        manifest["stills"].append({"file":name+".png","frame":frame,"camera":cam,"resolution":size,
                                   "samples":scene.cycles.samples,"render_seconds":time.perf_counter()-started,
                                   "core_emission_strength":core_bs.inputs["Emission Strength"].default_value})
        print("R1-C SHOT",name,"DONE",flush=True)
    scene.view_layers[0].material_override=None
    core_bs.inputs["Emission Strength"].default_value=p["core"]["emission_strength"]
    # Keep completed still provenance if a long animation render is interrupted.
    (output/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    if video and not draft:
        scene.render.use_persistent_data=True
        scene.cycles.denoiser="OPTIX"
        scene.camera=bpy.data.objects["ThreeQuarter"]
        scene.render.resolution_x,scene.render.resolution_y=p["render"]["video_size"]
        scene.cycles.samples=p["render"]["animation_samples"]
        scene.frame_start,scene.frame_end=p["render"]["video_frames"]
        scene.render.image_settings.media_type="VIDEO"; scene.render.image_settings.file_format="FFMPEG"
        scene.render.ffmpeg.format="MPEG4"; scene.render.ffmpeg.codec="H264"
        scene.render.ffmpeg.constant_rate_factor="HIGH"; scene.render.ffmpeg.ffmpeg_preset="GOOD"
        scene.render.ffmpeg.audio_codec="NONE"
        scene.render.filepath=str(output/"idle-material.mp4")
        started=time.perf_counter(); bpy.ops.render.render(animation=True)
        clip=bpy.data.movieclips.load(str(output/"idle-material.mp4"),check_existing=False)
        expected=scene.frame_end-scene.frame_start+1
        if clip.frame_duration!=expected or list(clip.size)!=p["render"]["video_size"]:
            raise RuntimeError("Encoded preview dimensions / frame count differ")
        manifest["videos"].append({"file":"idle-material.mp4","frames":p["render"]["video_frames"],
                                   "decoded_frames":clip.frame_duration,"size":list(clip.size),
                                   "fps":scene.render.fps,"samples":scene.cycles.samples,
                                   "denoiser":scene.cycles.denoiser,"persistent_data":True,
                                   "render_seconds":time.perf_counter()-started})
        bpy.data.movieclips.remove(clip)
    (output/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--draft",action="store_true"); parser.add_argument("--video",action="store_true")
    parser.add_argument("--render-only",action="store_true")
    parser.add_argument("--video-only",action="store_true")
    parser.add_argument("--shot")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    p=read_settings()
    if not args.render_only: build(p)
    render(p,draft=args.draft,video=args.video or args.video_only,video_only=args.video_only,only_shot=args.shot)
