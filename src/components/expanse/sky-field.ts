import { DataTexture, LinearFilter, MathUtils, RepeatWrapping, RGBAFormat, Vector3 } from 'three';
import { EXPANSE } from './parameters';
import { valueNoise } from './world';

export const SKY_WIDTH = 512;
export const SKY_HEIGHT = 256;
const azimuths = Array.from({ length: SKY_WIDTH }, (_, column) =>
  ((column + 0.5) / SKY_WIDTH - 0.5) * 2 * Math.PI);
const azimuthX = azimuths.map(Math.sin);
const azimuthZ = azimuths.map(angle => -Math.cos(angle));

export function forSkyDirection(visit: (offset: number, x: number, y: number, z: number) => void) {
  for (let row = 0; row < SKY_HEIGHT; row++) {
    const y = (row / (SKY_HEIGHT - 1)) ** 2;
    const radius = Math.sqrt(1 - y * y);
    for (let column = 0; column < SKY_WIDTH; column++) {
      visit(4 * (row * SKY_WIDTH + column), radius * azimuthX[column], y, radius * azimuthZ[column]);
    }
  }
}

export function createSkyField() {
  const start = performance.now();
  const bands = EXPANSE.atmosphere.skyFinish.veils.map((band, index) => {
    const { azimuth, elevation, tilt, halfLength, halfWidth } = band;
    const a = MathUtils.degToRad(azimuth), e = MathUtils.degToRad(elevation), t = MathUtils.degToRad(tilt);
    const center = new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
    const east = new Vector3(Math.cos(a), 0, Math.sin(a));
    const up = new Vector3(-Math.sin(a) * Math.sin(e), Math.cos(e), Math.cos(a) * Math.sin(e));
    const along = east.clone().multiplyScalar(Math.cos(t)).addScaledVector(up, Math.sin(t));
    const across = up.multiplyScalar(Math.cos(t)).addScaledVector(east, -Math.sin(t));
    return { center, along: along.divideScalar(Math.tan(MathUtils.degToRad(halfLength))),
      across: across.divideScalar(Math.tan(MathUtils.degToRad(halfWidth))),
      coverage: band.coverage, seed: EXPANSE.seed + 297 + 137 * index };
  });
  const data = new Uint8Array(SKY_WIDTH * SKY_HEIGHT * 4);
  const ray = new Vector3();
  forSkyDirection((offset, x, y, z) => {
    const a = 2.25 * x + 1.6 * z, b = 3.2 * y + 1.1 * z;
    const broad = 0.74 * valueNoise(a + 0.62, b + 0.23, EXPANSE.seed + 84)
      + 0.26 * valueNoise(2.1 * a - 1.24, 2.1 * b + 2.32, EXPANSE.seed + 135);
    ray.set(x, y, z);
    let uncovered = 1, clear = 1;
    for (const { center, along, across, coverage, seed } of bands) {
      // Project onto the tangent plane at the band's authored sky direction.
      const depth = ray.dot(center);
      if (depth <= 0) continue;
      const u = ray.dot(along) / depth, v = ray.dot(across) / depth;
      const envelope = coverage * (1 - MathUtils.smoothstep(u * u + v * v, 0.06, 1));
      if (envelope <= 0) continue;

      const bend = 0.38 * u * u + 0.23 * valueNoise(1.55 * u, 1.1 * v, seed);
      const strand = v + bend;
      const split = strand + 0.105 * valueNoise(2.5 * u, 3.1 * strand, seed + 1);
      const fibers = 0.58 * valueNoise(1.25 * u + 0.3, 6.9 * strand + 1.1, seed + 2)
        + 0.29 * valueNoise(2.7 * u - 1.7, 15 * split, seed + 3)
        + 0.13 * valueNoise(5.3 * u, 29 * split - 1.6, seed + 4);
      const breaks = 0.24 + 0.76 * MathUtils.smoothstep(valueNoise(3.4 * u, 4.1 * strand, seed + 5), -0.55, 0.31);
      const filament = MathUtils.smoothstep(fibers, -0.38, 0.52) * breaks;
      uncovered *= 1 - envelope;
      clear *= 1 - envelope * filament;
    }
    const envelope = 1 - uncovered, density = 1 - clear;
    data[offset] = Math.round(255 * (0.5 + 0.5 * broad));
    data[offset + 1] = Math.round(255 * envelope);
    data[offset + 2] = envelope > 0 ? Math.round(255 * density / envelope) : 0;
    data[offset + 3] = Math.round(data[offset + 1] * data[offset + 2] / 255);
  });
  return { data, generationMs: performance.now() - start };
}

export function createSkyDiagnostics(data: Uint8Array) {
  const texture = new DataTexture(data, SKY_WIDTH, SKY_HEIGHT, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
