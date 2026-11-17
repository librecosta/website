# The Expanse city surface palette

G2-A uses five low-saturation surfaces for the city at the existing scene exposure and lighting. The hex values are sRGB base colors. Roughness and metalness are unitless MeshStandardMaterial inputs. The runtime values live in [skyline.ts](../../src/components/expanse/skyline.ts).

| Surface | Base color | Roughness | Metalness | Use |
| --- | --- | ---: | ---: | --- |
| Satin Alloy | `#c4c9cb` | 0.42 | 0.34 | Broad exterior skins and shell courses |
| Structural Iron | `#465059` | 0.78 | 0.16 | Load-bearing webs, ribs, brackets and recessed structure |
| Precision Metal | `#8b9da9` | 0.36 | 0.46 | Guide rails, running faces and machined lips |
| Deck Composite | `#7e7b70` | 0.77 | 0.08 | Transfer decks and maintenance platforms |
| Sand-Aged Surface | `#a69b86` | 0.91 | 0.03 | Exposed low plinths and surfaces dulled by sand |

The proof uses the 42°–82° primary ring span and its existing transfer platform, the axial spire's shell courses and exposed inner structure, and the T5 Winged Tower archetype. On T5 the main shell is Satin Alloy, the side wing is Structural Iron and the plinth is Sand-Aged Surface.

The shared city material reads vertex color and `cityFinish.xy` for roughness and metalness. Each face has a constant pair. Color-only pieces use the G1 pair of 0.55 and 0.26. The same geometry contract applies to merged meshes, instanced buildings and vehicles, airships and satellites. `cityMark` continues to describe emission independently.

For G2-B/C, assign these surfaces where the geometry is built, at the part or face level. Keep the existing mesh batches and give any new geometry using the city shader one `cityFinish` pair per vertex. Sample S3–S5 with the normal atmosphere before widening coverage. Keep Sand-Aged Surface on exposed areas where the warmer matte response supports the form.
