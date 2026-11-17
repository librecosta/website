import { MathUtils, Vector3 } from 'three';
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

const TAU = 2 * Math.PI;
const { clamp, degToRad, lerp, smoothstep } = MathUtils;

// Blend the two periodic copies within one noise cell of the flow meridian.
function flowNoise(angle: number, across: number, cells: number, seed: number) {
  const along = angle * cells / TAU;
  const sample = valueNoise(along, across, seed);
  const seam = smoothstep(Math.abs(along), cells / 2 - 1, cells / 2 + 1);
  return seam > 0 ? lerp(sample, valueNoise(along - Math.sign(along) * cells, across, seed), seam) : sample;
}

export function createSkyField() {
  const start = performance.now();
  const { flow } = EXPANSE.atmosphere.skyFinish;
  const a = degToRad(flow.azimuth), e = degToRad(flow.elevation), t = degToRad(flow.tilt);
  const origin = new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
  const east = new Vector3(Math.cos(a), 0, Math.sin(a));
  const up = new Vector3(-Math.sin(a) * Math.sin(e), Math.cos(e), Math.cos(a) * Math.sin(e));
  const along = east.clone().multiplyScalar(Math.cos(t)).addScaledVector(up, Math.sin(t));
  const across = up.multiplyScalar(Math.cos(t)).addScaledVector(east, -Math.sin(t));
  const halfWidth = degToRad(flow.halfWidth), bend = degToRad(flow.bend);
  const branches = flow.branches.map(branch => ({
    ...branch, offset: degToRad(branch.offset), halfWidth: degToRad(branch.halfWidth),
    fringeReach: degToRad(branch.fringeReach), outward: Math.sign(branch.offset),
  }));
  const widthBase = 0.95, widthLong = 0.24, widthShort = 0.18;
  const maxWidth = widthBase + widthLong + widthShort;
  const cloudLimit = Math.sin(bend + Math.max(halfWidth * maxWidth,
    ...branches.map(branch => Math.abs(branch.offset) + Math.max(branch.halfWidth * maxWidth, branch.fringeReach))));
  const seed = EXPANSE.seed + 297;
  const data = new Uint8Array(SKY_WIDTH * SKY_HEIGHT * 4);
  const ray = new Vector3();
  forSkyDirection((offset, x, y, z) => {
    // Cartesian projections keep the low-contrast field continuous even at zenith.
    const broad = 0.72 * valueNoise(1.9 * x + 0.45 * z + 0.62, 2.7 * y + 0.9 * z + 0.23, seed + 7)
      + 0.28 * valueNoise(3.1 * x - 1.7 * z - 1.24, 3.7 * y + 1.6 * z + 2.32, seed + 8);
    const mist = valueNoise(1.35 * x - 0.9 * z + 1.4, 1.7 * y + 0.8 * z - 0.8, seed + 9);
    data[offset] = Math.round(255 * (0.5 + 0.5 * broad));
    data[offset + 3] = Math.round(255 * (0.5 + 0.5 * mist));

    ray.set(x, y, z);
    // Skip directions outside every possible ribbon, including the flow poles.
    const side = ray.dot(across);
    if (Math.abs(side) >= cloudLimit) return;
    const lat = Math.asin(clamp(side, -1, 1));
    const lon = Math.atan2(ray.dot(along), ray.dot(origin));
    const spine = bend * (0.63 * Math.sin(1 + lon) + 0.37 * Math.sin(2 * lon - 1.4));
    const local = lat - spine;
    const width = widthBase + widthLong * Math.sin(2 * lon + 0.9) + widthShort * Math.sin(5 * lon - 1.4);
    const main = flow.density * (1 - smoothstep(Math.abs(local), halfWidth * width * 0.11, halfWidth * width));
    let secondary = 0;
    for (const branch of branches) {
      const separation = branch.offset * (0.62 + 0.38 * Math.sin(lon * 2 + branch.phase));
      const distance = local - separation;
      const span = branch.halfWidth * width;
      const envelope = 1 - smoothstep(Math.abs(distance), 0, span);
      // Feather only the outward edge. The extension shares the branch's fiber field.
      const outwardDistance = distance * branch.outward;
      const reach = branch.fringeReach * (0.85 + 0.15 * Math.cos(2 * lon + branch.phase));
      const fringe = smoothstep(outwardDistance, 0, 0.8 * span)
        * (1 - smoothstep(outwardDistance, 0.22 * reach, reach));
      secondary += branch.density * (0.72 + 0.28 * Math.cos(lon * 3 - branch.phase))
        * (envelope + branch.fringeStrength * fringe);
    }
    if (main + secondary <= 0) return;

    const strand = local * (1 + 0.23 * Math.sin(3 * lon - 0.4)) + 0.042 * flowNoise(lon, 4 * local + 1.3, 13, seed + 1);
    const fork = strand + 0.025 * flowNoise(lon, 15 * strand + 3.5, 24, seed + 2);
    const fibers = 0.53 * flowNoise(lon, 33 * strand + 4.2, 12, seed + 3)
      + 0.32 * flowNoise(lon, 62 * fork - 1.1, 26, seed + 4)
      + 0.15 * flowNoise(lon, 105 * fork + 2.8, 39, seed + 5);
    const feather = smoothstep(fibers, -0.31, 0.38);
    const lowFade = lerp(0.26, 1, smoothstep(y, 0.018, 0.18));
    const density = 0.82 + 0.18 * flowNoise(lon, 0.6, 19, seed);
    const contrast = lowFade * density * (0.13 + 0.87 * feather);
    data[offset + 1] = Math.round(255 * main * contrast);
    data[offset + 2] = Math.round(255 * secondary * contrast);
  });
  return { data, generationMs: performance.now() - start };
}
