# Witness Core · R1-C2 Surface Character Samples

> Historical asset research. This study used one L-shaped ring sample. The full assembly, joints, core, and animation remained untouched. Rebuild the upstream gray and material projects before using these scripts. [R1-B2 rebuild](../README.md) · [R1-C rebuild](../r1-c/README.md)

At the start of this study on 2026-11-06, the fetched `develop` was at `218e3dd`. The two local commits `a93e7bd` (nested joints) and `ff79571` (R1-C materials) had yet to be pushed. This records the state at that date.

## Upstream material audit

The audit examined the actual R1-C Blender file, material assignments, nodes, and UVs and produced a temporary unbaked GLB. [Audit script](audit_r1c.py) · [Audit report](r1-c-audit.json)

| Check | Result |
| --- | --- |
| Materials and assignment | The rings used two independent Principled metals. Each ring had 104 Outer faces and 96 Inner faces. Inner covered the square opening walls and their bevels. The core's 98 faces used Core Light. |
| Roughness | Outer used object-space Noise at scale 340 mapped to 0.48–0.61. Inner used object-space Wave at scale 220 mapped to 0.29–0.36. Both were procedural. |
| Normal detail | Outer used two Noise-to-Bump stages, distances 0.0015 and 0.00025, strengths 0.22 and 0.17. Inner used Wave-to-Bump at distance 0.00018 and strength 0.12. These stages affected shading only. |
| UVs and baking | Only the core retained its default cube UV map. R1-C used procedural nodes and had no baked maps or high-poly mesh. |
| Blender-specific effects | Object Noise and Wave, ColorRamp, Bump, Cycles indirect light, studio lighting, AgX, and denoising. |
| GLB export | 53,068 bytes, zero images and zero textures. It retained bevels, normals, assignments, three animations, and some constant material data. Core color, roughness, emission, transmission, and IOR and Inner constant color and anisotropy were present. The procedural Outer base color was absent. |

## Controlled samples

The three samples shared one mesh, UV layout, placement, and lighting. Each distance used the same camera, exposure, seed, and sampling. The section measures 0.72 × 0.72 Blender units with a 0.012 three-segment bevel. The dimensions below describe the procedural height field. All surface detail was expressed in shading.

| Variant | Surface treatment | Scale |
| --- | --- | --- |
| A · R1-C baseline | Original shader with flat broad faces and subtle microtexture at medium distance. | Original Noise, Wave, and Bump |
| B · Fine forged | Clusters of shallow forged dimples, grain, darker rough depressions, and fine directional machining on the inner wall. | Cell spacing about 0.045 BU, bump distance 0.0022, strength 0.65 |
| C · Stylized shallow tooling | Wider, sparser rounded-square tooling marks with larger areas of smooth metal. | Cell spacing about 0.133 BU, bump distance 0.004, strength 0.65 |

The generated B and C samples used Smart UV atlases and six baked 2048² PNGs in local `textures/`. Base color is sRGB. Roughness and tangent normals are non-color data. Bake padding is 16 pixels. The saved preview materials use the baked images. The low-contrast oxidation and polishing appear in color and roughness. The procedural heights added no physical displacement.

The local B and C GLBs embed base color, metallic-roughness, and normal images, with UVs, normals, and explicit tangents. Reimported vertex positions agreed at 1e-5 quantization and were checked by rendering. `previews/overview.png` compares medium and close views. `previews/texture-overview.png` shows the baked maps. The study used Steam Blender 5.2.3 LTS, RTX 3070 Laptop GPU / OptiX, 1440 × 1080, 96 samples, and fixed AgX. The dimpled direction was superseded in R1-C3. [Sample verification](sample-verification.json) · [Follow-on study](../r1-c3/README.md)

## Rebuild

From the repository root, substitute the actual Blender path and run each stage in a fresh background process.

```powershell
$blenderExe = 'E:/SteamLibrary/steamapps/common/Blender/blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/r1-c2/audit_r1c.py
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/r1-c2/samples.py
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/r1-c2/verify_samples.py
python art/witness-core/r1-b/r1-c2/compose_overview.py
```

The local project is `surface-samples.blend`. Blender handles modeling and baking. Board composition uses Python and Pillow. [Sample parameters](sample-parameters.json)
