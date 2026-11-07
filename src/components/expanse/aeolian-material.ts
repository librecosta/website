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
    duneBend: { value: new Vector2(...ripples.bend) },
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
        uniform vec2 duneWind, duneBend, duneAA;
        uniform vec4 duneBroad, duneFine;
        uniform float duneSpacingWarp, duneRoughness;

        float duneFilter(float cycles, float depth, vec2 distanceFade) {
          float footprint = length(vec2(dFdx(cycles), dFdy(cycles)));
          return (1.0 - smoothstep(duneAA.x, duneAA.y, footprint))
               * (1.0 - smoothstep(distanceFade.x, distanceFade.y, depth));
        }

        float duneHash(vec2 p) {
          vec3 a = fract(vec3(p.xyx) * vec3(0.1031, 0.1099, 0.0973));
          a += dot(a, a.yzx + 33.33);
          return fract((a.x + a.y) * a.z);
        }

        // Value and analytic gradient of a C1 lattice, used only for broad
        // phase bending. It does not supply any grain or color.
        vec3 duneWarp(vec2 p) {
          vec2 cell = floor(p), f = fract(p);
          vec2 t = f * f * (3.0 - 2.0 * f), dt = 6.0 * f * (1.0 - f);
          float a = duneHash(cell), b = duneHash(cell + vec2(1, 0));
          float c = duneHash(cell + vec2(0, 1)), d = duneHash(cell + vec2(1, 1));
          float lo = mix(a, b, t.x), hi = mix(c, d, t.x);
          return vec3(2.0 * mix(lo, hi, t.y) - 1.0, 2.0 * dt * vec2(mix(b - a, d - c, t.y), hi - lo));
        }

        vec2 duneMicroGradient(vec2 q, float depth) {
          float k1 = PI2 / 171.0, k2 = PI2 / 94.0, k3 = PI2 / 329.0;
          float crossPhase = k1 * q.y + 0.53 * sin(k3 * q.x);
          float obliquePhase = k2 * (q.y + 0.29 * q.x) + 1.17;
          vec2 warpScale = vec2(59.0, 83.0);
          vec3 warp = duneWarp(q / warpScale + vec2(0.61, 1.87));
          float s = q.x + duneBend.x * sin(crossPhase) + duneBend.y * sin(obliquePhase)
            + duneSpacingWarp * warp.x;
          vec2 ds = vec2(1.0, 0.0)
            + duneBend.x * cos(crossPhase) * vec2(0.53 * k3 * cos(k3 * q.x), k1)
            + duneBend.y * cos(obliquePhase) * vec2(0.29 * k2, k2)
            + duneSpacingWarp * warp.yz / warpScale;

          float broad = s / duneBroad.x, sharp = 2.0 * broad;
          float fineK = PI2 / 46.0;
          float finePhase = fineK * (q.y - 0.18 * q.x);
          float fine = (s + 0.92 * sin(finePhase)) / duneFine.x + 0.27;
          vec2 df = (ds + 0.92 * fineK * cos(finePhase) * vec2(-0.18, 1.0)) / duneFine.x;
          // Analytic derivatives of a micro-height wave and its lee-side
          // harmonic. Filter each frequency before it contributes to the normal.
          float a = cos(PI2 * broad) * duneFilter(broad, depth, duneBroad.zw);
          float b = 0.32 * cos(PI2 * sharp + 0.72) * duneFilter(sharp, depth, duneBroad.zw);
          float c = cos(PI2 * fine) * duneFilter(fine, depth, duneFine.zw);
          return PI2 * (ds * (duneBroad.y / duneBroad.x) * (a + b) + df * duneFine.y * c);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        vec2 acrossWind = vec2(-duneWind.y, duneWind.x);
        vec2 duneQ = vec2(dot(vDuneWorld, duneWind), dot(vDuneWorld, acrossWind));
        float bed = sin(PI2 * (duneQ.y / 237.0 + duneQ.x / 371.0))
          * sin(PI2 * (duneQ.y / 159.0 - duneQ.x / 287.0) + 1.3);
        if (duneFinish) roughnessFactor += duneRoughness * bed;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (duneRipples) {
          float beds = clamp(0.52 + 0.48 * bed
            + 0.17 * sin(PI2 * (duneQ.y / 113.0 - duneQ.x / 181.0) + 2.4), 0.10, 0.95);
          vec2 gradient = beds * duneMicroGradient(duneQ, length(vViewPosition));
          vec2 xz = duneWind * gradient.x + acrossWind * gradient.y;
          vec3 viewGradient = mat3(viewMatrix) * vec3(xz.x, 0.0, xz.y);
          // For H(x,z) + h(x,z), add (-dh/dx, 0, -dh/dz) to the
          // heightfield normal before normalization (in view space here).
          normal = normalize(normal - dot(normal, viewMatrix[1].xyz) * viewGradient);
        }`);
  };
  return { material, uniforms };
}
