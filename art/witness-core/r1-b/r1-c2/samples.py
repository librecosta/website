"""Controlled R1-C2 surface swatches. No edits to Witness Core or animation."""
import argparse,hashlib,json,math,sys,tempfile,time,struct
from pathlib import Path
sys.dont_write_bytecode=True
import bpy,bmesh
import numpy as np
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/"r1-c"))
import study
sys.path.insert(0,str(ROOT.parent))
from build import apply_bevel

def settings():
    return json.loads((ROOT/"sample-parameters.json").read_text(encoding="utf-8"))
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def scalar(n,l,operation,a,b=None):
    node=n.new("ShaderNodeMath");node.operation=operation
    for i,v in enumerate([a,b] if b is not None else [a]):
        if isinstance(v,(float,int)):node.inputs[i].default_value=v
        else:l.new(v,node.inputs[i])
    return node.outputs[0]
def ramp(n,l,source,points):
    node=n.new("ShaderNodeValToRGB");node.color_ramp.interpolation="EASE"
    elements=node.color_ramp.elements
    for element,(pos,value) in zip(elements,points):
        element.position=pos;element.color=(value,value,value,1)
    l.new(source,node.inputs["Fac"]);return node.outputs["Color"]

def new_surfaces(key,p):
    q=p["variants"][key]
    mat,n,l,bs=study.material(key+" forged source")
    mat.use_fake_user=True
    coord=n.new("ShaderNodeTexCoord");co=coord.outputs["Object"]
    age=study.noise(n,l,co,3.2,(-800,500),3)
    micro=study.noise(n,l,co,160,(-800,-500),2)
    vor=n.new("ShaderNodeTexVoronoi")
    vor.voronoi_dimensions="3D";vor.feature="SMOOTH_F1"
    vor.inputs["Scale"].default_value=q["pit_cell_scale"]
    vor.inputs["Smoothness"].default_value=.35
    if key=="C":
        vor.distance="MINKOWSKI";vor.inputs["Exponent"].default_value=3.
    l.new(co,vor.inputs["Vector"])
    bowl=ramp(n,l,vor.outputs["Distance"],[(.12,.06),(.50 if key=="C" else .62,1.)])
    patch=ramp(n,l,age,[(.42,0.),(.64,1.)])
    pit=scalar(n,l,"MULTIPLY",scalar(n,l,"SUBTRACT",1.,bowl),patch)
    height=scalar(n,l,"SUBTRACT",1.,pit)
    fine=scalar(n,l,"MULTIPLY",micro,.12)
    height=scalar(n,l,"ADD",height,fine)
    bump=n.new("ShaderNodeBump")
    bump.inputs["Distance"].default_value=q["pit_bump_distance"]
    bump.inputs["Strength"].default_value=q["pit_bump_strength"]
    l.new(height,bump.inputs["Height"]);l.new(bump.outputs["Normal"],bs.inputs["Normal"])
    # Pit/oxide patches and raised burnished regions respond differently to light.
    roughsource=scalar(n,l,"ADD",scalar(n,l,"MULTIPLY",pit,.7),scalar(n,l,"MULTIPLY",age,.3))
    color=study.ramp(n,l,roughsource,[q["color_high"],q["color_low"]],(-400,400))
    l.new(color,bs.inputs["Base Color"]);bs.inputs["Metallic"].default_value=.93
    rough=study.ramp(n,l,roughsource,q["roughness"],(-200,180))
    l.new(rough,bs.inputs["Roughness"])
    outer=mat
    mat,n,l,bs=study.material(key+" precision source");mat.use_fake_user=True
    coord=n.new("ShaderNodeTexCoord");co=coord.outputs["Object"]
    wave=n.new("ShaderNodeTexWave");wave.wave_type="BANDS";wave.bands_direction="Y"
    wave.inputs["Scale"].default_value=q["machining_wave_scale"]
    wave.inputs["Distortion"].default_value=.75 if key=="B" else 1.4
    l.new(co,wave.inputs["Vector"])
    age=study.noise(n,l,co,9,(-700,250),2)
    streak=scalar(n,l,"MULTIPLY",wave.outputs["Fac"],.7)
    streak=scalar(n,l,"ADD",streak,scalar(n,l,"MULTIPLY",age,.3))
    rough=study.ramp(n,l,streak,q["inner_roughness"],(-200,200))
    l.new(rough,bs.inputs["Roughness"])
    col=study.ramp(n,l,age,[[.06,.068,.073,1],[.115,.125,.132,1]],(-200,400))
    l.new(col,bs.inputs["Base Color"]);bs.inputs["Metallic"].default_value=1
    bs.inputs["Anisotropic"].default_value=0  # Direction is carried by real baked normal/roughness.
    bump=n.new("ShaderNodeBump");bump.inputs["Strength"].default_value=.2
    bump.inputs["Distance"].default_value=q["machining_bump_distance"]
    l.new(wave.outputs["Fac"],bump.inputs["Height"]);l.new(bump.outputs["Normal"],bs.inputs["Normal"])
    return outer,mat

