'use client';

import { sampleSky, type Atmosphere } from './atmosphere';

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
  #include <common>
  #include <dithering_pars_fragment>
  ${sampleSky}

  void main() {
    gl_FragColor = vec4(skyRadiance(normalize(vWorldRay)), 1.0);
    #include <colorspace_fragment>
    #include <dithering_fragment>
  }
`;

export function AtmosphericSky({ atmosphere }: { atmosphere: Atmosphere }) {
  // Draw at far depth after the opaque world so foreground pixels reject the sky.
  return <mesh frustumCulled={false} renderOrder={1}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[triangle, 3]} /></bufferGeometry>
    <shaderMaterial uniforms={atmosphere.uniforms} vertexShader={vertex} fragmentShader={fragment}
      toneMapped={false} depthWrite={false} dithering />
  </mesh>;
}
