import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, ShaderMaterial, type Points } from 'three';
import { EXPANSE } from './parameters';
import type { SandstormUniforms } from './sandstorm';

const { veil } = EXPANSE.sandstorm;
const period = [290, 236, 290] as const;
const vertex = /* glsl */ `
  uniform vec2 stormWind;
  uniform float stormTime, veilStrength, pixelScale;
  attribute vec2 grain;
  varying vec2 vFlow;
  varying float vAlpha, vShade;

  void main() {
    // Recycle a world-space lattice outside the visible radius. Camera
    // movement selects a neighbouring copy without dragging grains along.
    vec3 period = vec3(${period.map(n => n.toFixed(1)).join(', ')});
    float phase = stormTime * mix(2.1, 3.7, grain.x) + position.z * 0.14;
    vec3 direction = vec3(stormWind.x, 0.0, stormWind.y);
    vec3 point = position + direction * stormTime * mix(162.0, ${veil.windSpeed.toFixed(1)} * 1.4, grain.x);
    point.y += sin(phase) * mix(1.8, 6.0, grain.y);
    vec3 relative = mod(point - cameraPosition + period * 0.5, period) - period * 0.5;
    vec4 view = viewMatrix * vec4(cameraPosition + relative, 1.0);
    gl_Position = projectionMatrix * view;
    vec3 projectedWind = mat3(viewMatrix) * (direction + vec3(0.0, cos(phase) * 0.11, 0.0));
    vFlow = normalize(projectedWind.xy * max(1.0, -view.z) + view.xy * projectedWind.z + vec2(0.001, 0.0));
    gl_PointSize = clamp(pixelScale * mix(0.20, 0.49, grain.y) / max(2.0, -view.z), 1.0, 7.5);
    float distanceToEye = length(relative);
    float edge = 1.0 - smoothstep(74.0, 112.0, distanceToEye);
    vAlpha = veilStrength * edge * smoothstep(6.0, 18.0, distanceToEye) * mix(0.19, 0.48, grain.y)
      * exp(-distanceToEye * veilStrength * ${veil.extinction.toFixed(4)});
    vShade = mix(0.49, 1.23, grain.x);
  }
`;
const fragment = /* glsl */ `
  uniform vec3 veilColor;
  varying vec2 vFlow;
  varying float vAlpha, vShade;
  void main() {
    vec2 p = vec2(gl_PointCoord.x * 2.0 - 1.0, 1.0 - gl_PointCoord.y * 2.0);
    vec2 axis = vec2(dot(p, vFlow), dot(p, vec2(-vFlow.y, vFlow.x))) * vec2(1.0, 2.9);
    float alpha = (1.0 - smoothstep(0.24, 1.0, length(axis))) * vAlpha;
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(veilColor * vShade, alpha);
    #include <colorspace_fragment>
  }
`;

export function StormGrit({ uniforms, mobile }: { uniforms: SandstormUniforms; mobile: boolean }) {
  const points = useRef<Points>(null);
  const resources = useMemo(() => {
    const count = veil.grains[mobile ? 'mobile' : 'desktop'];
    const positions = new Float32Array(count * 3), grains = new Float32Array(count * 2);
    let seed = EXPANSE.seed + 271;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      positions.set(period.map(length => length * random()), i * 3);
      grains.set([random(), random()], i * 2);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('grain', new BufferAttribute(grains, 2));
    const { stormWind, stormTime, veilStrength, veilColor } = uniforms;
    const material = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
      uniforms: { stormWind, stormTime, veilStrength, veilColor, pixelScale: { value: 1 } },
      transparent: true, depthWrite: false, toneMapped: false });
    return { geometry, material };
  }, [uniforms, mobile]);
  useEffect(() => () => { resources.geometry.dispose(); resources.material.dispose(); }, [resources]);
  useFrame(({ gl, size, camera }) => {
    points.current!.visible = uniforms.veilStrength.value > 0.012;
    resources.material.uniforms.pixelScale.value = .5 * size.height * gl.getPixelRatio() * camera.projectionMatrix.elements[5];
  });
  return <points ref={points} geometry={resources.geometry} material={resources.material}
    frustumCulled={false} renderOrder={5} dispose={null} />;
}