def sample_mesh(p):
    s=p["sample"];L,H,W,D=[s[k] for k in ("length","height","beam_width","depth")]
    outline=[(0,0),(L,0),(L,H),(L-W,H),(L-W,W),(0,W)]
    vertices=[(x-L/2,y,z-H/2) for y in (-D/2,D/2) for x,z in outline]
    faces=[tuple(range(6)),tuple(reversed(range(6,12)))]
    faces += [(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]
    mesh=bpy.data.meshes.new("Shared L corner");mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    return mesh

def material_slots(obj,mats):
    for slot,mat in zip(obj.material_slots,mats):
        slot.link="OBJECT";slot.material=mat

def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False);obj.hide_render=False
    obj.select_set(True);bpy.context.view_layer.objects.active=obj

def bake_variant(obj,key,p,source_mats):
    active(obj)
    textures=ROOT/"textures";textures.mkdir(exist_ok=True)
    images={}
    scene=bpy.context.scene
    scene.cycles.samples=16
    scene.render.bake.use_selected_to_active=False
    scene.render.bake.margin=p["bake_margin_px"]
    scene.render.bake.use_clear=True
    for channel in ("basecolor","roughness","normal"):
        image=bpy.data.images.new(key+"_"+channel,width=p["atlas_size"],height=p["atlas_size"],alpha=False)
        image.colorspace_settings.name="sRGB" if channel=="basecolor" else "Non-Color"
        restore=[]
        for mat in dict.fromkeys(source_mats):
            n,l=mat.node_tree.nodes,mat.node_tree.links
            for node in n:node.select=False
            target=n.new("ShaderNodeTexImage");target.image=image;target.select=True;n.active=target
            bs=next(x for x in n if x.type=="BSDF_PRINCIPLED")
            out=next(x for x in n if x.type=="OUTPUT_MATERIAL")
            emit=None
            if channel!="normal":
                emit=n.new("ShaderNodeEmission")
                socket=bs.inputs["Base Color" if channel=="basecolor" else "Roughness"]
                if socket.is_linked:l.new(socket.links[0].from_socket,emit.inputs["Color"])
                else:
                    value=socket.default_value
                    emit.inputs["Color"].default_value=list(value) if hasattr(value,"__len__") else (value,value,value,1)
                l.new(emit.outputs[0],out.inputs["Surface"])
            restore.append((mat,bs,out,target,emit))
        bpy.ops.object.bake(type="NORMAL" if channel=="normal" else "EMIT",normal_space="TANGENT")
        image.filepath_raw=str(textures/(key+"-"+channel+".png"));image.file_format="PNG";image.save()
        for mat,bs,out,target,emit in restore:
            mat.node_tree.links.new(bs.outputs["BSDF"],out.inputs["Surface"])
            mat.node_tree.nodes.remove(target)
            if emit:mat.node_tree.nodes.remove(emit)
        images[channel]=image
        print("BAKED",key,channel,flush=True)
    baked=[]
    for role,metallic in (("forged",.93),("precision",1.)):
        mat,n,l,bs=study.material(key+" "+role+" baked PBR")
        bs.inputs["Metallic"].default_value=metallic
        for channel,socket in (("basecolor","Base Color"),("roughness","Roughness")):
            node=n.new("ShaderNodeTexImage");node.image=images[channel]
            l.new(node.outputs["Color"],bs.inputs[socket])
        normal=n.new("ShaderNodeTexImage");normal.image=images["normal"]
        convert=n.new("ShaderNodeNormalMap");convert.space="TANGENT"
        l.new(normal.outputs["Color"],convert.inputs["Color"]);l.new(convert.outputs["Normal"],bs.inputs["Normal"])
        baked.append(mat)
    material_slots(obj,[baked[0],baked[1],baked[0],baked[1]])
    return {k:{"file":im.filepath_raw,"sha256":sha(Path(im.filepath_raw))} for k,im in images.items()}

