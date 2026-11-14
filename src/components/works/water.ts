/* Adapted from Wenz Louie Rejas (2026), MIT, 0319381. See public/works/wenz-license.txt. */
import * as T from 'three';
import type { DistanceField } from './shore-field';

const oceanFragment = `
float hash(float seed) {
  return fract(sin(seed) * 43758.5453);
}

float hash(vec2 point) {
  point = fract(point * vec2(127.1, 311.7));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

float vnoise(vec2 point) {
  vec2 i = floor(point), fraction = fract(point);
  fraction = fraction * fraction * fraction * (fraction * (fraction * 6.0 - 15.0) + 10.0);
  return mix(
    mix(hash(i),                  hash(i + vec2(1.0, 0.0)), fraction.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), fraction.x),
    fraction.y
  );
}
float smin(float first, float other, float blend) {
  float overlap = max(blend - abs(first - other), 0.0) / blend;
  return min(first, other) - overlap * overlap * overlap * blend / 6.0;
}
uniform float uEdgeThreshold;
uniform float uEdgeSoftness;
uniform vec3  uDeepColor;
uniform vec3  uMidColor;
uniform float uMidPosition;
uniform vec3  uHighlight;
uniform float uOpacity;
uniform float uDeepOpacity;
uniform float uFresnelPower;
uniform float uFresnelStrength;
uniform float uSpecularStrength;
uniform float uSpecularPower;
uniform vec3  uSunDirection;
uniform vec3  uMoonDirection;
uniform float uMoonIntensity;

float oceanTone(float edge) {
  return smoothstep(uEdgeThreshold - uEdgeSoftness, uEdgeThreshold + uEdgeSoftness, edge);
}

vec4 oceanSurface(float tone, vec3 normal, vec3 position) {
  float safeMP = max(uMidPosition, 1e-4);
  float seg0   = clamp(tone / safeMP, 0.0, 1.0);
  float seg1   = clamp((tone - safeMP) / max(1.0 - safeMP, 1e-4), 0.0, 1.0);
  float inSeg1 = step(safeMP, tone);
  vec3 color   = mix(
    mix(uDeepColor, uMidColor, seg0),
    mix(uMidColor,  uHighlight, seg1),
    inSeg1
  );

  vec3 surfaceNormal       = normalize(normal);
  vec3 viewDir = normalize(vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]));

  float nDotV  = clamp(dot(surfaceNormal, viewDir), 0.0, 1.0);
  float fresnel = pow(1.0 - nDotV, uFresnelPower) * uFresnelStrength;
  color = mix(color, uHighlight, fresnel);

  vec3  sunDir = normalize(uSunDirection);
  vec3  halfVector      = normalize(sunDir + viewDir);
  float spec   = pow(max(dot(surfaceNormal, halfVector), 0.0), uSpecularPower) * uSpecularStrength;
  color = mix(color, uHighlight, spec);

  vec3  moonDir = normalize(uMoonDirection);
  vec3  moonHalfVector      = normalize(moonDir + viewDir);
  float moonSpec = pow(max(dot(surfaceNormal, moonHalfVector), 0.0), 64.0) * uMoonIntensity * 0.45;
  color = mix(color, vec3(0.72, 0.82, 1.0), clamp(moonSpec, 0.0, 1.0));

  return vec4(color, mix(uDeepOpacity, 1.0, max(tone, fresnel)) * uOpacity);
}

uniform float uTime;
uniform float uScale;
uniform float uSmoothness;
uniform float uFlowX;
uniform float uFlowZ;
uniform float uCellSpeed;
uniform float uNoiseScale;
uniform float uNoiseFlowSpeed;
uniform float uDistortAmount;
uniform vec3  uFoamColor;
uniform float uFoamAmount;
uniform float uCrestStrength;

varying vec2  vWorldPos;
varying vec3  vPos;
varying vec3  vNormal;
varying float vWaveHeight;

vec2 hash2(vec2 point) {
  point = vec2(dot(point, vec2(127.1, 311.7)), dot(point, vec2(269.5, 183.3)));
  return fract(sin(point) * 43758.5453);
}

vec2 cellPt(vec2 seed) {
  return 0.5 + 0.5 * sin(uTime * uCellSpeed + 6.2831 * seed);
}

vec2 voronoiEdge(vec2 point) {
  vec2 i = floor(point), f = point - i;
  float nearest = 8.0, blended = 8.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2  neighbour = vec2(float(x), float(y));
      float cellGap = length(neighbour + cellPt(hash2(i + neighbour)) - f);
      nearest  = min(nearest, cellGap);
      blended = smin(blended, cellGap, uSmoothness);
    }
  return vec2(nearest, blended);
}

float fbm(vec2 point) {
#ifdef LIGHT_NOISE
  return LIGHT_NOISE_MEAN + LIGHT_NOISE_SPREAD * (vnoise(point) - 0.5);
#else
  float value = 0.0, amplitude = 0.5;
  for (int i = 0; i < 2; i++) { value += amplitude * vnoise(point); point *= 2.0; amplitude *= 0.5; }
  return value;
#endif
}

void main() {
  vec2 noiseUV = vWorldPos * uNoiseScale + vec2(uTime * uNoiseFlowSpeed, 0.0);
  vec2 distort = vec2(
    fbm(noiseUV),
    fbm(noiseUV + vec2(5.2, 1.3))
  ) - 0.5;
  distort *= uDistortAmount;

  vec2 uv = vWorldPos * uScale + vec2(uFlowX, uFlowZ) * uTime + distort;

  vec2  vor  = voronoiEdge(uv);
  float edge = vor.x - vor.y;

  float tone = oceanTone(edge);
  vec4 surface = oceanSurface(tone, vNormal, vPos);
  float swell = vnoise(vWorldPos * 0.021 + vec2(uTime * 0.009, -uTime * 0.006));
  float glints = smoothstep(0.72, 0.96, vnoise(vWorldPos * 2.7));
  vec3 color = surface.rgb * (0.84 + 0.27 * swell);
  color = mix(color, uHighlight, glints * (0.07 + 0.16 * swell));

  float crestFactor = smoothstep(0.1, 0.72, vWaveHeight);
  color = mix(color, uFoamColor, crestFactor * uCrestStrength);

  float alpha = surface.a;

  vec2  foamUV    = vWorldPos * uNoiseScale * 2.1 + vec2(uFlowX, uFlowZ) * uTime * 0.4 + vec2(4.7, 2.1);
  float foamNoise = fbm(foamUV);
  float foamEdge  = smoothstep(uEdgeThreshold * 0.3, uEdgeThreshold + uEdgeSoftness * 1.5, edge);
  float crest     = smoothstep(0.12, 0.60, vWaveHeight);
  float foam      = clamp(foamEdge + crest * 0.75, 0.0, 1.0)
                  * smoothstep(0.38, 0.56, foamNoise)
                  * uFoamAmount;
  color = mix(color, uFoamColor, foam);
  alpha = max(alpha, foam);

  float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  color += (dither - 0.5) / 255.0;

  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

const shoreFragment = `
float hash(float seed) {
  return fract(sin(seed) * 43758.5453);
}

