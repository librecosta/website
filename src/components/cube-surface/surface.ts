import {
  BoxGeometry,
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  ShaderMaterial,
} from "three";

export const views = [
  "Composite",
  "Base color",
  "Panel mask",
  "Fine lines",
  "Fresnel",
  "Emissive",
  "Bloom only",
] as const;

export type SurfaceView = (typeof views)[number];

type Point = readonly [number, number];
type Route = readonly Point[];
type Panel = readonly [x: number, y: number, w: number, h: number, level: number];
type Face = {
  panels: Panel[];
  joins: Route[];
  lit: Route[];
};

// +X, -X, +Y, -Y, +Z, -Z. The three visible faces share a fabrication
// vocabulary, with distinct panel sizes, stepped routes and quiet areas.
const side: Face = {
  panels: [[0, 0, 24, 48, .39], [24, 0, 43, 16, .65], [67, 0, 33, 33, .26],
    [24, 16, 31, 32, .52], [55, 16, 12, 17, .68], [0, 48, 18, 38, .63],
    [18, 48, 44, 52, .43], [62, 33, 38, 21, .51], [62, 54, 38, 46, .33],
    [70, 42, 8, 6, .18], [62, 69, 18, 19, .55]],
  joins: [[[0, 48], [32, 48], [32, 39], [55, 39], [55, 16], [24, 16]],
    [[67, 0], [67, 33], [100, 33]], [[18, 100], [18, 64], [31, 64], [31, 56], [62, 56]],
    [[62, 100], [62, 69], [80, 69], [80, 54], [100, 54]],
    [[0, 86], [12, 86], [12, 78], [18, 78]], [[55, 39], [70, 39], [70, 48], [78, 48]]],
  lit: [[[0, 48], [32, 48], [32, 39], [55, 39]], [[67, 6], [67, 33], [91, 33]],
    [[18, 90], [18, 64], [31, 64]], [[70, 42], [70, 48], [78, 48]]],
};

const crown: Face = {
  panels: [[0, 0, 32, 28, .55], [32, 0, 38, 19, .4], [70, 0, 30, 19, .67],
    [0, 28, 21, 39, .43], [21, 28, 16, 19, .61], [37, 19, 63, 28, .52],
    [0, 67, 37, 33, .49], [37, 47, 23, 53, .62], [60, 47, 40, 53, .44],
    [13, 34, 9, 7, .26], [74, 11, 14, 8, .42]],
  joins: [[[0, 28], [32, 28], [32, 0]], [[21, 28], [21, 47], [37, 47], [37, 67], [0, 67]],
    [[37, 47], [60, 47], [60, 64], [73, 64], [73, 73], [100, 73]],
    [[60, 100], [60, 64]], [[37, 19], [70, 19], [70, 12], [100, 12]],
    [[87, 20], [87, 34], [74, 34], [74, 47], [100, 47]],
    [[10, 28], [10, 42], [13, 42], [13, 34], [22, 34]]],
  lit: [[[0, 28], [32, 28], [32, 7]], [[21, 47], [37, 47], [37, 60]],
    [[60, 47], [60, 64], [73, 64]], [[74, 47], [90, 47]]],
};

const front: Face = {
  panels: [[0, 0, 17, 53, .42], [17, 0, 26, 23, .65], [43, 0, 38, 14, .40],
    [81, 0, 19, 37, .65], [17, 23, 49, 31, .51], [66, 14, 15, 40, .61],
    [81, 37, 19, 33, .40], [0, 53, 31, 27, .67], [31, 54, 41, 46, .43],
    [72, 54, 9, 28, .57], [0, 80, 31, 20, .48], [72, 82, 28, 18, .53],
    [55, 32, 7, 10, .16], [75, 64, 6, 9, .25]],
  joins: [[[0, 16], [17, 16], [17, 28], [29, 28], [29, 23], [66, 23], [66, 14], [81, 14]],
    [[43, 0], [43, 14], [81, 14], [81, 37], [100, 37]],
    [[17, 53], [34, 53], [34, 48], [47, 48], [47, 38], [55, 38], [55, 32], [62, 32], [62, 42]],
    [[0, 53], [17, 53], [17, 62], [31, 62], [31, 80], [0, 80]],
    [[31, 100], [31, 80], [52, 80], [52, 75], [72, 75], [72, 54], [81, 54]],
    [[72, 100], [72, 82], [81, 82], [81, 70], [100, 70]],
    [[81, 64], [75, 64], [75, 73]], [[21, 38], [40, 38], [43, 35], [49, 35]]],
  lit: [[[0, 16], [17, 16], [17, 28], [29, 28]], [[43, 4], [43, 14], [73, 14]],
    [[34, 48], [47, 48], [47, 38], [55, 38], [55, 32], [62, 32]],
    [[52, 80], [52, 75], [72, 75], [72, 58]], [[81, 64], [75, 64], [75, 73]]],
};

