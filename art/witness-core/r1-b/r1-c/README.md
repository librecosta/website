# Witness Core · R1-C

> Historical asset research. Blender projects and rendered outputs are generated locally. Rebuild the upstream gray model before creating this material project. [R1-B2 rebuild](../README.md)

The study adds blackened forged metal, machined interior metal, and a warm ivory core to R1-B2. The vertices, topology, beams, bevel dimensions, joint hierarchy, and animation keys are preserved. Only corner normals change. Broad faces keep flat normals, while bevels use smooth weighted normals.

## Materials

Colors below are scene-linear RGB. All three rings share the same two metals. Precision is assigned only to the inner walls facing the square openings and their related bevels. [Material parameters](material-parameters.json)

| Material | Base color | Roughness | Metallic | Normal / bump | Emissive |
| --- | --- | --- | ---: | --- | --- |
| Outer Monument Metal | Graphite, RGB approximately 0.045–0.059 | 0.48–0.61 | 0.93 | Two object-space Noise scales, 38 and 340, for shallow forged relief and grain | 0 |
| Inner Precision Metal | Cool gray, RGB 0.105 / 0.113 / 0.119 | 0.29–0.36 | 1.0 | Fine Wave along local Y for machining, anisotropy 0.18 | 0 |
| Core Light Material | Warm neutral ivory | 0.26 | 0 | Clean dielectric, IOR 1.46, transmission 0.08 | Ivory, strength 0.7 |

Low-contrast tonal and roughness changes suggest age. Path-traced occlusion supplies the interior shadowing. Object-space textures follow the ring motion. The ring bevels remain 0.012 with three segments and the core bevel remains 0.006.

## Lighting and review

- A single Principled dielectric supplies the core emission. Cycles lights the inner walls directly from the core geometry. The studio uses five area lights, a dark floor, and fixed AgX exposure. Bloom and supplementary core lights were disabled.
- Local `previews/core-light-comparison.png` isolates core emission with the remaining camera, exposure, light, and seed fixed. The near inner walls lift slightly while the three core faces remain legible. Light strength was calibrated for the study.
- Local `previews/overview.png` combines the Workbench baseline, hero, front, closeups, and light comparison. `previews/matched-comparison.png` compares gray and material renders under the same Cycles lights. Hero and front views are 1536². Closeups are 1600 × 1200.
- Local `previews/idle-material.mp4` covers frames 1–240 at 960², 24 fps, H.264, and 10 seconds. Cycles used 32 samples with OptiX denoising for video and 128 samples with OpenImageDenoise for stills. The capture system was Steam Blender 5.2.3 LTS and an RTX 3070 Laptop GPU with 8 GB.
- The reopened projects agreed in geometry, hierarchy, transforms, quaternion keys, and sampled world poses. The sampled pose and continuous clearance checks retained the R1-B2 lower bound of **0.0661008**. The normal check used 0.25° tolerance, and framing was checked across all 240 frames. [Preservation report](preservation-report.json) · [Collision report](collision-report.json)

## Web transfer

Bevel geometry, corner normals, material assignments, and the basic PBR and emissive values are transferable. Object-space Noise and Wave need UVs and texel-density decisions before baking base color, roughness, or tangent normals. Anisotropy requires corresponding runtime support. Baked maps and a web GLB were outside this study.

Cycles bounce light, studio reflections, denoising, and AgX are preview conditions. Lighting nearby web geometry from the core requires a separate runtime or baked solution.

## Rebuild

From the repository root, substitute the actual Blender path.

```powershell
$blenderExe = 'E:/SteamLibrary/steamapps/common/Blender/blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/r1-c/study.py -- --video
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/r1-c/validate_materials.py
python art/witness-core/r1-b/r1-c/compose_overview.py
```

The script opens the upstream gray model and saves a separate local `witness-core-materials.blend`. Open that project when using `--render-only --video-only` or `--render-only --shot clay-control`. Image-board composition requires Python and Pillow. Intermediate frames and logs are temporary outputs.
