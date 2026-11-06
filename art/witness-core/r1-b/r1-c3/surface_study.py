"""R1-C3: real dense geometry -> selected-to-active low-poly UV bakes.

Only operates in an isolated Blender background process. Never touches live Blender
or writes any earlier revision. No random/Voronoi/noise height or damage fields.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import tempfile
import time
import struct
import zlib

sys.dont_write_bytecode = True
import bpy
import bmesh
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "r1-c"))
import study
sys.path.insert(0, str(ROOT.parent))
from build import apply_bevel


def params():
    return json.loads((ROOT / "parameters.json").read_text(encoding="utf-8"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.hide_render = False
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def mesh_hash(mesh):
    return study.digest({"vertices": [list(v.co) for v in mesh.vertices],
                         "faces": [list(f.vertices) for f in mesh.polygons],
                         "uv": [list(v.uv) for v in mesh.uv_layers.active.data] if mesh.uv_layers else []})


def outline(p):
    q = p["coupon"]
    L, H, W = (q[k] for k in ("length", "height", "beam_width"))
    return [(x - L / 2, z - H / 2) for x, z in
            ((0, 0), (L, 0), (L, H), (L - W, H), (L - W, W), (0, W))]


def normals(obj, low=False):
    for f in obj.data.polygons:
        f.use_smooth = True
    if low:
        active(obj)
        mod = obj.modifiers.new("Precise weighted bevel normals", "WEIGHTED_NORMAL")
        mod.weight = 50
        bpy.ops.object.modifier_apply(modifier=mod.name)
        ns = [v.vector.copy() for v in obj.data.corner_normals]
        for f in obj.data.polygons:
            if max(abs(v) for v in f.normal) > .99999:
                for i in f.loop_indices:
                    ns[i] = f.normal.copy()
        obj.data.normals_split_custom_set(ns)


def face_role(f):
    n, c = f.normal, f.center
    if max(abs(v) for v in n) < .9999:
        return 2  # protected precision bevel
    if (n.x < -.9 and c.x > 0) or n.z > .9:
        return 1  # inner walls AND top cut/end surface
    return 0


def low_mesh(p, collection):
    D = p["coupon"]["depth"]
    poly = outline(p)
    vertices = [(x, y, z) for y in (-D / 2, D / 2) for x, z in poly]
    faces = [tuple(range(6)), tuple(reversed(range(6, 12)))]
    faces += [(i, (i + 1) % 6, (i + 1) % 6 + 6, i + 6) for i in range(6)]
    mesh = bpy.data.meshes.new("Shared animation-ready coupon")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    bm = bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh); bm.free()
    obj = bpy.data.objects.new("A Low", mesh); collection.objects.link(obj)
    active(obj)
    apply_bevel(obj, p["coupon"]["bevel"], p["coupon"]["bevel_segments"])
    mesh = obj.data
    for f in mesh.polygons:
        f.material_index = face_role(f)
    normals(obj, low=True)
    active(obj); bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.025)
    bpy.ops.object.mode_set(mode="OBJECT")
    triangulate=obj.modifiers.new("Explicit bake tangent triangulation","TRIANGULATE")
    if hasattr(triangulate,"keep_custom_normals"):triangulate.keep_custom_normals=True
    bpy.ops.object.modifier_apply(modifier=triangulate.name)
    return obj


def linspace_breaks(breaks, step):
    result = []
    for a, b in zip(breaks, breaks[1:]):
        # Keep the first/last 0.03 strip clear so the 0.012 bevel never crosses
        # a neighbouring dense coplanar edge or gets clamped to the grid step.
        pad = min(.03, (b-a)/4)
        result.append(a)
        result.extend(np.linspace(a+pad, b-pad, math.ceil((b-a-2*pad)/step)+1).tolist())
    result.append(breaks[-1])
    return result


def dense_mesh(p):
    """Welded planar quad patches. Dense depth supports actual finishing cuts."""
    q, h = p["coupon"], p["high_poly"]
    L, H, W, D = [q[k] for k in ("length", "height", "beam_width", "depth")]
    xs = linspace_breaks([-L / 2, L / 2 - W, L / 2], h["xz_grid_step_max"])
    zs = linspace_breaks([-H / 2, -H / 2 + W, H / 2], h["xz_grid_step_max"])
    ys = linspace_breaks([-D / 2, D / 2], h["depth_grid_step_max"])
    verts, faces, lookup = [], [], {}

    def index(v):
        key = tuple(round(t, 9) for t in v)
        if key not in lookup:
            lookup[key] = len(verts); verts.append(v)
        return lookup[key]

    def quad(points):
        faces.append(tuple(index(v) for v in points))

    # L caps with regular grids; skip open quadrant.
    for y in (-D / 2, D / 2):
        for x0, x1 in zip(xs, xs[1:]):
            for z0, z1 in zip(zs, zs[1:]):
                if x1 <= L / 2 - W + 1e-8 and z0 >= -H / 2 + W - 1e-8:
                    continue
                quad([(x0,y,z0),(x1,y,z0),(x1,y,z1),(x0,y,z1)])
    poly = outline(p)
    for a, b in zip(poly, poly[1:] + poly[:1]):
        axis = 0 if a[0] != b[0] else 1
        values = xs if axis == 0 else zs
        values = [t for t in values if min(a[axis],b[axis])-1e-8 <= t <= max(a[axis],b[axis])+1e-8]
        for u0, u1 in zip(values, values[1:]):
            v0 = (u0,a[1]) if axis==0 else (a[0],u0)
            v1 = (u1,a[1]) if axis==0 else (a[0],u1)
            for y0,y1 in zip(ys,ys[1:]):
                quad([(v0[0],y0,v0[1]),(v1[0],y0,v1[1]),(v1[0],y1,v1[1]),(v0[0],y1,v0[1])])
    mesh = bpy.data.meshes.new("Real dense surface lattice")
    mesh.from_pydata(verts, [], faces); mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    return mesh


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x*x*(3-2*x)


def sculpt_vertices(obj, p, machined):
    """Real shape editing: continuous broad planes and regular finish cuts.

    Unlike a crater field, every body patch is a smooth low-frequency control
    surface. Boundary masks protect all bevels and silhouette. No random input.
    """
    mesh = obj.data; q=p["coupon"]; h=p["high_poly"]
    count=len(mesh.vertices)
    points=np.empty(count*3,dtype=np.float32);mesh.vertices.foreach_get("co",points)
    points=points.reshape((-1,3));before=points.copy()
    x,y,z=points.T
    D=q["depth"]; poly=outline(p)
    eps=2e-6
    # Cap faces: distance to the true L boundary, including concave inner corner.
    d=np.full(count,np.inf)
    for a,b in zip(poly,poly[1:]+poly[:1]):
        av=np.array(a);v=np.array(b)-av
        t=np.clip(((x-a[0])*v[0]+(z-a[1])*v[1])/np.dot(v,v),0,1)
        dist=np.sqrt((x-a[0]-t*v[0])**2+(z-a[1]-t*v[1])**2)
        d=np.minimum(d,dist)
    cap=np.abs(np.abs(y)-D/2)<eps
    fade=smoothstep((d-.015)/h["edge_protection_width"])
    # Three intentionally broad, elongated forging sweeps, not pockmarks.
    field=(.42*np.sin(2*math.pi*(.62*x+.12*z)+.3)
           +.32*np.cos(2*math.pi*(.16*x+1.05*z)+1.0)
           +.24*np.sin(2*math.pi*(1.85*x-.28*z)+.6))
    depth=h["forging_depth_scale"]*field*fade
    points[cap,1]-=np.sign(y[cap])*depth[cap]
    for edge,(a,b) in enumerate(zip(poly,poly[1:]+poly[:1])):
        v=np.array(b)-np.array(a);length=np.linalg.norm(v)
        tangent=v/length;normal=np.array([tangent[1],-tangent[0]])
        perpendicular=(x-a[0])*normal[0]+(z-a[1])*normal[1]
        u=(x-a[0])*tangent[0]+(z-a[1])*tangent[1]
        mask=(np.abs(perpendicular)<eps)&(u>0)&(u<length)&~cap
        fade=smoothstep((np.minimum(u,length-u)-.015)/h["edge_protection_width"])
        fade*=smoothstep((D/2-np.abs(y)-.015)/h["edge_protection_width"])
        precision=edge in (2,3,4)  # top end + inner vertical + inner ledge
        if precision and machined:
            pitch=h["machining_pitch"]
            cuts=.5+.5*np.cos(2*math.pi*y/pitch)
            depth=(h["machining_finish_depth"]+h["machining_peak_to_valley"]*cuts)*fade
        else:
            f=(.42*np.sin(2*math.pi*(.77*u+.18*y)+.4)
               +.32*np.cos(2*math.pi*(.22*u+1.1*y)+1.1)
               +.24*np.sin(2*math.pi*(1.7*u-.31*y)+.8))
            depth=h["forging_depth_scale"]*(.45 if precision else .75)*f*fade
        points[mask,0]-=normal[0]*depth[mask]
        points[mask,2]-=normal[1]*depth[mask]
    # Explicitly lock bevel vertices as well as the analytic fade. At the L's
    # concave corner the diagonal distance can exceed the scalar protection band.
    protected=list({v for face in mesh.polygons if face.material_index==2 for v in face.vertices})
    points[protected]=before[protected]
    delta=np.linalg.norm(points-before,axis=1)
    # Keep undeformed coordinates as a point attribute, independent of shading.
    nominal=mesh.attributes.new("nominal_position",type="FLOAT_VECTOR",domain="POINT")
    nominal.data.foreach_set("vector",before.ravel())
    directions=[tuple(round(v) for v in f.normal) if max(abs(v) for v in f.normal)>.9999 else None for f in mesh.polygons]
    mesh.vertices.foreach_set("co",points.ravel());mesh.update()
    for face in mesh.polygons:face.use_smooth=True
    # Smooth the forged plane itself, while preserving precise bevel transitions.
    # Neighbouring bevel faces must not bend the normals of the planar region.
    ns=[n.vector.copy() for n in mesh.corner_normals]
    for group in set(directions)-{None}:
        sums=np.zeros((count,3),dtype=np.float64)
        face_indices=[i for i,g in enumerate(directions) if g==group]
        for i in face_indices:
            f=mesh.polygons[i]
            for v in f.vertices:sums[v]+=np.array(f.normal)*f.area
        lengths=np.linalg.norm(sums,axis=1)
        sums/=np.maximum(lengths[:,None],1e-20)
        for i in face_indices:
            f=mesh.polygons[i]
            for loop in f.loop_indices:ns[loop]=sums[mesh.loops[loop].vertex_index]
    mesh.normals_split_custom_set(ns)
    return {"vertices":count,"faces":len(mesh.polygons),"triangles":sum(len(f.vertices)-2 for f in mesh.polygons),
            "modified_vertices":int((delta>1e-7).sum()),"maximum_absolute_shift":float(delta.max()),
            "rms_shift":float(np.sqrt(np.mean(delta**2))),"displacement_exclusively_inward":False,
            "shader_bump_or_displacement":False}


def math_node(n,l,op,a,b=None):
    node=n.new("ShaderNodeMath");node.operation=op
    for i,value in enumerate([a] if b is None else [a,b]):
        if isinstance(value,(float,int)):node.inputs[i].default_value=value
        else:l.new(value,node.inputs[i])
    return node.outputs[0]


def material_sources(key,p):
    mats=[]
    for role in ("Forged body","Precision finish","Protected bevel"):
        mat,n,l,bs=study.material(key+" source / "+role);mat.use_fake_user=True
        geo=n.new("ShaderNodeNewGeometry");sep=n.new("ShaderNodeSeparateXYZ")
        l.new(geo.outputs["Position"],sep.inputs[0]);x,y,z=[sep.outputs[k] for k in ("X","Y","Z")]
        def op(oper,a,b=None):return math_node(n,l,oper,a,b)
        phase=op("ADD",op("MULTIPLY",x,2.1),op("MULTIPLY",z,1.3))
        field=op("ADD",.5,op("MULTIPLY",op("SINE",phase),.25))
        field=op("ADD",field,op("MULTIPLY",op("SINE",op("ADD",op("MULTIPLY",x,5.5),op("MULTIPLY",y,-3.2))),.12))
        aged=key=="C"
        if role=="Forged body" or (key=="A" and role=="Precision finish"):
            colors=([[.039,.042,.044,1],[.052,.055,.058,1]] if aged else [[.044,.047,.049,1],[.049,.052,.055,1]])
            color=study.ramp(n,l,field,colors,(-100,260));l.new(color,bs.inputs["Base Color"])
            rough=study.ramp(n,l,field,[.45,.55] if aged else [.44,.49],(-100,80))
            l.new(rough,bs.inputs["Roughness"]);bs.inputs["Metallic"].default_value=.96
        else:
            bs.inputs["Base Color"].default_value=(.085,.094,.100,1)
            bs.inputs["Metallic"].default_value=1
            pitch=p["high_poly"]["machining_pitch"]
            bands=op("ADD",.5,op("MULTIPLY",op("COSINE",op("MULTIPLY",y,2*math.pi/pitch)),.5))
            rough=study.ramp(n,l,bands,[.30,.37] if key!="A" else [.38,.40],(-100,80))
            l.new(rough,bs.inputs["Roughness"])
            if aged:
                color=study.ramp(n,l,field,[[.075,.082,.087,1],[.095,.103,.109,1]],(-100,260))
                l.new(color,bs.inputs["Base Color"])
        if role=="Protected bevel":
            for link in list(bs.inputs["Base Color"].links):l.remove(link)
            bs.inputs["Base Color"].default_value=(.080,.086,.090,1)
            for link in list(bs.inputs["Roughness"].links):l.remove(link)
            bs.inputs["Roughness"].default_value=.35
            if aged:
                color=study.ramp(n,l,field,[[.083,.090,.095,1],[.102,.109,.115,1]],(-100,260))
                l.new(color,bs.inputs["Base Color"])
                rough=study.ramp(n,l,field,[.31,.35],(-100,80));l.new(rough,bs.inputs["Roughness"])
        mats.append(mat)
    return mats


def slots(obj,mats):
    for slot,mat in zip(obj.material_slots,mats):
        slot.link="OBJECT";slot.material=mat


def proof_material(p):
    name="C3 geometry only - no maps or bump"
    if name in bpy.data.materials:mat=bpy.data.materials[name]
    else:
        mat,_,_,bs=study.material(name)
        bs.inputs["Base Color"].default_value=(.22,.23,.24,1)
        bs.inputs["Metallic"].default_value=p["geometry_proof"]["metallic"]
        bs.inputs["Roughness"].default_value=p["geometry_proof"]["roughness"]
    mat.use_fake_user=True
    return mat


def objects(kind):
    return {key:bpy.data.objects[key+" "+kind] for key in "ABC"}


def only_visible(obj):
    for o in list(objects("Low").values())+list(objects("High").values()):
        o.hide_set(o!=obj);o.hide_render=o!=obj
    obj.hide_render=False;obj.hide_set(False)


def save():
    for image in bpy.data.images:
        if image.filepath_raw and str(ROOT/"textures") in image.filepath_raw:
            image.filepath_raw="//textures/"+Path(image.filepath_raw).name
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"surface-language.blend"),compress=True,relative_remap=False)


def save_linear_png16(image,path,rgb):
    """Lossless 16-bit data PNG, no display transform or gamma manipulation.

    Blender float bake buffers are bottom-up. PNG rows are top-down. Write raw
    numerical channels, then reload the actual file used by the low-poly render.
    """
    width,height=image.size
    data=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(data)
    data=data.reshape((height,width,4))[::-1,:,:3 if rgb else 1]
    data=np.rint(np.clip(data,0,1)*65535).astype(">u2")
    def chunk(kind,payload):
        return struct.pack(">I",len(payload))+kind+payload+struct.pack(">I",zlib.crc32(kind+payload)&0xffffffff)
    raw=b"".join(b"\x00"+row.tobytes() for row in data)
    header=struct.pack(">IIBBBBB",width,height,16,2 if rgb else 0,0,0,0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",header)+chunk(b"IDAT",zlib.compress(raw,6))+chunk(b"IEND",b""))


def build(p):
    if not bpy.app.background or bpy.data.filepath:raise RuntimeError("New factory background process required")
    (ROOT/"verification.json").unlink(missing_ok=True)
    source=ROOT.parent/"r1-c"/"witness-core-materials.blend"
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene=bpy.context.scene;scene.name="R1-C3 genuine high-poly surface study"
    for obj in list(bpy.data.collections["WitnessCore"].objects):bpy.data.objects.remove(obj,do_unlink=True)
    collection=bpy.data.collections.new("R1-C3 Sample Only");scene.collection.children.link(collection)
    low=low_mesh(p,collection)
    sources={k:material_sources(k,p) for k in "ABC"}
    for mat in sources["A"]:low.data.materials.append(mat)
    # Set role indices after slots exist (Blender can clamp invalid material indices).
    for face in low.data.polygons:face.material_index=face_role(face)
    for key in "BC":
        o=bpy.data.objects.new(key+" Low",low.data);collection.objects.link(o)
    template=bpy.data.objects.new("Dense template",dense_mesh(p));collection.objects.link(template)
    # Angle-only bevel; thousands of coplanar grid edges are left untouched.
    active(template);apply_bevel(template,p["coupon"]["bevel"],p["coupon"]["bevel_segments"])
    # The protected 0.03 boundary cells allow the same 0.012 bevel as low poly.
    for mat in sources["A"]:template.data.materials.append(mat)
    for face in template.data.polygons:face.material_index=face_role(face)
    stats={}
    for key in "AB":
        o=bpy.data.objects.new(key+" High",template.data.copy());collection.objects.link(o)
        stats[key]=sculpt_vertices(o,p,machined=key=="B")
    other=bpy.data.objects.new("C High",bpy.data.objects["B High"].data);collection.objects.link(other)
    bpy.data.objects.remove(template,do_unlink=True)
    for kind in ("Low","High"):
        for k,obj in objects(kind).items():slots(obj,sources[k])
    floor=bpy.data.objects["Studio ground - preview only"];floor.location.z=-1.25
    rig=bpy.data.collections["R1-C Studio"]
    lighting=p["lighting"]
    scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value=lighting["world_strength"]
    for name,param in (("Key softbox","key_power"),("Precision fill","fill_power"),("Upper strip","upper_strip_power")):
        bpy.data.objects[name].data.energy=lighting[param]
    panel=bpy.data.objects["Face reflection panel"];fp=lighting["face_panel"]
    panel.location=fp["position"];study.aim(panel,fp["target"])
    panel.data.size,panel.data.size_y=fp["size"];panel.data.energy=fp["power"]
    for shot in ("medium","close","proof"):
        r=p["render"]
        study.study_camera("C3 "+shot,r[shot+"_camera"],r[shot+"_target"],r[shot+"_scale"],rig)
    proof_material(p)
    scene.camera=bpy.data.objects["C3 medium"]
    scene.render.resolution_x,scene.render.resolution_y=p["render"]["size"]
    scene.cycles.samples=p["render"]["samples"];scene.cycles.seed=p["render"]["seed"]
    scene.cycles.use_animated_seed=False;scene.render.use_persistent_data=True
    scene.view_settings.look=p["render"]["look"];scene.view_settings.exposure=p["render"]["exposure"]
    scene["parameters_sha256"]=study.digest(p)
    old={name:sha(path) for name,path in {
        "R1-B2":ROOT.parent/"witness-core.blend",
        "R1-C":source,"R1-C2":ROOT.parent/"r1-c2"/"surface-samples.blend"}.items()}
    scene["originals_sha256"]=json.dumps(old,sort_keys=True)
    scene["scope"]="L coupon only. No new full-core geometry, kinematics, emissive core or animation."
    stats["C"]={"shared_mesh_with":"B High","same_physical_geometry":True}
    stats["low"]={"vertices":len(low.data.vertices),"faces":len(low.data.polygons),"geometry_uv_sha256":mesh_hash(low.data)}
    stats["originals_sha256"]=old
    write_json(ROOT/"highpoly-report.json",stats)
    only_visible(objects("High")["B"]);active(objects("High")["B"])
    study.gpu();save()
    print("REAL HIGH-POLY BUILT",json.dumps(stats),flush=True)


def bake(p):
    scene=bpy.context.scene;study.gpu()
    scene.cycles.samples=p["bake"]["samples"]
    scene.render.bake.use_selected_to_active=True
    scene.render.bake.cage_extrusion=p["bake"]["cage_extrusion"]
    scene.render.bake.max_ray_distance=p["bake"]["max_ray_distance"]
    scene.render.bake.margin=p["bake"]["margin"]
    scene.render.bake.use_clear=True
    scene.world.light_settings.distance=p["bake"]["ao_distance"]
    (ROOT/"textures").mkdir(exist_ok=True)
    report={}
    for key in "ABC":
        hi,lo=objects("High")[key],objects("Low")[key]
        only_visible(hi);lo.hide_render=False;lo.hide_set(False)
        source=[slot.material for slot in hi.material_slots]
        # Unique bake-target materials per variant, shared low mesh remains intact.
        target=[]
        for i in range(3):
            m,n,l,bs=study.material(key+" bake target "+str(i));target.append(m)
        slots(lo,target);active(lo);hi.select_set(True)
        images={};report[key]={}
        for channel in ("basecolor","roughness","normal","ao"):
            image=bpy.data.images.new(key+"_"+channel,width=p["bake"]["size"],height=p["bake"]["size"],alpha=False,
                                      float_buffer=channel!="basecolor")
            image.colorspace_settings.name="sRGB" if channel=="basecolor" else "Non-Color"
            image.generated_color=(.5,.5,1,1) if channel=="normal" else (0,0,0,1)
            for mat in target:
                n=mat.node_tree.nodes
                for node in n:node.select=False
                tex=n.new("ShaderNodeTexImage");tex.image=image;tex.select=True;n.active=tex
            restore=[]
            if channel in ("basecolor","roughness"):
                for mat in source:
                    n,l=mat.node_tree.nodes,mat.node_tree.links
                    bs=next(x for x in n if x.type=="BSDF_PRINCIPLED")
                    out=next(x for x in n if x.type=="OUTPUT_MATERIAL")
                    emit=n.new("ShaderNodeEmission")
                    socket=bs.inputs["Base Color" if channel=="basecolor" else "Roughness"]
                    if socket.is_linked:l.new(socket.links[0].from_socket,emit.inputs["Color"])
                    else:
                        v=socket.default_value
                        emit.inputs["Color"].default_value=list(v) if hasattr(v,"__len__") else (v,v,v,1)
                    l.new(emit.outputs[0],out.inputs["Surface"]);restore.append((mat,bs,out,emit))
            bpy.ops.object.bake(type={"normal":"NORMAL","ao":"AO"}.get(channel,"EMIT"),normal_space="TANGENT")
            for mat,bs,out,emit in restore:
                mat.node_tree.links.new(bs.outputs[0],out.inputs["Surface"]);mat.node_tree.nodes.remove(emit)
            path=ROOT/"textures"/(key+"-"+channel+".png")
            if channel=="basecolor":
                # OpenImageIO on this Windows build intermittently fails to
                # overwrite Unicode output paths. Write in ASCII temp, then use
                # Python's Unicode-aware file I/O; never alter global settings.
                temp=Path(tempfile.gettempdir())/("librecosta-r1c3-"+key+"-basecolor.png")
                image.filepath_raw=str(temp);image.file_format="PNG";image.save()
                path.write_bytes(temp.read_bytes());temp.unlink()
            else:
                save_linear_png16(image,path,rgb=channel=="normal")
            bpy.data.images.remove(image)
            image=bpy.data.images.load(str(path),check_existing=False)
            image.name=key+"_"+channel
            image.colorspace_settings.name="sRGB" if channel=="basecolor" else "Non-Color"
            images[channel]=image
            report[key][channel]={"file":"textures/"+key+"-"+channel+".png","sha256":sha(path),
                                  "bits_per_channel":p["bake"]["basecolor_bits" if channel=="basecolor" else "data_maps_bits"]}
            for mat in target:
                for node in list(mat.node_tree.nodes):
                    if node.type=="TEX_IMAGE":mat.node_tree.nodes.remove(node)
            print("BAKED HIGH -> LOW",key,channel,flush=True)
        baked=[]
        for i,role in enumerate(("forged","precision","bevel")):
            m,n,l,bs=study.material(key+" baked / "+role)
            bs.inputs["Metallic"].default_value=.96 if i==0 or (key=="A" and i==1) else 1
            for ch,socket in (("basecolor","Base Color"),("roughness","Roughness")):
                tex=n.new("ShaderNodeTexImage");tex.image=images[ch];l.new(tex.outputs[0],bs.inputs[socket])
            tex=n.new("ShaderNodeTexImage");tex.image=images["normal"]
            convert=n.new("ShaderNodeNormalMap");convert.space="TANGENT"
            l.new(tex.outputs[0],convert.inputs["Color"]);l.new(convert.outputs[0],bs.inputs["Normal"])
            # AO is delivered separately, NOT multiplied into base color or GI twice.
            ao=n.new("ShaderNodeTexImage");ao.image=images["ao"];ao.label="AO delivery only - intentionally unconnected"
            baked.append(m)
        slots(lo,baked)
    scene.cycles.samples=p["render"]["samples"]
    scene["baked_from_real_high_poly"]=True
    write_json(ROOT/"bake-report.json",report)
    only_visible(objects("Low")["B"]);active(objects("Low")["B"]);save()


def render(p,draft=False,high_only=False):
    scene=bpy.context.scene;study.gpu()
    if scene["parameters_sha256"]!=study.digest(p):raise RuntimeError("Rebuild before rendering changed parameters")
    proof_material(p)
    # Clean the isolated review copy, retaining only the three useful cameras.
    for obj in list(scene.objects):
        if obj.type=="CAMERA" and not obj.name.startswith("C3 "):
            bpy.data.objects.remove(obj,do_unlink=True)
    scene.camera=bpy.data.objects["C3 medium"]
    only_visible(objects("Low" if scene.get("baked_from_real_high_poly") else "High")["B"])
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=="VIEW_3D":
                area.spaces.active.region_3d.view_perspective="CAMERA"
                area.spaces.active.shading.type="MATERIAL"
                area.spaces.active.shading.use_scene_lights=True
                area.spaces.active.shading.use_scene_world=True
    save()
    out=(Path(tempfile.gettempdir())/"librecosta-r1c3-draft") if draft else ROOT/"previews"
    out.mkdir(exist_ok=True)
    manifest={"blender":bpy.app.version_string,"engine":"Cycles OptiX",
              "source_blend_sha256":sha(ROOT/"surface-language.blend"),
              "parameters_sha256":study.digest(p),
              "shared_low_geometry_and_uv":{key:mesh_hash(obj.data) for key,obj in objects("Low").items()},"shots":[]}
    kinds=("High",) if high_only else ("High","Low")
    shots=[(key,kind,shot,False) for shot in ("medium","close") for kind in kinds for key in "ABC"]
    shots += [(key,"High","proof",True) for key in "ABC"]
    shots += [("A","Low","proof",True)]  # undetailed nominal low geometry control
    for key,kind,shot,clay in shots:
        obj=objects(kind)[key];only_visible(obj)
        energies={o.name:o.data.energy for o in scene.objects if o.type=="LIGHT"}
        world_bg=scene.world.node_tree.nodes.get("Background")
        world_strength=world_bg.inputs["Strength"].default_value
        if clay:
            for o in scene.objects:
                if o.type=="LIGHT":o.data.energy=200 if o.name=="Face reflection panel" else (18 if o.name=="Precision fill" else 0)
            world_bg.inputs["Strength"].default_value=.035
        scene.view_layers[0].material_override=bpy.data.materials["C3 geometry only - no maps or bump"] if clay else None
        scene.camera=bpy.data.objects["C3 "+shot]
        scene.render.resolution_x,scene.render.resolution_y=(960,720) if draft else p["render"]["size"]
        scene.cycles.samples=32 if draft else p["render"]["samples"]
        scene.render.image_settings.media_type="IMAGE";scene.render.image_settings.file_format="PNG"
        filename=key+"-"+kind.lower()+"-"+("clay" if clay else shot)+".png"
        scene.render.filepath=str(out/filename)
        started=time.perf_counter();bpy.ops.render.render(write_still=True)
        manifest["shots"].append({"file":filename,"object":obj.name,"camera":scene.camera.name,
            "camera_matrix":[list(row) for row in scene.camera.matrix_world],"ortho_scale":scene.camera.data.ortho_scale,
            "exposure":scene.view_settings.exposure,"resolution":[scene.render.resolution_x,scene.render.resolution_y],
            "samples":scene.cycles.samples,"clay_override_no_maps":clay,
            "light_settings":{o.name:{"energy":o.data.energy,"matrix":[list(row) for row in o.matrix_world],
                                      "size":[o.data.size,o.data.size_y]} for o in scene.objects if o.type=="LIGHT"},
            "world_strength":world_bg.inputs["Strength"].default_value,
            "sha256":sha(Path(scene.render.filepath)),"seconds":time.perf_counter()-started})
        print("RENDERED",filename,flush=True)
        for name,energy in energies.items():bpy.data.objects[name].data.energy=energy
        world_bg.inputs["Strength"].default_value=world_strength
    scene.view_layers[0].material_override=None
    write_json(out/"manifest.json",manifest)


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--build",action="store_true")
    parser.add_argument("--bake",action="store_true")
    parser.add_argument("--render",action="store_true")
    parser.add_argument("--draft",action="store_true")
    parser.add_argument("--high-only",action="store_true")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    p=params()
    if args.build:build(p)
    else:
        if not bpy.app.background:raise RuntimeError("Background only")
        bpy.ops.wm.open_mainfile(filepath=str(ROOT/"surface-language.blend"))
    if args.bake:bake(p)
    if args.render:render(p,draft=args.draft,high_only=args.high_only)
