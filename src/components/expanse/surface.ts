import type { SurfaceView, WorldParameters } from './parameters';
import type { Monument } from './world';

type Mask = Exclude<SurfaceView, 'finalMaterial'>;

type HeightSource = {
  heightAt: (x: number, z: number, world: WorldParameters) => number;
  valleyAt: (z: number, world: WorldParameters) => { x: number; width: number };
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function smoothstep(lo: number, hi: number, value: number) {
  const t = clamp((value - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
}

export function analyzeSurface(world: WorldParameters, { heightAt, valleyAt }: HeightSource) {
  const { terrain, surface } = world;
  const step = surface.analysisStep;
  const maxWidth = Math.max(...terrain.valleySpine.map(node => node.width));
  const maxRadius = Math.max(surface.minimumNeighborhoodCells * step, maxWidth * surface.neighborhoodWidth);
  const padding = Math.ceil(maxRadius / step) + 2;
  const nx = Math.ceil(terrain.width / step) + 1;
  const nz = Math.ceil(terrain.depth / step) + 1;
  const stride = nx + 2 * padding;
  const rows = nz + 2 * padding;
  const minX = -terrain.width / 2 - padding * step;
  const minZ = terrain.centerZ - terrain.depth / 2 - padding * step;
  const base = new Float32Array(stride * rows);
  const smooth = new Float32Array(base.length);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < stride; i++) {
      base[j * stride + i] = heightAt(minX + i * step, minZ + j * step, world);
    }
  }
  const heights = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    const start = (j + padding) * stride + padding;
    heights.set(base.subarray(start, start + nx), j * nx);
  }
  heights.sort();
  const percentile = (p: number) => {
    const index = p * (heights.length - 1), floor = Math.floor(index);
    return lerp(heights[floor], heights[Math.ceil(index)], index - floor);
  };
  const relief = percentile(0.95) - percentile(0.05);
  // A 3×3 binomial kernel suppresses cell-scale variation before derivatives.
  for (let j = 1; j < rows - 1; j++) {
    for (let i = 1; i < stride - 1; i++) {
      const k = j * stride + i;
      smooth[k] = (4 * base[k] + 2 * (base[k - 1] + base[k + 1] + base[k - stride] + base[k + stride])
        + base[k - stride - 1] + base[k - stride + 1] + base[k + stride - 1] + base[k + stride + 1]) / 16;
    }
  }
  function smoothHeight(x: number, z: number) {
    const fx = (x - minX) / step, fz = (z - minZ) / step;
    const i = Math.floor(fx), j = Math.floor(fz), k = j * stride + i;
    return lerp(lerp(smooth[k], smooth[k + 1], fx - i), lerp(smooth[k + stride], smooth[k + stride + 1], fx - i), fz - j);
  }
  return {
    relief,
    sample(x: number, z: number) {
      const spine = valleyAt(z, world);
      const radius = Math.max(step * surface.minimumNeighborhoodCells, spine.width * surface.neighborhoodWidth);
      const diagonal = radius * Math.SQRT1_2;
      const west = smoothHeight(x - radius, z), east = smoothHeight(x + radius, z);
      const south = smoothHeight(x, z - radius), north = smoothHeight(x, z + radius);
      const slopeDegrees = Math.atan(Math.hypot(east - west, north - south) / (2 * radius)) * 180 / Math.PI;
      const mean = (west + east + south + north + smoothHeight(x - diagonal, z - diagonal)
        + smoothHeight(x + diagonal, z - diagonal) + smoothHeight(x - diagonal, z + diagonal)
        + smoothHeight(x + diagonal, z + diagonal)) / 8;
      const curvature = (mean - smoothHeight(x, z)) / (radius * radius);
      const lateral = x - spine.x;
      return {
        slopeDegrees,
        flatness: 1 - smoothstep(...surface.flatSlope, slopeDegrees),
        concavity: smoothstep(...surface.curvature, curvature),
        exposure: smoothstep(...surface.curvature, -curvature),
        valley: 1 - smoothstep(...surface.corridor, Math.abs(lateral) / spine.width),
        bank: Math.sign(lateral),
      };
    },
  };
}

type FootprintPoint = { along: number; across: number };

function footprintHull(points: FootprintPoint[]) {
  points.sort((a, b) => a.across - b.across || a.along - b.along);
  const chain = (vertices: FootprintPoint[]) => {
    const edges: FootprintPoint[] = [];
    for (const point of vertices) {
      while (edges.length > 1) {
        const a = edges[edges.length - 2], b = edges[edges.length - 1];
        const turn = (b.across - a.across) * (point.along - a.along) - (b.along - a.along) * (point.across - a.across);
        if (turn > 0) break;
        edges.pop();
      }
      edges.push(point);
    }
    return edges.slice(0, -1);
  };
  return [...chain(points), ...chain(points.reverse())];
}

