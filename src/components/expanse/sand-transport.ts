import type { WorldParameters } from './parameters';

type WindMotion = WorldParameters['windMotion'];
type Transport = Pick<WindMotion, 'metersPerUnit' | 'step' | 'threshold' | 'shelterDistances' | 'shelterAngles' | 'maxShear' | 'looseBed'> & {
  resolution: readonly [number, number];
  bounds: readonly [number, number, number, number];
  baseShear: number;
  diffusion: number;
  settling: number;
  liftRate: number;
  transportPerShear: number;
  gusts: readonly (readonly [number, number, number])[];
};
type Ground = (x: number, z: number) => number;
type TransportOptions = {
  sediment: Ground;
  window?: WindMotion['window'];
  background?: { feed: number; inlet: number };
  sanctuary?: { influence: Ground; crosswind: Ground; turn: number; settling: number };
};

export function saltationThreshold({ grainDiameter, grainDensity, airDensity, gravity, bagnoldFactor }: Transport['threshold']) {
  return bagnoldFactor * Math.sqrt((grainDensity - airDensity) / airDensity * gravity * grainDiameter);
}

export function renderedGround(positions: ArrayLike<number>, [nx, nz]: readonly number[], terrain: WorldParameters['terrain']): Ground {
  const { width, depth, centerZ } = terrain;
  const startZ = centerZ + depth / 2;
  return (x, z) => {
    const u = Math.max(0, Math.min(nx, (x / width + 0.5) * nx));
    const v = Math.max(0, Math.min(nz, (startZ - z) * nz / depth));
    const ix = Math.min(nx - 1, Math.floor(u));
    const iz = Math.min(nz - 1, Math.floor(v));
    const a = (iz * (nx + 1) + ix) * 3 + 1;
    const b = a + (nx + 1) * 3;
    const s = u - ix;
    const t = v - iz;
    return s + t <= 1
      ? (1 - s - t) * positions[a] + s * positions[a + 3] + t * positions[b]
      : (s + t - 1) * positions[b + 3] + (1 - t) * positions[a + 3] + (1 - s) * positions[b];
  };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function createSandTransport(config: Transport, axis: readonly [number, number], ground: Ground,
  windSurface = ground, options?: TransportOptions) {
  const [nx, nz] = config.resolution;
  const [x0, x1, z0, z1] = config.bounds;
  const { metersPerUnit, step, diffusion } = config;
  const spacingX = (x1 - x0) / nx;
  const spacingZ = (z1 - z0) / nz;
  const dx = spacingX * metersPerUnit;
  const dz = spacingZ * metersPerUnit;
  const cellArea = dx * dz;
  const threshold = saltationThreshold(config.threshold);
  const maxVelocity = config.maxShear * config.transportPerShear;
  // Bound the sum of explicit outgoing face coefficients for any wind sign.
  const cfl = step * (2 * maxVelocity * (1 / dx + 1 / dz) + 2 * diffusion * (1 / dx ** 2 + 1 / dz ** 2));
  if (cfl >= 1) throw new Error(`Unstable sand transport step (CFL bound ${cfl.toFixed(3)})`);

  const count = nx * nz;
  const current = new Float64Array(count);
  const next = new Float64Array(count);
  const bed = new Float64Array(count);
  const sourceRate = new Float64Array(count);
  const groundLift = new Float64Array(count);
  const backgroundFeed = new Float64Array(count);
  const inletDensity = new Float64Array(count);
  const velocityX = new Float64Array(count);
  const velocityZ = new Float64Array(count);
  const shelter = new Float64Array(count);
  const settledFraction = new Float64Array(count);
  const settlingRate = new Float64Array(count);
  const windRetention = new Float64Array(count);
  const liftRetention = new Float64Array(count);
  const exposure = new Float64Array(count);
  const erodibility = new Float64Array(count);
  const bearingX = new Float64Array(count);
  const bearingZ = new Float64Array(count);
  const solid = new Uint8Array(count);
  const window = options?.window;
  const dormantSince = new Int32Array(nz).fill(-1);
  const gusts = config.gusts.map(([amplitude, wavelength, speed]) => ({
    amplitude, waveNumber: Math.PI * 2 / wavelength, frequency: Math.PI * 2 * speed / wavelength,
    sine: new Float64Array(count), cosine: new Float64Array(count),
  }));
  const axisLength = Math.hypot(...axis);
  const windX = axis[0] / axisLength;
  const windZ = axis[1] / axisLength;
  const windAngle = Math.atan2(windZ, windX);
  const [lowShadow, fullShadow] = config.shelterAngles.map(degrees => Math.tan(degrees * Math.PI / 180));
  const balance = { lifted: 0, deposited: 0, escaped: 0, entered: 0, fed: 0 };
  let steps = 0;
  let first = window ? -1 : 0;
  let last = window ? -1 : nz;
  const travel = window?.backgroundTravel ?? 0;
  const upstreamCol = Math.round(-travel * windX / dx);
  const upstreamRow = Math.round(-travel * windZ / dz);
  const phases = new Float64Array(gusts.length * 2);
  const backgroundPhases = new Float64Array(phases.length);

  for (let row = 0; row < nz; row++) for (let col = 0; col < nx; col++) {
    const i = row * nx + col;
    const x = x0 + (col + 0.5) * spacingX;
    const z = z0 + (row + 0.5) * spacingZ;
    const height = ground(x, z);
    solid[i] = Number((windSurface(x, z) - height) * metersPerUnit > 0.25);
    const slopeX = (ground(x + spacingX, z) - ground(x - spacingX, z)) / (2 * spacingX);
    const slopeZ = (ground(x, z + spacingZ) - ground(x, z - spacingZ)) / (2 * spacingZ);
    let horizon = 0;
    for (const distance of config.shelterDistances) {
      const upwind = distance / metersPerUnit;
      const rise = (windSurface(x - windX * upwind, z - windZ * upwind) - height) * metersPerUnit;
      horizon = Math.max(horizon, (rise - 0.03) / distance);
    }
    const shadow = clamp01((horizon - lowShadow) / (fullShadow - lowShadow));
    shelter[i] = shadow * shadow * (3 - 2 * shadow);
    const sanctuary = options?.sanctuary;
    const refuge = sanctuary?.influence(x, z) ?? 0;
    const remaining = 1 - refuge;
    liftRetention[i] = remaining ** 3;
    windRetention[i] = 1 - 0.62 * refuge;
    settlingRate[i] = config.settling * (1 + shelter[i] + (sanctuary?.settling ?? 0) * refuge);
    settledFraction[i] = -Math.expm1(-settlingRate[i] * step);
    exposure[i] = (1 - 0.74 * shelter[i]) * (0.89 + 0.26 * clamp01(0.5 + slopeX * windX + slopeZ * windZ));
    const crossSlope = -slopeX * windZ + slopeZ * windX;
    const turn = sanctuary ? sanctuary.turn * 4 * refuge * remaining * sanctuary.crosswind(x, z) : 0;
    const bearing = windAngle - Math.max(-0.23, Math.min(0.23, crossSlope * 0.43)) + turn;
    bearingX[i] = Math.cos(bearing);
    bearingZ[i] = Math.sin(bearing);

    const along = (x * windX + z * windZ) * metersPerUnit;
    const across = (-x * windZ + z * windX) * metersPerUnit;
    gusts.forEach((gust, index) => {
      const phase = gust.waveNumber * (along + across * (index === 0 ? 0.29 : -0.37)) + index * 2.6;
      gust.sine[i] = Math.sin(phase);
      gust.cosine[i] = Math.cos(phase);
    });
    erodibility[i] = solid[i] ? 0 : clamp01(options?.sediment(x, z) ?? 0);
    bed[i] = config.looseBed * erodibility[i];
    if (options?.background && !solid[i]) {
      const available = 0.12 + 0.88 * Math.sqrt(erodibility[i]);
      backgroundFeed[i] = options.background.feed * available * exposure[i] * liftRetention[i];
      inletDensity[i] = options.background.inlet * available * remaining ** 2;
    }
  }

  function gustPhase(time: number, target: Float64Array) {
    for (let j = 0; j < gusts.length; j++) {
      const phase = time * gusts[j].frequency;
      target[2 * j] = Math.cos(phase);
      target[2 * j + 1] = Math.sin(phase);
    }
  }

  function shearAt(i: number, phase: Float64Array) {
    let shear: number = config.baseShear;
    for (let j = 0; j < gusts.length; j++) {
      const gust = gusts[j];
      shear += gust.amplitude * (gust.cosine[i] * phase[2 * j] + gust.sine[i] * phase[2 * j + 1]);
    }
    return Math.max(0, Math.min(config.maxShear, shear * exposure[i]));
  }

  function liftAt(i: number, shear: number) {
    const relative = shear / threshold;
    const lift = config.liftRate * erodibility[i] * liftRetention[i] * relative * Math.max(0, relative * relative - 1);
    return Math.min(lift, bed[i] / step);
  }

  // Imported fine dust provides a floor. The travel-delayed upstream estimate
  // carries the changing gust contribution across the moving window edges.
  function backgroundAt(row: number, col: number) {
    const local = Math.min(nz - 1, Math.max(0, row)) * nx + col;
    if (solid[local]) return 0;
    if (!window || row < 0 || row >= nz) return inletDensity[local];
    const r = Math.min(nz - 1, Math.max(0, row + upstreamRow));
    const c = Math.min(nx - 1, Math.max(0, col + upstreamCol));
    const i = r * nx + c;
    const residence = -Math.expm1(-config.settling * window.backgroundAge) / config.settling;
    return inletDensity[local] + liftAt(i, shearAt(i, backgroundPhases)) * residence * liftRetention[local];
  }

  function seed(i: number, estimate: number) {
    const initial = Math.min(bed[i], estimate);
    current[i] = initial;
    bed[i] -= initial;
    balance.lifted += initial * cellArea;
  }

  const mass = (values: Float64Array) => values.reduce((sum, density) => sum + density, 0) * cellArea;
  const initialBed = mass(bed);
  if (!window && options?.background) {
    for (let i = 0; i < count; i++) {
      const typicalShear = Math.min(config.maxShear, config.baseShear * exposure[i]);
      seed(i, inletDensity[i] + (liftAt(i, typicalShear) + backgroundFeed[i]) / settlingRate[i]);
    }
  }

  function follow(cameraZ: number) {
    if (!window) return false;
    const desired = Math.floor((cameraZ - window.lead - z0) / (spacingZ * window.stride)) * window.stride;
    const start = Math.min(nz - window.rows, Math.max(0, desired));
    if (start === first) return false;
    const end = start + window.rows;
    for (let row = first; row < last; row++) if (row < start || row >= end) dormantSince[row] = steps;
    gustPhase(steps * step - window.backgroundAge, backgroundPhases);
    for (let row = start; row < end; row++) {
      if (row >= first && row < last) continue;
      const since = dormantSince[row];
      for (let col = 0; col < nx; col++) {
        const i = row * nx + col;
        if (solid[i]) continue;
        if (since < 0) {
          seed(i, backgroundAt(row, col));
        } else {
          const settled = current[i] * -Math.expm1(-settlingRate[i] * (steps - since) * step);
          current[i] -= settled;
          bed[i] += settled;
          balance.deposited += settled * cellArea;
        }
      }
    }
    first = start;
    last = end;
    return true;
  }

  function transfer(a: number, b: number, speed: number, spacing: number) {
    const carried = speed * (speed >= 0 ? current[a] : current[b]);
    const mixed = diffusion * (current[a] - current[b]) / spacing;
    const amount = (carried + mixed) * step / spacing;
    next[a] -= amount;
    next[b] += amount;
  }

  function advance() {
    if (first < 0) return;
    gustPhase(steps * step, phases);
    if (window) gustPhase(steps * step - window.backgroundAge, backgroundPhases);
    const begin = first * nx, end = last * nx;
    for (let i = begin; i < end; i++) {
      if (solid[i]) continue;
      const shear = shearAt(i, phases);
      const velocity = shear * config.transportPerShear * windRetention[i];
      velocityX[i] = velocity * bearingX[i];
      velocityZ[i] = velocity * bearingZ[i];
      groundLift[i] = liftAt(i, shear);
      sourceRate[i] = groundLift[i] + backgroundFeed[i];
    }
    next.set(current.subarray(begin, end), begin);
    let lifted = 0;
    let deposited = 0;
    let escaped = 0;
    let entered = 0;
    let fed = 0;
    for (let row = first; row < last; row++) for (let col = 0; col < nx; col++) {
      const i = row * nx + col;
      if (solid[i]) continue;
      if (col + 1 < nx && !solid[i + 1]) transfer(i, i + 1, (velocityX[i] + velocityX[i + 1]) / 2, dx);
      if (row + 1 < last && !solid[i + nx]) transfer(i, i + nx, (velocityZ[i] + velocityZ[i + nx]) / 2, dz);
      const outX = (col === 0 ? Math.max(0, -velocityX[i]) : 0) + (col === nx - 1 ? Math.max(0, velocityX[i]) : 0);
      const w = velocityZ[i];
      let outwardZ = 0;
      let incoming = 0;
      if (col === 0) incoming += Math.max(0, velocityX[i]) * inletDensity[i] * step / dx;
      if (col === nx - 1) incoming += Math.max(0, -velocityX[i]) * inletDensity[i] * step / dx;
      if (row === first && (row === 0 || !solid[i - nx])) {
        outwardZ += Math.max(0, -w);
        if (w > 0) incoming += w * backgroundAt(row - 1, col) * step / dz;
      }
      if (row === last - 1 && (row === nz - 1 || !solid[i + nx])) {
        outwardZ += Math.max(0, w);
        if (w < 0) incoming -= w * backgroundAt(row + 1, col) * step / dz;
      }
      const loss = current[i] * step * (outX / dx + outwardZ / dz);
      next[i] += incoming - loss;
      escaped += loss;
      entered += incoming;
    }
    for (let i = begin; i < end; i++) {
      const lift = groundLift[i] * step;
      const feed = backgroundFeed[i] * step;
      const settle = next[i] * settledFraction[i];
      bed[i] += settle - lift;
      next[i] += lift + feed - settle;
      lifted += lift;
      deposited += settle;
      fed += feed;
    }
    balance.lifted += lifted * cellArea;
    balance.deposited += deposited * cellArea;
    balance.escaped += escaped * cellArea;
    balance.entered += entered * cellArea;
    balance.fed += fed * cellArea;
    current.set(next.subarray(begin, end), begin);
    steps++;
  }

  return {
    advance, follow, concentration: current, get time() { return steps * step; }, get firstRow() { return first; },
    get windowStart() { return z0 + first * spacingZ; }, windowDepth: (window?.rows ?? nz) * spacingZ,
    bed, balance, sourceRate, velocityX, velocityZ, shelter, solid, threshold, cellArea, cfl,
    measureBudget() {
      const airborne = mass(current), onGround = mass(bed);
      const { lifted, deposited, escaped, entered, fed } = balance;
      return { airborne, lifted, deposited, escaped, entered, fed,
        residual: airborne - lifted + deposited + escaped - entered - fed,
        totalResidual: airborne + onGround + escaped - entered - fed - initialBed };
    },
  };
}
