"""Verify sample-only scope, real maps, GLB textures and optional roundtrip views."""
import hashlib,json,struct,sys,tempfile
from pathlib import Path
sys.dont_write_bytecode=True
import bpy,bmesh
import numpy as np
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
import samples
import study

def glb_json(path):
    data=path.read_bytes();length,kind=struct.unpack_from("<II",data,12)
    assert kind==0x4E4F534A
    return json.loads(data[20:20+length])

def point_set(obj):
    return {tuple(round(v,5) for v in (obj.matrix_world @ vertex.co)) for vertex in obj.data.vertices}

def uv_coverage(mesh,size):
    """Pixel-center UV coverage, excluding empty atlas and dilation margins."""
    mesh.calc_loop_triangles()
    uv=mesh.uv_layers.active.data
    coverage=np.zeros((size,size),dtype=bool)
    for tri in mesh.loop_triangles:
        p=np.array([list(uv[i].uv) for i in tri.loops])*size
        lo=np.maximum(np.floor(p.min(axis=0)).astype(int),0)
        hi=np.minimum(np.ceil(p.max(axis=0)).astype(int),size)
        if np.any(hi<=lo):continue
        x,y=np.meshgrid(np.arange(lo[0],hi[0])+.5,np.arange(lo[1],hi[1])+.5)
        edges=[]
        for a,b in zip(p,np.roll(p,-1,axis=0)):
            edges.append((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]))
        inside=(np.minimum.reduce(edges)>1e-5)|(np.maximum.reduce(edges)<-1e-5)
        coverage[lo[1]:hi[1],lo[0]:hi[0]]|=inside
    return coverage.ravel()

