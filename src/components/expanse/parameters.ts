export type Vec3 = readonly [number, number, number];
export type JourneySignal = { value: number; raw: number; invalidate: () => void };

// Continuous dune banks; authored offsets are measured from the valley spine.
export const EXPANSE = {
  seed: 7137,
  terrain: {
    width: 7200, depth: 10800, centerZ: -2000, baseHeight: -4,
    resolution: { desktop: [280, 420], mobile: [144, 224] },
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
  // Monolith Field then Hero Destination. Angles are degrees, applied YXZ.
  structures: [
    // The surviving pair leans away from the valley, opening toward the sky.
    { id: 'field-axis', family: 'Mid Monoliths', kind: 'box', center: [-650, -2990],
      scale: [200, 920, 250], orientation: [3, 14, 22], burial: 335 },
    { id: 'field-lean', family: 'Mid Monoliths', kind: 'box', center: [650, -3490],
      scale: [310, 760, 260], orientation: [-6, -18, -24], burial: 220 },
    { id: 'hero-axis', family: 'Hero Structure', kind: 'box', center: [70, -5400],
      scale: [430, 1550, 410], orientation: [-3, 28, -5], burial: 430 },
  ],
  atmosphere: {
    sky: '#dedfd9', fogNear: 850, fogFar: 8000,
    terrainColor: '#d0cabc', monumentColor: '#92958d',
    sunPosition: [-2600, 2800, 900], sunTarget: [0, 0, -2100],
    sunColor: '#fff0d7', sunIntensity: 3.4,
    hemisphereSky: '#dce3e4', hemisphereGround: '#8f887b', hemisphereIntensity: 1.2,
    exposure: 0.98,
  },
  journey: {
    screens: 4, scrubSeconds: 0.18, cameraRadius: 12, reducedProgress: 0,
    framingAspect: 2,
    // Position X is lateral to spine, Y is eye height; target Y is above valley floor.
    keys: [
      { at: 0, position: [20, 70, 1000], target: [0, 140, -1800], roll: 0, fov: 52 },
      { at: 0.12, position: [5, 70, 650], target: [10, 150, -2200], roll: -0.003, fov: 52 },
      { at: 0.38, position: [-10, 65, -650], target: [30, 185, -3000], roll: -0.008, fov: 53 },
      { at: 0.68, position: [15, 58, -2650], target: [0, 260, -4800], roll: 0.012, fov: 54 },
      { at: 0.88, position: [0, 58, -3680], target: [40, 360, -5400], roll: -0.005, fov: 55 },
      { at: 1, position: [0, 55, -4050], target: [40, 430, -5400], roll: 0, fov: 55 },
    ],
  },
} as const;

export type WorldParameters = typeof EXPANSE;
