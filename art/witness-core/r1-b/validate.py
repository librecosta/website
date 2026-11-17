"""R1-B2 bounded-joint certificate and independent actual-mesh sampling.

The analytic certificate covers a specified joint box. BVH/winding samples are
a separate finite test, never a continuous-motion or arbitrary-rotation proof.
"""

import copy
import hashlib
import itertools
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from kinematics import (action_fcurves, angle_at, constraints, last_frame,
                        load_parameters, orientation_at, parameter_hash, require_safe_parameters)


def tree(vertices, triangles):
    return BVHTree.FromPolygons(vertices, triangles, all_triangles=True, epsilon=0.0)


def mesh_arrays(mesh):
    mesh.calc_loop_triangles()
    return [v.co.copy() for v in mesh.vertices], [tuple(t.vertices) for t in mesh.loop_triangles]


def contains_point(vertices, triangles, point):
    """Signed-solid-angle winding; resolve containment missed by surface BVH."""
    relative = [v-point for v in vertices]
    lengths = [v.length for v in relative]
    angles = []
    for ia, ib, ic in triangles:
        a, b, c = relative[ia], relative[ib], relative[ic]
        la, lb, lc = lengths[ia], lengths[ib], lengths[ic]
        if min(la, lb, lc) < 1e-8:
            raise ValueError("Containment probe on another surface vertex")
        angles.append(2*math.atan2(a.dot(b.cross(c)),
                      la*lb*lc+a.dot(b)*lc+b.dot(c)*la+c.dot(a)*lb))
    winding = abs(math.fsum(angles)/(4*math.pi))
    if winding < 0.0001:
        return False
    if abs(winding-1) < 0.0001:
        return True
    raise ValueError(f"Ambiguous solid-angle winding: {winding}")


def projected_triangle_hits_prism(vertices, tri, half):
    """Clip projected triangle to XZ square; handles degenerate projections."""
    polygon = [(vertices[i].x, vertices[i].z) for i in tri]
    for axis, sign in ((0, 1), (0, -1), (1, 1), (1, -1)):
        result = []
        for i, start in enumerate(polygon):
            stop = polygon[(i+1) % len(polygon)]
            da, db = sign*start[axis]-half, sign*stop[axis]-half
            if da <= 0:
                result.append(start)
            if (da <= 0) != (db <= 0):
                t = da/(da-db)
                result.append(tuple(a+t*(b-a) for a, b in zip(start, stop)))
        polygon = result
        if not polygon:
            return False
    return True


