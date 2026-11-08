import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute, BufferGeometry, Color, DataTexture, DoubleSide, LinearFilter, RedFormat,
  ShaderMaterial, Vector2, Vector3,
} from 'three';
import { EXPANSE, type WindView } from './parameters';
import { createSandTransport } from './sand-transport';
import { sanctuaryTransport, type Sandstorm } from './sandstorm';
import type { SanctuaryField } from './sanctuary-field';
import { sandBedSupply } from './world';

const config = EXPANSE.windMotion;
const densityRange = 96;

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
  uniform bool showDensity;
  varying vec2 vLayer;
  varying vec3 vPosition, vNormal;

  void main() {
    vec2 point = vPosition.xz - (showDensity ? vec2(0.0) : layerDrift * vLayer.x);
    vec2 sampleUV = (point - fieldOrigin) / fieldSize;
    vec2 edge = min(sampleUV, 1.0 - sampleUV) * fieldSize;
    float fade = smoothstep(0.0, edgeWidth, min(edge.x, edge.y));
    fade *= 1.0 - smoothstep(viewFade.x, viewFade.y, distance(cameraPosition.xz, vPosition.xz));
    if (fade <= 0.0) discard;
    float value = texture2D(field, sampleUV).r;
    if (!showDensity) {
      float density = value * value * densityRange;
      if (density * fade < 0.025) discard;
      vec3 view = normalize(cameraPosition - vPosition);
      float grazing = 1.0 / max(abs(dot(normalize(vNormal), view)), 0.16);
      float opticalDepth = density * extinction * vLayer.y * grazing;
      float alpha = (1.0 - exp(-opticalDepth)) * fade;
      float scattering = pow(0.5 + 0.5 * dot(sunDirection, -view), 2.0);
      vec3 light = skyLight + sunLight * (0.75 + 0.52 * scattering);
      gl_FragColor = vec4(dustColor * light, alpha);
    } else {
      float alpha = 0.91 * smoothstep(0.02, 0.55, value);
      gl_FragColor = vec4(0.025, 0.78, 0.58, alpha * fade);
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

type Ground = (x: number, z: number) => number;

export function SandDust({ terrain, ground, windSurface, field: refuge, storm, mobile, mode, visible, debug }: {
  terrain: BufferGeometry; ground: Ground; windSurface: Ground; field: SanctuaryField | null; storm: Sandstorm; mobile: boolean;
  mode: Exclude<WindView, 'static'>; visible: boolean; debug: boolean;
}) {
  const { gl, invalidate } = useThree();
  const clock = useRef({ remainder: 0, running: false, nextRead: 0 });
  const resources = useMemo(() => {
    const [nx] = config.resolution;
    const [x0, x1] = config.bounds;
    const nz = config.window.rows;
    const simulation = createSandTransport(config, EXPANSE.aeolian.wind, ground, windSurface, {
      sediment: sandBedSupply(EXPANSE, ground), window: config.window, background: EXPANSE.sandstorm.background,
      sanctuary: refuge ? sanctuaryTransport(refuge, ground) : undefined,
    });
    const { geometry, drawNear } = buildLayers(terrain, mobile);
    const pixels = new Uint8Array(nx * nz);
    const field = new DataTexture(pixels, nx, nz, RedFormat);
    field.minFilter = field.magFilter = LinearFilter;
    const direction = new Vector2(...EXPANSE.aeolian.wind).normalize();
    const material = new ShaderMaterial({
      vertexShader: vertex, fragmentShader: fragment, side: DoubleSide, forceSinglePass: true,
      depthWrite: false, transparent: true,
      uniforms: {
        field: { value: field }, showDensity: { value: false },
        fieldOrigin: { value: new Vector2(x0, 0) }, fieldSize: { value: new Vector2(x1 - x0, simulation.windowDepth) },
        layerDrift: { value: direction.multiplyScalar(8) },
        edgeWidth: { value: config.dust.edgeFade }, viewFade: { value: new Vector2(...config.dust.viewFade) },
        dustColor: { value: new Color(config.dust.tint) }, extinction: { value: config.dust.extinction },
        densityRange: { value: densityRange }, skyLight: { value: new Color() },
        sunLight: { value: new Color() }, sunDirection: { value: new Vector3() },
      },
    });
    function upload() {
      const { concentration } = simulation;
      const first = simulation.firstRow * nx;
      for (let cell = 0; cell < pixels.length; cell++) {
        pixels[cell] = Math.round(255 * Math.sqrt(Math.min(1, concentration[first + cell] / densityRange)));
      }
      material.uniforms.fieldOrigin.value.y = simulation.windowStart;
      field.needsUpdate = true;
    }
    return { simulation, geometry, drawNear, field, material, upload };
  }, [mobile, terrain, ground, windSurface, refuge]);
  useLayoutEffect(() => {
    const { material } = resources;
    const { daylight } = EXPANSE.atmosphere;
    material.uniforms.skyLight.value.set(daylight.hemisphereSky).multiplyScalar(daylight.hemisphereIntensity * 0.30);
    material.uniforms.sunLight.value.set(daylight.sunColor).multiplyScalar(daylight.sunIntensity * 0.20);
    material.uniforms.sunDirection.value.set(...daylight.sunPosition).sub(new Vector3(...EXPANSE.atmosphere.sunTarget)).normalize();
    material.uniforms.showDensity.value = mode === 'concentration';
    invalidate();
  }, [invalidate, mode, resources]);
  useLayoutEffect(() => { clock.current = { remainder: 0, running: false, nextRead: 0 }; }, [resources, storm]);
  useLayoutEffect(() => { clock.current.running = false; }, [visible]);
  useEffect(() => () => {
    resources.geometry.dispose();
    resources.field.dispose();
    resources.material.dispose();
  }, [resources]);
  useFrame(({ camera }, delta) => {
    if (!visible || document.hidden) {
      clock.current.running = false;
      return;
    }
    const { simulation } = resources;
    let changed = simulation.follow(camera.position.z);
    let advanced = false;
    resources.drawNear(camera.position.z, mode !== 'transport');
    // Skip the inactive wall time and bound catch-up after a stall.
    if (clock.current.running) clock.current.remainder += Math.min(delta, 0.09);
    clock.current.running = true;
    while (clock.current.remainder >= config.step) {
      clock.current.remainder -= config.step;
      simulation.advance();
      storm.simulation.advance();
      changed = true;
      advanced = true;
    }
    if (!changed) return;
    resources.upload();
    if (advanced) storm.upload();
    if (debug && simulation.time >= clock.current.nextRead) {
      clock.current.nextRead = simulation.time + 0.25;
      gl.domElement.dataset.windTime = simulation.time.toFixed(3);
      const first = simulation.firstRow * config.resolution[0];
      gl.domElement.dataset.sandWindow = simulation.windowStart.toFixed(2);
      gl.domElement.dataset.sandPeak = Math.max(...simulation.concentration.subarray(first,
        first + config.resolution[0] * config.window.rows)).toFixed(3);
      gl.domElement.dataset.sandBudget = JSON.stringify({ ground: simulation.measureBudget(), suspended: storm.simulation.measureBudget() });
    }
  });
  return <mesh geometry={resources.geometry} material={resources.material} dispose={null} />;
}
