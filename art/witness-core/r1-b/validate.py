"""Reopenable actual-mesh validation. Sampling is explicitly NOT the proof."""

import copy
import hashlib
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import closest_point_on_tri

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from kinematics import (action_fcurves, constraints, last_frame, load_parameters,
                        orientation_at, parameter_hash, require_safe_parameters)


class ValidationFailure(RuntimeError):
    """A detailed failing report was already written."""


def tree(vertices, triangles):
    return BVHTree.FromPolygons(vertices, triangles, all_triangles=True, epsilon=0.0)


def mesh_arrays(mesh):
    mesh.calc_loop_triangles()
    return ([v.co.copy() for v in mesh.vertices], [tuple(t.vertices) for t in mesh.loop_triangles])


def radial_bounds(vertices, triangles):
    origin = Vector((0, 0, 0))
    minimum = min(closest_point_on_tri(origin, *(vertices[i] for i in tri)).length for tri in triangles)
    maximum = max(v.length for v in vertices)
    return minimum, maximum


def contains_point(vertices, triangles, point):
    """Signed solid-angle winding for closed oriented meshes; no grazing rays."""
    relative = [vertex - point for vertex in vertices]
    lengths = [v.length for v in relative]
    angles = []
    for ia, ib, ic in triangles:
        a, b, c = relative[ia], relative[ib], relative[ic]
        la, lb, lc = lengths[ia], lengths[ib], lengths[ic]
        if min(la, lb, lc) < 1e-8:
            raise ValueError("Containment probe lies on another mesh vertex")
        numerator = a.dot(b.cross(c))
        denominator = la * lb * lc + a.dot(b) * lc + b.dot(c) * la + c.dot(a) * lb
        angles.append(2 * math.atan2(numerator, denominator))
    winding = abs(math.fsum(angles) / (4 * math.pi))
    if winding < 0.0001:
        return False
    if abs(winding - 1) < 0.0001:
        return True
    raise ValueError(f"Unresolved solid-angle winding number: {winding}")


