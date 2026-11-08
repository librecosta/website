import { Vector2, Vector3, Vector4, type DataArrayTexture, type DataTexture, type MeshStandardMaterial } from 'three';
import { createMineralGrain, MINERAL_GRAIN_CELLS } from './monument-grain';
import { createInscriptionTexture } from './monument-inscription';
import { EXPANSE, MONUMENT_LAYERS, type InscriptionFinish, type MonumentFinish, type MonumentLayer } from './parameters';

const layers = Object.keys(MONUMENT_LAYERS);
const layerIndex = (layer: MonumentLayer) => layers.indexOf(layer);

export function createMonumentStudy(gray: MeshStandardMaterial) {
  const { scale, finish, topScale, groove } = EXPANSE.hero;
  const { inscription, refined } = finish;
  let bakedTier = -1;
  const material = gray.clone();
  const uniforms = {
    steleSize: { value: new Vector3(...scale) },
    steleDepositSize: { value: new Vector3(...finish.depositSize) },
    steleDepositFade: { value: new Vector2(...finish.depositFade) },
    steleGrainSize: { value: finish.grainSize },
    steleGrainFade: { value: new Vector2(...finish.grainFade) },
    steleFinish: { value: new Vector4() },
    steleLayer: { value: 0 },
    steleHasInscription: { value: false },
    steleInscriptionMap: { value: null as DataArrayTexture | null },
    steleInscriptionResponse: { value: new Vector2() },
    steleRefined: { value: false },
    steleTaper: { value: new Vector2(...topScale) },
    steleSlot: { value: new Vector4(groove.center, groove.width * 0.5, groove.bottom, groove.top) },
    steleSlotDepth: { value: groove.depth },
    steleDressing: { value: new Vector4(refined.marginWidth, refined.marginPolish, refined.grooveRoughness, refined.grooveOcclusion) },
    stelePasses: { value: refined.passes.map(pass => new Vector4(...pass)) },
    stelePassFinish: { value: new Vector2(refined.passRelief, refined.passPolish) },
    steleGrainMap: { value: null as DataTexture | null },
    steleMineral: { value: new Vector4(refined.grainPeriod, refined.grainRelief, refined.grainRoughness, refined.grainOcclusion) },
  };

  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform vec3 steleSize;
        varying vec3 vStelePosition, vSteleFace;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vStelePosition = transformed * steleSize;
        vSteleFace = objectNormal / steleSize;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vStelePosition, vSteleFace;
        uniform vec3 steleSize, steleDepositSize;
        uniform vec2 steleDepositFade, steleGrainFade;
        uniform float steleGrainSize;
        uniform vec4 steleFinish;
        uniform int steleLayer;
        uniform bool steleHasInscription;
        uniform highp sampler2DArray steleInscriptionMap;
        uniform vec2 steleInscriptionResponse;
        uniform bool steleRefined;
        uniform vec2 steleTaper, stelePassFinish;
        uniform vec4 steleSlot, steleDressing, steleMineral;
        uniform float steleSlotDepth;
        uniform vec4 stelePasses[${refined.passes.length}];
        uniform sampler2D steleGrainMap;

        vec3 steleReadInscription(vec3 p) {
          vec3 face = normalize(vSteleFace);
          vec3 axis = abs(face);
          float height = p.y / steleSize.y + 0.5;
          vec2 halfSpan = 0.5 * steleSize.xz * mix(vec2(1.0), steleTaper, height);
          vec2 across = p.xz / (2.0 * halfSpan);
          vec2 uv = vec2(across.x + 0.5, 1.0 - height);
          float chart = 0.0, plane = halfSpan.y - p.z;
          if (axis.y > max(axis.x, axis.z)) {
            uv.y = 0.5 - across.y;
            chart = 3.0;
            plane = steleSize.y * 0.5 - p.y;
          } else if (axis.x > axis.z) {
            uv.x = 0.5 + sign(face.x) * across.y;
            chart = face.x < 0.0 ? 1.0 : 2.0;
            plane = halfSpan.x - abs(p.x);
          }
          // Only outer planes receive the pattern. The actual slot remains a
          // clean cut and is not treated as a projected copy of the facade.
          float exterior = 1.0 - smoothstep(4.0, 17.0, plane);
          vec2 dx = dFdx(uv), dy = dFdy(uv);
          vec3 neutral = vec3(128.0 / 255.0, 0.0, 0.0);
          if (exterior <= 0.0) return neutral;
          return mix(neutral, textureGrad(steleInscriptionMap, vec3(uv, chart), dx, dy).rgb, exterior);
        }

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

        // The cutting head follows the long axis. Adjacent passes stop at different
        // heights, with feathered shoulders from later abrasive wear.
        vec2 steleToolPasses(vec3 p) {
          float feed = p.x + 0.78 * p.z - 0.052 * p.y + 8.0 * sin(p.y * 0.0034);
          float pixel = fwidth(feed);
          vec2 result = vec2(0.0);
          for (int i = 0; i < ${refined.passes.length}; ++i) {
            vec4 pass = stelePasses[i];
            float across = feed - pass.x;
            float entry = smoothstep(-pass.y - pixel, -0.58 * pass.y, across);
            float exit = 1.0 - smoothstep(0.52 * pass.y, pass.y + pixel, across);
            float lengthMask = smoothstep(pass.z, pass.z + 170.0, p.y)
              * (1.0 - smoothstep(pass.w - 160.0, pass.w, p.y));
            float track = entry * exit * lengthMask;
            result.x += track * (0.30 + 0.70 * entry);
            result.y = max(result.y, track);
          }
          return result;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float relief = 0.0, cavity = 0.0, inscriptionMask = 0.0;
        if (steleHasInscription) {
          vec3 drawing = steleReadInscription(vStelePosition);
          float panel = drawing.r - 128.0 / 255.0;
          inscriptionMask = drawing.b;
          diffuseColor.rgb *= 1.0 + 0.28 * panel - steleInscriptionResponse.y * inscriptionMask;
          roughnessFactor += 0.24 * inscriptionMask - 0.31 * panel;
          relief = -steleInscriptionResponse.x * drawing.g;
          cavity = 0.13 * inscriptionMask;
        } else if (steleRefined) {
          vec3 p = vStelePosition;
          vec3 face = abs(normalize(vSteleFace));
          float height = p.y / steleSize.y + 0.5;
          vec2 taper = mix(vec2(1.0), steleTaper, height);
          vec2 halfSpan = 0.5 * steleSize.xz * taper;
          vec2 rim = halfSpan - abs(p.xz);
          // Ignore the distance to the face's own plane. Blend on the modeled bevel.
          float sideRim = mix(rim.y, rim.x, face.z / max(face.x + face.z, 0.001));
          float capRim = 0.5 * steleSize.y - abs(p.y);
          float outerRim = mix(min(sideRim, capRim), min(rim.x, rim.y), smoothstep(0.25, 0.85, face.y));

          float slotX = p.x - steleSlot.x * steleSize.x * taper.x;
          float slotHalfWidth = steleSlot.y * steleSize.x * taper.x;
          float depth = halfSpan.y - p.z;
          float maxDepth = steleSlotDepth * steleSize.z * taper.y;
          vec2 bounds = vec2(abs(slotX) - slotHalfWidth,
            max(steleSlot.z * steleSize.y - p.y, p.y - steleSlot.w * steleSize.y));
          float aperture = length(max(bounds, vec2(0.0))) + min(max(bounds.x, bounds.y), 0.0);
          float recess = smoothstep(4.0, 33.0, depth)
            * (1.0 - smoothstep(0.0, 5.0, aperture))
            * (1.0 - smoothstep(maxDepth + 4.0, maxDepth + 10.0, depth));
          float shoulder = (1.0 - smoothstep(4.0, 24.0, depth))
            * (1.0 - smoothstep(4.0, steleDressing.x, abs(aperture)));
          float rimPolish = 0.84 * (1.0 - smoothstep(5.0, steleDressing.x, outerRim));
          float dressed = max(rimPolish * (1.0 - recess), shoulder);
          float innerDepth = smoothstep(12.0, maxDepth, depth);
          float junction = smoothstep(-19.0, 0.0, max(bounds.x, bounds.y));
          cavity = steleDressing.w * recess * (0.35 + innerDepth * (0.46 + 0.19 * junction));

          vec2 passes = steleToolPasses(p);
          // Low, sand-exposed faces have lost more of the original tool relief.
          float survivingTool = mix(0.58, 1.0, smoothstep(-660.0, 400.0, p.y));
          float toolExposure = survivingTool * (1.0 - recess) * (1.0 - 0.75 * dressed) * (1.0 - face.y);
          roughnessFactor += steleDressing.z * recess - steleDressing.y * dressed
            - stelePassFinish.y * passes.y * toolExposure;
          relief = stelePassFinish.x * passes.x * toolExposure;

          // One oblique section stays continuous across front, side and groove.
          // Mips filter the packed grain height/roughness/contact before they affect lighting.
          vec2 grainUv = vec2(p.x + 0.81 * p.z, p.y + 0.36 * p.z - 0.17 * p.x) / steleMineral.x;
          vec2 grainX = dFdx(grainUv), grainY = dFdy(grainUv);
          float grainPixel = float(${MINERAL_GRAIN_CELLS}) * max(length(grainX), length(grainY));
          float grainWeight = (1.0 - smoothstep(0.22, 0.57, grainPixel)) * (1.0 - 0.73 * dressed);
          if (grainWeight > 0.0) {
            vec3 grain = textureGrad(steleGrainMap, grainUv, grainX, grainY).rgb;
            relief += steleMineral.y * grainWeight * (grain.r - 0.35);
            roughnessFactor += steleMineral.z * grainWeight * (grain.g - 0.5);
            cavity += steleMineral.w * grainWeight * grain.b;
          }
        } else {
          float steleDistance = length(vViewPosition);
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
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        reflectedLight.indirectDiffuse *= 1.0 - cavity;`)
      .replace('#include <colorspace_fragment>', `
        #include <colorspace_fragment>
        if (steleLayer == ${layerIndex('color')}) gl_FragColor.rgb = linearToOutputTexel(vec4(diffuseColor.rgb, 1.0)).rgb;
        if (steleLayer == ${layerIndex('mask')}) gl_FragColor.rgb = vec3(inscriptionMask);
        if (steleLayer == ${layerIndex('roughness')}) gl_FragColor.rgb = vec3(material.roughness);
        if (steleLayer == ${layerIndex('normal')}) {
          gl_FragColor.rgb = 0.5 + 0.5 * normalize(steleBaseNormal + 6.0 * (normal - steleBaseNormal));
        }
        if (steleLayer == ${layerIndex('cavity')}) gl_FragColor.rgb = vec3(1.0 - cavity);`);
  };

  function select(finishName: Exclude<MonumentFinish, 'gray'>, layer: MonumentLayer) {
    const designed = Object.hasOwn(inscription.looks, finishName);
    uniforms.steleHasInscription.value = designed;
    uniforms.steleRefined.value = finishName === 'refined';
    if (designed) {
      const look = inscription.looks[finishName as InscriptionFinish];
      if (bakedTier !== look.tier) {
        const texture = createInscriptionTexture(look.tier);
        uniforms.steleInscriptionMap.value?.dispose();
        uniforms.steleInscriptionMap.value = texture;
        bakedTier = look.tier;
      }
      material.color.set(inscription.color);
      material.roughness = inscription.roughness;
      uniforms.steleInscriptionResponse.value.set(look.relief, look.contrast);
    } else {
      const study = finishName === 'refined' ? refined : finish.studies[finishName as keyof typeof finish.studies];
      material.color.set(study.color);
      material.roughness = study.roughness;
      if (finishName === 'refined') uniforms.steleGrainMap.value ??= createMineralGrain();
      if ('deposit' in study) {
        uniforms.steleFinish.value.set(study.deposit, study.grain, study.roughnessVariation, study.relief);
      }
    }
    uniforms.steleLayer.value = layerIndex(layer);
    const fog = layer === 'full';
    if (material.fog !== fog) {
      material.fog = fog;
      material.needsUpdate = true;
    }
  }

  function dispose() {
    uniforms.steleInscriptionMap.value?.dispose();
    uniforms.steleInscriptionMap.value = null;
    bakedTier = -1;
    uniforms.steleGrainMap.value?.dispose();
    uniforms.steleGrainMap.value = null;
    material.dispose();
  }

  return { material, select, dispose };
}
