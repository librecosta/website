"""R1-B2: serial one-axis joints and a bounded square-aperture certificate."""

import hashlib
import json
import math
from pathlib import Path

from mathutils import Quaternion

ROOT = Path(__file__).resolve().parent


def load_parameters():
    return json.loads((ROOT / "parameters.json").read_text(encoding="utf-8"))


def parameter_hash(parameters):
    return hashlib.sha256(json.dumps(parameters, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def max_projection(a, d, limits):
    """Maximum a*|cos(t)|+d*|sin(t)| on a symmetric interval below 90 deg."""
    limit = math.radians(max(abs(x) for x in limits))
    if not 0 <= limit < math.pi / 2:
        raise ValueError("Certificate requires symmetric joint limits below 90 degrees")
    critical = math.atan2(d, a)
    angles = [0, limit] + ([critical] if critical <= limit else [])
    return max(a * math.cos(t) + d * math.sin(t) for t in angles)


def constraints(p):
    """Per-coordinate separation, specific to Y -> X -> Z hierarchy.

    Each outer ring must have an empty infinite square prism of half-width h.
    Each inner solid stays inside a smaller prism; Euclidean separation >= h-E.
    A bevel-width allowance contracts the nominal hole. Actual mesh triangles
    are separately tested against that prism. No full-free-rotation sphere rule.
    """
    a, b, c = p["rings"]
    bevel = p["bevel"]["width"]
    holes = {r["name"]: r["S"] / 2 - r["W"] - bevel for r in (a, b, c)}
    A, dyA = a["S"] / 2, a["D"] / 2
    B, dyB = b["S"] / 2, b["D"] / 2
    bmax = math.radians(max(abs(x) for x in b["limits_degrees"]))
    cmax = math.radians(max(abs(x) for x in c["limits_degrees"]))
    core_half = p["core"]["side"] / 2
    core_sphere = math.sqrt(3) * core_half
    # C^-1*A = Rz(-c) Rx(-b). Triangle inequality bounds the cross term.
    cross_extent = max(A + math.sin(cmax) * (dyA + math.sin(bmax) * A),
                       max_projection(A, dyA, b["limits_degrees"]))
    extents = [
        ("RingA", "Core", max_projection(core_half, core_half, a["limits_degrees"]),
         "Ry(-a): cube projection h*(|cos(a)|+|sin(a)|)"),
        ("RingB", "RingA", max_projection(A, dyA, b["limits_degrees"]),
         "Rx(-b): max(A, A*|cos(b)|+dyA*|sin(b)|)"),
        ("RingC", "RingB", max_projection(B, dyB, c["limits_degrees"]),
         "Rz(-c): max(B, B*|cos(c)|+dyB*|sin(c)|)"),
        ("RingC", "RingA", cross_extent,
         "Rz(-c)Rx(-b): E_x <= A + sin(cmax)*(dyA+sin(bmax)*A); E_z <= projection(A,dyA,b)"),
        ("RingB", "Core", core_sphere, "Stable cube outer sphere (nonadjacent pair only)"),
        ("RingC", "Core", core_sphere, "Stable cube outer sphere (nonadjacent pair only)"),
    ]
    pairs = []
    for outer, inner, extent, method in extents:
        gap = holes[outer] - extent
        pairs.append({"outer": outer, "inner": inner, "empty_prism_half_width": holes[outer],
                      "inner_projection_bound": extent, "method": method,
                      "conservative_gap": gap, "after_numeric_allowance": gap - 2*p["numeric_tolerance"],
                      "required_clearance": p["clearance"],
                      "pass": gap - 2*p["numeric_tolerance"] >= p["clearance"]})
    return holes, pairs


def require_safe_parameters(p):
    expected = [("RingA", "WitnessCore", [0, 1, 0]),
                ("RingB", "RingAPivot", [1, 0, 0]), ("RingC", "RingBPivot", [0, 0, 1])]
    if len(p["rings"]) != 3:
        raise ValueError("Exactly three serial joints required")
    for r, (name, parent, axis) in zip(p["rings"], expected):
        if (r["name"], r["parent"], r["axis_local"]) != (name, parent, axis):
            raise ValueError("Certificate is specific to A(Y) -> B(X) -> C(Z), all centered")
        if not (r["S"] > 0 and 0 < r["W"] < r["S"]/2 and r["D"] > 0
                and 0 < p["bevel"]["width"] < min(r["W"], r["D"])/2):
            raise ValueError("Invalid beam or bevel dimensions")
        lo, hi = r["limits_degrees"]
        if lo != -hi or not 0 < hi < 90 or abs(r["idle_amplitude_degrees"]) > hi:
            raise ValueError("Symmetric limits <90deg, enclosing idle amplitude, required")
    m = p["motion"]
    if (m["fps"] <= 0 or int(m["fps"]) != m["fps"] or m["alignment_target_degrees"] != 0
            or min(m["idle_seconds"], m["alignment_seconds"]) <= 0
            or not 0 < m["idle_speed_ramp_seconds"] <= m["idle_seconds"]/2
            or p["validation"]["sample_step_frames"] <= 0
            or min(p["validation"]["joint_grid_steps_degrees"]) <= 0
            or p["clearance"] < 0.05 or p["numeric_tolerance"] <= 0):
        raise ValueError("Invalid motion, validation or clearance settings")
    if not 0 < p["core"]["bevel_width"] < p["core"]["side"]/2:
        raise ValueError("Invalid core dimensions")
    preview_angles = p["preview"]["moderate_joint_degrees"]
    if len(preview_angles) != 3 or any(not r["limits_degrees"][0] <= x <= r["limits_degrees"][1]
                                     for r, x in zip(p["rings"], preview_angles)):
        raise ValueError("Preview joint pose must stay inside the certified domain")
    failed = [x for x in constraints(p)[1] if not x["pass"]]
    if failed:
        raise ValueError(f"Bounded single-axis clearance failed: {failed}")


def speed_integral(u):
    return u**6 - 3*u**5 + 2.5*u**4


def idle_travel_time(seconds, duration, ramp):
    t = max(0.0, min(duration, seconds))
    if t < ramp:
        return ramp * speed_integral(t/ramp)
    if t > duration-ramp:
        return duration-ramp-ramp*speed_integral((duration-t)/ramp)
    return t-ramp/2


def smootherstep(u):
    u = max(0.0, min(1.0, u))
    return u**3 * (10+u*(-15+6*u))


def angle_at(seconds, ring, p):
    m = p["motion"]
    travel = idle_travel_time(seconds, m["idle_seconds"], m["idle_speed_ramp_seconds"])
    angle = ring["idle_amplitude_degrees"] * math.sin(
        math.radians(ring["idle_phase_degrees"]) + 2*math.pi*ring["idle_frequency_hz"]*travel)
    if seconds > m["idle_seconds"]:
        angle *= 1-smootherstep((seconds-m["idle_seconds"])/m["alignment_seconds"])
    return angle


def orientation_at(seconds, ring, p):
    return Quaternion(ring["axis_local"], math.radians(angle_at(seconds, ring, p)))


def last_frame(p):
    return 1+round((p["motion"]["idle_seconds"]+p["motion"]["alignment_seconds"])*p["motion"]["fps"])


def action_fcurves(obj):
    for layer in obj.animation_data.action.layers:
        for strip in layer.strips:
            bag = strip.channelbag(obj.animation_data.action_slot)
            if bag:
                yield from bag.fcurves