def box_arrays(side, offset=(0, 0, 0)):
    offset = Vector(offset)
    vertices = [Vector((x, y, z)) + offset for x in (-side / 2, side / 2)
                for y in (-side / 2, side / 2) for z in (-side / 2, side / 2)]
    quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
             (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    triangles = [(q[0], q[1], q[2]) for q in quads] + [(q[0], q[2], q[3]) for q in quads]
    return vertices, triangles


def sensor_controls(parameters):
    a, ta = box_arrays(2)
    b, tb = box_arrays(2, (0.8, 0.3, 0.2))
    c, tc = box_arrays(0.5)
    d, td = box_arrays(1, (4, 0, 0))
    large, crossing, contained, separate = [tree(v, t) for v, t in ((a, ta), (b, tb), (c, tc), (d, td))]
    result = {
        "crossing_boxes_detected": bool(large.overlap(crossing)),
        "contained_box_has_no_surface_overlap": not bool(large.overlap(contained)),
        "contained_box_detected_by_solid_angle": contains_point(a, ta, c[0]),
        "separate_boxes_not_flagged": not large.overlap(separate) and not contains_point(a, ta, d[0]),
    }
    unsafe = copy.deepcopy(parameters)
    unsafe["rings"][1]["S"] = 3.0
    try:
        require_safe_parameters(unsafe)
        result["unsafe_parameter_negative_control_rejected"] = False
    except ValueError:
        result["unsafe_parameter_negative_control_rejected"] = True
    return result


def topology_and_envelope(obj, expected_dimensions, expected_euler, nominal, tolerance):
    mesh = obj.data
    vertices, triangles = mesh_arrays(mesh)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    manifold = all(e.is_manifold and e.is_contiguous for e in bm.edges)
    volume = bm.calc_volume(signed=True)
    degenerate = sum(f.calc_area() < 1e-10 for f in bm.faces)
    bm.free()
    adjacency = {i: set() for i in range(len(vertices))}
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacency[a].add(b)
        adjacency[b].add(a)
    pending = set(adjacency)
    components = 0
    while pending:
        stack = [pending.pop()]
        components += 1
        while stack:
            for neighbor in adjacency[stack.pop()]:
                if neighbor in pending:
                    pending.remove(neighbor)
                    stack.append(neighbor)
    minimum = [min(v[axis] for v in vertices) for axis in range(3)]
    maximum = [max(v[axis] for v in vertices) for axis in range(3)]
    dimensions = [b - a for a, b in zip(minimum, maximum)]
    center = [(a + b) / 2 for a, b in zip(minimum, maximum)]
    r_min, r_max = radial_bounds(vertices, triangles)
    self_tree = tree(vertices, triangles)
    self_crossings = [(a, b) for a, b in self_tree.overlap(self_tree)
                      if a < b and not set(triangles[a]).intersection(triangles[b])]
    euler = len(mesh.vertices) - len(mesh.edges) + len(mesh.polygons)
    dimensions_ok = max(abs(a - b) for a, b in zip(dimensions, expected_dimensions)) <= tolerance
    # The nominal annulus shell and un-beveled outer sphere MUST still enclose actual faces.
    envelope_ok = r_min >= nominal["r_min"] - tolerance and r_max <= nominal["R_max"] + tolerance
    return {
        "geometry_sha256": hashlib.sha256(json.dumps({
            "vertices": [list(v) for v in vertices], "triangles": triangles,
        }, separators=(",", ":")).encode()).hexdigest(),
        "vertices": len(vertices), "triangles": len(triangles), "faces": len(mesh.polygons),
        "edges": len(mesh.edges), "components": components, "euler_characteristic": euler,
        "expected_euler_characteristic": expected_euler,
        "closed_consistently_oriented_manifold": manifold,
        "positive_volume": volume, "degenerate_faces": degenerate,
        "nonadjacent_self_surface_crossings": len(self_crossings),
        "local_AABB_min": minimum, "local_AABB_max": maximum,
        "local_dimensions_XYZ": dimensions, "expected_dimensions_XYZ": expected_dimensions,
        "local_AABB_center": center,
        "actual_min_surface_radius": r_min, "actual_max_vertex_radius": r_max,
        "within_nominal_radial_envelope": envelope_ok,
        "pass": (manifold and volume > 0 and components == 1 and degenerate == 0
                 and euler == expected_euler and not self_crossings and dimensions_ok
                 and max(abs(v) for v in center) <= tolerance and envelope_ok and not obj.modifiers),
    }, (vertices, triangles)


def matrix_delta(a, b):
    return max(abs(a[row][col] - b[row][col]) for row in range(4) for col in range(4))


def quaternion_delta_degrees(a, b):
    cosine = abs(sum(x * y for x, y in zip(a, b))) / math.sqrt(sum(x * x for x in a) * sum(y * y for y in b))
    return math.degrees(2 * math.acos(min(1.0, cosine)))


def _validate_scene(parameters, reopened):
    scene = bpy.context.scene
    tolerance = parameters["numeric_tolerance"]
    bounds, pairs = constraints(parameters)
    report = {
        "schema_version": 1, "blender_version": bpy.app.version_string,
        "source_file": Path(bpy.data.filepath).name,
        "source_sha256": hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
        "independent_source_reopen": reopened,
        "parameters_sha256": parameter_hash(parameters),
        "scene_parameter_hash_matches": scene.get("parameters_sha256") == parameter_hash(parameters),
        "units": parameters["units"], "numeric_tolerance": tolerance,
        "guarantee": {
            "method": "origin-centered radial shell separation, all orientations",
            "ring_r_min_formula": "S/2 - W",
            "ring_R_max_formula": "sqrt(2*(S/2)^2 + (D/2)^2)",
            "cube_R_max_formula": "sqrt(3)*side/2",
            "domain": "Common fixed center; rigid rotations; no translation, scale, deformation or later mesh edits. Beveled actual mesh must stay within nominal radial envelopes.",
            "proof": "For any outer material point x and inner point y, ||x-y|| >= ||x||-||y|| >= r_min(outer)-R_max(inner). Rigid rotation preserves each radius; therefore the bound holds for every relative orientation, not only sampled times.",
            "nominal_bounds": bounds, "all_pair_constraints": pairs,
            "conservative_minimum_gap": min(p["conservative_gap"] for p in pairs),
            "minimum_gap_after_numeric_allowance": min(p["conservative_gap"] for p in pairs) - 2 * tolerance,
            "clearance": parameters["clearance"],
        },
        "sensor_controls": sensor_controls(parameters),
        "objects": {}, "failures": [],
    }
    failures = report["failures"]
    report["timeline"] = {"fps": scene.render.fps, "fps_base": scene.render.fps_base,
                           "start": scene.frame_start, "end": scene.frame_end}
    if (scene.render.fps != parameters["motion"]["fps"] or scene.render.fps_base != 1
            or scene.frame_start != 1 or scene.frame_end != last_frame(parameters)):
        failures.append("Saved timeline timing differs from parameters")
    if not report["scene_parameter_hash_matches"]:
        failures.append("Saved model and current parameters differ; rebuild before validation")
    if not all(p["pass"] for p in pairs):
        failures.append("Nominal all-angle clearance constraint failed")
    if not all(report["sensor_controls"].values()):
        failures.append("Collision sensor positive/negative controls failed")
    names = [r["name"] for r in parameters["rings"]] + ["Core"]
    meshes = {name: bpy.data.objects[name] for name in names}
    report["source_editability"] = {
        "local_editable_meshes": all(o.data.library is None and o.data.is_editable for o in meshes.values()),
        "external_libraries": [lib.name for lib in bpy.data.libraries],
        "embedded_auto_run_scripts_required": False,
    }
    if not report["source_editability"]["local_editable_meshes"] or bpy.data.libraries:
        failures.append("Model is not a self-contained editable local asset")
    arrays = {}
    for index, name in enumerate(names):
        if name == "Core":
            dimensions = [parameters["core"]["side"]] * 3
            euler = 2
            expected_parent = "WitnessCore"
        else:
            ring = parameters["rings"][index]
            dimensions = [ring["S"], ring["D"], ring["S"]]
            euler = 0
            expected_parent = ring["pivot"]
        item, arrays[name] = topology_and_envelope(meshes[name], dimensions, euler, bounds[name], tolerance)
        item["parent"] = meshes[name].parent.name if meshes[name].parent else None
        item["parent_correct"] = item["parent"] == expected_parent
        report["objects"][name] = item
        if not item["pass"] or not item["parent_correct"]:
            failures.append(f"Mesh topology, dimensions, envelope or hierarchy failed: {name}")
    pivots = [bpy.data.objects[r["pivot"]] for r in parameters["rings"]]
    hierarchy_ok = all(p.parent and p.parent.name == "WitnessCore" and p.rotation_mode == "QUATERNION" for p in pivots)
    independent_actions = len({p.animation_data.action.as_pointer() for p in pivots}) == 3
    rotation_only = all(c.data_path == "rotation_quaternion" for p in pivots for c in action_fcurves(p))
    inert_objects = [bpy.data.objects["WitnessCore"], *meshes.values()]
    inert_ok = all(not o.animation_data and not o.constraints for o in inert_objects)
    pivots_clean = all(not p.constraints and not p.animation_data.drivers for p in pivots)
    root = bpy.data.objects["WitnessCore"]
    transform_objects = [root, *pivots, *meshes.values()]
    origin_locks = all(o.location.length <= tolerance
                       and max(abs(value - 1) for value in o.scale) <= tolerance
                       and matrix_delta(o.matrix_parent_inverse, Matrix.Identity(4)) <= tolerance
                       for o in transform_objects) and root.parent is None
    static_meshes = all(o.data.shape_keys is None and not o.data.animation_data and not o.hide_render
                        for o in meshes.values())
    report["hierarchy"] = {"correct_pivots": hierarchy_ok, "three_independent_actions": independent_actions,
                           "rotation_only_curves": rotation_only, "root_and_meshes_unanimated": inert_ok,
                           "no_constraints_or_drivers_on_pivots": pivots_clean,
                           "static_zero_offsets_unit_scales_identity_parent_inverses": origin_locks,
                           "no_deformation_animation_or_hidden_model_meshes": static_meshes,
                           "model_mesh_count": len([o for o in bpy.data.collections["WitnessCore"].objects if o.type == "MESH"])}
    report["animation_keys_sha256"] = hashlib.sha256(json.dumps([
        {"pivot": p.name, "curves": [{"path": c.data_path, "index": c.array_index,
          "keys": [[float(k.co.x), float(k.co.y), k.interpolation] for k in c.keyframe_points]}
         for c in action_fcurves(p)]} for p in pivots
    ], sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    if not (hierarchy_ok and independent_actions and rotation_only and inert_ok and pivots_clean and origin_locks and static_meshes
            and report["hierarchy"]["model_mesh_count"] == 4):
        failures.append("Unexpected hierarchy, animation channel or hidden geometry")
    step = parameters["validation"]["sample_step_frames"]
    end = last_frame(parameters)
    frames = [1 + i * step for i in range(round((end - 1) / step) + 1)]
    pair_stats = {f"{p['outer']} / {p['inner']}": {
        "samples": 0, "surface_overlap_samples": 0, "containment_samples": 0,
        "minimum_actual_mesh_radial_lower_bound": float("inf"),
    } for p in pairs}
    max_center = max_rigid_error = max_motion_error = max_core_delta = 0.0
    previous_frame = scene.frame_current
    scene.frame_set(1)
    core_initial = meshes["Core"].matrix_world.copy()
    reverse_references = {}
    for frame_index, frame in enumerate(frames):
        scene.frame_set(math.floor(frame), subframe=frame % 1)
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        world_arrays, world_trees, radial = {}, {}, {}
        for name, obj in meshes.items():
            matrix = obj.evaluated_get(depsgraph).matrix_world.copy()
            max_center = max(max_center, matrix.translation.length)
            rotation = matrix.to_3x3()
            gram = rotation.transposed() @ rotation
            rigid_error = max(abs(gram[r][c] - (1 if r == c else 0)) for r in range(3) for c in range(3))
            max_rigid_error = max(max_rigid_error, rigid_error, abs(rotation.determinant() - 1))
            vertices, triangles = arrays[name]
            transformed = [matrix @ vertex for vertex in vertices]
            world_arrays[name] = transformed
            world_trees[name] = tree(transformed, triangles)
            radial[name] = radial_bounds(transformed, triangles)
        max_core_delta = max(max_core_delta, matrix_delta(meshes["Core"].matrix_world, core_initial))
        for ring, pivot in zip(parameters["rings"], pivots):
            expected = orientation_at((frame - 1) / parameters["motion"]["fps"], ring, parameters)
            max_motion_error = max(max_motion_error, quaternion_delta_degrees(pivot.matrix_world.to_quaternion(), expected))
            max_center = max(max_center, pivot.matrix_world.translation.length)
        for pair in pairs:
            outer, inner = pair["outer"], pair["inner"]
            stat = pair_stats[f"{outer} / {inner}"]
            overlaps = world_trees[outer].overlap(world_trees[inner])
            containment = False
            if not overlaps:
                containment = (contains_point(world_arrays[outer], arrays[outer][1], world_arrays[inner][0])
                               or contains_point(world_arrays[inner], arrays[inner][1], world_arrays[outer][0]))
            gap = radial[outer][0] - radial[inner][1]
            stat["samples"] += 1
            stat["surface_overlap_samples"] += bool(overlaps)
            stat["containment_samples"] += bool(containment)
            if gap < stat["minimum_actual_mesh_radial_lower_bound"]:
                stat["minimum_actual_mesh_radial_lower_bound"] = gap
                stat["minimum_bound_frame"] = frame
            if overlaps or containment or gap < parameters["clearance"] - tolerance:
                failures.append({"frame": frame, "pair": [outer, inner], "overlapping_triangles": len(overlaps),
                                 "containment": containment, "radial_gap": gap})
        if frame_index % max(1, round(parameters["validation"]["reverse_check_step_frames"] / step)) == 0:
            reverse_references[frame] = [obj.matrix_world.copy() for obj in meshes.values()]
    max_reverse_error = 0.0
    for frame, matrices in reversed(list(reverse_references.items())):
        scene.frame_set(math.floor(frame), subframe=frame % 1)
        bpy.context.view_layer.update()
        max_reverse_error = max(max_reverse_error, *(matrix_delta(o.matrix_world, m) for o, m in zip(meshes.values(), matrices)))
    scene.frame_set(end)
    alignment_errors = [quaternion_delta_degrees(p.matrix_world.to_quaternion(), (1, 0, 0, 0)) for p in pivots]
    if (max_center > tolerance or max_rigid_error > 1e-5 or max_core_delta > tolerance
            or max_motion_error > 0.1 or max_reverse_error > tolerance or max(alignment_errors) > 0.001):
        failures.append("Transform, deterministic motion, reverse evaluation or alignment check failed")
    actual_envelopes_ok = all(x["within_nominal_radial_envelope"] for x in report["objects"].values())
    domain_ok = (hierarchy_ok and independent_actions and rotation_only and inert_ok and pivots_clean and origin_locks and static_meshes
                 and max_center <= tolerance and max_rigid_error <= 1e-5
                 and report["scene_parameter_hash_matches"])
    report["guarantee"]["actual_mesh_envelopes_confirmed"] = actual_envelopes_ok
    report["guarantee"]["rigid_common_center_domain_confirmed"] = domain_ok
    report["guarantee"]["all_angle_pass"] = (all(p["pass"] for p in pairs) and actual_envelopes_ok and domain_ok
        and report["guarantee"]["minimum_gap_after_numeric_allowance"] >= parameters["clearance"])
    if not report["guarantee"]["all_angle_pass"]:
        failures.append("All-angle guarantee, domain or numeric allowance failed")
    report["sampled_mesh_checks"] = {
        "method": "World-transformed actual triangles: BVH surface intersections plus signed-solid-angle winding tests for containment; actual surface/vertex radial gap is a lower bound, NOT exact inter-surface distance.",
        "frame_range": [1, end], "step_frames": step, "sampled_poses": len(frames),
        "tested_pairs_per_pose": len(pairs), "pair_results": pair_stats,
        "max_common_center_error": max_center, "max_rigid_matrix_error": max_rigid_error,
        "max_core_matrix_change": max_core_delta, "max_baked_vs_analytic_degrees": max_motion_error,
        "reverse_rechecked_poses": len(reverse_references), "max_reverse_matrix_error": max_reverse_error,
        "alignment_end_errors_degrees": alignment_errors,
        "pass": (all(s["surface_overlap_samples"] == 0 and s["containment_samples"] == 0
                     and s["minimum_actual_mesh_radial_lower_bound"] >= parameters["clearance"] - tolerance
                     for s in pair_stats.values()) and max_center <= tolerance and max_rigid_error <= 1e-5),
    }
    report["unverified"] = ["Nonrigid edits, translated/scaled pivots, changed mesh/parameters without rebuilding, or different future asset versions.",
                            "BVH samples alone do not certify continuous-time safety; the separately stated radial bound does under its domain."]
    report["pass"] = not failures
    scene.frame_set(previous_frame)
    (ROOT / "collision-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("R1-B VALIDATION", "PASS" if report["pass"] else "FAIL",
          "poses", len(frames), "minimum guaranteed gap", report["guarantee"]["conservative_minimum_gap"], flush=True)
    if failures:
        raise ValidationFailure(f"Validation failed: {failures[:8]}")
    return report


def validate_scene(parameters, reopened=False):
    try:
        return _validate_scene(parameters, reopened)
    except ValidationFailure:
        raise
    except Exception as error:
        # Never leave a stale success report after an exception or missing object.
        (ROOT / "collision-report.json").write_text(json.dumps({
            "pass": False, "error": repr(error), "parameters_sha256": parameter_hash(parameters),
            "source_file": Path(bpy.data.filepath).name,
        }, indent=2) + "\n", encoding="utf-8")
        raise


if __name__ == "__main__":
    validate_scene(load_parameters(), reopened=True)
