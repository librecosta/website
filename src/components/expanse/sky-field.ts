import { DataTexture, LinearFilter, MathUtils, RepeatWrapping, RGFormat } from 'three';
import { EXPANSE } from './parameters';
import { valueNoise } from './world';

// Store low-frequency masks once. The same direction is sampled regardless of
// camera position, and the azimuth seam wraps between adjacent texel centers.
export function createSkyField() {
  const width = 256, height = 128;
  const data = new Uint8Array(width * height * 2);
  const seed = EXPANSE.seed;
  for (let row = 0; row < height; row++) {
    const y = (row + 0.5) / height;
    const radius = Math.sqrt(1 - y * y);
    for (let col = 0; col < width; col++) {
      const azimuth = ((col + 0.5) / width - 0.5) * 2 * Math.PI;
      const x = radius * Math.sin(azimuth);
      const z = -radius * Math.cos(azimuth);
      const a = 2.25 * x + 1.6 * z;
      const b = 3.2 * y + 1.1 * z;
      const broad = 0.74 * valueNoise(a + 0.62, b + 0.23, seed + 84)
        + 0.26 * valueNoise(2.1 * a - 1.24, 2.1 * b + 2.32, seed + 135);

      // Stretch the field along azimuth. A gentle bend and a separate density
      // envelope keep the veil from reading as parallel stripes.
      const u = x + 0.48 * z;
      const bend = 0.08 * valueNoise(2.7 * u, 3.2 * y - z, seed + 212);
      const v = y + 0.13 * x - 0.035 * z + bend;
      const folds = 0.74 * valueNoise(2.9 * u - 0.8, 15 * v + 1.7, seed + 297)
        + 0.26 * valueNoise(6.3 * u + 1.5, 30 * v - 1.2, seed + 381);
      const envelope = 0.60 + 0.40 * valueNoise(1.8 * x + 1.2 * z, 3.1 * y - z, seed + 472);
      const veil = MathUtils.smoothstep(folds, -0.34, 0.60) * envelope;
      const offset = (row * width + col) * 2;
      data[offset] = Math.round(255 * (0.5 + 0.5 * broad));
      data[offset + 1] = Math.round(255 * veil);
    }
  }
  const texture = new DataTexture(data, width, height, RGFormat);
  texture.wrapS = RepeatWrapping;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
