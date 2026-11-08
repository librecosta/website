import { DataArrayTexture, LinearFilter, LinearMipmapLinearFilter } from 'three';
import { INSCRIPTION_CHART, INSCRIPTION_FACES } from './monument-inscription-layout';
import { MONUMENT_SURFACE_FACES } from './monument-surface-layout';

const width = 384, height = 960;

function createChartCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Inscription charts require Canvas 2D');
  const [chartWidth, chartHeight] = INSCRIPTION_CHART;
  context.scale(width / chartWidth, height / chartHeight);
  context.lineJoin = 'miter';
  context.miterLimit = 2;
  const path = (points: readonly (readonly [number, number])[], closed = false) => {
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) context.lineTo(...point);
    if (closed) context.closePath();
  };
  return { context, path };
}

function chartTexture(atlas: Uint8Array, depth: number) {
  const texture = new DataArrayTexture(atlas, width, height, depth);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = texture.needsUpdate = true;
  return texture;
}

export function createSurfaceTexture() {
  const { context, path } = createChartCanvas();
  const [chartWidth, chartHeight] = INSCRIPTION_CHART;
  const stride = width * height * 4;
  const atlas = new Uint8Array(stride * MONUMENT_SURFACE_FACES.length);
  MONUMENT_SURFACE_FACES.forEach(({ panels, lines, light }, index) => {
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = 'rgb(128, 0, 0)';
    context.fillRect(0, 0, chartWidth, chartHeight);
    for (const [tone, boundary] of panels) {
      path(boundary, true);
      context.fillStyle = `rgb(${Math.round(tone * 255)}, 0, 0)`;
      context.fill();
    }

    // The two line registers are independent of the panel tone and each other.
    context.globalCompositeOperation = 'lighten';
    for (const [routes, color] of [[lines, 'lime'], [light, 'blue']] as const) {
      context.strokeStyle = color;
      for (const [weight, route] of routes) {
        path(route);
        context.lineWidth = weight;
        context.stroke();
      }
    }
    atlas.set(context.getImageData(0, 0, width, height).data, index * stride);
  });
  return chartTexture(atlas, MONUMENT_SURFACE_FACES.length);
}

export function createInscriptionTexture(tier: number) {
  const { context, path } = createChartCanvas();
  const [chartWidth, chartHeight] = INSCRIPTION_CHART;
  const pixelCount = width * height;
  const atlas = new Uint8Array(pixelCount * INSCRIPTION_FACES.length * 4).fill(255);
  const gray = (value: number) => {
    const byte = Math.round(255 * value);
    return `rgb(${byte}, ${byte}, ${byte})`;
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

  return chartTexture(atlas, INSCRIPTION_FACES.length);
}
