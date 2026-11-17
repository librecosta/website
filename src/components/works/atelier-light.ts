import * as T from 'three';

/** A small linear-light reflection field for the atelier's glass and exposed metal. */
export function atelierEnvironment() {
  const width = 128;
  const height = 64;
  const pixels = new Uint16Array(width * height * 4);
  const point = new T.Vector3();
  const window = new T.Vector3(-.50, .72, .48).normalize();
  const windowRight = new T.Vector3().crossVectors(window, new T.Vector3(0, 1, 0)).normalize();
  const windowUp = new T.Vector3().crossVectors(windowRight, window);
  const sky = new T.Vector3(.68, .71, -.2).normalize();
  for (let y = 0; y < height; y++) {
    const elevation = ((y + .5) / height - .5) * Math.PI;
    for (let x = 0; x < width; x++) {
      const azimuth = ((x + .5) / width - .5) * Math.PI * 2;
      point.set(Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation),
        Math.cos(elevation) * Math.sin(azimuth));
      const ambient = T.MathUtils.lerp(.065, .27, T.MathUtils.smoothstep(point.y, -.25, .8));
      const key = point.dot(window) > 0
        ? (1 - T.MathUtils.smoothstep(Math.abs(point.dot(windowRight)), .14, .26)) *
          (1 - T.MathUtils.smoothstep(Math.abs(point.dot(windowUp)), .31, .52)) * 1.65
        : 0;
      const fill = T.MathUtils.smoothstep(point.dot(sky), .79, .98) * .67;
      pixels.set([
        T.DataUtils.toHalfFloat(ambient + key + fill * .70),
        T.DataUtils.toHalfFloat(ambient + key * .92 + fill * .86),
        T.DataUtils.toHalfFloat(ambient + key * .81 + fill),
        T.DataUtils.toHalfFloat(1),
      ], (y * width + x) * 4);
    }
  }
  const texture = new T.DataTexture(pixels, width, height, T.RGBAFormat, T.HalfFloatType);
  texture.mapping = T.EquirectangularReflectionMapping;
  texture.colorSpace = T.LinearSRGBColorSpace;
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