float hash(vec2 point) {
  point = fract(point * vec2(127.1, 311.7));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

float noise(vec2 point) {
  vec2 i = floor(point), fraction = fract(point);
  fraction = fraction * fraction * (3.0 - 2.0 * fraction);
  return mix(mix(hash(i),             hash(i + vec2(1,0)), fraction.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), fraction.x), fraction.y);
}


const float FOAM_OPACITY = 0.70;

float foamJag(vec2 point, float time) {
  float noiseValue = noise(point + vec2(0.11, -0.09) * time);
  return floor(noiseValue * 6.0) / 6.0 - 0.40;
}
const float WAVE_REACH=2.9, WAVE_INSET=0.35, WAVE_WIDTH=0.09,
  WAVE_DASH_SHORT=0.48, WAVE_DASH_LONG=0.22, WAVE_DASH_GRAIN=2.8,
  WAVE_DASH_TAPER=0.13, FOAM_RECEDE_SHARE=0.6, FOAM_TUCK=0.22,
  WAVE_SPEED=0.24, WAVE_LAG_GRAIN=1.9, WAVE_LAG=0.6, FOAM_CONTRACTED_WIDTH=0.12,
  FOAM_EXPANDED_WIDTH=0.26, FOAM_GRAIN=3.4, FOAM_JAG=0.19, WAVE_STRENGTH=0.76;