def verify():
    if not bpy.app.background:raise RuntimeError("Background process only")
    path=ROOT/"surface-samples.blend"
    bpy.ops.wm.open_mainfile(filepath=str(path))
    p=samples.settings();scene=bpy.context.scene
    assert scene["sample_parameter_hash"]==study.digest(p)
    source=ROOT.parent/"r1-c"/"witness-core-materials.blend"
    audit=json.loads((ROOT/"r1-c-audit.json").read_text(encoding="utf-8"))
    assert samples.sha(source)==audit["source_sha256"]==scene["source_r1c_sha256"]
    objects={"A":bpy.data.objects["A baseline"]}
    objects.update({k:bpy.data.objects[k+" "+p["variants"][k]["name"]] for k in ("B","C")})
    shared=len({o.data.as_pointer() for o in objects.values()})==1
    mesh=objects["A"].data
    bm=bmesh.new();bm.from_mesh(mesh)
    closed=all(e.is_manifold and e.is_contiguous for e in bm.edges);volume=bm.calc_volume(signed=True);bm.free()
    assert shared and closed and volume>0 and len(mesh.uv_layers)==1
    report={"source_r1c_unchanged":True,"blender":bpy.app.version_string,
            "sample_blend_sha256":samples.sha(path),"sample_parameters_sha256":study.digest(p),
            "shared_identical_mesh":shared,"geometry_and_uv_sha256":samples.geom_hash(mesh),
            "closed_manifold":closed,"volume":volume,
            "high_poly_sculpt":False,"physical_displacement":False,"textures":{},"glb":{}}
    covered=uv_coverage(mesh,p["atlas_size"])
    report["covered_uv_pixel_count"]=int(covered.sum())
    for key in ("B","C"):
        imgs={ch:bpy.data.images[key+"_"+ch] for ch in ("basecolor","roughness","normal")}
        arrays={}
        for ch,im in imgs.items():
            assert Path(bpy.path.abspath(im.filepath)).is_file() and list(im.size)==[p["atlas_size"]]*2
            values=np.empty(len(im.pixels),dtype=np.float32);im.pixels.foreach_get(values)
            arrays[ch]=values.reshape((-1,4))
        mask=covered&(arrays["normal"][:,2]>.8)
        stats={ch:{"file":"textures/"+key+"-"+ch+".png","size":list(im.size),
                   "sha256":samples.sha(Path(bpy.path.abspath(im.filepath))),
                   "valid_surface_min":arrays[ch][mask,:3].min(axis=0).tolist(),
                   "valid_surface_max":arrays[ch][mask,:3].max(axis=0).tolist(),
                   "valid_surface_std":arrays[ch][mask,:3].std(axis=0).tolist()}
               for ch,im in imgs.items()}
        assert max(stats["normal"]["valid_surface_std"][:2])>.005
        assert stats["roughness"]["valid_surface_std"][0]>.01
        report["textures"][key]=stats
    directory=ROOT/"exports";directory.mkdir(exist_ok=True)
    for key,filename in (("B","B-fine-forged.glb"),("C","C-stylized-tooling.glb")):
        obj=objects[key]
        for o in objects.values():o.hide_render=True
        samples.active(obj)
        target=directory/filename
        # Materialize object-linked slots on an export-only mesh copy. Blender's
        # apply-modifiers export path otherwise substitutes the shared A slots.
        export_mesh=obj.data.copy()
        indices=[f.material_index for f in export_mesh.polygons]
        export_mesh.materials.clear()
        for slot in obj.material_slots:export_mesh.materials.append(slot.material)
        for f,index in zip(export_mesh.polygons,indices):f.material_index=index
        export_obj=bpy.data.objects.new(key+" export coupon",export_mesh)
        scene.collection.objects.link(export_obj);export_obj.matrix_world=obj.matrix_world.copy()
        samples.active(export_obj)
        triangulate=export_obj.modifiers.new("Export-only triangulation for tangent basis","TRIANGULATE")
        if hasattr(triangulate,"keep_custom_normals"):triangulate.keep_custom_normals=True
        bpy.ops.object.modifier_apply(modifier=triangulate.name)
        bpy.ops.export_scene.gltf(filepath=str(target),export_format="GLB",use_selection=True,
            export_animations=False,export_normals=True,export_tangents=True,
            export_texcoords=True,export_materials="EXPORT",export_apply=False)
        bpy.data.objects.remove(export_obj,do_unlink=True)
        if export_mesh.users==0:bpy.data.meshes.remove(export_mesh)
        gltf=glb_json(target)
        mats=gltf["materials"]
        checks={
            "embedded_images":len(gltf.get("images",[]))>=3 and all("bufferView" in x for x in gltf["images"]),
            "basecolor_images":all("baseColorTexture" in m["pbrMetallicRoughness"] for m in mats),
            "roughness_images":all("metallicRoughnessTexture" in m["pbrMetallicRoughness"] for m in mats),
            "normal_images":all("normalTexture" in m for m in mats),
            "uv_and_normals":all("TEXCOORD_0" in prim["attributes"] and "NORMAL" in prim["attributes"]
                                  for m in gltf["meshes"] for prim in m["primitives"]),
            "explicit_tangents":all("TANGENT" in prim["attributes"]
                                   for m in gltf["meshes"] for prim in m["primitives"]),
        }
        original_points=point_set(obj)
        bpy.ops.object.select_all(action="DESELECT")
        bpy.ops.import_scene.gltf(filepath=str(target))
        imported=[o for o in bpy.context.selected_objects if o.type=="MESH"]
        imported_points=set().union(*(point_set(o) for o in imported))
        checks["roundtrip_positions_within_1e5_quantization"]=imported_points==original_points
        assert all(checks.values()),checks
        for o in objects.values():o.hide_render=True
        for o in imported:o.hide_render=False
        scene.camera=bpy.data.objects["Sample Medium"]
        scene.render.resolution_x,scene.render.resolution_y=800,600
        scene.cycles.samples=32;study.gpu()
        scene.render.filepath=str(Path(tempfile.gettempdir())/("librecosta-r1c2-"+key+"-glb-roundtrip.png"))
        bpy.ops.render.render(write_still=True)
        for o in imported:bpy.data.objects.remove(o,do_unlink=True)
        report["glb"][key]={"file":"exports/"+filename,"sha256":samples.sha(target),
                            "image_count":len(gltf["images"]),"material_count":len(mats),"checks":checks}
    report["pass"]=True
    (ROOT/"sample-verification.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print("SAMPLE UV MAPS + EMBEDDED GLB + ROUNDTRIP VERIFICATION PASS",flush=True)
if __name__=="__main__":
    try:verify()
    except Exception as error:
        (ROOT/"sample-verification.json").write_text(json.dumps({"pass":False,"error":repr(error)},indent=2)+"\n",encoding="utf-8")
        raise
