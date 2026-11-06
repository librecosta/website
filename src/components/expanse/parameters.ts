export type Vec3 = readonly [number, number, number];
export type JourneySignal = { value: number; raw: number; invalidate: () => void };

// P1-A3 study values. Layout offsets are measured from the valley spine at Z.
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
    basinProfile: { bankHeight: 105, bankRun: 560, outerFalloff: 2300, leftScale: 1.05, rightScale: 0.92 },
    duneLayers: [
      { layer: 'near', center: [-450, 2060], radius: [570, 540], height: 135, rotation: -0.35, leeScale: 0.65 },
      { layer: 'near', center: [510, 1600], radius: [660, 450], height: 110, rotation: 0.3, leeScale: 0.72 },
      { layer: 'near', center: [-390, 880], radius: [650, 420], height: 130, rotation: -0.5, leeScale: 0.68 },
      { layer: 'middle', center: [510, 180], radius: [770, 540], height: 145, rotation: 0.35, leeScale: 0.65 },
      { layer: 'middle', center: [-570, -700], radius: [800, 510], height: 165, rotation: -0.3, leeScale: 0.75 },
      { layer: 'middle', center: [620, -1500], radius: [860, 630], height: 180, rotation: 0.4, leeScale: 0.7 },
      { layer: 'middle', center: [-630, -2390], radius: [860, 610], height: 185, rotation: -0.4, leeScale: 0.72 },
      { layer: 'far', center: [710, -3250], radius: [1000, 700], height: 175, rotation: 0.35, leeScale: 0.8 },
      { layer: 'far', center: [-790, -4210], radius: [1200, 740], height: 195, rotation: -0.3, leeScale: 0.7 },
      { layer: 'far', center: [900, -5050], radius: [1300, 950], height: 185, rotation: 0.25, leeScale: 0.8 },
    ],
    pathMask: { halfWidth: 65, blendWidth: 240, massRetention: 0.12 },
    burialMasks: [
      { center: [-430, -1700], radius: [400, 570], height: 45, rotation: -0.2, leeScale: 1 },
      { center: [-650, -2930], radius: [570, 730], height: 65, rotation: -0.25, leeScale: 1 },
      { center: [-650, -5150], radius: [770, 680], height: 85, rotation: -0.35, leeScale: 1 },
    ],
    noise: [
      { wavelength: 1100, amplitude: 6 },
      { wavelength: 350, amplitude: 2 },
      { wavelength: 120, amplitude: 0.3 },
    ],
  },
  // Foreground Basin + Mid Fragments. Explicit slots, no random scatter.
  debrisDistribution: [
    { id: 'basin-edge', family: 'Foreground Debris', kind: 'wedge', center: [-270, 1550],
      scale: [145, 85, 120], orientation: [8, -22, -16], burial: 48 },
    { id: 'buried-corner', family: 'Foreground Debris', kind: 'box', center: [290, 1110],
      scale: [210, 78, 140], orientation: [-6, 24, 12], burial: 50 },
    { id: 'low-cut', family: 'Foreground Debris', kind: 'wedge', center: [-235, 650],
      scale: [120, 100, 155], orientation: [8, -12, -24], burial: 55 },
    { id: 'exposed-slice', family: 'Foreground Debris', kind: 'box', center: [290, 90],
      scale: [230, 78, 100], orientation: [-8, 18, 9], burial: 48 },
    { id: 'last-fragment', family: 'Foreground Debris', kind: 'wedge', center: [-310, -670],
      scale: [250, 110, 175], orientation: [9, -28, -17], burial: 58 },
  ],
  // Monolith Field then Hero Destination. Angles are degrees, applied YXZ.
  structures: [
    { id: 'field-west', family: 'Mid Monoliths', kind: 'box', center: [-430, -1700],
      scale: [220, 710, 210], orientation: [-7, 8, -19], burial: 285 },
    { id: 'field-east', family: 'Mid Monoliths', kind: 'box', center: [460, -2380],
      scale: [300, 660, 180], orientation: [12, -16, 22], burial: 245 },
    { id: 'field-axis', family: 'Mid Monoliths', kind: 'box', center: [-650, -2990],
      scale: [200, 920, 250], orientation: [3, 14, -8], burial: 335 },
    { id: 'field-lean', family: 'Mid Monoliths', kind: 'box', center: [650, -3490],
      scale: [310, 760, 260], orientation: [-6, -18, 14], burial: 355 },
    { id: 'field-stratum', family: 'Mid Monoliths', kind: 'wedge', center: [-460, -3900],
      scale: [480, 330, 280], orientation: [8, -20, -15], burial: 155 },
    { id: 'hero-axis', family: 'Hero Structure', kind: 'box', center: [70, -5400],
      scale: [430, 1550, 410], orientation: [-3, 28, -5], burial: 430 },
    { id: 'hero-shoulder', family: 'Hero Structure', kind: 'box', center: [-820, -5190],
      scale: [650, 670, 350], orientation: [-8, -12, 31], burial: 265 },
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
    screens: 9, scrubSeconds: 0.32, cameraRadius: 12, reducedProgress: 0,
    mobileFovExtra: 18,
    // Position X is lateral to spine, Y is eye height; target Y is above valley floor.
    keys: [
      { at: 0, position: [0, 55, 2250], target: [0, 100, -1400], roll: 0, fov: 52 },
      { at: 0.2, position: [0, 55, 2250], target: [0, 100, -1400], roll: 0, fov: 52 },
      { at: 0.45, position: [20, 55, 1000], target: [0, 140, -1800], roll: 0, fov: 52 },
      { at: 0.55, position: [-15, 55, -150], target: [30, 170, -2850], roll: -0.008, fov: 53 },
      { at: 0.75, position: [15, 58, -2650], target: [0, 260, -4800], roll: 0.012, fov: 54 },
      { at: 0.9, position: [0, 58, -3680], target: [40, 360, -5400], roll: -0.005, fov: 55 },
      { at: 1, position: [0, 55, -4050], target: [40, 430, -5400], roll: 0, fov: 55 },
    ],
  },
} as const;

export type WorldParameters = typeof EXPANSE;