uniform sampler2D uField;
uniform float uFieldSize;
uniform float uMargin;
uniform float uHighlight;
uniform vec3 uShallows;
uniform float uTime;
uniform vec3  uColor;

varying vec2 vFieldUv;

float stroke(float offset, float halfWidth, float pixelWidth) {
  float drawnHalfWidth = max(halfWidth, max(pixelWidth * 0.5, 1e-4));
  float edge = pixelWidth * 0.5;
  float coverage = 1.0 - smoothstep(drawnHalfWidth - edge, drawnHalfWidth + edge, abs(offset));
  return coverage * halfWidth / drawnHalfWidth;
}

float wave(float waveDistance, vec2 surfacePoint, float cycle, float pixelWidth) {
  float progress = fract(cycle);
  float crest = mix(WAVE_REACH, WAVE_INSET, progress);
  if (abs(waveDistance - crest) > WAVE_WIDTH + pixelWidth) return 0.0;

  float fade = smoothstep(0.0, 0.2, progress) * (1.0 - smoothstep(0.9, 1.0, progress));
  float growth = smoothstep(0.0, 0.85, progress);
  float cut = mix(WAVE_DASH_SHORT, WAVE_DASH_LONG, growth);
  float dash = noise(surfacePoint * WAVE_DASH_GRAIN + vec2(mod(floor(cycle), 61.0) * 17.3, 0.0));
  float taper = smoothstep(cut, cut + WAVE_DASH_TAPER, dash);
  float halfWidth = WAVE_WIDTH * taper * (0.4 + 0.6 * growth);

  return stroke(waveDistance - crest, halfWidth, pixelWidth) * fade;
}

float surge(float arrivals) {
  float settle = fract(arrivals);
  return max(
    1.0 - smoothstep(0.0, FOAM_RECEDE_SHARE, settle),
    smoothstep(FOAM_RECEDE_SHARE, 1.0, settle)
  );
}

