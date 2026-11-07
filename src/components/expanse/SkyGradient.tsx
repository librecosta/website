'use client';

import { useMemo } from 'react';
import { Color } from 'three';
import { EXPANSE } from './parameters';

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
  uniform vec3 horizon;
  uniform vec3 upperSky;
  uniform float gradientTop;

  void main() {
    float rise = smoothstep(0.0, gradientTop, normalize(vWorldRay).y);
    gl_FragColor = vec4(mix(horizon, upperSky, rise), 1.0);
    #include <colorspace_fragment>
  }
`;

export function SkyGradient() {
  const uniforms = useMemo(() => {
    const sky = EXPANSE.atmosphere.sky;
    return { horizon: { value: new Color(sky.horizon) }, upperSky: { value: new Color(sky.upper) },
      gradientTop: { value: sky.gradientTop } };
  }, []);

  // Draw at far depth after the opaque world so foreground pixels reject the sky.
  return <mesh frustumCulled={false} renderOrder={1}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[triangle, 3]} /></bufferGeometry>
    <shaderMaterial uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment}
      toneMapped={false} depthWrite={false} />
  </mesh>;
}