def geom_hash(mesh):
    return study.digest({"vertices":[list(v.co) for v in mesh.vertices],"faces":[list(f.vertices) for f in mesh.polygons],
                         "uv":[list(x.uv) for x in mesh.uv_layers.active.data]})

def build(p,do_bake=True):
    if not bpy.app.background or bpy.data.filepath:raise RuntimeError("New factory background process only")
    source=ROOT.parent/"r1-c"/"witness-core-materials.blend"
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene=bpy.context.scene;scene.name="R1-C2 controlled surface samples"
    original_outer=bpy.data.materials["Outer Monument Metal"]
    original_inner=bpy.data.materials["Inner Precision Metal"]
    # All removals occur in this isolated copy, never in the source file.
    for obj in list(bpy.data.collections["WitnessCore"].objects):
        bpy.data.objects.remove(obj,do_unlink=True)
    samples=bpy.data.collections.new("Surface Samples");scene.collection.children.link(samples)
    mesh=sample_mesh(p)
    obj=bpy.data.objects.new("A baseline",mesh);samples.objects.link(obj)
    for mat in (original_outer,original_inner,original_outer,original_inner):mesh.materials.append(mat)
    active(obj);apply_bevel(obj,p["sample"]["bevel"],p["sample"]["bevel_segments"])
    mesh=obj.data
    for face in mesh.polygons:
        # Same surface role mask in every variant. Bevels retain baseline shaders.
        inner=(face.normal.x<-.5 and face.center.x>0 or face.normal.z>.5 and face.center.z<0)
        bevel=max(abs(x) for x in face.normal)<.9999
        face.material_index=(1 if inner else 0)+(2 if bevel else 0)
        face.use_smooth=True
    mod=obj.modifiers.new("Weighted bevel normals","WEIGHTED_NORMAL");mod.weight=50
    bpy.ops.object.modifier_apply(modifier=mod.name)
    normals=[n.vector.copy() for n in mesh.corner_normals]
    for face in mesh.polygons:
        if max(abs(x) for x in face.normal)>.9999:
            for i in face.loop_indices:normals[i]=face.normal.copy()
    mesh.normals_split_custom_set(normals)
    active(obj);bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.025)
    bpy.ops.object.mode_set(mode="OBJECT")
    objects={"A":obj};source_materials={}
    material_slots(obj,[original_outer,original_inner,original_outer,original_inner])
    for key in ("B","C"):
        other=bpy.data.objects.new(key+" "+p["variants"][key]["name"],mesh);samples.objects.link(other)
        outer,inner=new_surfaces(key,p)
        source_materials[key]=[outer,inner,original_outer,original_inner]
        material_slots(other,source_materials[key]);objects[key]=other
    floor=bpy.data.objects["Studio ground - preview only"];floor.location.z=-1.25
    rig=bpy.data.collections["R1-C Studio"]
    for name,loc,target,scale in [
        ("Sample Medium",p["render"]["medium_camera"],p["render"]["medium_target"],p["render"]["medium_scale"]),
        ("Sample Close",p["render"]["close_camera"],p["render"]["close_target"],p["render"]["close_scale"])]:
        study.study_camera(name,loc,target,scale,rig)
    study.gpu();scene.render.use_persistent_data=True
    scene.cycles.seed=p["render"]["seed"];scene.cycles.samples=p["render"]["samples"]
    scene.view_settings.exposure=p["render"]["exposure"];scene.view_settings.look=p["render"]["look"]
    bake_report={}
    if do_bake:
        for key in ("B","C"):
            for o in objects.values():o.hide_render=True
            bake_report[key]=bake_variant(objects[key],key,p,source_materials[key])
    for key,o in objects.items():o.hide_render=key!="B";o.hide_set(key!="B")
    scene.camera=bpy.data.objects["Sample Medium"]
    scene.render.resolution_x,scene.render.resolution_y=p["render"]["medium_size"]
    scene.cycles.samples=p["render"]["samples"]
    scene["sample_parameter_hash"]=study.digest(p);scene["source_r1c_sha256"]=sha(source)
    scene["scope"]="Independent coupon only. Original Witness Core geometry, core light and animations untouched."
    bpy.context.preferences.filepaths.save_version=0
    # Relative texture references: portable project directory, no embedded caches.
    for im in bpy.data.images:
        if im.filepath_raw and str(ROOT/"textures") in im.filepath_raw:
            im.filepath_raw="//textures/"+Path(im.filepath_raw).name
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"surface-samples.blend"),compress=True,relative_remap=False)
    report={"source_r1c_sha256":sha(source),"sample_parameters_sha256":study.digest(p),
            "shared_mesh":len({o.data.as_pointer() for o in objects.values()})==1,
            "geometry_uv_sha256":geom_hash(mesh),"vertices":len(mesh.vertices),"faces":len(mesh.polygons),
            "uv_layers":[l.name for l in mesh.uv_layers],"baked":bake_report,
            "high_poly_sculpt":False,"physical_displacement":False,
            "scope":"One shared L-section mesh; no changes applied to the Witness Core"}
    (ROOT/"sample-report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")