def topology(obj, expected_dimensions, expected_euler, hole, tolerance):
    vertices, triangles = mesh_arrays(obj.data)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    manifold = all(e.is_manifold and e.is_contiguous for e in bm.edges)
    volume = bm.calc_volume(signed=True)
    degenerate = sum(f.calc_area() < 1e-10 for f in bm.faces)
    bm.free()
    adjacency = {i: set() for i in range(len(vertices))}
    for e in obj.data.edges:
        a, b = e.vertices
        adjacency[a].add(b)
        adjacency[b].add(a)
    pending, components = set(adjacency), 0
    while pending:
        stack = [pending.pop()]
        components += 1
        while stack:
            for neighbor in adjacency[stack.pop()]:
                if neighbor in pending:
                    pending.remove(neighbor)
                    stack.append(neighbor)
    low = [min(v[i] for v in vertices) for i in range(3)]
    high = [max(v[i] for v in vertices) for i in range(3)]
    dimensions = [b-a for a, b in zip(low, high)]
    center = [(a+b)/2 for a, b in zip(low, high)]
    inside_box = all(abs(v[i]) <= expected_dimensions[i]/2+tolerance for v in vertices for i in range(3))
    bvh = tree(vertices, triangles)
    self_crossings = [(a, b) for a, b in bvh.overlap(bvh)
                      if a < b and not set(triangles[a]).intersection(triangles[b])]
    euler = len(vertices)-len(obj.data.edges)+len(obj.data.polygons)
    hole_ok = True
    hits = 0
    origin_outside = None
    if hole is not None:
        hits = sum(projected_triangle_hits_prism(vertices, t, hole-tolerance) for t in triangles)
        origin_outside = not contains_point(vertices, triangles, Vector((0, 0, 0)))
        hole_ok = hits == 0 and origin_outside
    result = {
        "geometry_sha256": hashlib.sha256(json.dumps({
            "vertices": [list(v) for v in vertices], "triangles": triangles},
            separators=(",", ":")).encode()).hexdigest(),
        "vertices": len(vertices), "triangles": len(triangles), "faces": len(obj.data.polygons),
        "components": components, "euler_characteristic": euler,
        "closed_consistently_oriented_manifold": manifold, "signed_volume": volume,
        "degenerate_faces": degenerate, "nonadjacent_self_surface_crossings": len(self_crossings),
        "local_AABB_min": low, "local_AABB_max": high, "local_dimensions_XYZ": dimensions,
        "expected_dimensions_XYZ": expected_dimensions, "local_AABB_center": center,
        "within_nominal_box": inside_box, "empty_prism_half_width": hole,
        "projected_triangles_inside_prism": hits, "origin_outside_ring_material": origin_outside,
        "empty_prism_verified": hole_ok,
        "pass": (manifold and volume > 0 and components == 1 and degenerate == 0
                 and euler == expected_euler and not self_crossings and inside_box and hole_ok
                 and max(abs(a-b) for a, b in zip(dimensions, expected_dimensions)) <= tolerance
                 and max(abs(v) for v in center) <= tolerance and not obj.modifiers),
    }
    return result, (vertices, triangles)


