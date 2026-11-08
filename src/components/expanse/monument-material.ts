import { Vector2, Vector3, Vector4, type MeshStandardMaterial } from 'three';
import { EXPANSE, MONUMENT_LAYERS, type MonumentFinish, type MonumentLayer } from './parameters';

const layers = Object.keys(MONUMENT_LAYERS);
const layerIndex = (layer: MonumentLayer) => layers.indexOf(layer);

export function createMonumentStudy(gray: MeshStandardMaterial) {
  const { scale, finish } = EXPANSE.hero;
  const { refined } = finish;
  const material = gray.clone();
  const uniforms = {
    steleSize: { value: new Vector3(...scale) },
    steleDepositSize: { value: new Vector3(...finish.depositSize) },
    steleDepositFade: { value: new Vector2(...finish.depositFade) },
    steleGrainSize: { value: finish.grainSize },
    steleGrainFade: { value: new Vector2(...finish.grainFade) },
    steleFinish: { value: new Vector4() },
    steleLayer: { value: 0 },
    steleRefined: { value: false },
    steleAbrasionPitch: { value: new Vector3(...refined.abrasionPitch) },
    steleAbrasionSlope: { value: new Vector2(...refined.abrasionSlope) },
    steleAbrasionBend: { value: refined.abrasionBend },
    steleGrainPitch: { value: refined.grainPitch },
    steleRelief: { value: new Vector2(refined.abrasionRelief, refined.grainRelief) },
    steleSurface: { value: new Vector3(refined.depositTint, refined.abrasionRoughness, refined.grainRoughness) },
  };

  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform vec3 steleSize;
        varying vec3 vStelePosition;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vStelePosition = transformed * steleSize;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vStelePosition;
        uniform vec3 steleDepositSize;
        uniform vec2 steleDepositFade, steleGrainFade;
        uniform float steleGrainSize;
        uniform vec4 steleFinish;
        uniform int steleLayer;
        uniform bool steleRefined;
        uniform vec3 steleAbrasionPitch, steleSurface;
        uniform vec2 steleAbrasionSlope, steleRelief;
        uniform float steleAbrasionBend, steleGrainPitch;

        float steleHash(vec3 cell) {
          cell = fract(cell * vec3(0.1031, 0.11369, 0.13787));
          cell += dot(cell, cell.yzx + 19.19);
          return fract((cell.x + cell.y) * cell.z);
        }

        float steleNoise(vec3 p) {
          vec3 cell = floor(p), t = fract(p);
          t = t * t * (3.0 - 2.0 * t);
          float a = mix(steleHash(cell), steleHash(cell + vec3(1, 0, 0)), t.x);
          float b = mix(steleHash(cell + vec3(0, 1, 0)), steleHash(cell + vec3(1, 1, 0)), t.x);
          float c = mix(steleHash(cell + vec3(0, 0, 1)), steleHash(cell + vec3(1, 0, 1)), t.x);
          float d = mix(steleHash(cell + vec3(0, 1, 1)), steleHash(cell + vec3(1, 1, 1)), t.x);
          return 2.0 * mix(mix(a, b, t.y), mix(c, d, t.y), t.z) - 1.0;
        }

        float steleFilter(vec3 pixelX, vec3 pixelY) {
          return 1.0 - smoothstep(0.22, 0.62, max(length(pixelX), length(pixelY)));
        }

        vec3 steleCellVariation(vec3 cell) {
          vec3 hash = fract(cell * vec3(0.1031, 0.1030, 0.0973));
          hash += dot(hash, hash.yxz + 33.33);
          return fract((hash.xxy + hash.yxx) * hash.zyx);
        }

        float steleAbrasion(vec3 position, float pixel) {
          vec3 seed = steleCellVariation(floor(position));
          vec3 p = fract(position) - mix(vec3(0.38, 0.25, 0.38), vec3(0.62, 0.75, 0.62), seed);
          // Interrupted, shallow tooling traces. The warped lens tapers at both ends.
          p.y += (seed.z - 0.5) * (0.32 * p.x * p.x - 0.19 * p.z);
          float radius = length(p * vec3(mix(3.0, 5.4, seed.y), mix(4.8, 6.6, seed.x), 3.2));
          float profile = 1.0 - smoothstep(0.66 - 0.7 * pixel, 1.0, radius);
          return profile * smoothstep(0.06, 0.96, seed.z);
        }

        float steleMineralGrain(vec3 position, float pixel) {
          vec3 seed = steleCellVariation(floor(position));
          vec3 center = mix(vec3(0.135), vec3(0.865), seed);
          // Let inclusion centers wander, and taper their size before the next cell.
          vec3 extent = min(min(center, 1.0 - center) - 0.015, mix(vec3(0.18), vec3(0.38), seed.yzx));
          vec3 axis = abs(fract(position) - center) / extent;
          float face = max(max(axis.x, axis.y), axis.z);
          float radius = face + 0.33 * (axis.x + axis.y + axis.z - face);
          float profile = 1.0 - smoothstep(0.60 - 0.85 * pixel, 1.0, radius);
          return profile * mix(-0.40, 1.0, seed.z);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float deposit = 0.0, grain = 0.0, relief = 0.0;
        // Both studies use local 3D coordinates, continuous over edges and inside the groove.
        if (steleRefined) {
          vec3 abrasionPosition = vStelePosition;
          vec2 span = vec2(vStelePosition.x + 0.72 * vStelePosition.z, vStelePosition.y);
          float bend = sin(dot(span, vec2(0.009, 0.006))) + 0.42 * sin(dot(span, vec2(0.023, -0.013)));
          abrasionPosition.y += dot(vStelePosition.xz, steleAbrasionSlope) + steleAbrasionBend * bend;
          abrasionPosition.xz += vec2(0.36, -0.29) * vStelePosition.y;
          abrasionPosition = abrasionPosition / steleAbrasionPitch + vec3(8.3, 2.7, 7.1);
          // Cut through the inclusion field obliquely so broad stone faces cannot line up with a grid slice.
          const mat3 grainBasis = mat3(vec3(0.80, -0.36, 0.48), vec3(0.60, 0.48, -0.64), vec3(0.0, 0.80, 0.60));
          vec3 grainPosition = grainBasis * vStelePosition / steleGrainPitch + vec3(3.6, 6.8, 9.2);
          grainPosition += bend * vec3(0.37, -0.21, 0.62);
          // Soften edges before minification and skip unresolvable fields.
          float abrasionPixel = max(length(dFdx(abrasionPosition)), length(dFdy(abrasionPosition)));
          float grainPixel = max(length(dFdx(grainPosition)), length(dFdy(grainPosition)));
          float abrasionWeight = 1.0 - smoothstep(0.22, 0.65, abrasionPixel);
          float grainWeight = 1.0 - smoothstep(0.21, 0.49, grainPixel);
          if (abrasionWeight > 0.0) deposit = abrasionWeight * steleAbrasion(abrasionPosition, abrasionPixel);
          if (grainWeight > 0.0) grain = grainWeight * steleMineralGrain(grainPosition, grainPixel);
          diffuseColor.rgb *= 1.0 + steleSurface.x * deposit * vec3(1.0, 0.87, 0.70);
          roughnessFactor += steleSurface.z * grain - steleSurface.y * deposit;
          relief = steleRelief.y * grain - steleRelief.x * deposit;
        } else {
          float steleDistance = length(vViewPosition);
          vec3 depositPosition = vStelePosition + vec3(0.19 * vStelePosition.y, 0.0, 0.0);
          depositPosition = depositPosition / steleDepositSize + vec3(7.21, 3.17, 2.56);
          vec3 grainPosition = vStelePosition / steleGrainSize + vec3(1.26, 9.31, 5.83);
          float depositWeight = (1.0 - smoothstep(steleDepositFade.x, steleDepositFade.y, steleDistance))
            * steleFilter(dFdx(depositPosition), dFdy(depositPosition));
          float grainWeight = (1.0 - smoothstep(steleGrainFade.x, steleGrainFade.y, steleDistance))
            * steleFilter(dFdx(grainPosition), dFdy(grainPosition));
          if (depositWeight > 0.0) deposit = depositWeight * steleNoise(depositPosition);
          if (grainWeight > 0.0) grain = grainWeight * steleNoise(grainPosition);
          diffuseColor.rgb *= 1.0 + steleFinish.x * deposit * vec3(0.82, 1.0, 1.18) + steleFinish.y * grain;
          roughnessFactor += steleFinish.z * (0.7 * deposit + 0.3 * grain);
          relief = steleFinish.w * grain;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 steleBaseNormal = normal;
        // Surface gradient from the procedural height and the view-space surface basis.
        vec2 heightGradient = vec2(dFdx(relief), dFdy(relief));
        vec3 surfaceX = dFdx(-vViewPosition), surfaceY = dFdy(-vViewPosition);
        vec3 acrossX = cross(surfaceY, normal), acrossY = cross(normal, surfaceX);
        float determinant = dot(surfaceX, acrossX);
        vec3 gradient = heightGradient.x * acrossX + heightGradient.y * acrossY;
        normal = normalize(normal - sign(determinant) * gradient / max(abs(determinant), 1e-5));`)
      .replace('#include <opaque_fragment>', `
        #include <opaque_fragment>
        if (steleLayer == ${layerIndex('color')}) gl_FragColor.rgb = diffuse;
        if (steleLayer == ${layerIndex('deposit')}) gl_FragColor.rgb = vec3(0.32 + 0.26 * deposit);
        if (steleLayer == ${layerIndex('grain')}) gl_FragColor.rgb = vec3(0.32 + 0.26 * grain);
        if (steleLayer == ${layerIndex('normal')}) gl_FragColor.rgb = clamp(0.32 + 9.0 * (normal - steleBaseNormal), 0.0, 1.0);`);
  };

  function select(finishName: Exclude<MonumentFinish, 'gray'>, layer: MonumentLayer) {
    const study = finishName === 'refined' ? refined : finish.studies[finishName];
    material.color.set(study.color);
    material.roughness = study.roughness;
    uniforms.steleRefined.value = finishName === 'refined';
    if ('deposit' in study) {
      uniforms.steleFinish.value.set(study.deposit, study.grain, study.roughnessVariation, study.relief);
    }
    uniforms.steleLayer.value = layerIndex(layer);
    const fog = layer === 'full';
    if (material.fog !== fog) {
      material.fog = fog;
      material.needsUpdate = true;
    }
  }

  return { material, select };
}
