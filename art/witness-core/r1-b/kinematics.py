"""Deterministic geometry bounds and quaternion motion; no physics or handlers."""

import hashlib
import json
import math
from pathlib import Path

from mathutils import Euler, Quaternion, Vector


ROOT = Path(__file__).resolve().parent


def load_parameters():
    return json.loads((ROOT / "parameters.json").read_text(encoding="utf-8"))


def parameter_hash(parameters):
    encoded = json.dumps(parameters, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def nominal_bounds(parameters):
    result = {}
    for ring in parameters["rings"]:
        s, w, d = (ring[key] for key in ("S", "W", "D"))
        if not (s > 0 and 0 < w < s / 2 and d > 0):
            raise ValueError(f"Invalid ring dimensions: {ring['name']}")
        if not 0 < parameters["bevel"]["width"] < min(w, d) / 2:
            raise ValueError("Bevel must fit within every beam cross-section")
        result[ring["name"]] = {
            "r_min": s / 2 - w,
            "R_max": math.sqrt(2 * (s / 2) ** 2 + (d / 2) ** 2),
        }
    side = parameters["core"]["side"]
    if not side > 0 or not 0 < parameters["core"]["bevel_width"] < side / 2:
        raise ValueError("Core side and bevel must be positive and compatible")
    # The solid cube includes the origin; only its outer radius is used in nesting.
    result["Core"] = {"r_min": 0.0, "R_max": math.sqrt(3) * side / 2}
    return result


def constraints(parameters):
    bounds = nominal_bounds(parameters)
    names = [r["name"] for r in parameters["rings"]] + ["Core"]
    pairs = []
    for index, outer in enumerate(names[:-1]):
        for inner in names[index + 1:]:
            gap = bounds[outer]["r_min"] - bounds[inner]["R_max"]
            pairs.append({
                "outer": outer, "inner": inner,
                "outer_r_min": bounds[outer]["r_min"],
                "inner_R_max": bounds[inner]["R_max"],
                "conservative_gap": gap,
                "required_clearance": parameters["clearance"],
                "pass": gap >= parameters["clearance"],
            })
    return bounds, pairs


def require_safe_parameters(parameters):
    motion = parameters["motion"]
    if (motion["fps"] <= 0 or int(motion["fps"]) != motion["fps"]
            or min(motion["idle_seconds"], motion["alignment_seconds"]) <= 0
            or parameters["validation"]["sample_step_frames"] <= 0):
        raise ValueError("Positive durations, integral FPS and positive sample interval required")
    for ring in parameters["rings"]:
        if Vector(ring["rotation_axis_world"]).length < 1e-8:
            raise ValueError("Every rotation axis must be nonzero")
    _, pairs = constraints(parameters)
    failed = [p for p in pairs if not p["pass"]]
    if failed:
        raise ValueError(f"Unsafe nominal radial constraints: {failed}")


def speed_integral(u):
    """Integral of quintic smootherstep from 0 to u, with integral(1)=0.5."""
    return u ** 6 - 3 * u ** 5 + 2.5 * u ** 4


def idle_travel_time(seconds, duration, ramp):
    """C2 start/stop, constant angular speed through the central eight seconds."""
    t = max(0.0, min(duration, seconds))
    if not 0 < ramp <= duration / 2:
        raise ValueError("Idle ramp must fit into half the duration")
    if t < ramp:
        return ramp * speed_integral(t / ramp)
    if t > duration - ramp:
        return duration - ramp - ramp * speed_integral((duration - t) / ramp)
    return t - ramp / 2


def smootherstep(u):
    u = max(0.0, min(1.0, u))
    return u ** 3 * (10 + u * (-15 + 6 * u))


def orientation_at(seconds, ring, parameters):
    motion = parameters["motion"]
    duration = motion["idle_seconds"]
    axis = Vector(ring["rotation_axis_world"]).normalized()
    initial = Euler(tuple(math.radians(v) for v in ring["initial_xyz_degrees"]), "XYZ").to_quaternion()
    travel = idle_travel_time(seconds, duration, motion["idle_speed_ramp_seconds"])
    angle = math.radians(ring["phase_degrees"] + ring["degrees_per_second"] * travel)
    start = (Quaternion(axis, angle) @ initial).normalized()
    if seconds <= duration:
        return start
    target = Quaternion(motion["alignment_target_quaternion_wxyz"]).normalized()
    if start.dot(target) < 0:
        target.negate()
    u = (seconds - duration) / motion["alignment_seconds"]
    return start.slerp(target, smootherstep(u)).normalized()


def last_frame(parameters):
    motion = parameters["motion"]
    return 1 + round((motion["idle_seconds"] + motion["alignment_seconds"]) * motion["fps"])


def action_fcurves(obj):
    """Blender 5.2 layered Actions; no deprecated Action.fcurves access."""
    action = obj.animation_data.action
    for layer in action.layers:
        for strip in layer.strips:
            bag = strip.channelbag(obj.animation_data.action_slot)
            if bag:
                yield from bag.fcurves