export function buildDrifts(
  world: WorldParameters,
  relief: number,
  monuments: Monument[],
  { worldVertices, valleyAt }: Pick<HeightSource, 'valleyAt'> & {
    worldVertices: (monument: Monument, world: WorldParameters) => { x: number; z: number }[];
  },
) {
  const p = world.surface.drift;
  const windLength = Math.hypot(...p.wind);
  if (windLength === 0) return [];
  const windX = p.wind[0] / windLength, windZ = p.wind[1] / windLength;
  const project = (x: number, z: number) => ({ along: x * windX + z * windZ, across: z * windX - x * windZ });
  const targets = new Set<string>(p.targets);
  return monuments.filter(monument => targets.has(monument.id)).map(monument => {
    const [originX, , originZ] = monument.position;
    const hull = footprintHull(worldVertices(monument, world).map(vertex => project(vertex.x - originX, vertex.z - originZ)));
    const minAcross = Math.min(...hull.map(point => point.across));
    const maxAcross = Math.max(...hull.map(point => point.across));
    const minAlong = Math.min(...hull.map(point => point.along));
    const maxAlong = Math.max(...hull.map(point => point.along));
    const width = maxAcross - minAcross, centerAcross = (minAcross + maxAcross) / 2;
    const peak = Math.min(relief * p.reliefLimit, width * p.widthLimit);
    return {
      id: monument.id,
      peak,
      bank: Math.sign(originX - valleyAt(originZ, world).x),
      sample(x: number, z: number) {
        const dx = x - originX, dz = z - originZ;
        const across = dz * windX - dx * windZ;
        const along = dx * windX + dz * windZ;
        if (across <= minAcross || across >= maxAcross || along <= minAlong || along >= maxAlong + width * p.leeExtent[1]) return 0;
        // Intersect the wind-aligned slice with the rotated footprint. Only
        // points past its rear edge can accumulate sand in this approximation.
        let rear = -Infinity;
        for (let i = 0; i < hull.length; i++) {
          const a = hull[i], b = hull[(i + 1) % hull.length];
          if (a.across === b.across || across < Math.min(a.across, b.across) || across > Math.max(a.across, b.across)) continue;
          rear = Math.max(rear, lerp(a.along, b.along, (across - a.across) / (b.across - a.across)));
        }
        const lee = (along - rear) / width;
        if (lee <= 0) return 0;
        const feather = 1 - smoothstep(...p.crossFade, Math.abs(across - centerAcross) / width);
        return peak * smoothstep(0, p.leeRamp, lee) * Math.exp(-lee / p.leeDecay)
          * (1 - smoothstep(...p.leeExtent, lee)) * feather;
      },
    };
  });
}

export function buildSurfaceTerrain(
  world: WorldParameters,
  base: { positions: Float32Array; indices: Uint32Array },
  analysis: ReturnType<typeof analyzeSurface>,
  valueNoise: (x: number, z: number, seed: number) => number,
  drifts: ReturnType<typeof buildDrifts> = [],
) {
  const positions = base.positions.slice();
  const count = positions.length / 3;
  const masks: Record<Mask, Float32Array> = {
    slope: new Float32Array(count), concavity: new Float32Array(count), valley: new Float32Array(count),
    sandCoverage: new Float32Array(count), exposedCrust: new Float32Array(count), drift: new Float32Array(count),
  };
  const { cover, sandNoise, thicknessFraction, drift: driftParameters, slopeDisplayMax } = world.surface;
  const sandDepth = thicknessFraction * analysis.relief;
  const driftDepth = Math.max(0, ...drifts.map(drift => drift.peak));
  const coverageDepth = sandDepth || driftDepth;
  for (let i = 0; i < count; i++) {
    const index = i * 3, x = positions[index], z = positions[index + 2];
    const { slopeDegrees, flatness, concavity, exposure, valley, bank } = analysis.sample(x, z);
    let noise = 0;
    for (let octave = 0; octave < sandNoise.length; octave++) {
      const { wavelength, weight } = sandNoise[octave];
      noise += weight * valueNoise(x / wavelength, z / wavelength, world.seed + 607 + octave * 113);
    }
    const potential = clamp(cover.bias + cover.flat * flatness + cover.concavity * concavity + cover.valley * valley
      - cover.exposure * exposure + cover.noise * noise);
    let drift = 0;
    // The protected floor interrupts transport. A trial plume stays on its
    // source bank rather than reappearing as a detached patch across the lane.
    for (const source of drifts) if (source.bank === bank) drift = Math.max(drift, source.sample(x, z));
    if (drift > 0) {
      drift *= (1 - smoothstep(...driftParameters.steepSlope, slopeDegrees))
        * (1 - smoothstep(...driftParameters.protectedValley, valley));
    }
    const thickness = sandDepth * potential + drift;
    const coverage = coverageDepth > 0 ? clamp(thickness / coverageDepth) : 0;
    positions[index + 1] += thickness;
    masks.slope[i] = clamp(slopeDegrees / slopeDisplayMax);
    masks.concavity[i] = concavity;
    masks.valley[i] = valley;
    masks.sandCoverage[i] = coverage;
    masks.exposedCrust[i] = 1 - coverage;
    masks.drift[i] = driftDepth > 0 ? clamp(drift / driftDepth) : 0;
  }
  return { positions, indices: base.indices, masks, sandDepth, driftDepth };
}
