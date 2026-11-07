import { MeshStandardMaterial, Vector2, Vector4 } from 'three';
import { EXPANSE } from './parameters';

export function createAeolianMaterial() {
  const { sand, wind, ripples } = EXPANSE.aeolian;
  const material = new MeshStandardMaterial({ ...sand, metalness: 0 });
  const uniforms = {
    duneRipples: { value: false },
    duneFinish: { value: false },
    duneWind: { value: new Vector2(...wind).normalize() },
    duneBroad: { value: new Vector4(...ripples.broad) },
    duneFine: { value: new Vector4(...ripples.fine) },
    duneWarpScale: { value: new Vector2(...ripples.warpScale) },
    duneBend: { value: ripples.bend },
    duneSpacingWarp: { value: ripples.spacingWarp },
    duneAA: { value: new Vector2(...ripples.antialias) },
    duneRoughness: { value: ripples.roughnessVariation },
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDuneWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvDuneWorld = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vDuneWorld;
        uniform bool duneRipples, duneFinish;
        uniform vec2 duneWind, duneWarpScale, duneAA;
        uniform vec4 duneBroad, duneFine;
        uniform float duneBend, duneSpacingWarp, duneRoughness;

        float duneFilter(vec2 phaseGradient, vec2 pixelX, vec2 pixelY, float depth, vec2 distanceFade) {
          float footprint = length(vec2(dot(phaseGradient, pixelX), dot(phaseGradient, pixelY)));
          return (1.0 - smoothstep(duneAA.x, duneAA.y, footprint))
               * (1.0 - smoothstep(distanceFade.x, distanceFade.y, depth));
        }

        float duneHash(vec2 p) {
          vec3 a = fract(vec3(p.xyx) * vec3(0.1031, 0.1099, 0.0973));
          a += dot(a, a.yzx + 33.33);
          return fract((a.x + a.y) * a.z);
        }

        // One continuous field supplies broad phase bending and quiet patches.
        vec3 duneWarp(vec2 p) {
          vec2 cell = floor(p), f = fract(p);
          vec2 t = f * f * (3.0 - 2.0 * f), dt = 6.0 * f * (1.0 - f);
          float a = duneHash(cell), b = duneHash(cell + vec2(1, 0));
          float c = duneHash(cell + vec2(0, 1)), d = duneHash(cell + vec2(1, 1));
          float lo = mix(a, b, t.x), hi = mix(c, d, t.x);
          return vec3(2.0 * mix(lo, hi, t.y) - 1.0, 2.0 * dt * vec2(mix(b - a, d - c, t.y), hi - lo));
        }

        vec2 duneMicroGradient(vec2 q, vec2 pixelX, vec2 pixelY, float depth) {
          vec3 warp = duneWarp(q / duneWarpScale + vec2(0.61, 1.87));
          vec2 bendDirection = (PI2 / 210.0) * vec2(0.14, 1.0);
          float bendPhase = dot(q, bendDirection);
          float distance = q.x + duneBend * sin(bendPhase) + duneSpacingWarp * warp.x;
          vec2 direction = vec2(1.0, 0.0) + duneBend * cos(bendPhase) * bendDirection
            + duneSpacingWarp * warp.yz / duneWarpScale;

          float coverage = smoothstep(-0.66, 0.37, warp.x);
          vec2 broadGradient = direction / duneBroad.x;
          float broad = cos(PI2 * distance / duneBroad.x)
            * duneFilter(broadGradient, pixelX, pixelY, depth, duneBroad.zw);
          vec2 gradient = broadGradient * duneBroad.y * broad * mix(0.06, 1.0, coverage);
          if (depth < duneFine.w) {
            // The finer crests share the wind but fan slightly through the main bed.
            float fine = (distance + 0.075 * q.y) / duneFine.x + 0.27;
            vec2 fineGradient = (direction + vec2(0.0, 0.075)) / duneFine.x;
            float response = cos(PI2 * fine) * duneFilter(fineGradient, pixelX, pixelY, depth, duneFine.zw);
            gradient += fineGradient * duneFine.y * response * mix(0.28, 0.80, coverage);
          }
          return PI2 * gradient;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        vec2 acrossWind = vec2(-duneWind.y, duneWind.x);
        vec2 duneQ = vec2(dot(vDuneWorld, duneWind), dot(vDuneWorld, acrossWind));
        float bed = sin(PI2 * (duneQ.y / 237.0 + duneQ.x / 371.0))
          * sin(PI2 * (duneQ.y / 159.0 - duneQ.x / 287.0) + 1.3);
        if (duneFinish) roughnessFactor += duneRoughness * bed;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (duneRipples) {
          // Derivatives must be evaluated before any pixel-dependent branch.
          vec2 pixelX = dFdx(duneQ), pixelY = dFdy(duneQ);
          float depth = length(vViewPosition);
          if (depth < duneBroad.w) {
            float up = clamp(dot(normal, viewMatrix[1].xyz), 0.0, 1.0);
            float slope = sqrt(max(0.0, 1.0 - up * up));
            vec3 viewWind = mat3(viewMatrix) * vec3(duneWind.x, 0.0, duneWind.y);
            float lee = dot(normal, viewWind);
            // Keep more detail on windward slopes, with quiet lee slopes and
            // the strongest attenuation on steep faces.
            float exposure = mix(1.48, 0.36, smoothstep(-0.18, 0.24, lee));
            exposure *= 1.0 - 0.64 * smoothstep(0.28, 0.65, slope);
            vec2 gradient = exposure * duneMicroGradient(duneQ, pixelX, pixelY, depth);
            vec2 xz = duneWind * gradient.x + acrossWind * gradient.y;
            vec3 viewGradient = mat3(viewMatrix) * vec3(xz.x, 0.0, xz.y);
            // The horizontal gradient changes shading, not the dune silhouette.
            normal = normalize(normal - up * viewGradient);
          }
        }`);
  };
  return { material, uniforms };
}
