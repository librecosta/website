import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute, BufferGeometry, Color, DataTexture, DoubleSide, LinearFilter,
  ShaderMaterial, Vector2, Vector3,
} from 'three';
import { EXPANSE, type LightingLook, type WindView } from './parameters';
import { createSandTransport, renderedGround } from './sand-transport';
import { sandBedSupply, windSurfaceAbove, type Monument } from './world';

const config = EXPANSE.windMotion;
const densityRange = 96;
const sourceRange = 84;
const displayMode = { transport: 0, wind: 1, source: 2, concentration: 3 } as const;

const vertex = /* glsl */ `
  attribute vec2 layer;
  varying vec2 vLayer;
  varying vec3 vPosition, vNormal;
  void main() {
    vLayer = layer;
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormal = mat3(modelMatrix) * normal;
    gl_Position = projectionMatrix * viewMatrix * vec4(vPosition, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D field;
  uniform vec2 layerDrift, fieldOrigin, fieldSize, viewFade;
  uniform vec3 dustColor, skyLight, sunLight, sunDirection;
  uniform float edgeWidth, extinction, densityRange;
  uniform int mode;
  varying vec2 vLayer;
  varying vec3 vPosition, vNormal;

  float arrow(vec2 p, vec2 direction) {
    vec2 q = vec2(dot(p, direction), dot(p, vec2(-direction.y, direction.x)));
    float shaft = max(abs(q.y) - 0.027, abs(q.x) - 0.29);
    float tip = max(abs(abs(q.y) - (0.32 - q.x) * 0.64) - 0.028, abs(q.x - 0.22) - 0.13);
    return 1.0 - smoothstep(0.0, 0.038, min(shaft, tip));
  }

  void main() {
    vec2 point = vPosition.xz - (mode == 0 ? layerDrift * vLayer.x : vec2(0.0));
    vec2 sampleUV = (point - fieldOrigin) / fieldSize;
    vec2 edge = min(sampleUV, 1.0 - sampleUV) * fieldSize;
    float fade = smoothstep(0.0, edgeWidth, min(edge.x, edge.y));
    fade *= 1.0 - smoothstep(viewFade.x, viewFade.y, distance(cameraPosition.xz, vPosition.xz));
    if (fade <= 0.0) discard;
    vec4 data = texture2D(field, sampleUV);
    if (mode == 0) {
      float density = data.r * data.r * densityRange;
      if (density * fade < 0.025) discard;
      vec3 view = normalize(cameraPosition - vPosition);
      float grazing = 1.0 / max(abs(dot(normalize(vNormal), view)), 0.16);
      float opticalDepth = density * extinction * vLayer.y * grazing;
      float alpha = (1.0 - exp(-opticalDepth)) * fade;
      float scattering = pow(0.5 + 0.5 * dot(sunDirection, -view), 2.0);
      vec3 light = skyLight + sunLight * (0.75 + 0.52 * scattering);
      gl_FragColor = vec4(dustColor * light, alpha);
    } else {
      vec3 color;
      float alpha;
      if (mode == 1) {
        vec2 grid = point / 62.0;
        vec2 wind = 2.0 * data.gb - 1.0;
        float speed = length(wind);
        vec2 center = ((floor(grid) + 0.5) * 62.0 - fieldOrigin) / fieldSize;
        vec2 axis = 2.0 * texture2D(field, center).gb - 1.0;
        float mark = arrow(fract(grid) - 0.5, axis / max(length(axis), 0.01)) * smoothstep(0.05, 0.14, length(axis));
        color = mix(mix(vec3(0.035, 0.075, 0.17), vec3(0.12, 0.73, 0.93), speed), vec3(0.96), mark);
        alpha = 0.62;
      } else {
        float value = mode == 2 ? data.a : data.r;
        color = mode == 2 ? vec3(1.0, 0.31, 0.026) : vec3(0.025, 0.78, 0.58);
        alpha = 0.91 * smoothstep(0.02, 0.55, value);
      }
      gl_FragColor = vec4(color, alpha * fade);
    }
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function buildLayers(terrain: BufferGeometry, mobile: boolean) {
  const [x0, x1, z0, z1] = config.bounds;
  const { width, depth, centerZ, resolution } = EXPANSE.terrain;
  const [nx, nz] = resolution[mobile ? 'mobile' : 'desktop'];
  const dx = width / nx, dz = depth / nz, startZ = centerZ + depth / 2;
  const west = Math.floor((x0 + width / 2) / dx), east = Math.ceil((x1 + width / 2) / dx);
  const north = Math.floor((startZ - z1) / dz), south = Math.ceil((startZ - z0) / dz);
  const columns = east - west + 1, rows = south - north + 1;
  const levels = config.dust.layers.length;
  const levelSize = rows * columns;
  const ground = terrain.getAttribute('position').array;
  const groundNormals = terrain.getAttribute('normal').array;
  const positions = new Float32Array(levelSize * levels * 3);
  const normals = new Float32Array(positions.length);
  const layers = new Float32Array(levelSize * levels * 2);
  for (let level = 0; level < levels; level++) {
    const [height, weight] = config.dust.layers[level];
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const i = level * levelSize + row * columns + col;
      const j = ((row + north) * (nx + 1) + col + west) * 3;
      positions.set([ground[j], ground[j + 1] + height / config.metersPerUnit, ground[j + 2]], i * 3);
      normals.set([groundNormals[j], groundNormals[j + 1], groundNormals[j + 2]], i * 3);
      layers.set([height, weight], i * 2);
    }
  }
  const rowSize = (columns - 1) * 6;
  const debugSize = rowSize * (rows - 1);
  const indices = new Uint32Array(debugSize * (levels + 1));
  // Terrain rows keep the original triangulation. Separate index ranges allow
  // the normal draw and the one-layer debug draw to share the same vertices.
  for (let row = 0; row < rows - 1; row++) for (let level = 0; level < levels; level++) {
    for (let col = 0; col < columns - 1; col++) {
      const a = level * levelSize + row * columns + col, b = a + columns;
      const face = [a, a + 1, b, a + 1, b + 1, b];
      indices.set(face, debugSize + rowSize * (row * levels + level) + col * 6);
      if (level === 0) indices.set(face, rowSize * row + col * 6);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('layer', new BufferAttribute(layers, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  function drawNear(cameraZ: number, debug: boolean) {
    const first = Math.max(0, Math.floor((startZ - cameraZ - 80) / dz) - north);
    const last = Math.min(rows - 1, Math.ceil((startZ - cameraZ + config.dust.viewFade[1]) / dz) - north);
    const stride = rowSize * (debug ? 1 : levels);
    geometry.setDrawRange((debug ? 0 : debugSize) + first * stride, Math.max(0, last - first) * stride);
  }
  return { geometry, drawNear };
}

export function SandDust({ terrain, monuments, mobile, mode, lightingLook, visible, debug }: {
  terrain: BufferGeometry; monuments: Monument[]; mobile: boolean;
  mode: Exclude<WindView, 'static'>; lightingLook: LightingLook; visible: boolean; debug: boolean;
}) {
  const { gl, invalidate } = useThree();
  const clock = useRef({ remainder: 0, running: false });
  const resources = useMemo(() => {
    const [nx] = config.resolution;
    const [x0, x1] = config.bounds;
    const nz = config.window.rows;
    const ground = renderedGround(terrain.getAttribute('position').array,
      EXPANSE.terrain.resolution[mobile ? 'mobile' : 'desktop'], EXPANSE.terrain);
    const simulation = createSandTransport(config, EXPANSE.aeolian.wind, ground, windSurfaceAbove(ground, monuments),
      { sediment: sandBedSupply(EXPANSE, ground), window: config.window });
    const { geometry, drawNear } = buildLayers(terrain, mobile);
    const pixels = new Uint8Array(nx * nz * 4);
    const field = new DataTexture(pixels, nx, nz);
    field.minFilter = field.magFilter = LinearFilter;
    const direction = new Vector2(...EXPANSE.aeolian.wind).normalize();
    const material = new ShaderMaterial({
      vertexShader: vertex, fragmentShader: fragment, side: DoubleSide, forceSinglePass: true,
      depthWrite: false, transparent: true,
      uniforms: {
        field: { value: field }, mode: { value: 0 },
        fieldOrigin: { value: new Vector2(x0, 0) }, fieldSize: { value: new Vector2(x1 - x0, simulation.windowDepth) },
        layerDrift: { value: direction.multiplyScalar(8) },
        edgeWidth: { value: config.dust.edgeFade }, viewFade: { value: new Vector2(...config.dust.viewFade) },
        dustColor: { value: new Color(config.dust.tint) }, extinction: { value: config.dust.extinction },
        densityRange: { value: densityRange }, skyLight: { value: new Color() },
        sunLight: { value: new Color() }, sunDirection: { value: new Vector3() },
      },
    });
    function upload() {
      const { concentration, velocityX, velocityZ, sourceRate, maxVelocity } = simulation;
      const first = simulation.firstRow * nx;
      for (let cell = 0; cell < nx * nz; cell++) {
        const i = first + cell, p = cell * 4;
        pixels[p] = Math.round(255 * Math.sqrt(Math.min(1, concentration[i] / densityRange)));
        pixels[p + 1] = Math.round(127.5 * (1 + velocityX[i] / maxVelocity));
        pixels[p + 2] = Math.round(127.5 * (1 + velocityZ[i] / maxVelocity));
        pixels[p + 3] = Math.round(255 * Math.sqrt(Math.min(1, sourceRate[i] / sourceRange)));
      }
      material.uniforms.fieldOrigin.value.y = simulation.windowStart;
      field.needsUpdate = true;
    }
    return { simulation, geometry, drawNear, field, material, upload };
  }, [mobile, monuments, terrain]);
  useLayoutEffect(() => {
    const { material } = resources;
    const look = EXPANSE.atmosphere.looks[lightingLook];
    material.uniforms.skyLight.value.set(look.hemisphereSky).multiplyScalar(look.hemisphereIntensity * 0.30);
    material.uniforms.sunLight.value.set(look.sunColor).multiplyScalar(look.sunIntensity * 0.20);
    material.uniforms.sunDirection.value.set(...look.sunPosition).sub(new Vector3(...EXPANSE.atmosphere.sunTarget)).normalize();
    material.uniforms.mode.value = displayMode[mode];
    invalidate();
  }, [invalidate, lightingLook, mode, resources]);
  useLayoutEffect(() => { clock.current = { remainder: 0, running: false }; }, [resources]);
  useLayoutEffect(() => { clock.current.running = false; }, [visible]);
  useEffect(() => () => {
    resources.geometry.dispose();
    resources.field.dispose();
    resources.material.dispose();
  }, [resources]);
  useFrame(({ camera }, delta) => {
    if (!visible) {
      clock.current.running = false;
      return;
    }
    const { simulation } = resources;
    let changed = simulation.follow(camera.position.z);
    resources.drawNear(camera.position.z, mode !== 'transport');
    // Skip the inactive wall time and bound catch-up after a stall.
    if (clock.current.running) clock.current.remainder += Math.min(delta, 0.09);
    clock.current.running = true;
    while (clock.current.remainder >= config.step) {
      clock.current.remainder -= config.step;
      simulation.advance();
      changed = true;
    }
    if (!changed) return;
    resources.upload();
    if (debug) {
      gl.domElement.dataset.windTime = simulation.time.toFixed(3);
      const first = simulation.firstRow * config.resolution[0];
      gl.domElement.dataset.sandWindow = simulation.windowStart.toFixed(2);
      gl.domElement.dataset.sandPeak = Math.max(...simulation.concentration.subarray(first,
        first + config.resolution[0] * config.window.rows)).toFixed(3);
    }
  });
  return <mesh geometry={resources.geometry} material={resources.material} dispose={null} />;
}
