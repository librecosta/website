# Witness Core · R1-C3 High-Poly Surface Language

> Historical asset research. The study uses one L-shaped ring corner and supersedes the R1-C2 dimpled surface. Rebuild R1-C first. R1-C2 is optional and only provides a comparison fingerprint when its project is present. [Upstream rebuild](../r1-c/README.md)

## Surface studies

| Variant | High-poly surface | Color and roughness |
| --- | --- | --- |
| A · Forged Plain | Broad shallow undulations across the main faces, with weaker relief on the inner walls. | Blackened metal, roughness 0.44–0.49, very subtle large-scale variation. |
| B · Forged + Precision Machined | Forged body and refined inner wall, inner top, and top cut. Parallel machining lines are modeled into the refined faces. | Same body as A. Refined faces are slightly brighter with roughness 0.30–0.37. Bevels retain their continuous highlights. |
| C · Aged Precision | Shares B's exact high-poly geometry. | Roughness 0.45–0.55 on the body, uneven low-contrast oxidation, and locally brighter bevels with roughness 0.31–0.35. |

B was the study's preferred candidate for weight, machining, and geometric order. C was retained as a subtle aging variant. All three remained samples.

## Geometry and baking

- The sample is 2.60 long and 1.80 high, with a 0.72 × 0.72 beam and a 0.012 BU three-segment bevel. The physical scale remains open.
- A and B each have 280,008 high-poly vertices and 560,012 triangles. C shares B's mesh. All three low-poly samples share one 144-vertex, 284-triangle mesh and UV layout.
- Deterministic control functions directly shape the dense mesh. The maximum forged displacement is 0.004600 BU, about 0.64% of beam width. Broad variation spans about 0.5–1.6 BU. Machining lines are 0.012 BU apart with 0.00014 BU nominal peak-to-valley depth and a mesh step of at most 0.002 BU along the detailed direction.
- The bevel vertices remain fixed. High-poly face relief slightly expands the local envelope. The `nominal_position` attribute preserves the original coordinates. The low-poly silhouette stays fixed, with relief transferred through tangent normals. [Control functions](surface_study.py) · [Parameters](parameters.json)
- Each variant produces 2048² base color, roughness, tangent normal, and AO maps in local `textures/`. The normal bake uses OpenGL +Y, the AO distance is 0.22 BU, and the data maps are 16-bit. Base color is 8-bit sRGB and excludes lighting. The preview keeps AO separate from base color. Roughness bakes the authored material response. Metallic is 0.96 on the body and 1.0 on refined faces and bevels.
- Baking uses Selected to Active with 16 px padding, a cage extrusion of 0.015 BU, and maximum ray distance of 0.04 BU. Low-poly previews read the saved maps. C's oxidation and polishing are carried by color and roughness.

## Review and verification

| Local output in `previews/` | Contents |
| --- | --- |
| `overview.png` | Low-poly medium and close views |
| `high-low-comparison.png` | Matched camera comparison |
| `geometry-proof.png` | Nominal low-poly and A and B/C high-poly surfaces under a shared grazing light and uniform material |
| `surface-sections.png` | Actual saved mesh sections, with vertical exaggeration confined to the chart |
| `texture-overview.png` | Thumbnails of the baked maps |

The per-variant medium, close, and clay frames are generated alongside the boards. Material frames use the same studio, camera, 1440 × 1080 resolution, 96 samples, and AgX. The geometry board uses a separate grazing-light setup.

An independent reopen verified closed, positive-volume meshes, fixed bevels, unchanged upstream project checksums, shared low-poly UVs, identical B/C high-poly geometry, and all 12 texture files. Each sample was also checked at 420 deterministic low-poly sample points. B/C had a median normal error of about 0.009° and a 95th percentile near 0.20°. Those values describe sampled bake fidelity. Web compression, channel packing, runtime evaluation, and full-assembly application remained open. [Verification report](verification.json)

## Rebuild

The study used Steam Blender 5.2.3 LTS in a separate background process and an RTX 3070 Laptop GPU with Cycles OptiX. From the repository root, substitute the actual Blender path.

```powershell
$blenderExe = 'E:/SteamLibrary/steamapps/common/Blender/blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/r1-c3/surface_study.py -- --build --bake --render
& $blenderExe --background --factory-startup --python-exit-code 1 --python art/witness-core/r1-b/r1-c3/verify.py
python art/witness-core/r1-b/r1-c3/compose.py
```

Re-run `--render` or `--bake` on an existing sample. After editing parameters, start with `--build`. The local `surface-language.blend` opens with B Low displayed. Show one high- or low-poly collection at a time. Board composition requires Pillow.
