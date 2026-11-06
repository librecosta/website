"""Independent saved-file checks: real relief, intact meshes, bakes and tangent fidelity."""
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode=True
import bpy
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
import surface_study as s


def coordinates(mesh,attribute=None):
    data=mesh.attributes[attribute].data if attribute else mesh.vertices
    result=np.empty(len(mesh.vertices)*3,dtype=np.float32)
    data.foreach_get("vector" if attribute else "co",result)
    return result.reshape((-1,3))


def health(obj):
    mesh=obj.data
    bm=bmesh.new();bm.from_mesh(mesh)
    result={"closed_manifold":all(e.is_manifold and e.is_contiguous for e in bm.edges),
            "positive_volume":bm.calc_volume(signed=True)>0,
            "volume":bm.calc_volume(signed=True),"loose_vertices":sum(not v.link_faces for v in bm.verts)}
    bm.free()
    result.update(vertices=len(mesh.vertices),faces=len(mesh.polygons),triangles=sum(len(f.vertices)-2 for f in mesh.polygons))
    assert result["closed_manifold"] and result["positive_volume"] and not result["loose_vertices"],result
    return result


def uv_mask(mesh,size):
    mesh.calc_loop_triangles();uv=mesh.uv_layers.active.data
    mask=np.zeros((size,size),dtype=bool)
    for tri in mesh.loop_triangles:
        p=np.array([list(uv[i].uv) for i in tri.loops])*size
        lo=np.maximum(np.floor(p.min(axis=0)).astype(int),0)
        hi=np.minimum(np.ceil(p.max(axis=0)).astype(int),size)
        if np.any(hi<=lo):continue
        x,y=np.meshgrid(np.arange(lo[0],hi[0])+.5,np.arange(lo[1],hi[1])+.5)
        edges=[(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]) for a,b in zip(p,np.roll(p,-1,axis=0))]
        inside=(np.minimum.reduce(edges)>1e-6)|(np.maximum.reduce(edges)<-1e-6)
        mask[lo[1]:hi[1],lo[0]:hi[0]]|=inside
    return mask


def bilinear(array,uv):
    h,w,_=array.shape
    px=np.clip(float(uv.x)*w-.5,0,w-1.001);py=np.clip(float(uv.y)*h-.5,0,h-1.001)
    x,y=int(px),int(py);a,b=px-x,py-y
    return ((1-a)*(1-b)*array[y,x]+a*(1-b)*array[y,x+1]+(1-a)*b*array[y+1,x]+a*b*array[y+1,x+1])[:3]


def normal_fidelity(low,high,image_array):
    """Ray-project deterministic low samples to high; compare actual corner normals
    against the decoded low-poly tangent normal map. Excludes tiny bevel faces.
    A sampled numerical check, not a claim of pixel-perfect or silhouette identity.
    """
    hm=high.data;lm=low.data
    hm.calc_loop_triangles();lm.calc_loop_triangles();lm.calc_tangents(uvmap=lm.uv_layers.active.name)
    triangles=list(hm.loop_triangles)
    verts=[v.co.copy() for v in hm.vertices]
    bvh=BVHTree.FromPolygons(verts,[t.vertices[:] for t in triangles],all_triangles=True)
    hns=[n.vector.copy() for n in hm.corner_normals]
    lns=[n.vector.copy() for n in lm.corner_normals]
    uvs=lm.uv_layers.active.data
    errors=[];misses=0
    weights=[(i/8,j/8,1-(i+j)/8) for i in range(1,7) for j in range(1,8-i)]
    for tri in lm.loop_triangles:
        face=lm.polygons[tri.polygon_index]
        if face.material_index==2 or face.area<.003 or max(abs(v) for v in face.normal)<.9999:continue
        for weights3 in weights:
            point=sum((lm.vertices[v].co*w for v,w in zip(tri.vertices,weights3)),Vector())
            normal=sum((lns[i]*w for i,w in zip(tri.loops,weights3)),Vector()).normalized()
            uv=sum((uvs[i].uv*w for i,w in zip(tri.loops,weights3)),Vector((0,0)))
            tangent=sum((lm.loops[i].tangent*w for i,w in zip(tri.loops,weights3)),Vector())
            tangent=(tangent-normal*tangent.dot(normal)).normalized()
            sign=lm.loops[tri.loops[0]].bitangent_sign
            bitangent=normal.cross(tangent)*sign
            hit,_,idx,_=bvh.ray_cast(point+normal*.015,-normal,.04)
            if hit is None:misses+=1;continue
            htri=triangles[idx];a,b,c=[hm.vertices[v].co for v in htri.vertices]
            v0,v1,v2=b-a,c-a,hit-a
            d00,d01,d11,d20,d21=v0.dot(v0),v0.dot(v1),v1.dot(v1),v2.dot(v0),v2.dot(v1)
            den=d00*d11-d01*d01
            v=(d11*d20-d01*d21)/den;w=(d00*d21-d01*d20)/den
            source_normal=sum((hns[i]*weight for i,weight in zip(htri.loops,(1-v-w,v,w))),Vector()).normalized()
            tex=bilinear(image_array,uv)*2-1
            decoded=(tangent*float(tex[0])+bitangent*float(tex[1])+normal*float(tex[2])).normalized()
            errors.append(math.degrees(math.acos(max(-1,min(1,source_normal.dot(decoded))))))
    stats={"sample_count":len(errors),"ray_misses":misses,
           "median_error_degrees":float(np.median(errors)),"p95_error_degrees":float(np.percentile(errors,95)),
           "maximum_error_degrees":float(max(errors)),"method":"Deterministic flat-face samples, BVH ray hit, interpolated high custom normals vs bilinear tangent-map decode"}
    assert len(errors)>100 and misses==0,stats
    assert stats["median_error_degrees"]<1.5 and stats["p95_error_degrees"]<4,stats
    return stats


