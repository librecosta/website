import { DataTexture, LinearFilter, LinearMipmapLinearFilter, MathUtils, RepeatWrapping } from 'three';

export const MINERAL_GRAIN_CELLS = 12;

// Periodic cellular section through the mineral. Adjacent grains meet at a
// shallow joint; mineral hardness determines polish and relief within each cell.
export function createMineralGrain() {
  const size = 128, cells = MINERAL_GRAIN_CELLS;
  let state = 0x4e171a1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const grains = Array.from({ length: cells * cells }, () => ({
    x: 0.19 + 0.62 * random(), y: 0.19 + 0.62 * random(), hardness: random(),
  }));
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) * cells / size, v = (y + 0.5) * cells / size;
    const i = Math.floor(u), j = Math.floor(v);
    let closest = Infinity, next = Infinity, hardness = 0;
    for (let row = j - 1; row <= j + 1; row++) for (let column = i - 1; column <= i + 1; column++) {
      const grain = grains[((row + cells) % cells) * cells + (column + cells) % cells];
      const dx = column + grain.x - u, dy = row + grain.y - v;
      const distance = dx * dx + dy * dy;
      if (distance < closest) {
        next = closest;
        closest = distance;
        hardness = grain.hardness;
      } else {
        next = Math.min(next, distance);
      }
    }
    const interior = MathUtils.smoothstep(Math.sqrt(next) - Math.sqrt(closest), 0, 0.28);
    const offset = (y * size + x) * 4;
    data[offset] = Math.round(255 * interior * (0.28 + 0.62 * hardness));
    data[offset + 1] = Math.round(255 * MathUtils.lerp(0.58, 1 - hardness, interior));
    data[offset + 2] = Math.round(255 * (1 - interior) ** 2);
    data[offset + 3] = 255;
  }
  const texture = new DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = texture.needsUpdate = true;
  return texture;
}
