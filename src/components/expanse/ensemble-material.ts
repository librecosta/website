import { CanvasTexture, Color, MeshBasicMaterial, MeshStandardMaterial, NoColorSpace } from 'three';
import { EXPANSE } from './parameters';

type Trace = [number, number][];

// One atlas with front/back on the left and side faces on the right. RGB
// carries panel fill, dark seams and warm inlay, respectively.
export function createRuinPattern() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const path = (points: Trace, closed: boolean) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (closed) ctx.closePath();
  };
  const stroke = (points: Trace, width: number, closed = false) => {
    path(points, closed); ctx.lineWidth = width; ctx.stroke();
  };
  const fill = (points: Trace, color: string) => {
    path(points, true); ctx.fillStyle = color; ctx.fill();
  };

  // Coordinates trace the supplied face drawings from crown to foot.
  for (const side of [false, true]) {
    const width = side ? 278 : 364;
    const mirror = (points: Trace): Trace => points.map(([x, y]) => [width - x, y]);
    const symmetric = (half: Trace): Trace => [...half, ...mirror(half).reverse()];
    const pair = (points: Trace, weight: number) => {
      stroke(points, weight); stroke(mirror(points), weight);
    };
    ctx.save();
    ctx.translate(side ? 512 : 0, 0);
    ctx.scale(512 / width, 1024 / 851);
    const frame = symmetric(side
      ? [[78, 50], [49, 99], [49, 764], [78, 811]]
      : [[91, 50], [43, 107], [43, 763], [91, 811]]);
    fill(frame, side ? '#b00000' : '#c00000');
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#00e000';
    stroke(frame, 2.6, true);

    if (side) {
      const shoulder = symmetric([[49, 217], [68, 211], [86, 191]]);
      const foot = symmetric([[49, 703], [63, 732], [88, 775]]);
      stroke(shoulder, 4.6); stroke(foot, 3.4);
      const rail = ctx.createLinearGradient(0, 335, 0, 735);
      rail.addColorStop(0, '#00cb00');
      rail.addColorStop(.62, '#008000');
      rail.addColorStop(1, '#001200');
      ctx.strokeStyle = rail;
      pair([[49, 340], [68, 343], [86, 378], [86, 724]], 4);
      ctx.strokeStyle = '#0000b0';
      stroke(symmetric([[60, 163], [90, 163], [99, 149]]), 2.6);
      stroke(symmetric([[62, 210], [70, 208], [86, 191]]), 2);
      pair([[59, 731], [64, 732]], 2.4);
      stroke(symmetric([[75, 752]]), 2);
      stroke(symmetric([[88, 774]]), 2.8);
      ctx.strokeStyle = '#0000f0';
      stroke([[width / 2, 220], [width / 2, 723]], 3);
      for (const y of [612, 630, 648]) pair([[62, y], [84, y]], 2.8);
    } else {
      const body = symmetric([[107, 178], [60, 230], [60, 691], [113, 775]]);
      stroke(body, 4, true);
      const rail: Trace = [[60, 341], [84, 341], [119, 381], [119, 530], [140, 553], [140, 724]];
      pair(rail, 4.8);
      ctx.strokeStyle = '#0000b0';
      stroke(symmetric([[119, 138], [103, 158], [57, 158], [57, 109], [98, 60]]), 2.2, true);
      stroke(body, 2.6, true);
      pair(rail, 2.2);
      pair([[56, 731], [89, 731]], 2);
      stroke(symmetric([[100, 752]]), 2);
      stroke(symmetric([[82, 803]]), 2);
      ctx.strokeStyle = '#000045';
      pair([[172, 212], [172, 724]], 1.8);
      ctx.strokeStyle = '#0000ff';
      stroke([[width / 2, 212], [width / 2, 724]], 3.4);
      for (const y of [248, 268, 287, 612, 630, 648]) pair([[91, y], [126, y]], 2.8);
    }
    ctx.restore();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createRuinMaterial(pattern: CanvasTexture) {
  const material = new MeshStandardMaterial({ color: '#a99a85', roughness: 0.87, metalness: 0 });
  material.customProgramCacheKey = () => 'buried-ensemble';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.ruinPattern = { value: pattern };
    shader.uniforms.ruinPanel = { value: new Color('#776b5c') };
    shader.uniforms.ruinSeam = { value: new Color('#554c40') };
    shader.uniforms.ruinInlay = { value: new Color('#e4bf8c') };
    shader.uniforms.ruinSand = { value: new Color(EXPANSE.aeolian.sand.color) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 ruinGround;
        varying vec2 vRuinUv;
        varying vec3 vRuinLocalNormal;
        varying vec3 vRuinPosition;
        varying vec3 vRuinWorld;
        varying float vRuinHeight;
      `)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vRuinUv = uv;
        vRuinLocalNormal = normal;
        vRuinPosition = position;
        vec4 ruinWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.);
        vRuinWorld = ruinWorld.xyz;
        vRuinHeight = ruinWorld.y - ruinGround.x - dot(
          ruinWorld.xz - instanceMatrix[3].xz, ruinGround.yz);
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D ruinPattern;
        uniform vec3 ruinPanel;
        uniform vec3 ruinSeam;
        uniform vec3 ruinInlay;
        uniform vec3 ruinSand;
        varying vec2 vRuinUv;
        varying vec3 vRuinLocalNormal;
        varying vec3 vRuinPosition;
        varying vec3 vRuinWorld;
        varying float vRuinHeight;
      `)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float upright = 1. - smoothstep(0.08, 0.5, abs(vRuinLocalNormal.y));
        float side = step(abs(vRuinLocalNormal.z), abs(vRuinLocalNormal.x));
        vec2 atlasUv = vec2((vRuinUv.x + side) * .5, vRuinUv.y);
        vec3 pattern = texture2D(ruinPattern, atlasUv).rgb * upright;
        float rim = max(abs(vRuinPosition.x), abs(vRuinPosition.z)) + min(abs(vRuinPosition.x), abs(vRuinPosition.z)) * .55;
        float erosion = smoothstep(.53, .77, rim);
        float streak = sin(vRuinWorld.x * .041 - vRuinWorld.z * .024 + sin(vRuinWorld.y * .019) * .46);
        float dust = (1. - smoothstep(2., 84., vRuinHeight + streak * 16.)) * (.79 + streak * .10);
        vec3 mineral = diffuseColor.rgb * (1. + erosion * .052);
        mineral = mix(mineral, ruinPanel, pattern.r * .83);
        mineral = mix(mineral, ruinSeam, pattern.g * .52);
        mineral = mix(mineral, ruinInlay, pattern.b * .90);
        diffuseColor.rgb = mix(mineral, ruinSand, dust * .68);
        float weather = streak * .017 * (1. - smoothstep(120., 620., length(vViewPosition)));
        roughnessFactor = clamp(mix(roughnessFactor - .12 * pattern.r + weather, .98, dust) + .04 * erosion, 0., 1.);
      `)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // Screen-space derivatives of the same mip-filtered mask, so the
        // shallow machining reads under side light without extra texture fetches.
        float relief = -(pattern.r * .35 + pattern.g * .52) * (1. - dust);
        relief *= 1. - smoothstep(350., 1180., length(vViewPosition));
        vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
        vec3 sx = cross(dpdy, normal), sy = cross(normal, dpdx);
        float det = dot(dpdx, sx);
        vec3 grad = sign(det) * (dFdx(relief) * sx + dFdy(relief) * sy);
        normal = normalize(max(abs(det), 1e-6) * normal - grad);
      `);
  };
  return material;
}

export function createDistantSteleMaterial() {
  const material = new MeshBasicMaterial({ color: EXPANSE.atmosphere.distantSilhouette, toneMapped: false });
  material.customProgramCacheKey = () => 'distant-stele-panels';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStele;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStele = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStele;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float shoulder = 1. - smoothstep(.17, .34, min(abs(vStele.x), abs(vStele.z)));
        float crown = smoothstep(.26, .45, vStele.y);
        diffuseColor.rgb *= mix(.91, 1., max(shoulder, crown));
      `);
  };
  return material;
}