void main() {
  vec2 distances = (texture2D(uField, vFieldUv).rg * 2.0 - 1.0) * uMargin;
  float shoreDistance = distances.r;
  float waveDistance = distances.g;
  float pixelWidth = fwidth(waveDistance);
  if (shoreDistance < -FOAM_TUCK || shoreDistance > uMargin - 0.1) discard;

  vec2 surfacePoint = vFieldUv * uFieldSize;
  float clock = uTime * WAVE_SPEED + noise(surfacePoint * WAVE_LAG_GRAIN) * WAVE_LAG;

  float foamWidth = mix(FOAM_CONTRACTED_WIDTH, FOAM_EXPANDED_WIDTH, surge(clock));
  float foamEdge = foamWidth - foamJag(surfacePoint * FOAM_GRAIN, uTime) * FOAM_JAG;
  float foam = shoreDistance < foamEdge ? FOAM_OPACITY : 0.0;

  float waves = wave(waveDistance, surfacePoint, clock, pixelWidth);

  float wash = (1.0 - smoothstep(0.05, uMargin-0.14, shoreDistance)) * (0.56 + 0.32*uHighlight);
  float line = max(foam * (0.75 + 0.25*uHighlight), waves * WAVE_STRENGTH);
  float alpha = max(line, wash);
  if (alpha <= 0.002) discard;

  gl_FragColor = vec4(mix(uShallows, uColor, line / max(alpha,0.001)), alpha);
  #include <colorspace_fragment>
}
`;
export function oceanMaterial() {
  return new T.ShaderMaterial({
    defines: { LIGHT_NOISE: 1, LIGHT_NOISE_MEAN: '0.375', LIGHT_NOISE_SPREAD: '0.52' },
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 0.08 },
      uSmoothness: { value: 0.18 },
      uEdgeThreshold: { value: 0.075 },
      uEdgeSoftness: { value: 0.065 },
      uDeepColor: { value: new T.Color('#285f86') },
      uMidColor: { value: new T.Color('#316991') },
      uMidPosition: { value: 0.64 },
      uHighlight: { value: new T.Color('#649aaf') },
      uOpacity: { value: 1 },
      uDeepOpacity: { value: 1 },
      uFresnelPower: { value: 5.2 },
      uFresnelStrength: { value: 0.28 },
      uSpecularStrength: { value: 0.18 },
      uSpecularPower: { value: 26 },
      uSunDirection: { value: new T.Vector3(-0.45, 0.84, 0.24) },
      uMoonDirection: { value: new T.Vector3(0, 1, 0) },
      uMoonIntensity: { value: 0 },
      uFlowX: { value: 0.037 },
      uFlowZ: { value: -0.025 },
      uCellSpeed: { value: 0.24 },
      uNoiseScale: { value: 0.12 },
      uNoiseFlowSpeed: { value: 0.045 },
      uDistortAmount: { value: 0.74 },
      uFoamColor: { value: new T.Color('#a9dce2') },
      uFoamAmount: { value: 0.045 },
      uCrestStrength: { value: 0.055 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vWorldPos;
      varying vec3 vPos, vNormal;
      varying float vWaveHeight;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.);
        float a = dot(world.xz,vec2(.12,.08)) - uTime*.73;
        float b = dot(world.xz,vec2(-.085,.18)) - uTime*.51;
        float c = dot(world.xz,vec2(.24,.31)) + uTime*.9;
        vWaveHeight = sin(a)*.3+sin(b)*.22+sin(c)*.09;
        world.y += .13*vWaveHeight;
        vNormal = normalize(vec3(-cos(a)*.045+cos(b)*.028-cos(c)*.015,1.,
          -cos(a)*.031-cos(b)*.044-cos(c)*.02));
        vWorldPos=world.xz;
        vPos=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }
    `,
    fragmentShader: oceanFragment,
  });
}

export function shoreMesh(field: DistanceField, margin: number) {
  const { size, resolution, distances } = field;
  const bytes = new Uint8Array(resolution * resolution * 4);
  for (let i = 0; i < distances.length; i++) {
    const shade = Math.round((T.MathUtils.clamp(distances[i] / margin, -1, 1) * .5 + .5) * 255);
    bytes[i * 4] = bytes[i * 4 + 1] = shade;
    bytes[i * 4 + 3] = 255;
  }
  const texture = new T.DataTexture(bytes, resolution, resolution);
  texture.magFilter = texture.minFilter = T.LinearFilter;
  texture.needsUpdate = true;
  const material = new T.ShaderMaterial({
    uniforms: {
      uField: { value: texture },
      uFieldSize: { value: size },
      uMargin: { value: margin },
      uTime: { value: 0 },
      uColor: { value: new T.Color('#daf3dc') },
      uShallows: { value: new T.Color('#56bcc0') },
      uHighlight: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vFieldUv;
      void main() {
        vFieldUv = vec2(uv.x, 1.0-uv.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: shoreFragment,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(field.centerX, 0.09, field.centerZ);
  return mesh;
}

export function oceanSurfaceMaterial(texture: T.Texture) {
  return new T.ShaderMaterial({
    uniforms: { uWater: { value: texture }, uBufferSize: { value: new T.Vector2(1, 1) } },
    vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uWater;
      uniform vec2 uBufferSize;
      void main() {
        vec3 color = texture2D(uWater, gl_FragCoord.xy / uBufferSize).rgb;
        float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        gl_FragColor = vec4(color + (grain - 0.5) / 255.0, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
