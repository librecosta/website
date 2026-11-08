import { useEffect, useState } from 'react';
import { BufferAttribute, BufferGeometry, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace,
  TextureLoader, Vector2, Vector3, WebGLRenderTarget, type Texture, type WebGLRenderer } from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { artwork, core, hero, net, stone, svgUrl } from './artwork';

export function createMonumentGeometry() {
  const indexed = new BufferGeometry();
  indexed.setAttribute('position', new BufferAttribute(core.positions, 3));
  indexed.setAttribute('normal', new BufferAttribute(core.normals, 3));
  indexed.setIndex(new BufferAttribute(core.indices, 1));
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  // A groove wall or bevel can share an indexed vertex with a facade. UVs
  // belong to triangle corners so those faces can all sample the blank gutter.
  const uv = new Float32Array(core.indices.length * 2);
  for (let i = 0; i < uv.length; i += 2) uv.set([.002, .998], i);
  for (const face of net.faces) {
    for (let i = face.indexStart; i < face.indexStart + face.indexCount; i++) {
      const [x, y] = face.projectVertex(core.indices[i]);
      uv.set([(x - net.left) / net.width, 1 - (y - net.top) / net.height], 2 * i);
    }
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));

  // Per-corner depth keeps the lamp on the recessed side walls, off shared bevels and caps.
  const wallDepth = new Float32Array(core.indices.length).fill(-64);
  const scale = new Vector3(...hero.scale);
  const position = (index: number) => new Vector3().fromArray(core.positions, index * 3).multiply(scale);
  for (const { outline, indexStart, indexCount } of core.grooveWalls) {
    const mouth = position(outline[0]);
    const edge = position(outline[1]).sub(mouth).normalize();
    const inward = position(outline[2]).sub(mouth);
    inward.addScaledVector(edge, -inward.dot(edge)).normalize();
    for (let i = indexStart; i < indexStart + indexCount; i++) {
      wallDepth[i] = position(core.indices[i]).sub(mouth).dot(inward);
    }
  }
  geometry.setAttribute('grooveWallDepth', new BufferAttribute(wallDepth, 1));
  return geometry;
}

function bakeBloom(renderer: WebGLRenderer, emission: Texture) {
  if (!renderer.extensions.has('EXT_color_buffer_float')) return undefined;
  const size = new Vector2(1536, Math.round(1536 * net.height / net.width));
  const input = new WebGLRenderTarget(size.x, size.y, { depthBuffer: false });
  const output = new WebGLRenderTarget(size.x / 2, Math.round(size.y / 2), { depthBuffer: false });
  const pass = new UnrealBloomPass(size, 1, .24, .58);
  const blit = new MeshBasicMaterial({ map: emission, toneMapped: false, depthTest: false });
  const quad = new FullScreenQuad(blit);
  const previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(input);
    quad.render(renderer);
    pass.render(renderer, output, input, 0, false);
    // Keep the filtered glow only. The sharp source has its own mask.
    blit.map = pass.renderTargetsHorizontal[0].texture;
    renderer.setRenderTarget(output);
    quad.render(renderer);
    return output;
  } catch {
    output.dispose();
    return undefined;
  } finally {
    renderer.setRenderTarget(previous);
    quad.dispose();
    blit.dispose();
    pass.dispose();
    input.dispose();
  }
}

type Maps = { color: Texture; emission: Texture; bloom?: WebGLRenderTarget };

export function useMonumentAtlas(renderer: WebGLRenderer, invalidate: () => void) {
  const [maps, setMaps] = useState<Maps>();
  useEffect(() => {
    let active = true, ready = 0;
    let bloom: WebGLRenderTarget | undefined;
    const loader = new TextureLoader();
    const loaded = () => {
      if (!active || ++ready !== 2) return;
      bloom = bakeBloom(renderer, emission);
      setMaps({ color, emission, bloom });
      invalidate();
    };
    const textureSize = Math.min(2048, renderer.capabilities.maxTextureSize);
    const color = loader.load(svgUrl(artwork('composite', { textureSize })), loaded);
    color.colorSpace = SRGBColorSpace;
    const emission = loader.load(svgUrl(artwork('emission', { textureSize })), loaded);
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    color.anisotropy = emission.anisotropy = anisotropy;
    return () => { active = false; color.dispose(); emission.dispose(); bloom?.dispose(); };
  }, [renderer, invalidate]);
  return maps;
}

export function createMonumentMaterial(maps: Maps | undefined, center?: readonly number[]) {
  const material = new MeshStandardMaterial({ color: maps ? '#ffffff' : stone, map: maps?.color,
    emissiveMap: maps?.emission, roughness: .86, metalness: 0 });
  if (!maps) return material;
  material.customProgramCacheKey = () => 'monument-atlas-groove-light';
  material.onBeforeCompile = shader => {
    shader.uniforms.monumentCenter = { value: new Vector2(center?.[0] ?? 0, center?.[2] ?? 0) };
    shader.uniforms.monumentDistanceMode = { value: center ? 1 : 0 };
    shader.uniforms.monumentBloom = { value: maps.bloom?.texture ?? maps.emission };
    shader.uniforms.monumentBloomStrength = { value: maps.bloom ? .64 : 0 };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `
      #include <common>
      attribute float grooveWallDepth;
      varying vec2 vGrooveLamp;
    `).replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vGrooveLamp = vec2(grooveWallDepth, position.y);
    `);
    const { bottom, top } = hero.groove;
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_pars_fragment>', `
      #include <emissivemap_pars_fragment>
      uniform vec2 monumentCenter;
      uniform float monumentDistanceMode;
      uniform sampler2D monumentBloom;
      uniform float monumentBloomStrength;
      varying vec2 vGrooveLamp;
    `).replace('#include <emissivemap_fragment>', `
      float nearMonument = mix(1.0, 1.0 - smoothstep(2050.0, 3800.0, distance(cameraPosition.xz, monumentCenter)), monumentDistanceMode);
      float ink = texture2D(emissiveMap, vEmissiveMapUv).r;
      float halo = texture2D(monumentBloom, vEmissiveMapUv).r * monumentBloomStrength;
      float grazing = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
      float light = ink * ink * (0.018 + nearMonument * (1.12 + 0.14 * grazing * grazing * grazing));
      float lampOffset = abs(vGrooveLamp.x - 7.5);
      float lampPixel = min(0.5 * fwidth(vGrooveLamp.x), 12.0);
      float lampCore = (1.0 - smoothstep(1.5, 2.8 + lampPixel, lampOffset)) * 2.8 / (2.8 + lampPixel);
      float lampSpill = 0.24 * (1.0 - smoothstep(2.0, 18.0, lampOffset));
      float lampEnds = smoothstep(${bottom + .006}, ${bottom + .03}, vGrooveLamp.y)
        * (1.0 - smoothstep(${top - .03}, ${top - .006}, vGrooveLamp.y));
      float grooveLight = (lampCore + lampSpill) * lampEnds * (0.014 + 1.12 * nearMonument);
      totalEmissiveRadiance += vec3(1.0, 0.55, 0.20) * (light + halo * nearMonument + grooveLight);
    `);
  };
  return material;
}