def extract_profiles(high):
    mesh=high.data;pts=coordinates(mesh);nom=coordinates(mesh,"nominal_position")
    # Front forging section across the horizontal beam.
    cap=np.abs(nom[:,1]+.36)<1e-6
    z_values=nom[cap,2];z=float(z_values[np.argmin(abs(z_values+.54))])
    indices=np.where(cap&(abs(nom[:,2]-z)<1e-6))[0];indices=indices[np.argsort(nom[indices,0])]
    forging={"axis":"X","fixed_nominal_y":-.36,"fixed_nominal_z":z,
             "position_BU":nom[indices,0].tolist(),"normal_offset_BU":(-(pts[indices,1]-nom[indices,1])).tolist()}
    inner=abs(nom[:,2]+.18)<1e-6
    x_values=nom[inner,0];x=float(x_values[np.argmin(abs(x_values))])
    indices=np.where(inner&(abs(nom[:,0]-x)<1e-6))[0];indices=indices[np.argsort(nom[indices,1])]
    machining={"axis":"Y","fixed_nominal_x":x,"fixed_nominal_z":-.18,
               "position_BU":nom[indices,1].tolist(),"normal_offset_BU":(pts[indices,2]-nom[indices,2]).tolist()}
    return {"forging":forging,"inner_finish":machining}


