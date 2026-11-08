import { DataArrayTexture, LinearFilter, LinearMipmapLinearFilter } from 'three';
import { INSCRIPTION_CHART, INSCRIPTION_FACES } from './monument-inscription-layout';

export function createInscriptionTexture(tier: number) {
  const width = 384, height = 960;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Inscription charts require Canvas 2D');
  const [chartWidth, chartHeight] = INSCRIPTION_CHART;
  context.scale(width / chartWidth, height / chartHeight);
  context.lineJoin = 'miter';
  context.miterLimit = 2;

  const pixelCount = width * height;
  const atlas = new Uint8Array(pixelCount * INSCRIPTION_FACES.length * 4).fill(255);
  const gray = (value: number) => {
    const byte = Math.round(255 * value);
    return `rgb(${byte}, ${byte}, ${byte})`;
  };
  const path = (points: readonly (readonly [number, number])[], closed = false) => {
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) context.lineTo(...point);
    if (closed) context.closePath();
  };
  const stroke = (width: number, value: number) => {
    context.lineWidth = width;
    context.strokeStyle = gray(value);
    context.stroke();
  };
  const fill = (value: number) => {
    context.fillStyle = gray(value);
    context.fill();
  };

  // R: panel tone. G: depth of the recessed profile. B: independent route mask.
  // Derive the normal from the same bevel profile used to shade the groove.
  INSCRIPTION_FACES.forEach((face, faceIndex) => {
    const drawings = face.slice(0, tier + 1);
    for (const channel of [0, 1, 2]) {
      context.fillStyle = gray(channel === 0 ? 0.5 : 0);
      context.fillRect(0, 0, chartWidth, chartHeight);
      if (channel === 0) {
        for (const drawing of drawings) for (const [tone, outline] of drawing.panels ?? []) {
          path(outline, true);
          fill(tone);
        }
      } else {
        // Draw all bevel shoulders first. Intersections then share a single dark floor.
        for (const drawing of drawings) for (const [width, route] of drawing.seams ?? []) {
          path(route);
          if (channel === 1) stroke(width * 1.85, 0.13);
          stroke(width * 1.4, channel === 1 ? 0.27 : 0.17);
        }
        for (const drawing of drawings) for (const [width, route] of drawing.seams ?? []) {
          path(route);
          stroke(width * 0.84, channel === 1 ? 0.63 : 0.73);
        }
        for (const drawing of drawings) for (const [depth, outline, ramp] of drawing.cuts ?? []) {
          path(outline, true);
          if (channel === 1) {
            stroke(2.25, depth * 0.22);
            stroke(1.16, depth * 0.53);
          }
          if (channel === 1 && ramp) {
            const profile = context.createLinearGradient(...ramp[0], ...ramp[1]);
            profile.addColorStop(0, gray(depth * 0.22));
            profile.addColorStop(1, gray(depth));
            context.fillStyle = profile;
            context.fill();
          } else {
            fill(channel === 1 ? depth : 1);
          }
        }
      }
      const bytes = context.getImageData(0, 0, width, height).data;
      for (let i = 0; i < pixelCount; i++) atlas[4 * (faceIndex * pixelCount + i) + channel] = bytes[4 * i];
    }
  });

  const texture = new DataArrayTexture(atlas, width, height, INSCRIPTION_FACES.length);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = texture.needsUpdate = true;
  return texture;
}
