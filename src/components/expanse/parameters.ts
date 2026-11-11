export type Vec3 = readonly [number, number, number];
export type JourneySignal = { value: number; raw: number; invalidate: () => void };
export const WIND_VIEWS = {
  transport: '沙暴与刮沙', concentration: '浓度场', static: '关闭风沙',
} as const;
export type WindView = keyof typeof WIND_VIEWS;
export const SKY_VIEWS = {
  color: '最终合成', background: '底场', main: '主云带', secondary: '次云带',
} as const;
export type SkyView = keyof typeof SKY_VIEWS;

const passage = { scroll: 0.35, path: 0.356, slope: 0.646729 } as const;
const chapterSpan = 1 - passage.scroll;
// Crop the old opening's grid rows while retaining the far edge and cell spacing.
const terrainDepth = 16200 * 16 / 21;
const distantSteleGroove = { center: -0.08, width: 0.085, depth: 0.27, bottom: -0.42, top: 0.39 } as const;

// Continuous dune banks; authored offsets are measured from the valley spine.
export const EXPANSE = {
  seed: 7137,
  terrain: {
    width: 7200, depth: terrainDepth, centerZ: -12800 + terrainDepth / 2, baseHeight: -4,
    resolution: { desktop: [280, 480], mobile: [144, 256] },
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
      broad: [8.6, 0.056, 300, 820],
      fine: [3.75, 0.024, 125, 340],
      bedScale: [28, 64],
      bedFade: [480, 1540],
      bedRelief: 0.88,
      bedTint: 0.043,
      warpScale: [77, 124],
      bend: 4.2,
      spacingWarp: 13,
      antialias: [0.11, 0.32], // cycles per pixel
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
  windMotion: {
    fps: { desktop: 60, mobile: 30 },
    bounds: [-625, 625, -5600, -500], // Keep 10.625 world units per row, with room behind Passage.
    resolution: [112, 480],
    window: { rows: 172, stride: 4, lead: 1510, backgroundTravel: 3.2, backgroundAge: 1.1 },
    metersPerUnit: 0.08,
    step: 1 / 32,
    threshold: { grainDiameter: 0.00023, grainDensity: 2650, airDensity: 1.2, gravity: 9.81, bagnoldFactor: 0.10 },
    baseShear: 0.275,
    maxShear: 0.50,
    transportPerShear: 11,
    // Amplitude (m/s of friction velocity), wavelength and propagation speed in SI units.
    gusts: [[0.132, 27, 4.0], [0.070, 14, 3.1]],
    shelterDistances: [1.6, 3.5, 6.7, 11.0],
    shelterAngles: [4, 23],
    diffusion: 0.15, // m²/s
    settling: 0.39, // 1/s
    liftRate: 9, // mg/m²/s before the dimensionless excess-shear multiplier
    looseBed: 4000, // mg/m² of fine material available at full erodibility
    sediment: {
      // World Z and relative loose-sand availability, independent of the camera.
      supply: [[1370, 0.28], [450, 0.48], [-800, 0.90], [-2010, 0.98], [-3150, 0.33], [-3740, 0.095], [-5600, 0.04]],
      bedding: [205, 105], corridor: [0.55, 1.62], slope: [0.17, 0.58], bowlRadius: 55,
    },
    dust: {
      tint: '#edcfaa',
      extinction: 0.015, // m²/mg, tuned for this scene
      viewFade: [760, 1240], edgeFade: 85,
      // Height in metres and fraction of column mass at each level.
      layers: [[0.11, 0.43], [0.33, 0.34], [0.70, 0.23]],
    },
  },
  sandstorm: {
    background: { feed: 10.5, inlet: 13 }, // mg/m²/s and mg/m² from unresolved upwind dust
    // World Z from Passage to the lee. Air visibility recovers more than bed transport.
    shelter: { approach: [-930, -3720], veilMinimum: .23, driftMinimum: .74, settling: 1.2 },
    veil: {
      extinction: 0.0115, // per world unit, calibrated against the previous mid-journey look.
      range: [89, 175],
      tint: '#b19478', windSpeed: 218,
      samples: { desktop: 5, mobile: 4 },
      grains: { desktop: 5200, mobile: 1500 },
    },
  },
  futureCity: {
    center: [3600, 0, -128000],
    scale: 15,
    cameraFar: 260000,
    fov: 55,
    fog: [51000, 255000, .30, .94],
    haze: { foothillHeight: 41000, foothillDensity: .51,
      crownCenter: [4000, 101000, -113000], crownRadius: [96500, 21900, 37000], crownDensity: 3.25 },
    lookAtHeights: [49300, 55500],
    retarget: [0.356, 1],
    ring: {
      height: 3760, radius: 4700, guideOffset: 222, tilt: [8, 0, -4],
      revolutionSeconds: 180,
      bob: { amplitude: 110, period: 36 },
      pitch: { degrees: 1.8, period: 52 },
      roll: { degrees: 1.25, period: 66 },
    },
    secondaryRing: {
      height: 4360, radius: 3140, sectionScale: .60,
      revolutionSeconds: 155, direction: -1, phaseDegrees: 14,
    },
    satellites: { count: 3, height: 5050, orbitRadius: 1830, sphereRadius: 125,
      pitchDegrees: 6, phaseDegrees: 18, revolutionSeconds: 60 },
    // Dedicated closed lanes above local traffic and inside the city's orbital track.
    // Width, height, length and waypoints are in skyline-local units.
    airships: [
      { id: 'passenger', size: [380, 210, 970], speed: 43, phase: .04,
        waypoints: [[-3550,4000,560],[-3100,4020,980],[-2580,4060,940],[-2360,4110,550],
          [-2570,4140,120],[-3070,4090,25],[-3510,4040,160]] },
      { id: 'cargo', size: [535, 250, 1120], speed: 35, phase: .06,
        waypoints: [[3570,3440,900],[3070,3420,1200],[2520,3480,1010],[2330,3560,570],
          [2580,3630,-340],[3180,3610,-670],[3570,3530,-260],[3710,3480,330]] },
    ],
    traffic: {
      // Width, height, length in skyline-local units. Small craft share the service and passenger lanes.
      vehicles: {
        courier: [44, 19, 83], cab: [57, 29, 98], shuttle: [77, 35, 152],
        utility: [67, 36, 105], freighter: [99, 47, 185], heavy: [142, 58, 242],
      },
      // Closed flight lanes, in city-local units. Each has one direction and one cruise speed.
      routes: [
        { id: 'freight', speed: 76, phase: .028,
          fleet: ['heavy', 'freighter', 'freighter', 'heavy', 'freighter', 'heavy', 'freighter', 'freighter'],
          waypoints: [[-5550,640,2780],[-5160,620,3200],[-4180,620,3360],[-2400,625,3290],[0,650,3070],
            [2350,625,3220],[4660,620,3280],[5220,625,3270],[5480,635,3100],[5490,647,2820],
            [5240,654,2610],[4660,660,2590],
            [2300,760,2600],[0,790,2520],[-2300,760,2570],[-4480,660,2650],[-5320,640,2510]] },
        { id: 'commuter', speed: 108, phase: .04,
          fleet: ['cab', 'shuttle', 'cab', 'courier', 'cab', 'shuttle', 'cab', 'courier',
            'cab', 'shuttle', 'cab', 'courier', 'cab', 'shuttle', 'cab', 'courier'],
          waypoints: [[-4050,1780,2010],[-3890,1680,2230],[-3280,1570,2240],[-1450,1580,1810],
            [0,1600,1830],[1380,1580,1810],[2850,1620,2180],[3690,1700,2140],[4010,1780,1980],
            [4030,1850,1730],[3780,1900,1550],[3010,1950,1600],[1550,1880,1630],[0,1780,1410],
            [-1530,1940,1720],[-3100,2090,1860],[-3750,1940,1750],[-3990,1850,1800]] },
        { id: 'express', speed: 146, phase: .065,
          fleet: ['shuttle', 'courier', 'shuttle', 'shuttle', 'courier', 'shuttle', 'courier', 'courier'],
          waypoints: [[-2550,2360,0],[-2000,2360,1230],[0,2460,1560],[1920,2360,1260],[2500,2460,0],
            [2260,2600,-1700],[1050,2670,-2360],[-1080,2630,-2320],[-2340,2530,-1650]] },
        { id: 'west-service', speed: 86, phase: .075,
          fleet: ['utility', 'courier', 'cab', 'courier', 'utility', 'courier', 'utility', 'courier', 'cab'],
          waypoints: [[-5740,1000,500],[-5210,1040,1490],[-4210,1200,2160],[-3350,1250,1790],
            [-3510,1320,920],[-4340,1220,350],[-5210,1100,210]] },
        { id: 'east-service', speed: 91, phase: .028,
          fleet: ['courier', 'utility', 'cab', 'courier', 'utility', 'courier', 'cab', 'utility', 'courier'],
          waypoints: [[5700,1010,220],[5400,1030,1250],[4490,1160,2000],[3650,1390,1760],
            [3690,1490,1010],[4020,1400,250],[4470,1220,-440],[5290,1060,-520]] },
      ],
    },
    ruin: { id: 'field-axis', shift: [-260, 0], scale: [490, 1420, 530], orientation: [5, -17, 25], burial: 410 },
    // Local X, Z, width, depth, terrace elevation, alignment angle.
    // Outlying shelves step outward and rearward, leaving gaps at the ravine mouths.
    outerDistricts: [
      [-7800, -2640, 1490, 1350, 160, -9], [-6260, -1950, 1340, 1050, 186, -11],
      [-5990, -1150, 1640, 1530, 295, -12], [-4010, 1680, 1560, 1240, 166, -16],
      [ 7940, -2600, 1600, 1360, 148,   8], [ 6230, -2620, 1240, 1300, 170,  10],
      [ 5780, -1230, 1730, 1440, 248,  11], [ 3980, 1540, 1420, 1330, 138,  15],
    ],
    middleDistricts: [
      [-4640, -3000, 1790, 1300, 420, -10], [-3620, -880, 1660, 1500, 330, -12],
      [-2380,  1120, 1410, 1370, 245, -15], [ 4370, -3240, 1640, 1460, 405,   9],
      [ 3290, -1340, 1680, 1510, 350,  12], [ 2540,  880, 1530, 1460, 258,  13],
    ],
    coreWidth: 1510,
  },
  // The surviving ruin retains its position in the original alignment.
  alignment: [
    { id: 'field-axis', scale: [200, 920, 250],
      ideal: { center: [-500, -2850], yaw: 12, burial: 290 },
      disturbed: { offset: [-150, -140], orientation: [3, 2, 22], settlement: 45 } },
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
  distantSteleGroove,
  distantSteleTaper: [0.76, 0.84],
  duneObservation: { center: [473, -1717], height: 3 },
  observationBoards: {
    // Approved scene-root poses from the transform inspector. Quaternions are XYZW.
    bones: {
      position: [204.09600513225388, 83.95141683850744, -1338.7312755215785],
      quaternion: [-0.1720811034144197, -0.6138817613407904, -0.26784836249764493, 0.7223534672500262],
      scale: [123, 51.37058823529412, 1],
    },
    ruin: {
      position: [-628.9823214234278, 214.40878648295427, -2827.350322615274],
      quaternion: [-0.15038460402906367, 0.5796677379987989, 0.017866922384221814, 0.8006563291943016],
      scale: [400, 167.05882352941177, 1],
    },
    ring: {
      position: [1300, 38200, -90435.4794453424],
      quaternion: [0.4589831905753898, 0.039227546794147396, 0.006767486175302883, 0.8875527203905218],
      scale: [28870.87714754157, 12057.836926326187, 1.3243521627312647],
    },
    airship: {
      relative: true,
      position: [250, -610, 620],
      quaternion: [0.1684976229, 0.08858292996, 0.01520586408, 0.9815958422],
      scale: [2103.5354001537125, 878.5353730052035, 1.450714069071526],
    },
    dune: {
      relative: true,
      position: [40.70205781960027, 49.831754820044466, -49.93065308537234],
      quaternion: [-0.10430798801336942, -0.1922979428650093, 0.13295642349879971, 0.9666767475515775],
      scale: [178, 74.341176471, 1],
    },
  },
  dressing: {
    deposits: [
      { id: 'field-axis', height: 27, tail: 390 },
      { id: 'still-monolith', height: 19, tail: 510 },
    ],
    // World X/Z at the edge of the travelled valley, not a uniform scatter.
    rockGroups: [
      { center: [-100, -1195], spread: [41, 72], count: 8, sizes: [3, 20], omit: [0, 1, 3, 4, 5] },
      { center: [199, -1360], spread: [43, 77], count: 5, sizes: [2.5, 12], omit: [] },
      { center: [-135, -2970], spread: [52, 94], count: 8, sizes: [3, 24], omit: [0, 1, 2, 3, 4, 5, 6, 7] },
      { center: [477, -3385], spread: [69, 98], count: 7, sizes: [5, 38], omit: [] },
      { center: [-332, -4480], spread: [43, 84], count: 7, sizes: [3, 20], omit: [1, 2, 3, 4, 5] },
    ],
    bones: [
      { center: [186, -1350], length: 51, yaw: -0.78, ribs: 4 },
    ],
  },
  atmosphere: {
    skyFinish: {
      fieldValue: 0.045,
      fieldWarmth: [0.022, 0.003, -0.019],
      fieldMist: 0.09,
      maxOpticalDepth: 0.56,
      cloudLightLow: [0.995, 0.956, 0.867], cloudLightHigh: [0.95, 0.966, 0.99],
      hazeTint: [0.93, 0.90, 0.835], hazeHeight: 0.14, hazeOpacity: 0.27,
      horizonGlow: {
        // Heights are the sine of the viewing elevation. The broad ivory lift
        // reaches above the softer apricot color concentrated at the horizon.
        haloRange: [0.04, 0.54], haloLift: [0.078, 0.034, -0.043],
        coreHeight: 0.22, coreLift: [0.036, 0.005, -0.030],
        lowHazeTint: [0.973, 0.928, 0.78],
      },
      zenithGrade: {
        // Sine of the viewing elevation and the linear RGB scale at full weight.
        elevationRange: [0.30, 0.58],
        colorScale: [0.725, 0.766, 0.828],
      },
      distantHaze: 0.16,
      // Angles in degrees. Azimuth starts at -Z; positive tilt rises toward +X.
      flow: {
        azimuth: -8, elevation: 22, tilt: -13, halfWidth: 8, density: 0.94, bend: 8.5,
        branches: [
          { offset: 16, halfWidth: 5.2, density: 0.43, phase: 0.7, fringeReach: 44, fringeStrength: 0.69 },
          { offset: -8, halfWidth: 3.8, density: 0.22, phase: -1.1, fringeReach: 21, fringeStrength: 1.2 },
        ],
      },
    },
    sky: {
      turbidity: 3.4, rayleigh: 1.4, mieCoefficient: 0.006, mieDirectionalG: 0.78,
      exposure: 1.36, saturation: 0.46, blackLevel: 0.515, whiteLevel: 0.952,
      horizonTint: [1.035, 1.008, 0.917], horizonTintHeight: 0.25,
    },
    fogNear: 1750, fogFar: 12900, cameraFar: 46000,
    distantSilhouette: '#b9b4a8', distantFadeDepth: [15700, 40800], distantFog: [0.3, 0.94],
    monumentColor: '#999b95',
    sunTarget: [0, 0, -2800],
    // The fixed map covers the casters and their downhill ground projections.
    daylight: {
      sunPosition: [-6250, 2830, 1570], sunColor: '#fff0d6', sunIntensity: 3.9,
      hemisphereSky: '#e3edf5', hemisphereGround: '#b2a694', hemisphereIntensity: 1.48,
      shadowStrength: 0.95, shadowBounds: [-3120, 2820, 2810, -980, 5600, 16000],
    },
    shadowResolution: { desktop: 2560, mobile: 1280 },
    shadowRadius: { desktop: 1.75, mobile: 1.25 },
    shadowBias: -0.00014, shadowNormalBias: 1.35,
    exposure: 1.03,
  },
  journey: {
    introScreens: .4, screens: 6, holdScreens: .65,
    scrubSeconds: 0.85, cameraRadius: 12,
    reducedProgress: passage.path,
    framingAspect: 2,
    pointer: { yawDegrees: 4.05, pitchDegrees: 2.475, responseMs: 250, settleDistance: 0.0025 },
    // Reparameterize the retained Hermite segments onto the full chapter scroll range.
    timing: [
      passage,
      { scroll: 0.387131, path: 0.38, slope: 0.649709 },
      { scroll: 0.48, path: 0.434632, slope: 0.559748 },
      { scroll: 0.56, path: 0.479207, slope: 0.560138 },
      { scroll: 0.644351, path: 0.53, slope: 0.684866 },
      { scroll: 0.71, path: 0.576402, slope: 0.753057 },
      { scroll: 0.770576, path: 0.63, slope: 1.151707 },
      { scroll: 0.837807, path: 0.730001, slope: 1.629771 },
      { scroll: 0.905903, path: 0.85, slope: 2.476453 },
      { scroll: 0.92, path: 0.882689, slope: 2.181154 },
      { scroll: 0.96, path: 0.957221, slope: 1.542328 },
      { scroll: 0.98, path: 0.984193, slope: 1.12953 },
      { scroll: 1, path: 1, slope: 0.031574 },
    ].map(({ scroll, path, slope }) => ({ scroll: (scroll - passage.scroll) / chapterSpan, path, slope: slope * chapterSpan })),
    // Position X is lateral to spine, Y is eye height; target Y is above valley floor.
    keys: [
      { at: 0, position: [20, 38, 1000], target: [0, 170, -2500], roll: 0, fov: 52 },
      { at: 0.2, position: [5, 38, 250], target: [10, 210, -3400], roll: -0.003, fov: 52 },
      { at: 0.38, position: [-10, 38, -1140], target: [40, 270, -4900], roll: -0.006, fov: 53 },
      { at: 0.53, position: [-30, 37, -2530], target: [60, 580, -6000], roll: 0.004, fov: 53 },
      { at: 0.63, position: [-60, 37, -3180], target: [70, 700, -6000], roll: 0.006, fov: 53 },
      { at: 0.73, position: [-100, 38, -3500], target: [70, 770, -6000], roll: -0.004, fov: 53 },
      { at: 0.85, position: [-110, 36, -3820], target: [70, 850, -6000], roll: -0.003, fov: 54 },
      { at: 1, position: [-100, 34, -4040], target: [70, 925, -6000], roll: 0, fov: 55 },
    ],
  },
} as const;

export type WorldParameters = typeof EXPANSE;
