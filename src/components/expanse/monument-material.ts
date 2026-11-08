import { Vector2, Vector3, Vector4, type MeshStandardMaterial } from 'three';
import { EXPANSE, type MonumentFinish } from './parameters';

export function createMonumentStudy(gray: MeshStandardMaterial) {
  const { scale, finish } = EXPANSE.hero;
  const material = gray.clone();
  const uniforms = {
    steleSize: { value: new Vector3(...scale) },
    steleDepositSize: { value: new Vector3(...finish.depositSize) },
    steleDepositFade: { value: new Vector2(...finish.depositFade) },
    steleGrainSize: { value: finish.grainSize },
    steleGrainFade: { value: new Vector2(...finish.grainFade) },
    steleFinish: { value: new Vector4() },
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
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float steleDistance = length(vViewPosition);
        // Sample in object space so the material crosses bevels and groove walls without seams.
        vec3 depositPosition = vStelePosition + vec3(0.19 * vStelePosition.y, 0.0, 0.0);
        depositPosition = depositPosition / steleDepositSize + vec3(7.21, 3.17, 2.56);
        vec3 grainPosition = vStelePosition / steleGrainSize + vec3(1.26, 9.31, 5.83);
        float depositWeight = (1.0 - smoothstep(steleDepositFade.x, steleDepositFade.y, steleDistance))
          * steleFilter(dFdx(depositPosition), dFdy(depositPosition));
        float grainWeight = (1.0 - smoothstep(steleGrainFade.x, steleGrainFade.y, steleDistance))
          * steleFilter(dFdx(grainPosition), dFdy(grainPosition));
        float deposit = 0.0, grain = 0.0;
        if (depositWeight > 0.0) deposit = depositWeight * steleNoise(depositPosition);
        if (grainWeight > 0.0) grain = grainWeight * steleNoise(grainPosition);
        diffuseColor.rgb *= 1.0 + steleFinish.x * deposit * vec3(0.82, 1.0, 1.18) + steleFinish.y * grain;
        roughnessFactor += steleFinish.z * (0.7 * deposit + 0.3 * grain);
        float relief = steleFinish.w * grain;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // Surface gradient from the procedural height and the view-space surface basis.
        vec2 heightGradient = vec2(dFdx(relief), dFdy(relief));
        vec3 surfaceX = dFdx(-vViewPosition), surfaceY = dFdy(-vViewPosition);
        vec3 acrossX = cross(surfaceY, normal), acrossY = cross(normal, surfaceX);
        float determinant = dot(surfaceX, acrossX);
        vec3 gradient = heightGradient.x * acrossX + heightGradient.y * acrossY;
        normal = normalize(normal - sign(determinant) * gradient / max(abs(determinant), 1e-5));`);
  };

  function select(finishName: Exclude<MonumentFinish, 'gray'>) {
    const study = finish.studies[finishName];
    material.color.set(study.color);
    material.roughness = study.roughness;
    uniforms.steleFinish.value.set(study.deposit, study.grain, study.roughnessVariation, study.relief);
  }

  return { material, select };
}
