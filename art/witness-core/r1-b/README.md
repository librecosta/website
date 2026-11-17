# Witness Core · R1-B2

> Historical asset research. The repository retains the scripts, parameters, and reports. Rebuild the Blender project, model exports, textures, and previews locally using the commands below.

R1-B2 replaces the peer-level free rotation in R1-B with thicker frames and nested, single-axis motion. The earlier all-angle clearance left large gaps and made the assembly feel thin. The earlier version is available at `218e3dd`.

The study used a separate background process in Steam Blender 5.2.3 LTS. The gray frames and white core use basic materials. Open Blender projects were left alone.

## Geometry and hierarchy

Dimensions are in Blender units. The physical scale remains open. Each ring is one closed solid mesh. Its plane is local XZ, with thickness along local Y. All pivots and the core share a center and use unit scale.

| Component | Outer side S | Beam width W | Thickness D | Axis relative to parent and range |
| --- | ---: | ---: | ---: | --- |
| A · Inner ring | 1.94 | 0.40 | 0.46 | Y, ±6° |
| B · Middle ring | 3.15 | 0.50 | 0.56 | X, through opposite sides of A, ±40° |
| C · Outer ring | 4.80 | 0.72 | 0.72 | Z, through opposite sides of B, ±30° |
| Core | 0.60 | — | — | Stationary under the root |

The rings use a 0.012 bevel with three segments. The core bevel is 0.006. Relative to R1-B, the outer, middle, and inner beam widths increased from 0.45, 0.30, and 0.16 to 0.72, 0.50, and 0.40. Their thicknesses increased from 0.35, 0.25, and 0.14 to 0.72, 0.56, and 0.46. The nominal one-sided aligned gaps C–B and B–A are each **0.105**, down from 0.700 and 0.375.

The hierarchy is `WitnessCore → RingAPivot → RingBPivot → RingCPivot`. Each mesh belongs to its corresponding pivot. Core is a direct child of WitnessCore. Each outer ring inherits the inner ring's pose before applying its own joint angle. Each pivot uses an independent quaternion action.

## Motion and verification

- **Idle, frames 1–241.** The three axes move with different phases and one-second eased starts and stops. Amplitudes are 4°, 28°, and 22°. The clip is a bounded calibration sequence.
- **Precision Alignment, frames 241–481.** Each joint returns to 0° with quintic smootherstep. Scalar joint angles construct local quaternions and preserve the joint limits. Core stays fixed.
- **Continuous bound within the documented joint ranges.** Inner bounding boxes are projected into the validated square opening of the surrounding ring. The bevel margin is included as `h=S/2-W-bevel_width`. Adjacent extrema include the endpoints and `atan(D/S)`, with a separate bound for non-adjacent pairs. The validation checks the triangulated opening, envelope, closed manifold, and self-intersection. The conservative clearance lower bound is **0.0661008 > 0.05**, including numerical margin.
- **Independent mesh sampling.** 961 half-frame animation poses, 1,105 joint-grid poses, and one preview pose gave **2,067 × 6** pair checks. The transformed meshes showed zero BVH intersections or solid containment events. The containment test uses signed solid angles and includes positive and negative fixtures. The results agreed across 61 time samples evaluated in reverse.
- The projected-prism bound establishes continuity for the specified axes and ranges. Changes to the axes, hierarchy, geometry, dimensions, or allowed ranges require rebuilding and rechecking. [Collision report](collision-report.json)

The reopened project contained four editable, closed, connected meshes with positive volume, totaling **672 vertices and 1,340 triangles**. An independent build reproduced the mesh and animation fingerprints.

## Previews and rebuild

Local `previews/overview.png` shows the three-quarter, front, oblique, side, and top views plus selected animation poses. The medium-deflection view uses A +2°, B +28°, C −22°. The 10-second idle and 10.042-second alignment previews use Workbench, H.264, 1280 × 960, 24 fps, and no audio. The recorded checks cover framing and selected decoded frames. [Preview manifest](previews/manifest.json)

From the repository root, substitute the actual Blender path.

```powershell
$blenderExe = 'E:/SteamLibrary/steamapps/common/Blender/blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/build.py -- --previews
& $blenderExe --background art/witness-core/r1-b/witness-core.blend --python-exit-code 1 --python art/witness-core/r1-b/validate.py
python art/witness-core/r1-b/compose_previews.py
```

Modeling, validation, and video use Blender components. Compositing the board requires Python and Pillow. The builder requires a fresh `--background --factory-startup` process. [Parameters](parameters.json) · [Follow-on material study](r1-c/README.md)
