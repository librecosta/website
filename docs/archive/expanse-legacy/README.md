# The Expanse · Retired Experiments

P1-C1A4-Z1 captured LibreCosta's own browser frames for future technical writing. The four cropped WebP boards total about 54 KiB. The second board compares materials at the same camera position. The others document different stages. The notes below describe the recorded builds.

| Case | Reason for retirement | What the experiment established |
| --- | --- | --- |
| [Early debug panel and hardpan terrain](01-retired-debug.webp) | Two material menus were disabled in the four-face gray model. Testing required returning to a single groove. The terrain switches could also remove the approved dune geometry and surface. The earlier P1-B2 gray hardpan mask broke up the basin into patches. | Debug tools work best when they expose the active scene. Dune form comes from the long windward slope and steep lee slope. Ripples attenuate with distance and sampling density. See `ffa581d` and `dfd2adf`. |
| [Three generations of single-groove monument materials](02-monument-surface.webp) | Mineral deposition, grain, and roughness covered the full face without conveying how the structure was made. Engraved variant B competed with the real groove. The flat material removed the relief, but its offset layout no longer fit the centered main groove and wraparound secondary groove. | Physical grooves, floors, and bevels defined the form. Authored flat panel, line, grazing-light, and emissive layers worked once the layout matched the valid face area. See `ae4d423`, `e49490b`, `dc243e7`, and `20721ed`. |
| [Backlight haze and isolated cloud bands](03-light-and-sky.webp) | Shorter fog distance improved the silhouette at the cost of groove and face contrast. The isolated J3D-R2 cloud domains left conspicuous empty areas at low elevations and narrow widths. | Directional side light and a continuous world-direction cloud field solved separate problems. Distant surfaces sampled air color without cloud filaments to avoid imprinting clouds on stone. Backlight came from `ffa581d`, isolated cloud bands from `a28b188`. |
| [Moving ground density and lift diagnostics](04-sand-and-diagnostics.webp) | Translated low-frequency density kept its shape and looked like moving stains. Short streaks resembled light trails. Wind arrows and lift masks verified inputs but gave little information about occlusion or visible concentration. | Threshold lift, advection, diffusion, and deposition produce changing concentration. The cleanup kept visible dust, concentration, and off views. Lift remained part of CPU simulation and verification. |

## Related records

- [Early blockouts and monument material trials](expanse-blockout.md)
- [Still Monolith surface development](monument-surface.md)
- [Procedural environment research and test conditions](../../research/procedural-environments.md)
- [Independent cube surface study](../../research/hubtown-cube-surface.md)
- [Current Act I direction](../../creative/act-01-expanse.md)
