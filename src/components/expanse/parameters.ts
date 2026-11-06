export type Vec3 = readonly [number, number, number];

// P1-A study values, not frozen art direction or final camera keyframes.
export const EXPANSE = {
  seed: 7137,
  terrain: {
    width: 5400, depth: 6200, centerZ: -1550, baseHeight: -4,
    resolution: { desktop: [240, 320], mobile: [128, 176] },
    masses: [
      { center: [-400, 680], radius: [310, 620], height: 26, rotation: -0.5 },
      { center: [500, 140], radius: [300, 700], height: 32, rotation: 0.4 },
      { center: [-980, 450], radius: [780, 900], height: 148, rotation: -0.3 },
      { center: [1150, 720], radius: [690, 840], height: 92, rotation: 0.25 },
      { center: [1030, -450], radius: [610, 1150], height: 115, rotation: 0.2 },
      { center: [-1600, -2350], radius: [850, 1100], height: 185, rotation: -0.2 },
      { center: [1500, -2800], radius: [900, 1000], height: 210, rotation: 0.3 },
      { center: [-320, -4200], radius: [1700, 650], height: 90, rotation: 0 },
    ],
    noise: [
      { wavelength: 950, amplitude: 11 },
      { wavelength: 320, amplitude: 3.8 },
      { wavelength: 130, amplitude: 0.85 },
    ],
    corridor: { halfWidth: 125, blendWidth: 340, bend: 65, bendLength: 1100 },
    pads: [
      { center: [0, -740], radius: [440, 300], level: -1 },
      { center: [-650, -1680], radius: [650, 720], level: 5 },
      { center: [650, -1360], radius: [470, 650], level: 3 },
    ],
  },
  architecture: {
    threshold: { center: [0, -740], width: 340, height: 410, depth: 120, beam: 72 },
    western: { center: [-650, -1680], columns: 5, rows: 3, spacing: [175, 285],
      rowHeights: [360, 450, 520], width: 108, depth: 180, lintel: 65, rotation: -0.08 },
    eastern: { center: [650, -1300], scale: [210, 510, 230], rotation: 0.1 },
    rearGate: { center: [-110, -2490], width: 360, height: 490, depth: 130, beam: 76 },
    solids: [
      { group: 'threshold-shoulder', kind: 'box', center: [-300, -990], scale: [125, 265, 350], rotation: 0, base: -3 },
      { group: 'threshold-buttress', kind: 'wedge', center: [300, -960], scale: [145, 215, 290], rotation: 0, base: -3 },
      { group: 'western-wall', kind: 'box', center: [-1080, -2290], scale: [480, 285, 100], rotation: -0.08, base: null },
      { group: 'eastern-blade', kind: 'box', center: [930, -1610], scale: [85, 430, 230], rotation: 0.1, base: null },
      { group: 'eastern-foot', kind: 'wedge', center: [540, -1690], scale: [240, 260, 290], rotation: 0.1, base: null },
    ],
    distant: { bands: [-1700, 1550], startZ: -2250, rows: 5, columns: 5,
      spacing: [190, 295], width: 72, depth: 112, heights: [230, 330, 270, 390, 300] },
  },
  atmosphere: {
    sky: '#dddcd3', fogNear: 950, fogFar: 4200,
    terrainColor: '#c8c0ab', monumentColor: '#aaa99e',
    sunPosition: [1350, 1700, -1800], sunTarget: [0, 0, -1200],
    sunColor: '#fff1d5', sunIntensity: 3.1,
    hemisphereSky: '#d5dbe0', hemisphereGround: '#928571', hemisphereIntensity: 2.2,
    exposure: 0.92,
  },
  views: [
    { id: 'overlook', label: '首屏远眺', description: '低缓的苍白平原展开，巨构群沿空旷中轴向远方延伸。',
      desktop: { position: [250, 45, 1000], target: [-60, 115, -1400], fov: 43 },
      mobile: { position: [350, 48, 1280], target: [-70, 135, -1350], fov: 64 } },
    { id: 'approach', label: '接近巨构', description: '越过平原，列阵、厚墙与中央开口逐渐分离为清楚的层次。',
      desktop: { position: [210, 26, 160], target: [0, 155, -1100], fov: 48 },
      mobile: { position: [210, 32, 400], target: [0, 165, -1050], fov: 65 } },
    { id: 'threshold', label: '外围门槛', description: '停在巨门之外，以厚重边界与向远方敞开的负空间感知尺度。',
      desktop: { position: [170, 25, -140], target: [0, 170, -850], fov: 55 },
      mobile: { position: [160, 30, 60], target: [0, 170, -900], fov: 67 } },
  ],
} as const;

export type WorldParameters = typeof EXPANSE;
export type ViewId = typeof EXPANSE.views[number]['id'];