def main():
    if not bpy.app.background:raise RuntimeError("New background process only")
    path=ROOT/"surface-language.blend";bpy.ops.wm.open_mainfile(filepath=str(path))
    scene=bpy.context.scene;p=s.params()
    assert scene["parameters_sha256"]==s.study.digest(p)
    assert scene.get("baked_from_real_high_poly")
    old=json.loads(scene["originals_sha256"])
    for key,source in {"R1-B2":ROOT.parent/"witness-core.blend","R1-C":ROOT.parent/"r1-c"/"witness-core-materials.blend",
                       "R1-C2":ROOT.parent/"r1-c2"/"surface-samples.blend"}.items():
        if key in old:assert s.sha(source)==old[key]
    high,low=s.objects("High"),s.objects("Low")
    assert len({o.data.as_pointer() for o in low.values()})==1
    assert high["B"].data==high["C"].data
    report={"blender":bpy.app.version_string,"source_blend_sha256":s.sha(path),"parameters_sha256":s.study.digest(p),
            "earlier_revisions_unchanged":True,"originals_sha256":old,"shared_low_geometry_and_uv":True,
            "B_and_C_share_high_geometry":True,"high":{},"low":health(low["A"]),"textures":{},"normal_bake_fidelity":{}}
    assert all(o.parent is None for o in [*high.values(),*low.values()])  # no replacement rig
    assert not any(o.animation_data for o in [*high.values(),*low.values()])
    report["coupon_only_no_animation_or_kinematic_changes"]=True
    profiles={}
    for key in "AB":
        mesh=high[key].data;pts=coordinates(mesh);nom=coordinates(mesh,"nominal_position")
        delta=np.linalg.norm(pts-nom,axis=1)
        result=health(high[key])
        result.update(maximum_vertex_shift=float(delta.max()),rms_vertex_shift=float(np.sqrt(np.mean(delta**2))),
                      nominal_bounds=[nom.min(axis=0).tolist(),nom.max(axis=0).tolist()],
                      actual_bounds=[pts.min(axis=0).tolist(),pts.max(axis=0).tolist()],
                      changed_vertices=int((delta>1e-7).sum()))
        bevel_vertices={v for f in mesh.polygons if f.material_index==2 for v in f.vertices}
        result["maximum_shift_of_protected_bevel_vertices"]=float(delta[list(bevel_vertices)].max())
        print("HIGH MESH CHECK",key,json.dumps(result),flush=True)
        assert delta.max()<p["high_poly"]["forging_depth_scale"]+1e-6
        assert result["maximum_shift_of_protected_bevel_vertices"]<1e-6
        assert result["changed_vertices"]>200000
        # No shader bump/displacement can masquerade as the dense physical relief.
        prohibited={"TEX_NOISE","TEX_VORONOI","BUMP","DISPLACEMENT","VECTOR_DISPLACEMENT"}
        nodes=[node.type for slot in high[key].material_slots for node in slot.material.node_tree.nodes]
        assert not (set(nodes)&prohibited),set(nodes)&prohibited
        result["no_noise_voronoi_bump_displacement_nodes"]=True
        report["high"][key]=result;profiles[key]=extract_profiles(high[key])
    cover=uv_mask(low["A"].data,p["bake"]["size"])
    report["covered_uv_texels"]=int(cover.sum())
    bake=json.loads((ROOT/"bake-report.json").read_text(encoding="utf-8"))
    for key in "ABC":
        imgs={}
        for channel in ("normal","roughness","ao","basecolor"):
            im=bpy.data.images[key+"_"+channel]
            source=Path(bpy.path.abspath(im.filepath))
            assert source.is_file() and list(im.size)==[p["bake"]["size"]]*2
            assert s.sha(source)==bake[key][channel]["sha256"]
            png_bits=source.read_bytes()[24]
            assert png_bits==p["bake"]["basecolor_bits" if channel=="basecolor" else "data_maps_bits"]
            pixels=np.empty(len(im.pixels),dtype=np.float32);im.pixels.foreach_get(pixels)
            array=pixels.reshape((p["bake"]["size"],p["bake"]["size"],4));imgs[channel]=array
            values=array[cover,:3]
            stats={"sha256":s.sha(source),"size":list(im.size),"png_bits_per_channel":png_bits,"colorspace":im.colorspace_settings.name,
                   "surface_min":values.min(axis=0).tolist(),"surface_max":values.max(axis=0).tolist(),"surface_std":values.std(axis=0).tolist()}
            report["textures"].setdefault(key,{})[channel]=stats
            if channel=="normal":assert max(stats["surface_std"][:2])>1e-4
            if channel=="roughness":assert stats["surface_std"][0]>.008
            if channel=="ao":assert stats["surface_max"][0]>.95 and .05<stats["surface_min"][0]<.92
        report["normal_bake_fidelity"][key]=normal_fidelity(low[key],high[key],imgs["normal"])
    # C adds no extra dents: its normal bake must agree with B, apart from sampling.
    b=bpy.data.images["B_normal"];c=bpy.data.images["C_normal"]
    bv=np.empty(len(b.pixels),np.float32);cv=np.empty(len(c.pixels),np.float32)
    b.pixels.foreach_get(bv);c.pixels.foreach_get(cv)
    report["B_C_normal_map_max_absolute_difference"]=float(np.max(abs(bv-cv)))
    assert report["B_C_normal_map_max_absolute_difference"]<.01
    s.write_json(ROOT/"surface-sections.json",profiles)
    report["pass"]=True;s.write_json(ROOT/"verification.json",report)
    print("HIGH POLY / UV BAKES / NORMAL FIDELITY PASS",json.dumps(report["normal_bake_fidelity"]),flush=True)


if __name__=="__main__":
    try:main()
    except Exception as error:
        s.write_json(ROOT/"verification.json",{"pass":False,"error":repr(error)})
        raise
