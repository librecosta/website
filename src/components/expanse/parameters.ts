export type Vec3 = readonly [number, number, number];
export type JourneySignal = { value: number; raw: number; invalidate: () => void };
export const SURFACE_VIEWS = {
  original: 'Original terrain',
  dunes: 'Dune geometry only',
  ripples: 'Dune geometry + ripple normals',
  finalMaterial: 'Final sand material',
} as const;
export type SurfaceView = keyof typeof SURFACE_VIEWS;

// Continuous dune banks; authored offsets are measured from the valley spine.
export const EXPANSE = {
  seed: 7137,
  terrain: {
    // Extend the existing heightfield beyond the destination, keeping the
    // near edge and longitudinal grid spacing unchanged.
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
    basinProfile: { bankHeight: 70, bankRun: 700, outerFalloff: 2500, leftScale: 1.05, rightScale: 0.92 },
    crestBlend: 42,
    // Each ribbon extends through the whole valley; height never falls back to
    // zero between longitudinal nodes. The left shoulder merges into its bank.
    crestRibbons: [
      { id: 'left-bank', side: -1, reliefScale: 0.35, innerWidth: 0.96, outerWidth: 1.2, nodes: [
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
      { id: 'right-bank', side: 1, reliefScale: 1, innerWidth: 0.85, outerWidth: 1.52, nodes: [
        { z: 3400, offset: 580, width: 840, height: 130 },
        { z: 1200, offset: 760, width: 1050, height: 144 },
        { z: -300, offset: 660, width: 840, height: 156 },
        { z: -1800, offset: 860, width: 1140, height: 164 },
        { z: -3300, offset: 1080, width: 1300, height: 178 },
        { z: -5200, offset: 1160, width: 1450, height: 164 },
        { z: -7400, offset: 1250, width: 1700, height: 130 },
      ] },
    ],
    // Broad oblique folds sit on the continuous banks. Sweep bends the crest
    // across its long axis. On the right a low shoulder leads into a wider fold.
    crosswindFolds: [
      { center: [-880, 510], radius: [980, 970], height: 125, rotation: -0.35, sweep: 0.25 },
      { center: [-620, -920], radius: [1080, 1250], height: 213, rotation: 0.28, sweep: -0.33 },
      { center: [600, 510], radius: [940, 620], height: 61, rotation: 0.55, sweep: -0.38 },
      { center: [970, -1890], radius: [1460, 790], height: 93, rotation: -0.6, sweep: 0.48 },
      { center: [-1040, -4330], radius: [1350, 1030], height: 53, rotation: 0.42, sweep: -0.26 },
    ],
    pathMask: { halfWidth: 65, blendWidth: 440, massRetention: 0.12 },
    noise: [{ wavelength: 1320, amplitude: 5 }, { wavelength: 500, amplitude: 1.3 }],
  },
  aeolian: {
    // X/Z downwind direction. The authored ridge turns are relative to this.
    wind: [1, -0.5],
    corridor: [0.90, 3.05],
    reliefNoise: { wavelength: 690, strength: 0.09 },
    sand: { color: '#ddd0b8', roughness: 0.94 },
    ripples: {
      // [wavelength, micro-height amplitude, near fade start, far cutoff], in world units.
      broad: [8.6, 0.062, 245, 620],
      fine: [3.75, 0.015, 105, 260],
      warpScale: [77, 124],
      bend: 4.2,
      spacingWarp: 13,
      antialias: [0.09, 0.30], // cycles per pixel
      roughnessVariation: 0.035,
    },
    // Centers are lateral to the valley spine. Length is tip-to-tip, widths
    // run from the brink to each toe, and positive bend sweeps the tips downwind.
    ridges: [
      { center: [-710, 850], turn: 20, length: 1350, stoss: 450, lee: 230, height: 104, bend: 110, brink: 39 },
      { center: [630, 280], turn: 49, length: 1640, stoss: 460, lee: 210, height: 92, bend: 138, brink: 40 },
      { center: [-640, -1880], turn: 36, length: 2050, stoss: 520, lee: 210, height: 90, bend: 115, brink: 41 },
      { center: [990, -2400], turn: 49, length: 2330, stoss: 690, lee: 265, height: 114, bend: 175, brink: 43 },
      { center: [-1220, -4810], turn: -23, length: 2580, stoss: 940, lee: 330, height: 115, bend: 360, brink: 49 },
      { center: [1020, -4440], turn: 54, length: 2170, stoss: 730, lee: 290, height: 112, bend: 210, brink: 48 },
    ],
  },
  // P1-B2 research baseline. The live aeolian terrain does not consume it.
  surface: {
    analysisStep: 25, neighborhoodWidth: 0.15, minimumNeighborhoodCells: 1.5,
    flatSlope: [8, 25], slopeDisplayMax: 45,
    curvature: [0.000045, 0.001], corridor: [0.42, 1.6],
    cover: { bias: 0.14, flat: 0.38, concavity: 0.27, valley: 0.18, exposure: 0.32, noise: 0.07 },
    sandNoise: [{ wavelength: 410, weight: 2 / 3 }, { wavelength: 205, weight: 1 / 3 }],
    thicknessFraction: 0.025,
    material: {
      hardpan: { color: '#cbd0cc', roughness: 0.84 },
      sand: { color: '#d9cbb2', roughness: 0.98 },
    },
    drift: {
      targets: ['basin-left-edge', 'field-axis'], wind: [1, -0.5],
      reliefLimit: 0.032, widthLimit: 0.025, leeRamp: 0.18, leeDecay: 1.05,
      leeExtent: [2.4, 3.2], crossFade: [0.08, 0.5],
      steepSlope: [18, 33], protectedValley: [0.72, 0.98],
    },
  },
  // Exposure limits the upper surface above the sampled sand.
  remnants: [
    { id: 'basin-left-edge', family: 'Basin Remnant', kind: 'box', center: [-455, 285],
      scale: [180, 145, 415], orientation: [6, 31, -10], burial: 0, exposure: 35 },
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
  // Broad markers punctuate the slender stelae. Gaps separate runs that
  // recede across the horizon, with the right bank screening more of them.
  distantStelae: [
    { id: 'stele-west-1', family: 'Distant Stelae', kind: 'slotted', center: [-10100, -19900],
      scale: [430, 1950, 250], orientation: [0, 18, 0], burial: 400 },
    { id: 'stele-west-2', family: 'Distant Stelae', kind: 'slotted', center: [-8450, -18800],
      scale: [185, 1250, 140], orientation: [0, 18, 0], burial: 360 },
    { id: 'stele-west-3', family: 'Distant Stelae', kind: 'slotted', center: [-8450, -20000],
      scale: [270, 1540, 180], orientation: [0, 18, 0], burial: 400 },
    { id: 'stele-west-4', family: 'Distant Stelae', kind: 'slotted', center: [-8850, -26300],
      scale: [360, 1570, 230], orientation: [0, 18, 0], burial: 400 },
    { id: 'stele-west-5', family: 'Distant Stelae', kind: 'slotted', center: [-8600, -29000],
      scale: [660, 2150, 320], orientation: [0, 18, 0], burial: 400 },
    { id: 'stele-west-6', family: 'Distant Stelae', kind: 'slotted', center: [-8070, -30900],
      scale: [200, 1460, 140], orientation: [0, 18, 0], burial: 450 },
    { id: 'stele-west-7', family: 'Distant Stelae', kind: 'slotted', center: [-7800, -35800],
      scale: [400, 1770, 205], orientation: [0, 18, 0], burial: 400 },
    { id: 'stele-west-8', family: 'Distant Stelae', kind: 'slotted', center: [-6500, -38000],
      scale: [245, 1560, 155], orientation: [0, 18, 0], burial: 420 },
    { id: 'stele-east-1', family: 'Distant Stelae', kind: 'slotted', center: [7510, -21500],
      scale: [340, 1910, 230], orientation: [0, 18, 0], burial: 430 },
    { id: 'stele-east-2', family: 'Distant Stelae', kind: 'slotted', center: [9000, -23900],
      scale: [195, 1930, 130], orientation: [0, 18, 0], burial: 450 },
    { id: 'stele-east-3', family: 'Distant Stelae', kind: 'slotted', center: [13900, -30600],
      scale: [420, 2580, 220], orientation: [0, 18, 0], burial: 440 },
    { id: 'stele-east-4', family: 'Distant Stelae', kind: 'slotted', center: [17000, -35500],
      scale: [615, 2840, 330], orientation: [0, 18, 0], burial: 460 },
  ],
  hero: { id: 'still-monolith', family: 'Hero Structure', kind: 'slotted', center: [70, -6000],
    scale: [920, 2400, 560], orientation: [0, 24, 0], burial: 520,
    topScale: [0.76, 0.84],
    // Normalized cross section: one deep, narrow opening on the +Z face.
    groove: { center: -0.08, width: 0.085, depth: 0.27, bottom: -0.42, top: 0.39 } },
  atmosphere: {
    sky: { horizon: '#e8e4d9', upper: '#cbd8e0', gradientTop: 0.66 },
    fogNear: 1750, fogFar: 12900, cameraFar: 46000,
    distantSilhouette: '#bac0bd', distantFadeDepth: [15700, 40800],
    monumentColor: '#999b95',
    sunTarget: [0, 0, -2800],
    defaultLook: 'sideLight',
    // The fixed maps cover the casters and their downhill ground projections.
    looks: {
      soft: {
        sunPosition: [-4350, 4750, 2600], sunColor: '#fff4e4', sunIntensity: 2.85,
        hemisphereSky: '#e2edf5', hemisphereGround: '#b9ad99', hemisphereIntensity: 1.8,
        shadowStrength: 0.85, shadowBounds: [-2560, 2450, 3450, -1800, 5600, 13900],
      },
      sideLight: {
        sunPosition: [-6250, 2830, 1570], sunColor: '#fff0d6', sunIntensity: 3.9,
        hemisphereSky: '#e3edf5', hemisphereGround: '#b2a694', hemisphereIntensity: 1.48,
        shadowStrength: 0.95, shadowBounds: [-3120, 2820, 2810, -980, 5600, 16000],
      },
    },
    shadowResolution: { desktop: 2560, mobile: 1280 },
    shadowRadius: { desktop: 1.75, mobile: 1.25 },
    shadowBias: -0.00014, shadowNormalBias: 1.35,
    exposure: 1.03,
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
export type LightingLook = keyof WorldParameters['atmosphere']['looks'];
export const LIGHTING_LOOKS: Record<LightingLook, string> = { soft: '明亮柔光', sideLight: '雕塑感侧光' };
