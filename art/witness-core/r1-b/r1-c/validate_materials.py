"""Reopen both local assets, compare structure, then rerun inherited mesh checks."""
import hashlib
import json
import math
from pathlib import Path
import sys

sys.dont_write_bytecode=True
import bpy
from mathutils import Matrix
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
sys.path.insert(0,str(ROOT.parent))
import study
import validate as geometry_validation
from kinematics import load_parameters

def snapshot():
    scene=bpy.context.scene
    data=study.signatures()
    names=["WitnessCore","RingAPivot","RingBPivot","RingCPivot","RingA","RingB","RingC","Core"]
    data["hierarchy_and_static_transforms"]={
        name:{"parent":bpy.data.objects[name].parent.name if bpy.data.objects[name].parent else None,
              "location":list(bpy.data.objects[name].location),"scale":list(bpy.data.objects[name].scale),
              "parent_inverse":[list(r) for r in bpy.data.objects[name].matrix_parent_inverse],
              "constraints":len(bpy.data.objects[name].constraints),
              "modifiers":len(bpy.data.objects[name].modifiers)}
        for name in names}
    data["world_poses"]={}
    for frame in (1,37,121,192,241,361,481):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        data["world_poses"][str(frame)]={n:[list(r) for r in bpy.data.objects[n].matrix_world] for n in names}
    return data

def verify():
    if not bpy.app.background:
        raise RuntimeError("Run in an independent background process, never a live project")
    p=study.read_settings()
    asset=ROOT/"witness-core-materials.blend"
    bpy.ops.wm.open_mainfile(filepath=str(asset))
    current=snapshot()
    scene=bpy.context.scene
    settings_ok=scene.get("material_parameters_sha256")==study.digest(p)
    mat_checks={}
    for role in ("outer","inner","core"):
        q=p[role]; mat=bpy.data.materials[q["name"]]
        bs=next(n for n in mat.node_tree.nodes if n.type=="BSDF_PRINCIPLED")
        expected_emission=q.get("emission_strength",0)
        mat_checks[role]={
            "nodes":len(mat.node_tree.nodes),
            "metallic_matches":abs(bs.inputs["Metallic"].default_value-q["metallic"])<1e-6,
            "emission_matches":abs(bs.inputs["Emission Strength"].default_value-expected_emission)<1e-6,
            "normal_bump_only":not mat.node_tree.nodes.get("Material Output").inputs["Displacement"].is_linked}
    # Ensure actual slot assignment includes finished inner walls on every ring.
    slots={n:sorted({p.material_index for p in bpy.data.objects[n].data.polygons})
           for n in ("RingA","RingB","RingC")}
    plane_normal_errors={}
    plane_normal_angles={}
    for name in ("RingA","RingB","RingC","Core"):
        mesh=bpy.data.objects[name].data
        plane_normal_errors[name]=max(
            (mesh.corner_normals[i].vector-face.normal).length
            for face in mesh.polygons if max(abs(x) for x in face.normal)>1-1e-5
            for i in face.loop_indices)
        plane_normal_angles[name]=max(
            math.degrees(mesh.corner_normals[i].vector.angle(face.normal))
            for face in mesh.polygons if max(abs(x) for x in face.normal)>1-1e-5
            for i in face.loop_indices)
    from render_previews import check_video_framing
    scene.camera=bpy.data.objects["ThreeQuarter"]
    scene.render.resolution_x,scene.render.resolution_y=p["render"]["video_size"]
    framing=check_video_framing(scene,*p["render"]["video_frames"])
    no_post=getattr(scene,"compositing_node_group",None) is None
    light_count=len([o for o in scene.objects if o.type=="LIGHT"])
    # No hidden helper lights masquerading as mesh emission.
    no_core_helpers=all(o.parent is None for o in scene.objects if o.type=="LIGHT")
    node_counts={k:v["nodes"] for k,v in mat_checks.items()}
    bpy.ops.wm.open_mainfile(filepath=str(ROOT.parent/"witness-core.blend"))
    baseline=snapshot()
    identity=current==baseline
    bpy.ops.wm.open_mainfile(filepath=str(asset))
    geometry_validation.ROOT=ROOT
    collision=geometry_validation.validate_scene(load_parameters(),reopened=True)
    checks={
        "source_structure_animation_world_poses_identical":identity,
        "material_parameter_hash_matches":settings_ok,
        "shader_values_match":all(all(v for k,v in item.items() if k!="nodes") for item in mat_checks.values()),
        "precision_slots_used_on_all_rings":all(v==[0,1] for v in slots.values()),
        "planar_corner_normals_within_quarter_degree":max(plane_normal_angles.values())<0.25,
        "whole_asset_inside_every_video_frame":framing["pass"],
        "no_compositor_glow":no_post,"five_external_studio_area_lights_only":light_count==5 and no_core_helpers,
        "actual_mesh_collision_validation":collision["pass"]}
    report={
        "revision":"R1-C","blender_version":bpy.app.version_string,
        "source_sha256":hashlib.sha256(asset.read_bytes()).hexdigest(),
        "baseline_sha256":hashlib.sha256((ROOT.parent/"witness-core.blend").read_bytes()).hexdigest(),
        "material_parameters_sha256":study.digest(p),"checks":checks,
        "baseline_signature":study.digest(baseline),"material_asset_signature":study.digest(current),
        "material_node_counts":node_counts,"slot_usage":slots,
        "planar_corner_normal_max_error":plane_normal_errors,"video_framing":framing,
        "planar_corner_normal_max_degrees":plane_normal_angles,"normal_tolerance_degrees":0.25,
        "geometry_adjustments":"None. Same vertices, polygons, parent hierarchy, local transforms and all quaternion keys.",
        "normal_adjustments":"Explicit planar corner normals; weighted interpolation on existing bevels. Normal-only procedural bump; no displacement.",
        "conservative_bounded_gap":collision["bounded_domain_certificate"]["minimum_gap_after_numeric_allowance"],
        "pass":all(checks.values())}
    (ROOT/"preservation-report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    if not report["pass"]:
        raise RuntimeError(f"Material asset verification failed: {checks}")
    print("R1-C SOURCE PRESERVATION + MESH VALIDATION PASS",flush=True)

if __name__=="__main__":
    verify()
