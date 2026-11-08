'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { BufferAttribute, BufferGeometry, ShaderMaterial, Vector3, type PerspectiveCamera } from 'three';
import { EXPANSE } from './parameters';
import { sanctuaryShader, sanctuaryUniforms, seedMotes, type SanctuaryField, type SanctuaryPointer } from './sanctuary-field';
import { sandstormAir, type SandstormUniforms } from './sandstorm';
import type { Monument } from './world';

const config = EXPANSE.sanctuary;
const moteVertex = (storm: boolean, mobile: boolean) => /* glsl */ `
  ${sanctuaryShader}
  ${storm ? sandstormAir(mobile) : ''}
  uniform float elapsed, pixelScale, pointerGain;
  uniform vec3 rayOrigin, rayDirection, pointerShape;
  attribute vec4 motion;
  attribute vec2 traits;
  varying float vOpacity, vLayer;
  void main() {
    float life = fract(elapsed / motion.y + motion.x);
    float seed = traits.x * 6.2831853;
    float layer = traits.y;
    float wander = mix(22.0, 61.0, layer) * life;
    vec3 point = position + vec3(wander * sin(seed + life * 3.8), motion.z * life,
      wander * cos(seed * 1.7 - life * 3.2));
    float t = dot(point - rayOrigin, rayDirection);
    vec3 offset = point - (rayOrigin + max(0.0, t) * rayDirection);
    float focus = dot(sanctuaryCenter - rayOrigin, rayDirection);
    float radial = length(offset);
    float weight = pointerGain * (1.0 - smoothstep(0.0, pointerShape.x, radial))
      * (1.0 - smoothstep(pointerShape.y * 0.35, pointerShape.y, abs(t - focus + pointerShape.z))) * step(0.0, t);
    vec3 outward = offset / max(radial, 28.0);
    vec3 tangent = cross(rayDirection, outward);
    point += weight * sanctuaryInfluence(point) * (outward * 0.56 + tangent * (0.73 + 0.22 * sin(elapsed * 2.1 + seed)));
    vec4 view = viewMatrix * vec4(point, 1.0);
    gl_Position = projectionMatrix * view;
    float size = motion.w * pixelScale / max(1.0, -view.z);
    gl_PointSize = clamp(size * mix(2.8, 3.4, layer), 1.0, 16.0);
    float lifeFade = smoothstep(0.025, 0.19, life) * (1.0 - smoothstep(0.65, 1.0, life));
    vOpacity = lifeFade * sanctuaryInfluence(point) * sanctuaryNearness() * smoothstep(0.26, 0.90, size) * mix(0.75, 1.0, traits.x);
    ${storm ? `
      if (vOpacity > 0.004) {
        vec3 ray = point - cameraPosition;
        float depth = max(length(ray), 0.001);
        vOpacity *= exp(-sandstormOpticalDepth(ray / depth, depth));
      }
    ` : ''}
    vLayer = layer;
  }
`;
const moteFragment = /* glsl */ `
  varying float vOpacity, vLayer;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = exp(-r * r * 9.0);
    float halo = exp(-r * r * 3.3) * (1.0 - smoothstep(0.64, 1.0, r));
    float alpha = vOpacity * (core * mix(0.88, 0.91, vLayer) + halo * mix(0.14, 0.32, vLayer));
    if (alpha < 0.004) discard;
    vec3 gold = mix(vec3(1.3, 0.77, 0.27), vec3(1.85, 1.39, 0.73), core);
    gl_FragColor = vec4(gold, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function SanctuaryMotes({ hero, field, ground, mobile, visible, reduced, pointer, debug, storm }: {
  hero: Monument; field: SanctuaryField; ground: (x: number, z: number) => number; mobile: boolean; visible: boolean; reduced: boolean;
  pointer: RefObject<SanctuaryPointer>; debug: boolean; storm?: SandstormUniforms;
}) {
  const { gl, invalidate } = useThree();
  const running = useRef(false);
  const resources = useMemo(() => {
    const quality = mobile ? 'mobile' : 'desktop';
    const { positions, motion, traits } = seedMotes(field, hero, ground, quality);
    const particles = new BufferGeometry();
    particles.setAttribute('position', new BufferAttribute(positions, 3));
    particles.setAttribute('motion', new BufferAttribute(motion, 4));
    particles.setAttribute('traits', new BufferAttribute(traits, 2));
    const uniforms = { ...sanctuaryUniforms(field), ...storm, elapsed: { value: config.stillTime }, pixelScale: { value: 1 },
      pointerGain: { value: 0 }, rayOrigin: { value: new Vector3() }, rayDirection: { value: new Vector3(0, 0, -1) },
      pointerShape: { value: new Vector3(config.pointer.radius, config.pointer.depth, field.radius.z * config.pointer.offsetFraction) } };
    const motes = new ShaderMaterial({ uniforms, vertexShader: moteVertex(!!storm, mobile), fragmentShader: moteFragment,
      transparent: true, depthWrite: false });
    return { motes, particles, uniforms, targetRay: new Vector3() };
  }, [hero, field, ground, mobile, storm]);
  useLayoutEffect(() => {
    running.current = false;
    if (reduced) {
      resources.uniforms.elapsed.value = config.stillTime;
      resources.uniforms.pointerGain.value = 0;
    }
    invalidate();
  }, [reduced, visible, resources, invalidate]);
  useEffect(() => () => {
    resources.motes.dispose(); resources.particles.dispose();
  }, [resources]);
  useEffect(() => () => {
    delete gl.domElement.dataset.sanctuaryTime;
    delete gl.domElement.dataset.sanctuaryPointer;
  }, [gl]);

  useFrame(({ camera, size }, delta) => {
    if (!visible || document.hidden) return;
    const { uniforms } = resources;
    uniforms.pixelScale.value = size.height * gl.getPixelRatio() * (camera as PerspectiveCamera).projectionMatrix.elements[5] * 0.5;
    if (!reduced) {
      const dt = running.current ? Math.min(delta, 0.09) : 0;
      running.current = true;
      uniforms.elapsed.value += dt;
      const sample = pointer.current;
      const weight = -Math.expm1(-dt / config.pointer.responseSeconds);
      const gain = uniforms.pointerGain;
      if (sample.active) {
        camera.updateMatrixWorld();
        uniforms.rayOrigin.value.copy(camera.position);
        const ray = resources.targetRay.set(sample.x, sample.y, 0.5).unproject(camera).sub(camera.position).normalize();
        uniforms.rayDirection.value.lerp(ray, gain.value < 0.05 ? 1 : -Math.expm1(-dt / (0.5 * config.pointer.responseSeconds))).normalize();
      }
      gain.value += ((sample.active ? config.pointer.strength : 0) - gain.value) * weight;
    }
    if (debug) {
      gl.domElement.dataset.sanctuaryTime = uniforms.elapsed.value.toFixed(3);
      gl.domElement.dataset.sanctuaryPointer = uniforms.pointerGain.value.toFixed(2);
    }
  });

  return <points geometry={resources.particles} material={resources.motes} frustumCulled={false} renderOrder={2} dispose={null} />;
}