def render(p,draft=False):
    scene=bpy.context.scene;study.gpu()
    objects={key:bpy.data.objects[key+" "+p["variants"][key]["name"]] for key in ("B","C")}
    objects["A"]=bpy.data.objects["A baseline"]
    output=Path(tempfile.gettempdir())/"librecosta-r1c2-draft" if draft else ROOT/"previews"
    output.mkdir(exist_ok=True)
    hashes={k:geom_hash(o.data) for k,o in objects.items()}
    assert len(set(hashes.values()))==1
    manifest={"blender":bpy.app.version_string,"renderer":"Cycles OptiX / fixed AgX",
              "same_shared_mesh_geometry_and_UV":hashes,"shots":[]}
    for shot in ("medium","close"):
        camera=bpy.data.objects["Sample "+shot.title()]
        for key in ("A","B","C"):
            for k,obj in objects.items():obj.hide_render=k!=key;obj.hide_set(k!=key)
            scene.camera=camera;scene.render.resolution_x,scene.render.resolution_y=([800,600] if draft else p["render"][shot+"_size"])
            scene.cycles.samples=32 if draft else p["render"]["samples"]
            scene.render.image_settings.media_type="IMAGE";scene.render.image_settings.file_format="PNG"
            scene.render.filepath=str(output/(key+"-"+shot+".png"))
            started=time.perf_counter();bpy.ops.render.render(write_still=True)
            manifest["shots"].append({"file":key+"-"+shot+".png","camera":camera.name,
                "camera_matrix":[list(row) for row in camera.matrix_world],"ortho_scale":camera.data.ortho_scale,
                "resolution":[scene.render.resolution_x,scene.render.resolution_y],
                "exposure":scene.view_settings.exposure,"samples":scene.cycles.samples,
                "seconds":time.perf_counter()-started})
            print("SAMPLE",key,shot,"DONE",flush=True)
    (output/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--draft",action="store_true")
    parser.add_argument("--render-only",action="store_true");parser.add_argument("--no-bake",action="store_true")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    p=settings()
    if not args.render_only:build(p,do_bake=not args.no_bake)
    render(p,draft=args.draft)
