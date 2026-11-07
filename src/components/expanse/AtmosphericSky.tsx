'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { bakeSkyRadiance, sampleSky, type Atmosphere } from './atmosphere';
import { type SkyLayers, type SkyView } from './parameters';
import { createSkyDiagnostics, createSkyField } from './sky-field';

const viewIndex: Record<SkyView, number> = { color: 0, envelope: 1, filaments: 2, opticalDepth: 3 };
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
  uniform sampler2D skyDiagnostics;
  uniform int skyView;
  uniform bool skyMicro;
  ${sampleSky}

  void main() {
    vec3 ray = normalize(vWorldRay);
    if (skyView != 0) {
      vec4 masks = texture2D(skyDiagnostics, skyDirectionUv(ray));
      float mask = skyView == 1 ? masks.g : skyView == 2 ? masks.b : masks.a;
      gl_FragColor = vec4(vec3(mask), 1.0);
      return;
    }
    gl_FragColor = vec4(skyRadiance(ray), 1.0);
    #include <colorspace_fragment>
    if (skyMicro) {
      // Static, neutral interleaved gradient dither. Half an 8-bit code value
      // in either direction after the display transfer function.
      float grain = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
      gl_FragColor.rgb += (grain - 0.5) / 255.0;
    }
  }
`;

export function AtmosphericSky({ atmosphere, layers, view, debug }:
  { atmosphere: Atmosphere; layers: SkyLayers; view: SkyView; debug: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  const canvas = useThree(state => state.gl.domElement);
  const field = useMemo(createSkyField, []);
  const diagnostics = useMemo(() => debug ? createSkyDiagnostics(field.data) : null, [debug, field]);
  useEffect(() => () => diagnostics?.dispose(), [diagnostics]);
  const { broad, veil, haze, micro } = layers;
  const uniforms = useMemo(() => ({
    airSky: atmosphere.uniforms.airSky, skyDiagnostics: { value: diagnostics },
    skyView: { value: viewIndex[view] }, skyMicro: { value: micro },
  }), [atmosphere, diagnostics, view, micro]);
  useLayoutEffect(() => {
    const bakeMs = bakeSkyRadiance(atmosphere, field.data, { broad, veil, haze });
    canvas.dataset.skyAnalyticMs = atmosphere.generationMs.toFixed(2);
    canvas.dataset.skyFieldMs = field.generationMs.toFixed(2);
    canvas.dataset.skyBakeMs = bakeMs.toFixed(2);
    invalidate();
  }, [atmosphere, field, broad, veil, haze, canvas, invalidate]);
  // Draw at far depth after the opaque world so foreground pixels reject the sky.
  return <mesh frustumCulled={false} renderOrder={1}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[triangle, 3]} /></bufferGeometry>
    <shaderMaterial uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment}
      toneMapped={false} depthWrite={false} />
  </mesh>;
}
