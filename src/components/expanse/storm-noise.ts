import { Data3DTexture, LinearFilter, RepeatWrapping, RGFormat } from 'three';

// Two tileable 3D fields, baked once. The shader advects them at different
// rates and warps the near flow so neither reads as a translating flat image.
export function createStormNoise(seed: number) {
  const size = 48;
  const data = new Uint8Array(size ** 3 * 2);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  function octave(cells: number, salt: number) {
    const lattice = new Float32Array(cells ** 3);
    let random = seed + salt;
    for (let i = 0; i < lattice.length; i++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      lattice[i] = random / 4294967296;
    }
    return (x: number, y: number, z: number) => {
      const fx = x * cells / size, fy = y * cells / size, fz = z * cells / size;
      const a = Math.floor(fx), b = Math.floor(fy), c = Math.floor(fz);
      const u = smooth(fx - a), v = smooth(fy - b), w = smooth(fz - c);
      const at = (i: number, j: number, k: number) => lattice[(i % cells) + cells * ((j % cells) + cells * (k % cells))];
      const row = (j: number, k: number) => lerp(at(a, j, k), at(a + 1, j, k), u);
      return lerp(lerp(row(b, c), row(b + 1, c), v), lerp(row(b, c + 1), row(b + 1, c + 1), v), w);
    };
  }
  const large = octave(4, 541), medium = octave(9, 789), fine = octave(17, 1511);
  for (let z = 0, i = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++, i += 2) {
    const detail = fine(x, y, z);
    data[i] = Math.round(255 * (large(x, y, z) * .74 + medium(x, y, z) * .26));
    data[i + 1] = Math.round(255 * (medium(x, y, z) * .62 + detail * .38));
  }
  const texture = new Data3DTexture(data, size, size, size);
  texture.format = RGFormat;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}
