'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { ShaderMaterial } from 'three';
import { bakeSkyRadiance, sampleSky, type Atmosphere } from './atmosphere';
import { EXPANSE, type SkyView } from './parameters';
import { createSkyField } from './sky-field';
import { sanctuaryAir, type SanctuaryUniforms } from './sanctuary-field';
import { sandstormAir, type SandstormUniforms } from './sandstorm';

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

export function AtmosphericSky({ atmosphere, view, sanctuary, storm, mobile }: {
  atmosphere: Atmosphere; view: SkyView; sanctuary?: SanctuaryUniforms; storm?: SandstormUniforms;
  mobile: boolean;
}) {
  const invalidate = useThree(state => state.invalidate);
  const canvas = useThree(state => state.gl.domElement);
  const field = useMemo(createSkyField, []);
  const useStorm = !!storm && view === 'color';
  const useSanctuary = !!sanctuary;
  const material = useMemo(() => {
    const ray = `ray * ${EXPANSE.atmosphere.cameraFar.toFixed(1)}`;
    let color = 'skyRadiance(ray)';
    if (useSanctuary) color = `scatterSanctuary(${color}, ${ray})`;
    if (useStorm) color = `scatterSandstorm(${color}, ${ray})`;
    const fragmentShader = fragment.replace('void main()', `${useSanctuary ? sanctuaryAir : ''}\n${useStorm ? sandstormAir(mobile) : ''}\nvoid main()`)
      .replace('skyRadiance(ray)', color);
    // Keep the same uniform entries as the opaque materials and motes, including live exposure.
    return new ShaderMaterial({ uniforms: { ...atmosphere.uniforms, ...sanctuary, ...storm },
      vertexShader: vertex, fragmentShader, toneMapped: false, depthWrite: false });
  }, [atmosphere, sanctuary, storm, useSanctuary, useStorm, mobile]);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const bakeMs = bakeSkyRadiance(atmosphere, field.data, view);
    canvas.dataset.skyAnalyticMs = atmosphere.generationMs.toFixed(2);
    canvas.dataset.skyFieldMs = field.generationMs.toFixed(2);
    canvas.dataset.skyBakeMs = bakeMs.toFixed(2);
    invalidate();
  }, [atmosphere, field, view, canvas, invalidate]);
  // Draw at far depth after the opaque world so foreground pixels reject the sky.
  return <mesh material={material} frustumCulled={false} renderOrder={1}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[triangle, 3]} /></bufferGeometry>
  </mesh>;
}
