# Architecture

## Static site and scene ownership

- App Router owns route metadata and the HTML shell. `next.config.ts` sets static export, and the root layout owns the shared audio provider. Keep the root placeholder and independent cube lab separate from The Expanse. [Routes](../src/app/) · [Next.js config](../next.config.ts)
- `ExpanseLab` owns native scroll, ScrollTrigger progress, reduced motion, debug UI, and the HTML fallback. It lazy-loads a single client-only Canvas. Keep the instrument and narrative HTML independent of WebGL initialization. [ExpanseLab](../src/components/expanse/ExpanseLab.tsx)
- `ExpanseCanvas` maps the smoothed progress into the configured camera path and composes the local pointer offset. The R3F frame callback is the sole camera writer. The Canvas uses demand rendering, with a capped scheduler for live world effects and no rendering in hidden tabs. Reuse that scheduler and refs for per-frame work. [ExpanseCanvas](../src/components/expanse/ExpanseCanvas.tsx) · [Journey mapping](../src/components/expanse/journey-timing.ts)

## Sources of truth

| Area | Implementation |
| --- | --- |
| Authored scene parameters and camera path | [parameters.ts](../src/components/expanse/parameters.ts) |
| Deterministic world geometry, heightfield, clearance, and city layout | [world.ts](../src/components/expanse/world.ts), [skyline.ts](../src/components/expanse/skyline.ts), and [world checks](../scripts/check-expanse.mjs) |
| Sky and aerial perspective | [sky-field.ts](../src/components/expanse/sky-field.ts) and [atmosphere.ts](../src/components/expanse/atmosphere.ts) |
| Near-ground sand and the approach shelter | [sand-transport.ts](../src/components/expanse/sand-transport.ts) and [sandstorm.ts](../src/components/expanse/sandstorm.ts) |
| Approved copy, subtitle windows, and brand handoff | [narrative.ts](../src/components/expanse/narrative.ts) and [ExpanseNarrative](../src/components/expanse/ExpanseNarrative.tsx) |
| Observation placement and visibility | [parameters.ts](../src/components/expanse/parameters.ts), [ObservationProjection](../src/components/expanse/ObservationProjection.tsx), and [ExpanseSignals](../src/components/expanse/ExpanseSignals.tsx) |

## Integration boundaries

- Use native scroll to drive reversible camera travel. Cinematic subtitle and brand timing can run independently within their scene windows. Keep the story's approved Chinese text and the brand reveal separate. Keep the transcript accessible in reduced motion and on WebGL failure.
- Scene-linked observation cards have authored transforms. Keep their debug wiring in the Expanse adapter and the transform inspector reusable in other browser-based Three.js projects. Use the export schema's parent-local position, XYZW quaternion, and scale when applying reviewed transforms. [Expanse adapter](../src/components/expanse/ExpanseTransformEditor.tsx) · [Transform Inspector](../src/tools/transform-inspector/README.md)
- Use the root audio provider for music, scene wind, and synthesized cues. Keep sound opt-in and let an enabled audio session continue across tab changes. The Canvas visibility policy only governs visual rendering. [AudioProvider](../src/components/audio/AudioProvider.tsx) · [Audio engine](../src/components/audio/site-audio.ts)
