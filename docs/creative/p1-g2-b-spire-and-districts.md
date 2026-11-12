# The Expanse · Spire and district refinement

G2-B keeps the G2-A city layout: 118 complexes, six instanced batches, three bridge pairs, and the same lot transforms and height gradient. The spire keeps its asymmetric crown, open bay, and original envelope. [Geometry source](../../src/components/expanse/skyline.ts) · [Surface palette](p1-g2-a-city-materials.md)

| Assembly | Construction and surfaces |
| --- | --- |
| Axial spire | Three large Satin Alloy courses per wing, with tapered end returns. A real shallow longitudinal rebate in each lower and middle course exposes an iron floor. Iron bearing seats tie the courses back to the wings, with short Precision Metal contact shoes. The dark spine and gaps between the two diaphragms remain open to view. |
| Spire footing | Each wing flares into a bearing shoe and tiered podium. Beveled transfer shoulders and Deck Composite treads distinguish occupied levels; Sand-Aged Surface is limited to exposed lower bands. |
| T1 · Service Podium (60) | Wide working roof over a recessed service band, with a short tower on an iron seat and a low side wing. Sand aging is confined to the low base frontage. |
| T2 · Gatehouse Block (18) | Iron inner jambs carry a tapered lintel with an alloy shell and composite top. The gateway remains open below the lintel. |
| T3 · Bridge Pair (3) | One composite crossing per pair. An iron underbeam and two haunches seat it into the unequal towers. |
| T4 · Stepped Core Tower (12) | Recessed vertical channel in the middle alloy tier, stepped shoulder, and a Precision Metal crown on a dark seat. The existing crown marker stays in its original emission channel. |
| T5 · Winged Tower (21) | Alloy main tower and iron wing land on separate bearings and meet at a short machined joint. The wing tapers independently above the shared footing. |
| T6 · Forecourt Transfer Mass (4) | Low working terrace in front of a cut-back shoulder that carries two rear annexes. The front tread remains clear. |

Primary silhouettes have tight chamfers. Shell edges have wider cuts and load transfers use a small number of sloped sections. The two types of longitudinal rebate are closed solids with triangulated end caps. `cityFinish` remains constant per face, and `cityMark` still carries emission. No shader variant or material batch was added.

The [G0 fixed cameras](p1-g0-visual-baseline.md) were replayed with production atmosphere, exposure, and light. S3 reads the district shoulders and bridge openings; S4 reads the spire shell, spine, and podium layers; S5 preserves the brand backdrop. The 390 × 844 view keeps the large profiles, while fine recesses and low sand aging are subdued at that scale.

World checks report identical minimum traffic clearances before and after. Triangle intersection checks at the spire footing find only the three existing contacts, with unchanged vertical extents: one T4 plinth and the two T6 transfers. Both render tiers retain the same six instance batches, linked all 15 WebGL programs, and reported no WebGL errors. Before/after captures and raw measurements are stored locally under `.local/p1-g2-b/`.

S4 holds at 25 draws and submits 10,108 more triangles in each tier after simplifying the high-count service podium. Desktop GPU P95 changed by −1.7% and +3.3% across two final paired runs. The mobile viewport on the same GPU returned −7.2% and +16.6%; its median remained near 1.4–1.5 ms. Retest the mobile tail on handset hardware before increasing detail there.

G2-C can reuse the palette and edge proportions for the rings and skyports. Keep finish assignments tied to use (shell, web, guide, deck), and check them in the same S3–S5 sequence with motion and atmosphere active. The rings, skyports, and their motion were held at G2-A for this pass.
