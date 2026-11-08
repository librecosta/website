import { CanvasTexture, Color, MeshBasicMaterial, MeshStandardMaterial, NoColorSpace } from 'three';
import { EXPANSE } from './parameters';

// Three data channels in one mipmapped sample: inset slabs, assembly seams,
// and calibration marks. All coordinates are authored on a 256 × 512 face.
export function createRuinPattern() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 512);
  const path = (points: number[][], closed = false) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (closed) ctx.closePath();
  };
  const seam = (points: number[][], width: number, closed = false) => {
    path(points, closed); ctx.lineWidth = width; ctx.stroke();
  };
  const frame = [[37, 64], [61, 36], [195, 36], [219, 64], [219, 456], [197, 480], [59, 480], [37, 456]];
  const shield = [[54, 151], [79, 121], [177, 121], [202, 151], [202, 405], [172, 448], [84, 448], [54, 405]];
  path(frame, true); ctx.fillStyle = '#880000'; ctx.fill();
  path(shield, true); ctx.fillStyle = '#bc0000'; ctx.fill();
  ctx.fillStyle = '#450000';
  ctx.fillRect(100, 56, 56, 42);
  ctx.fillRect(115, 135, 26, 304);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#00d600';
  seam(frame, 2.8, true);
  seam(shield, 2.7, true);
  seam([[47, 112], [76, 112], [87, 100], [169, 100], [180, 112], [209, 112]], 2.2);
  seam([[37, 203], [68, 203], [88, 229], [88, 320], [103, 338], [103, 390]], 3.2);
  seam([[219, 203], [188, 203], [168, 229], [168, 320], [153, 338], [153, 390]], 3.2);
  seam([[51, 433], [71, 433], [91, 461], [165, 461], [185, 433], [205, 433]], 2.2);
  ctx.strokeStyle = '#0000e4';
  seam([[128, 57], [150, 78], [128, 93], [106, 78]], 2.4, true);
  seam([[128, 64], [142, 78], [114, 78]], 2.0, true);
  seam([[128, 145], [128, 247], [117, 267], [128, 287], [139, 267], [128, 247]], 2.3);
  seam([[128, 287], [128, 412]], 2.3);
  for (const y of [155, 167, 179, 370, 381, 392]) {
    seam([[70, y], [86, y]], 2);
    seam([[170, y], [186, y]], 2);
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
    shader.uniforms.ruinInlay = { value: new Color('#bba174') };
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
        float face = mix(.7, 1., abs(vRuinLocalNormal.z));
        vec3 pattern = texture2D(ruinPattern, vRuinUv).rgb * upright * face;
        float rim = max(abs(vRuinPosition.x), abs(vRuinPosition.z)) + min(abs(vRuinPosition.x), abs(vRuinPosition.z)) * .55;
        float erosion = smoothstep(.53, .77, rim);
        float streak = sin(vRuinWorld.x * .041 - vRuinWorld.z * .024 + sin(vRuinWorld.y * .019) * .46);
        float dust = (1. - smoothstep(2., 84., vRuinHeight + streak * 16.)) * (.79 + streak * .10);
        vec3 mineral = diffuseColor.rgb * (1. + erosion * .052);
        mineral = mix(mineral, ruinPanel, pattern.r * .83);
        mineral = mix(mineral, ruinSeam, pattern.g * .52);
        mineral = mix(mineral, ruinInlay, pattern.b * .72);
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
