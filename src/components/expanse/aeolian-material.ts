import { MeshStandardMaterial, Vector2, Vector4 } from 'three';
import { EXPANSE } from './parameters';

export function createAeolianMaterial() {
  const { sand, wind, ripples } = EXPANSE.aeolian;
  const material = new MeshStandardMaterial({ ...sand, metalness: 0 });
  const uniforms = {
    duneWind: { value: new Vector2(...wind).normalize() },
    duneBroad: { value: new Vector4(...ripples.broad) },
    duneFine: { value: new Vector4(...ripples.fine) },
    duneBedScale: { value: new Vector2(...ripples.bedScale) },
    duneBedFade: { value: new Vector2(...ripples.bedFade) },
    duneBedRelief: { value: ripples.bedRelief },
    duneBedTint: { value: ripples.bedTint },
    duneWarpScale: { value: new Vector2(...ripples.warpScale) },
    duneBedPhase: { value: ripples.bedPhaseWarp },
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
        uniform vec2 duneWind, duneWarpScale, duneAA, duneBedScale, duneBedFade;
        uniform vec4 duneBroad, duneFine;
        uniform float duneBedPhase, duneSpacingWarp, duneRoughness, duneBedRelief, duneBedTint;

        float duneFootprint(vec2 phaseGradient, vec2 pixelX, vec2 pixelY) {
          return length(vec2(dot(phaseGradient, pixelX), dot(phaseGradient, pixelY)));
        }

        float duneFilter(vec2 phaseGradient, vec2 pixelX, vec2 pixelY, float depth, vec2 distanceFade) {
          return (1.0 - smoothstep(duneAA.x, duneAA.y, duneFootprint(phaseGradient, pixelX, pixelY)))
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

        vec3 duneSurface(vec2 q, vec2 pixelX, vec2 pixelY, float depth, vec3 exposure) {
          vec3 warp = duneWarp(q / duneWarpScale + vec2(0.61, 1.87));
          // The low-frequency wind bed bends both wavelengths without a repeated arc.
          float distance = q.x + duneSpacingWarp * warp.x;
          vec2 direction = vec2(1.0, 0.0) + duneSpacingWarp * warp.yz / duneWarpScale;

          // A wind-aligned, irregular bed interrupts the narrow crests.
          const float bedShear = 0.15;
          vec3 bed = duneWarp(vec2(distance + bedShear * q.y, q.y) / duneBedScale + vec2(5.24, 0.93));
          vec2 bedCross = vec2(0.0, 1.0 / duneBedScale.y);
          vec2 bedAlong = (direction + vec2(0.0, bedShear)) / duneBedScale.x;
          float bedFootprint = 0.6 * max(duneFootprint(bedAlong, pixelX, pixelY), duneFootprint(bedCross, pixelX, pixelY));
          float bedFilter = (1.0 - smoothstep(duneAA.x, duneAA.y, bedFootprint))
            * (1.0 - smoothstep(duneBedFade.x, duneBedFade.y, depth));
          vec2 bedGradient = bed.y * bedAlong + bed.z * bedCross;
          vec2 gradient = exposure.x * duneBedRelief * bedFilter * bedGradient;
          float coverage = smoothstep(-0.27, 0.59, 0.46 * warp.x + 0.87 * bed.x);
          distance += duneBedPhase * bed.x;
          direction += duneBedPhase * bedGradient;
          vec2 broadGradient = direction / duneBroad.x;
          if (depth < duneBroad.w) {
            float broad = cos(PI2 * distance / duneBroad.x)
              * duneFilter(broadGradient, pixelX, pixelY, depth, duneBroad.zw);
            gradient += exposure.y * PI2 * broadGradient * duneBroad.y * broad * mix(0.06, 1.0, coverage);
          }
          if (depth < duneFine.w) {
            // The finer crests share the wind but fan slightly through the main bed.
            float fine = (distance + 0.075 * q.y) / duneFine.x + 0.27;
            vec2 fineGradient = (direction + vec2(0.0, 0.075)) / duneFine.x;
            float response = cos(PI2 * fine) * duneFilter(fineGradient, pixelX, pixelY, depth, duneFine.zw);
            gradient += exposure.z * PI2 * fineGradient * duneFine.y * response * mix(0.12, 1.0, coverage);
          }
          return vec3(bed.x * bedFilter, gradient);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        vec2 acrossWind = vec2(-duneWind.y, duneWind.x);
        vec2 duneQ = vec2(dot(vDuneWorld, duneWind), dot(vDuneWorld, acrossWind));
        // Evaluate derivatives before branching by depth.
        vec2 pixelX = dFdx(duneQ), pixelY = dFdy(duneQ);
        float duneDepth = length(vViewPosition);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (duneDepth < duneBedFade.y) {
          float up = clamp(dot(normal, viewMatrix[1].xyz), 0.0, 1.0);
          vec3 viewWind = mat3(viewMatrix) * vec3(duneWind.x, 0.0, duneWind.y);
          float facing = dot(normal, viewWind);
          float stoss = 1.0 - smoothstep(-0.29, -0.025, facing);
          float lee = smoothstep(0.02, 0.25, facing);
          float slip = smoothstep(0.76, 0.95, up);
          // Fine crests quiet first in sheltered sand. Flat toes blend both responses.
          vec3 exposure = vec3(0.80, 0.96, 0.82) + stoss * vec3(0.18, 0.28, 0.48);
          exposure *= (1.0 - lee * vec3(0.49, 0.64, 0.83)) * mix(0.38, 1.0, slip);
          vec3 detail = duneSurface(duneQ, pixelX, pixelY, duneDepth, exposure);
          roughnessFactor += duneRoughness * detail.x * exposure.x;
          diffuseColor.rgb *= 1.0 + duneBedTint * detail.x * exposure.x * vec3(0.90, 1.05, 1.22);
          vec2 gradient = detail.yz;
          vec2 xz = duneWind * gradient.x + acrossWind * gradient.y;
          vec3 viewGradient = mat3(viewMatrix) * vec3(xz.x, 0.0, xz.y);
          // The horizontal gradient changes shading, not the dune silhouette.
          normal = normalize(normal - up * viewGradient);
        }`);
  };
  return material;
}
