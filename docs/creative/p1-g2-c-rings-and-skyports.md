# The Expanse · Ring and skyport refinement

G2-C applies the city palette to all eight main beam spans, the secondary ring, and both skyports. The new details are cut into the authored profiles. The rings still use one merged mesh each. [Geometry source](../../src/components/expanse/skyline.ts) · [G2-A surface palette](p1-g2-a-city-materials.md)

| Assembly | Construction and surfaces |
| --- | --- |
| M1 main beam | Satin Alloy skin and two shallow assembly joints per span. Structural Iron lines the web, underside, and hollow cell. Precision Metal lines the joint returns, terminal frames, and machined cell mouths. The original collar shapes and open terminal bores set the end silhouette. |
| M2 carrier | Structural Iron beam and radial braces, with Precision Metal guide faces, relieved ends, and bearing shoes. Each span has one inset joint on the outside face. The existing guide marks continue on the inward and lower faces. |
| M3 short guides | Four short Precision Metal arcs with relieved ends. Iron brackets carry the guides and small metal seats articulate the contact with M2. |
| Secondary ring | Satin Alloy skin, iron return structure, and machined ends and bearings. Four alternating shell spans receive one shallow assembly joint each. The lighter profile retains the original counter-rotation. |
| Skyport Root | Iron load-bearing slope between M1, M2 and the deck, with machined seating faces and one shallow inspection panel below the transition. |
| Skyport Deck | Deck Composite traffic and berth surface with a flush hatch, a recessed berth edge outside the passenger skids, and localized Sand-Aged Surface at the bottom of the recess. The nose exposes the machined edge and shell return. |
| Skyport Belly | A broad Structural Iron plate with a shallow machined return. The inspection and berth recesses use shape and finish for contrast. |

Both berths use the same assembly with the dimensions and slopes of their existing profiles. The shared material consumes the same `cityFinish` and `cityMark` attributes. Both render tiers linked all 15 programs without WebGL errors.

The fixed S3 and S4 views show the metal shell, dark web, guide faces, and suspended decks in normal atmosphere. An S3 capture at 23 s exposes the primary berth and its passenger ship. The low camera emphasizes the belly and berth edge. The hatch and recessed floor are subtler from that angle and at mobile scale. S5 keeps a clear backdrop for the brand and spire. [G0 fixed cameras](p1-g0-visual-baseline.md)

Both skyports retain bearing contact with M1 and M2 and clear all M3 arcs and seats. The main and secondary ring envelopes have 417 city units of separation along their shared local vertical axis. Conservative horizontal clearance from the spire exceeds 776 units across all tilts. The mesh audit also samples both rotations through 360 seconds and the cargo hull over one hour. All 540 samples across the passenger skid faces meet the flat berth at its authored height. The observation marker stayed attached to the ship and opened its card in the browser.

At S4 the change adds 1,200 submitted triangles at either tier and holds at 25 draws. Desktop GPU P95 changed by +1.4% and −11.7% in two paired runs. Mobile viewport tests included an 8.51 ms baseline outlier and two follow-up runs that measured +17.5% and +2.6%. The >15% increase did not repeat on the next run. The underlying tail variation remains unresolved on handset hardware. Screenshots, raw samples, and geometry checks are under `.local/p1-g2-c/`.
