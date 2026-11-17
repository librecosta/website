"""Read the actual R1-C file and inspect a temporary unbaked GLB export."""
import json,struct,hashlib,sys,tempfile
from pathlib import Path
sys.dont_write_bytecode=True
import bpy
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent/"r1-c"/"witness-core-materials.blend"

def run():
    if not bpy.app.background or bpy.data.filepath:
        raise RuntimeError("New --background --factory-startup process only")
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    report={"source_sha256":hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            "blender_version":bpy.app.version_string,"materials":{},"meshes":{}}
    for name in ("Outer Monument Metal","Inner Precision Metal","Core Light Material"):
        mat=bpy.data.materials[name]
        bs=next(n for n in mat.node_tree.nodes if n.type=="BSDF_PRINCIPLED")
        report["materials"][name]={
            "nodes":[{"name":n.name,"type":n.bl_idname,
                      "inputs":{s.name:list(s.default_value) if hasattr(s.default_value,"__len__") else s.default_value
                                for s in n.inputs if hasattr(s,"default_value") and s.type in ("VALUE","RGBA","VECTOR") and not s.is_linked}}
                     for n in mat.node_tree.nodes],
            "links":[[l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name] for l in mat.node_tree.links],
            "roughness_is_linked":bs.inputs["Roughness"].is_linked,
            "normal_is_linked":bs.inputs["Normal"].is_linked,
            "image_texture_nodes":[n.name for n in mat.node_tree.nodes if n.type=="TEX_IMAGE"]}
    for name in ("RingA","RingB","RingC","Core"):
        obj=bpy.data.objects[name]
        assignments={}
        for face in obj.data.polygons:
            mat=obj.data.materials[face.material_index].name
            item=assignments.setdefault(mat,{"faces":0,"local_area":0})
            item["faces"]+=1;item["local_area"]+=face.area
        report["meshes"][name]={"vertices":len(obj.data.vertices),"polygons":len(obj.data.polygons),
            "uv_layers":[l.name for l in obj.data.uv_layers],"modifiers":[m.type for m in obj.modifiers],
            "materials":assignments}
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.data.collections["WitnessCore"].objects: obj.select_set(True)
    path=Path(tempfile.gettempdir())/"librecosta-r1c-unbaked-audit.glb"
    bpy.ops.export_scene.gltf(filepath=str(path),export_format="GLB",use_selection=True,
        export_animations=True,export_normals=True,export_texcoords=True,export_materials="EXPORT")
    data=path.read_bytes()
    length,kind=struct.unpack_from("<II",data,12)
    if kind!=0x4E4F534A:raise RuntimeError("Not a GLB JSON chunk")
    gltf=json.loads(data[20:20+length])
    report["actual_unbaked_glb"]={
        "temporary_file_only":True,"bytes":len(data),
        "images":gltf.get("images",[]),"textures":gltf.get("textures",[]),
        "materials":gltf.get("materials",[]),"extensions_used":gltf.get("extensionsUsed",[]),
        "animation_count":len(gltf.get("animations",[])),
        "mesh_primitives":[{"mesh":m.get("name"),"material":p.get("material"),"attributes":list(p["attributes"])}
                           for m in gltf["meshes"] for p in m["primitives"]]}
    (ROOT/"r1-c-audit.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print("R1-C ACTUAL FILE + TEMPORARY GLB AUDIT COMPLETE",flush=True)
if __name__=="__main__":run()
