'use client';

import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { bakeSkyRadiance, sampleSky, type Atmosphere } from './atmosphere';
import { type SkyView } from './parameters';
import { createSkyField } from './sky-field';
import { EXPANSE } from './parameters';
import { sanctuaryAir, type SanctuaryUniforms } from './sanctuary-field';

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
  ${sampleSky}

  void main() {
    vec3 ray = normalize(vWorldRay);
    gl_FragColor = vec4(skyRadiance(ray), 1.0);
    #include <colorspace_fragment>
    // Static display-space dither, ± half an 8-bit code value.
    float grain = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
    gl_FragColor.rgb += (grain - 0.5) / 255.0;
  }
`;

const sanctuaryFragment = fragment.replace('void main()', `${sanctuaryAir}\nvoid main()`)
  .replace('skyRadiance(ray)', `scatterSanctuary(skyRadiance(ray), ray * ${EXPANSE.atmosphere.cameraFar.toFixed(1)})`);

export function AtmosphericSky({ atmosphere, view, sanctuary }: { atmosphere: Atmosphere; view: SkyView; sanctuary?: SanctuaryUniforms }) {
  const invalidate = useThree(state => state.invalidate);
  const canvas = useThree(state => state.gl.domElement);
  const field = useMemo(createSkyField, []);
  useLayoutEffect(() => {
    const bakeMs = bakeSkyRadiance(atmosphere, field.data, view);
    canvas.dataset.skyAnalyticMs = atmosphere.generationMs.toFixed(2);
    canvas.dataset.skyFieldMs = field.generationMs.toFixed(2);
    canvas.dataset.skyBakeMs = bakeMs.toFixed(2);
    invalidate();
  }, [atmosphere, field, view, canvas, invalidate]);
  // Draw at far depth after the opaque world so foreground pixels reject the sky.
  return <mesh frustumCulled={false} renderOrder={1}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[triangle, 3]} /></bufferGeometry>
    <shaderMaterial key={sanctuary ? 'sanctuary' : 'sky'} uniforms={{ ...atmosphere.uniforms, ...sanctuary }}
      vertexShader={vertex} fragmentShader={sanctuary ? sanctuaryFragment : fragment}
      toneMapped={false} depthWrite={false} />
  </mesh>;
}
