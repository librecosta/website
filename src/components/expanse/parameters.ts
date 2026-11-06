export type Vec3 = readonly [number, number, number];
export type JourneySignal = { value: number; raw: number; invalidate: () => void };

// Art-study parameters, not frozen architectural motifs or final camera keys.
export const EXPANSE = {
  seed: 7137,
  terrain: {
    width: 7200, depth: 9000, centerZ: -1700, baseHeight: -4,
    resolution: { desktop: [280, 360], mobile: [144, 200] },
    masses: [
      { center: [-1150, 600], radius: [1100, 1700], height: 155, rotation: -0.35 },
      { center: [1200, 300], radius: [1000, 1500], height: 205, rotation: 0.3 },
      { center: [-330, 1630], radius: [950, 460], height: 24, rotation: -0.2 },
      { center: [-500, -1050], radius: [560, 850], height: 140, rotation: -0.3 },
      { center: [670, -780], radius: [580, 620], height: 110, rotation: 0.4 },
      { center: [-850, -1880], radius: [850, 650], height: 120, rotation: -0.4 },
      { center: [620, -2160], radius: [620, 780], height: 95, rotation: 0.25 },
      { center: [-600, -3350], radius: [750, 950], height: 210, rotation: -0.2 },
      { center: [650, -3450], radius: [780, 850], height: 175, rotation: 0.35 },
      { center: [0, -5000], radius: [2100, 900], height: 165, rotation: 0 },
    ],
    noise: [
      { wavelength: 1050, amplitude: 9 },
      { wavelength: 330, amplitude: 3 },
      { wavelength: 110, amplitude: 0.4 },
    ],
    corridor: { halfWidth: 105, blendWidth: 370, bend: 65, bendLength: 1100, massRetention: 0.12 },
  },
  // All hero positions are authored. Pitch/yaw/roll are degrees, applied YXZ.
  structures: [
    { id: 'sentinel', family: 'Monolith', kind: 'box', center: [-660, -1040],
      scale: [480, 840, 185], orientation: [-8, -18, -24], burial: 210 },
    { id: 'submerged-keel', family: 'Buried Structure', kind: 'box', center: [620, -800],
      scale: [720, 240, 190], orientation: [8, 24, 8], burial: 125 },
    { id: 'long-remnant', family: 'Buried Structure', kind: 'box', center: [-850, -1950],
      scale: [1100, 180, 220], orientation: [2, -24, -9], burial: 95 },
    { id: 'exposed-cut', family: 'Buried Structure', kind: 'wedge', center: [510, -2110],
      scale: [260, 470, 290], orientation: [-8, 18, 14], burial: 215 },
    { id: 'threshold-west', family: 'Threshold', kind: 'box', center: [-360, -3400],
      scale: [330, 1100, 280], orientation: [8, 8, -12], burial: 310 },
    { id: 'threshold-east', family: 'Threshold', kind: 'box', center: [350, -3500],
      scale: [240, 990, 430], orientation: [-7, -8, 11], burial: 255 },
    { id: 'far-blade', family: 'Monolith', kind: 'box', center: [-1450, -4000],
      scale: [150, 670, 170], orientation: [4, 12, -22], burial: 295 },
    { id: 'far-stratum', family: 'Buried Structure', kind: 'box', center: [1260, -4600],
      scale: [610, 210, 250], orientation: [-6, -16, 8], burial: 105 },
  ],
  atmosphere: {
    sky: '#dedfd9', fogNear: 650, fogFar: 6200,
    terrainColor: '#d0cabc', monumentColor: '#92958d',
    sunPosition: [-2400, 2600, 700], sunTarget: [0, 0, -1800],
    sunColor: '#fff0d7', sunIntensity: 3.4,
    hemisphereSky: '#dce3e4', hemisphereGround: '#8f887b', hemisphereIntensity: 1.35,
    exposure: 0.98,
  },
  journey: {
    screens: 9, scrubSeconds: 0.32, cameraRadius: 12, reducedProgress: 0,
    mobileFovExtra: 18,
    // Position Y is eye height above analytic terrain; target Y is absolute.
    keys: [
      { at: 0, position: [190, 28, 2000], target: [-100, 125, -2400], roll: 0, fov: 47 },
      { at: 0.2, position: [160, 30, 1700], target: [-140, 135, -2350], roll: 0, fov: 47 },
      { at: 0.45, position: [50, 45, -500], target: [-120, 160, -2300], roll: -0.012, fov: 50 },
      { at: 0.55, position: [-40, 62, -1200], target: [80, 180, -2700], roll: -0.022, fov: 52 },
      { at: 0.8, position: [90, 55, -2210], target: [0, 245, -3500], roll: 0.012, fov: 53 },
      { at: 0.93, position: [50, 49, -2500], target: [0, 295, -3500], roll: 0.003, fov: 53 },
      { at: 1, position: [30, 48, -2540], target: [0, 300, -3500], roll: 0, fov: 53 },
    ],
  },
} as const;

export type WorldParameters = typeof EXPANSE;
