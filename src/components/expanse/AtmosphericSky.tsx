'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { Vector2, Vector3 } from 'three';
import { sampleSky, type Atmosphere } from './atmosphere';
import { EXPANSE, type SkyLayers } from './parameters';
import { createSkyField } from './sky-field';

const triangle = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
const vertex = /* glsl */ `
  varying vec3 vWorldRay;

  void main() {
    vec3 ray = vec3(position.xy / vec2(projectionMatrix[0][0], projectionMatrix[1][1]), -1.0);
    vWorldRay = transpose(mat3(viewMatrix)) * ray;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;
const fragment = /* glsl */ `
  varying vec3 vWorldRay;
  uniform sampler2D skyField;
  uniform vec3 skyBroadTint;
  uniform vec2 skyFieldFade;
  uniform float skyVeilOpacity;
  uniform bool skyBroad, skyVeil, skyMicro;
  ${sampleSky}

  void main() {
    vec3 ray = normalize(vWorldRay);
    vec3 radiance = skyRadiance(ray);
    if (skyBroad || skyVeil) {
      float elevation = max(0.0, ray.y);
      float fade = smoothstep(skyFieldFade.x, skyFieldFade.y, elevation);
      vec2 uv = vec2(0.5 + atan(ray.x, -ray.z + 1e-7) / 6.2831853, elevation);
      vec2 masks = texture2D(skyField, uv).rg;
      if (skyBroad) {
        radiance += (2.0 * masks.r - 1.0) * fade * skyBroadTint;
      }
      if (skyVeil) {
        float veil = fade * (1.0 - smoothstep(0.58, 0.94, elevation)) * masks.g * skyVeilOpacity;
        vec3 veilTint = mix(vec3(0.88, 0.865, 0.835), vec3(0.92, 0.93, 0.95), smoothstep(0.12, 0.54, elevation));
        radiance = mix(radiance, veilTint, veil);
      }
    }
    gl_FragColor = vec4(hazeRadiance(radiance, horizonHaze(ray.y)), 1.0);
    #include <colorspace_fragment>
    if (skyMicro) {
      // Static, neutral interleaved gradient dither. Half an 8-bit code value
      // in either direction after the display transfer function.
      float grain = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
      gl_FragColor.rgb += (grain - 0.5) / 255.0;
    }
  }
`;

export function AtmosphericSky({ atmosphere, layers }: { atmosphere: Atmosphere; layers: SkyLayers }) {
  const invalidate = useThree(state => state.invalidate);
  const field = useMemo(createSkyField, []);
  useEffect(() => () => field.dispose(), [field]);
  const uniforms = useMemo(() => {
    const { broadTint, fieldFade, veilOpacity } = EXPANSE.atmosphere.skyFinish;
    return {
      ...atmosphere.uniforms, airHorizonHaze: { value: layers.haze }, skyField: { value: field },
      skyBroadTint: { value: new Vector3(...broadTint) }, skyFieldFade: { value: new Vector2(...fieldFade) },
      skyVeilOpacity: { value: veilOpacity }, skyBroad: { value: layers.broad },
      skyVeil: { value: layers.veil }, skyMicro: { value: layers.micro },
    };
  }, [atmosphere, field, layers]);
  useLayoutEffect(() => {
    // Standard scene materials share this uniform through onBeforeCompile.
    atmosphere.uniforms.airHorizonHaze.value = layers.haze;
    invalidate();
  }, [atmosphere, layers.haze, invalidate]);
  // Draw at far depth after the opaque world so foreground pixels reject the sky.
  return <mesh frustumCulled={false} renderOrder={1}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[triangle, 3]} /></bufferGeometry>
    <shaderMaterial uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment}
      toneMapped={false} depthWrite={false} />
  </mesh>;
}
