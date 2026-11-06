export type Vec3 = readonly [number, number, number];
export type JourneySignal = { value: number; raw: number; invalidate: () => void };

// Continuous dune banks; authored offsets are measured from the valley spine.
export const EXPANSE = {
  seed: 7137,
  terrain: {
    // Extend the existing heightfield beyond the destination for the distant
    // grove, keeping the near edge and longitudinal grid spacing unchanged.
    width: 7200, depth: 16200, centerZ: -4700, baseHeight: -4,
    resolution: { desktop: [280, 630], mobile: [144, 336] },
    valleySpine: [
      { z: 3400, x: 210, floor: 4, width: 130 },
      { z: 2250, x: 120, floor: -6, width: 125 },
      { z: 1200, x: -95, floor: 0, width: 130 },
      { z: 300, x: 115, floor: 4, width: 135 },
      { z: -700, x: 65, floor: -4, width: 150 },
      { z: -1700, x: -90, floor: 10, width: 170 },
      { z: -2800, x: 100, floor: 15, width: 190 },
      { z: -4100, x: -40, floor: 30, width: 210 },
      { z: -5500, x: 50, floor: 45, width: 250 },
      { z: -7400, x: 0, floor: 50, width: 370 },
    ],
    basinProfile: { bankHeight: 70, bankRun: 650, outerFalloff: 2500, leftScale: 1.05, rightScale: 0.92 },
    crestBlend: 32,
    // Each ribbon extends through the whole valley; height never falls back to
    // zero between longitudinal nodes. The left shoulder merges into its bank.
    crestRibbons: [
      { id: 'left-bank', side: -1, reliefScale: 0.35, innerWidth: 0.86, outerWidth: 1.2, nodes: [
        { z: 3400, offset: -1050, width: 850, height: 75 },
        { z: 1400, offset: -1100, width: 900, height: 100 },
        { z: 400, offset: -900, width: 850, height: 125 },
        { z: -450, offset: -500, width: 680, height: 210 },
        { z: -1200, offset: -800, width: 850, height: 180 },
        { z: -2350, offset: -650, width: 900, height: 210 },
        { z: -3700, offset: -850, width: 1050, height: 195 },
        { z: -5400, offset: -960, width: 1150, height: 155 },
        { z: -7400, offset: -1050, width: 1300, height: 125 },
      ] },
      { id: 'left-shoulder', side: -1, reliefScale: 0.35, innerWidth: 1, outerWidth: 1.25, nodes: [
        { z: 3400, offset: -1800, width: 1250, height: 90 },
        { z: 1400, offset: -1550, width: 1150, height: 125 },
        { z: 400, offset: -1600, width: 1150, height: 160 },
        { z: -450, offset: -1050, width: 1150, height: 210 },
        { z: -1200, offset: -1400, width: 1250, height: 195 },
        { z: -2350, offset: -1450, width: 1500, height: 210 },
        { z: -3700, offset: -1500, width: 1550, height: 195 },
        { z: -5400, offset: -1700, width: 1650, height: 175 },
        { z: -7400, offset: -1800, width: 1700, height: 150 },
      ] },
      { id: 'right-bank', side: 1, reliefScale: 1, innerWidth: 0.9, outerWidth: 1.3, nodes: [
        { z: 3400, offset: 580, width: 840, height: 130 },
        { z: 1200, offset: 720, width: 1000, height: 155 },
        { z: -300, offset: 600, width: 780, height: 180 },
        { z: -1800, offset: 750, width: 1050, height: 170 },
        { z: -3300, offset: 960, width: 1250, height: 195 },
        { z: -5200, offset: 1150, width: 1450, height: 165 },
        { z: -7400, offset: 1250, width: 1700, height: 130 },
      ] },
    ],
    // Two broad crosswind folds share the continuous left bank underneath.
    // Their footprints overlap heavily; they are not a repeated dune scatter.
    crosswindFolds: [
      { center: [-850, 450], radius: [900, 850], height: 125, rotation: -0.35 },
      { center: [-580, -850], radius: [1000, 1150], height: 230, rotation: 0.28 },
    ],
    pathMask: { halfWidth: 65, blendWidth: 440, massRetention: 0.12 },
    noise: [
      { wavelength: 1100, amplitude: 6 },
      { wavelength: 350, amplitude: 2 },
      { wavelength: 120, amplitude: 0.3 },
    ],
  },
  // Two authored remnants groups. Exposure is an upper-surface height above
  // terrain, not a burial percentage or a visible clipping plane.
  remnants: [
    { id: 'basin-left-edge', family: 'Basin Remnant', kind: 'box', center: [-430, 500],
      scale: [300, 650, 160], orientation: [4, -35, -32], burial: 0, exposure: 20 },
    { id: 'basin-right-cut', family: 'Basin Remnant', kind: 'box', center: [410, -100],
      scale: [200, 500, 125], orientation: [-5, 20, 30], burial: 0, exposure: 14 },
  ],
  // A shared 12-degree datum and 750-unit bays describe the original order.
  // These explicit disturbances never come from a random scatter.
  alignment: [
    { id: 'field-axis', scale: [200, 920, 250],
      ideal: { center: [-500, -2850], yaw: 12, burial: 290 },
      disturbed: { offset: [-150, -140], orientation: [3, 2, 22], settlement: 45 } },
    { id: 'field-lean', scale: [310, 760, 260],
      ideal: { center: [500, -3600], yaw: 12, burial: 190 },
      disturbed: { offset: [150, 110], orientation: [-6, -30, -24], settlement: 30 } },
  ],
  // A distant authored grove, using the destination's same tapered solid.
  // Its staggered depths only emerge after approaching the mid-field.
  distantStelae: [
    { id: 'stele-west', family: 'Distant Stelae', kind: 'slotted', center: [-2900, -8800],
      scale: [410, 1500, 250], orientation: [0, 18, 0], burial: 500 },
    { id: 'stele-west-tall', family: 'Distant Stelae', kind: 'slotted', center: [-2300, -10000],
      scale: [570, 2100, 350], orientation: [0, 24, 0], burial: 600 },
    { id: 'stele-saddle', family: 'Distant Stelae', kind: 'slotted', center: [-1650, -9200],
      scale: [370, 1360, 230], orientation: [0, 22, 0], burial: 500 },
    { id: 'stele-return', family: 'Distant Stelae', kind: 'slotted', center: [-900, -11000],
      scale: [480, 1770, 300], orientation: [0, 16, 0], burial: 540 },
    { id: 'stele-far-edge', family: 'Distant Stelae', kind: 'slotted', center: [-350, -9700],
      scale: [310, 1140, 190], orientation: [0, 26, 0], burial: 430 },
  ],
  hero: { id: 'still-monolith', family: 'Hero Structure', kind: 'slotted', center: [70, -6000],
    scale: [920, 2400, 560], orientation: [0, 24, 0], burial: 520,
    topScale: [0.76, 0.84],
    // Normalized cross section: one deep, narrow opening on the +Z face.
    groove: { center: -0.08, width: 0.085, depth: 0.27, bottom: -0.42, top: 0.39 } },
  atmosphere: {
    sky: '#dedfd9', fogNear: 850, fogFar: 10000,
    terrainColor: '#d0cabc', monumentColor: '#92958d',
    sunPosition: [-2600, 2800, 900], sunTarget: [0, 0, -2100],
    // Cover the tall hero as well as the near basin, without a moving shadow rig.
    shadowBounds: [-4700, 4400, 3750, -2650, 50, 10000],
    sunColor: '#fff0d7', sunIntensity: 3.4,
    hemisphereSky: '#dce3e4', hemisphereGround: '#8f887b', hemisphereIntensity: 1.2,
    exposure: 0.98,
  },
  journey: {
    screens: 4, scrubSeconds: 0.18, cameraRadius: 12, reducedProgress: 0,
    framingAspect: 2,
    // Position X is lateral to spine, Y is eye height; target Y is above valley floor.
    keys: [
      { at: 0, position: [20, 70, 1000], target: [0, 170, -2500], roll: 0, fov: 52 },
      { at: 0.2, position: [5, 70, 250], target: [10, 210, -3400], roll: -0.003, fov: 52 },
      { at: 0.38, position: [-10, 68, -1100], target: [40, 270, -4900], roll: -0.006, fov: 53 },
      { at: 0.53, position: [-30, 66, -2400], target: [60, 580, -6000], roll: 0.004, fov: 53 },
      { at: 0.63, position: [-60, 68, -3000], target: [70, 700, -6000], roll: 0.006, fov: 53 },
      { at: 0.73, position: [-100, 70, -3300], target: [70, 770, -6000], roll: -0.004, fov: 52 },
      { at: 0.85, position: [-110, 68, -3600], target: [70, 850, -6000], roll: -0.003, fov: 52 },
      { at: 1, position: [-100, 60, -3800], target: [70, 900, -6000], roll: 0, fov: 52 },
    ],
  },
} as const;

export type WorldParameters = typeof EXPANSE;