def box_arrays(side, offset=(0, 0, 0)):
    offset = Vector(offset)
    v = [Vector((x, y, z))+offset for x in (-side/2, side/2)
         for y in (-side/2, side/2) for z in (-side/2, side/2)]
    quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
             (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return v, [(q[0], q[1], q[2]) for q in quads]+[(q[0], q[2], q[3]) for q in quads]


def sensor_controls(p):
    av, at = box_arrays(2)
    bv, bt = box_arrays(2, (.8, .3, .2))
    cv, ct = box_arrays(.5)
    dv, dt = box_arrays(1, (4, 0, 0))
    a, b, c, d = [tree(v, t) for v, t in ((av, at), (bv, bt), (cv, ct), (dv, dt))]
    unsafe = copy.deepcopy(p)
    unsafe["rings"][1]["S"] = 3.5
    rejected = False
    try:
        require_safe_parameters(unsafe)
    except ValueError:
        rejected = True
    return {"crossing_detected": bool(a.overlap(b)),
            "containment_not_detected_by_surface_BVH": not bool(a.overlap(c)),
            "containment_detected_by_winding": contains_point(av, at, cv[0]),
            "separate_not_flagged": not a.overlap(d) and not contains_point(av, at, dv[0]),
            "unsafe_tight_nesting_rejected": rejected,
            "prism_triangle_inside_detected": projected_triangle_hits_prism(
                [Vector((0, 0, 0)), Vector((.1, 0, 0)), Vector((0, 0, .1))], (0, 1, 2), .5),
            "prism_triangle_crossing_detected": projected_triangle_hits_prism(
                [Vector((-2, 0, -.2)), Vector((2, 0, -.2)), Vector((0, 0, 2))], (0, 1, 2), .5),
            "prism_triangle_outside_rejected": not projected_triangle_hits_prism(
                [Vector((2, 0, 2)), Vector((3, 0, 2)), Vector((2, 0, 3))], (0, 1, 2), .5)}


def matrix_delta(a, b):
    return max(abs(a[r][c]-b[r][c]) for r in range(4) for c in range(4))


def quaternion_delta(a, b):
    cosine = abs(sum(x*y for x, y in zip(a, b)))/math.sqrt(sum(x*x for x in a)*sum(y*y for y in b))
    return math.degrees(2*math.acos(min(1, cosine)))


def grid_values(ring, step):
    lo, hi = ring["limits_degrees"]
    values = [lo+i*step for i in range(math.floor((hi-lo)/step)+1)]+[hi, 0]
    return sorted(set(values))


def _validate_scene(p, reopened):
    require_safe_parameters(p)
    scene, tol = bpy.context.scene, p["numeric_tolerance"]
    holes, pairs = constraints(p)
    report = {
        "schema_version": 2, "revision": "R1-B2", "blender_version": bpy.app.version_string,
        "source_file": Path(bpy.data.filepath).name,
        "source_sha256": hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
        "independent_source_reopen": reopened, "parameters_sha256": parameter_hash(p),
        "scene_parameter_hash_matches": scene.get("parameters_sha256") == parameter_hash(p),
        "numeric_tolerance": tol, "units": p["units"], "failures": [],
        "bounded_domain_certificate": {
            "method": "Serial Y->X->Z joint-box projection into verified empty square prisms",
            "joint_limits_degrees": {r["name"]: r["limits_degrees"] for r in p["rings"]},
            "domain": "Rigid meshes; zero offsets; unit scales; A(Y) -> B(X) -> C(Z) local single-axis serial hierarchy; stable Core",
            "empty_prism_formula": "h = S/2-W-bevel_width",
            "projection_formula": "P(a,d,L) = max[a*abs(cos(t))+d*abs(sin(t))], t in [-L,L]; includes atan(d/a) extrema",
            "proof": "Actual outer material is outside |x|<h AND |z|<h. Every point of an inner solid has |x|,|z|<=E in outer coordinates. Any outer material point has at least one coordinate with absolute value >=h; Euclidean pair distance >=h-E. Relative transforms follow the serial hierarchy. Actual inward bevel envelopes and empty prisms are independently verified.",
            "all_pairs": pairs,
            "minimum_gap_after_numeric_allowance": min(x["after_numeric_allowance"] for x in pairs),
            "clearance": p["clearance"],
            "arbitrary_independent_rotations_verified": False,
        },
        "sensor_controls": sensor_controls(p), "objects": {},
    }
    failures = report["failures"]
    names = [r["name"] for r in p["rings"]]+["Core"]
    meshes = {name: bpy.data.objects[name] for name in names}
    pivots = [bpy.data.objects[r["pivot"]] for r in p["rings"]]
    root = bpy.data.objects["WitnessCore"]
    arrays = {}
    for i, name in enumerate(names):
        dims = [p["core"]["side"]]*3 if name == "Core" else [p["rings"][i][k] for k in ("S", "D", "S")]
        result, arrays[name] = topology(meshes[name], dims, 2 if name == "Core" else 0, holes.get(name), tol)
        parent = "WitnessCore" if name == "Core" else p["rings"][i]["pivot"]
        result["parent"] = meshes[name].parent.name if meshes[name].parent else None
        result["parent_correct"] = result["parent"] == parent
        report["objects"][name] = result
        if not result["pass"] or not result["parent_correct"]:
            failures.append(f"Mesh topology/envelope/hierarchy failed: {name}")
    local = all(o.data.library is None and o.data.is_editable for o in meshes.values()) and not bpy.data.libraries
    inert = all(not o.animation_data and not o.constraints and
                matrix_delta(o.matrix_basis, Matrix.Identity(4)) <= tol for o in [root, *meshes.values()])
    origins = all(o.location.length <= tol and max(abs(x-1) for x in o.scale) <= tol
                  and matrix_delta(o.matrix_parent_inverse, Matrix.Identity(4)) <= tol
                  for o in [root, *pivots, *meshes.values()]) and root.parent is None
    serial = all(o.parent and o.parent.name == r["parent"] and o.rotation_mode == "QUATERNION"
                 and not o.constraints and not o.animation_data.drivers for o, r in zip(pivots, p["rings"]))
    actions = len({o.animation_data.action.as_pointer() for o in pivots}) == 3
    # All keys and all linear segments stay on the same quaternion great-circle
    # arc, with angles in (-90,90). Normalized linear interpolation stays on-axis
    # and cannot overshoot endpoint angles. Check every key, not only samples.
    single_axis_keys = True
    axis_errors, key_limits = {}, {}
    for pivot, r in zip(pivots, p["rings"]):
        curves = list(action_fcurves(pivot))
        if len(curves) != 4 or any(c.data_path != "rotation_quaternion" for c in curves):
            single_axis_keys = False
            continue
        errors, angles = [], []
        component = r["axis_local"].index(1)
        for frame in range(1, last_frame(p)+1):
            q = [next(c for c in curves if c.array_index == k).evaluate(frame) for k in range(4)]
            errors.append(max(abs(q[k+1]) for k in range(3) if k != component))
            angles.append(math.degrees(2*math.atan2(q[component+1], q[0])))
        axis_errors[r["name"]] = max(errors)
        key_limits[r["name"]] = [min(angles), max(angles)]
        lo, hi = r["limits_degrees"]
        single_axis_keys &= (max(errors) <= tol and min(angles) >= lo-tol and max(angles) <= hi+tol
                             and all(k.interpolation == "LINEAR" for c in curves for k in c.keyframe_points)
                             and all(not c.modifiers and not c.mute for c in curves)
                             and all(len(c.keyframe_points) == last_frame(p) for c in curves)
                             and all(abs(k.co.x-frame) <= tol for c in curves
                                     for frame, k in enumerate(c.keyframe_points, 1)))
    static = all(not o.data.shape_keys and not o.data.animation_data and not o.hide_render for o in meshes.values())
    hierarchy = {"serial_parents_correct": serial, "three_distinct_actions": actions,
                 "single_axis_keys_and_bounded_linear_segments": bool(single_axis_keys),
                 "axis_quaternion_error": axis_errors, "baked_angle_ranges_degrees": key_limits,
                 "zero_offsets_unit_scale": origins, "inert_root_and_mesh_transforms": inert,
                 "static_visible_meshes": static, "self_contained_editable_meshes": local,
                 "model_mesh_count": len([o for o in bpy.data.collections["WitnessCore"].objects if o.type == "MESH"])}
    report["hierarchy"] = hierarchy
    domain_ok = (serial and actions and single_axis_keys and origins and inert and static and local
                 and hierarchy["model_mesh_count"] == 4 and report["scene_parameter_hash_matches"])
    if not domain_ok:
        failures.append("Hierarchy, axis, source hash or rigid-domain check failed")
    timeline_ok = (scene.frame_start == 1 and scene.frame_end == last_frame(p)
                   and scene.render.fps == p["motion"]["fps"] and scene.render.fps_base == 1)
    report["timeline"] = {"start": scene.frame_start, "end": scene.frame_end, "fps": scene.render.fps, "pass": timeline_ok}
    if not timeline_ok or not all(report["sensor_controls"].values()):
        failures.append("Timeline or collision-sensor control failed")
    report["animation_keys_sha256"] = hashlib.sha256(json.dumps([
        {"pivot": o.name, "keys": [[c.array_index, [[float(k.co.x), float(k.co.y)] for k in c.keyframe_points]]
                                 for c in action_fcurves(o)]} for o in pivots],
        separators=(",", ":")).encode()).hexdigest()
    stats = {f"{x['outer']} / {x['inner']}": {
        "samples": 0, "surface_overlap_samples": 0, "containment_samples": 0,
        "minimum_sampled_prism_gap_lower_bound": float("inf")} for x in pairs}
    max_center, max_rigid = 0.0, 0.0

    def inspect_pose(label):
        nonlocal max_center, max_rigid
        bpy.context.view_layer.update()
        # Query actual evaluated world matrices, including every parent joint.
        depsgraph = bpy.context.evaluated_depsgraph_get()
        matrices = {n: o.evaluated_get(depsgraph).matrix_world.copy() for n, o in meshes.items()}
        world = {n: [matrices[n] @ v for v in arrays[n][0]] for n in names}
        trees = {n: tree(world[n], arrays[n][1]) for n in names}
        for matrix in matrices.values():
            max_center = max(max_center, matrix.translation.length)
            rotation = matrix.to_3x3()
            gram = rotation.transposed() @ rotation
            max_rigid = max(max_rigid, abs(rotation.determinant()-1),
                            *(abs(gram[i][j]-(i == j)) for i in range(3) for j in range(3)))
        for pair in pairs:
            outer, inner = pair["outer"], pair["inner"]
            stat = stats[f"{outer} / {inner}"]
            overlap = trees[outer].overlap(trees[inner])
            containment = (not overlap and
                           (contains_point(world[outer], arrays[outer][1], world[inner][0])
                            or contains_point(world[inner], arrays[inner][1], world[outer][0])))
            inverse = matrices[outer].inverted()
            projected = [inverse @ v for v in world[inner]]
            gap = holes[outer]-max(max(abs(v.x), abs(v.z)) for v in projected)-2*tol
            stat["samples"] += 1
            stat["surface_overlap_samples"] += bool(overlap)
            stat["containment_samples"] += bool(containment)
            if gap < stat["minimum_sampled_prism_gap_lower_bound"]:
                stat["minimum_sampled_prism_gap_lower_bound"] = gap
                stat["minimum_bound_pose"] = label
            if overlap or containment or gap < p["clearance"]:
                failures.append({"pose": label, "pair": [outer, inner], "triangle_overlaps": len(overlap),
                                 "containment": bool(containment), "gap_lower_bound": gap})
        return matrices

    original_frame = scene.frame_current
    step = p["validation"]["sample_step_frames"]
    frames = [1+i*step for i in range(round((last_frame(p)-1)/step)+1)]
    references = {}
    max_motion_error = max_core_delta = 0.0
    core_identity = Matrix.Identity(4)
    for i, frame in enumerate(frames):
        scene.frame_set(math.floor(frame), subframe=frame % 1)
        matrices = inspect_pose({"frame": frame})
        expected_world = Quaternion((1, 0, 0, 0))
        for r, pivot in zip(p["rings"], pivots):
            q = orientation_at((frame-1)/p["motion"]["fps"], r, p)
            expected_world = expected_world @ q
            max_motion_error = max(max_motion_error,
                                   quaternion_delta(pivot.matrix_world.to_quaternion(), expected_world))
        max_core_delta = max(max_core_delta, matrix_delta(matrices["Core"], core_identity))
        if i % max(1, round(p["validation"]["reverse_check_step_frames"]/step)) == 0:
            references[frame] = matrices
    max_reverse = 0.0
    for frame, matrices in reversed(list(references.items())):
        scene.frame_set(math.floor(frame), subframe=frame % 1)
        bpy.context.view_layer.update()
        max_reverse = max(max_reverse, *(matrix_delta(meshes[n].matrix_world, m) for n, m in matrices.items()))
    scene.frame_set(last_frame(p))
    bpy.context.view_layer.update()
    aligned = max(matrix_delta(o.matrix_world, Matrix.Identity(4)) for o in pivots)
    print("R1-B2 timeline samples complete:", len(frames), flush=True)
    # Grid includes full independent local-joint intervals, not only the idle path.
    grids = [grid_values(r, s) for r, s in zip(p["rings"], p["validation"]["joint_grid_steps_degrees"])]
    saved_actions = [o.animation_data.action for o in pivots]
    saved_slots = [o.animation_data.action_slot for o in pivots]
    try:
        for o in pivots:
            o.animation_data.action = None
        for angles in itertools.product(*grids):
            for o, r, degrees in zip(pivots, p["rings"], angles):
                o.rotation_quaternion = Quaternion(r["axis_local"], math.radians(degrees))
            inspect_pose({"joint_degrees_A_B_C": list(angles)})
        for o, r, degrees in zip(pivots, p["rings"], p["preview"]["moderate_joint_degrees"]):
            o.rotation_quaternion = Quaternion(r["axis_local"], math.radians(degrees))
        inspect_pose({"preview_moderate_degrees_A_B_C": p["preview"]["moderate_joint_degrees"]})
    finally:
        for o, action, slot in zip(pivots, saved_actions, saved_slots):
            o.animation_data.action = action
            o.animation_data.action_slot = slot
        scene.frame_set(original_frame)
    if max_motion_error > .02 or max_core_delta > tol or max_reverse > tol or aligned > tol:
        failures.append("Deterministic motion, stable core, reverse lookup or final alignment failed")
    actual_ok = all(x["pass"] for x in report["objects"].values())
    certificate_ok = domain_ok and actual_ok and all(x["pass"] for x in pairs)
    report["bounded_domain_certificate"]["actual_mesh_envelopes_and_prisms_verified"] = actual_ok
    report["bounded_domain_certificate"]["pass"] = bool(certificate_ok)
    sampled_ok = all(s["surface_overlap_samples"] == 0 and s["containment_samples"] == 0
                     and s["minimum_sampled_prism_gap_lower_bound"] >= p["clearance"] for s in stats.values())
    sampled_ok &= max_center <= tol and max_rigid < 0.00001
    report["sampled_mesh_checks"] = {
        "method": "Evaluated world-transformed triangles; BVH intersections plus winding containment; transformed vertices give square-prism gap LOWER BOUNDS, not exact closest-surface distances",
        "timeline_sample_poses": len(frames), "timeline_step_frames": step,
        "joint_grid_degrees_A_B_C": grids, "joint_grid_poses": math.prod(len(g) for g in grids),
        "additional_preview_pose_checks": 1,
        "pair_results": stats, "max_center_error": max_center, "max_rigid_matrix_error": max_rigid,
        "max_baked_vs_analytic_world_degrees": max_motion_error,
        "max_core_matrix_change": max_core_delta, "reverse_poses": len(references),
        "max_reverse_matrix_error": max_reverse, "alignment_identity_error": aligned,
        "pass": bool(sampled_ok)}
    if not sampled_ok or not certificate_ok:
        failures.append("Bounded-domain certificate or actual-mesh samples failed")
    report["unverified"] = [
        "Angles outside A +/-6, B +/-40, C +/-30 degrees; arbitrary independent rotation.",
        "Changed axes, hierarchy, translation, scale, deformation, mesh or parameters without rebuilding.",
        "Minimum reported gaps are conservative certified lower bounds, NOT exact closest-distance measurements.",
        "BVH/winding samples are finite. Continuous bounded-domain safety comes from the separate projection certificate."]
    report["pass"] = not failures
    (ROOT/"collision-report.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    print("R1-B2 VALIDATION", "PASS" if report["pass"] else "FAIL",
          "certified gap", report["bounded_domain_certificate"]["minimum_gap_after_numeric_allowance"], flush=True)
    if failures:
        raise RuntimeError(f"Validation failed: {failures[:6]}")
    return report


def validate_scene(p, reopened=False):
    try:
        return _validate_scene(p, reopened)
    except Exception as error:
        path = ROOT/"collision-report.json"
        # Preserve a detailed failure report, but never a stale prior success.
        old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        if old.get("pass") is not False or old.get("parameters_sha256") != parameter_hash(p):
            path.write_text(json.dumps({"pass": False, "error": repr(error),
                                       "parameters_sha256": parameter_hash(p)}, indent=2)+"\n", encoding="utf-8")
        raise


if __name__ == "__main__":
    validate_scene(load_parameters(), reopened=True)