function mask(face: Face) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(canvas.width / 100, canvas.height / 100);
  ctx.fillStyle = "rgb(128, 0, 0)";
  ctx.fillRect(0, 0, 100, 100);
  for (const [x, y, w, h, level] of face.panels) {
    ctx.fillStyle = `rgb(${Math.round(255 * level)}, 0, 0)`;
    ctx.fillRect(x, y, w, h);
  }

  // Lighten modifies the line and accent channels without erasing the panel field.
  ctx.globalCompositeOperation = "lighten";
  ctx.lineJoin = "miter";
  for (const [routes, width, color] of [
    [face.joins, .24, "rgb(0, 218, 0)"],
    [face.lit, .16, "rgb(0, 0, 255)"],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const route of routes) {
      ctx.beginPath();
      ctx.moveTo(...route[0]);
      for (const point of route.slice(1)) ctx.lineTo(...point);
      ctx.stroke();
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  return texture;
}

export function createSurface() {
  const geometry = new BoxGeometry(2, 2, 2);
  const [sideMask, frontMask, crownMask] = [side, front, crown].map(mask);
  const textures = [sideMask, frontMask, crownMask, crownMask, frontMask, sideMask];
  const materials = textures.map((texture, index) => new ShaderMaterial({
    uniforms: {
      uMask: { value: texture },
      uView: { value: 0 },
      uEmission: { value: 1 },
      uFaceTone: { value: [0.65, 0.83, 1.18, 0.55, 1.0, 0.78][index] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 positionWorld = modelMatrix * vec4(position, 1.0);
        vPosition = positionWorld.xyz;
        gl_Position = projectionMatrix * viewMatrix * positionWorld;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMask;
      uniform int uView;
      uniform float uEmission;
      uniform float uFaceTone;
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;

      void main() {
        vec3 masks = texture2D(uMask, vUv).rgb;
        float key = clamp(0.49 + vPosition.y * 0.29 - vPosition.x * 0.24, 0.13, 1.0);
        float graze = 1.0 - clamp(dot(normalize(cameraPosition - vPosition), normalize(vNormal)), 0.0, 1.0);
        float fresnel = graze * graze * graze;
        vec3 base = mix(vec3(0.004, 0.018, 0.14), vec3(0.013, 0.36, 0.90), key * key) * uFaceTone;
        vec3 panel = base * (0.79 + 0.42 * masks.r);
        vec3 line = vec3(0.022, 0.22, 0.34) * masks.g * (0.3 + 0.7 * key);
        vec3 rim = vec3(0.035, 0.23, 0.53) * fresnel * 0.28;
        float edge = exp2(-36.0 * (1.0 - vUv.y)) * exp2(-1.8 * abs(vUv.x - 0.16));
        vec3 emission = vec3(0.07, 0.95, 1.65) * (masks.b * key * 0.24 + edge * 0.62) * uEmission * uFaceTone;
        vec3 color = panel + line + rim + emission;

        if (uView == 1) color = base;
        if (uView == 2) color = vec3(masks.r);
        if (uView == 3) color = vec3(masks.g);
        if (uView == 4) color = vec3(fresnel);
        if (uView == 5) color = emission;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  }));

  return {
    geometry,
    materials,
    dispose() {
      geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of [sideMask, frontMask, crownMask]) texture.dispose();
    },
  };
}
