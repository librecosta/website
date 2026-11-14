/*
 * Adapted from Isometria (Copyright 2026 bswxyz), MIT.
 * https://github.com/shellcat-com/formwork-isometria/tree/314b11cfaec44cdd43c91b4382c23f901f9e3cae
 * See public/works/isometria-license.txt.
 */
import * as THREE from 'three';
import type { Landmark, Project } from './projects';

const COLORS = [0x4db6e8, 0xf0d79a, 0x7ec850, 0x69b545, 0x9aa0a6];
export const halfGrid = 6;

function levelAt(i: number, j: number) {
  const dx = (i - halfGrid) / halfGrid;
  const dz = (j - halfGrid) / halfGrid;
  const r = Math.sqrt(dx * dx + dz * dz);
  const h = (1 - r) * 4.7 + Math.sin(i * 0.9) * 0.5 + Math.cos(j * 0.75) * 0.5 - 0.4;
  return Math.max(0, Math.round(h));
}

export function makeRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.shadowMap.enabled = true;
  // Three r187 replaces the original PCFSoftShadowMap with filtered PCF.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

export function makeCamera() {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 100);
  camera.position.set(9, 10, 9);
  camera.lookAt(0, 1.2, 0);
  camera.updateMatrixWorld();
  return camera;
}

export function addDaylight(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.62);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
  sun.shadow.bias = -0.0006;
  sun.shadow.radius = 1.4;
  scene.add(ambient, sun);
  return sun;
}

const accents: Record<Landmark, number> = {
  terrace: 0x2b777b,
  workshop: 0xdc8b58,
  observatory: 0x537787,
  collector: 0xb87242,
  prism: 0x62a19b,
  ribs: 0x3e839d,
  gates: 0x8675a8,
  archive: 0xb57d4e,
};

type Block = [x: number, y: number, z: number, width: number, height: number, depth: number];
const structures: Record<Landmark, Block[]> = {
  terrace: [[0, 0.22, 0, 0.68, 0.16, 0.53], [0.06, 0.38, -0.03, 0.47, 0.16, 0.43]],
  workshop: [[-0.15, 0.25, 0, 0.36, 0.22, 0.56], [0.21, 0.32, -0.08, 0.28, 0.36, 0.4]],
  observatory: [[0, 0.36, 0, 0.36, 0.49, 0.35], [0, 0.66, 0, 0.61, 0.17, 0.43]],
  collector: [[-0.2, 0.35, 0, 0.2, 0.44, 0.31], [0.17, 0.29, -0.04, 0.28, 0.32, 0.46]],
  prism: [[-0.13, 0.35, 0, 0.13, 0.44, 0.53], [0.14, 0.29, -0.03, 0.12, 0.32, 0.5]],
  ribs: [[-0.22, 0.26, 0, 0.11, 0.24, 0.57], [0, 0.35, 0, 0.12, 0.42, 0.63], [0.22, 0.26, 0, 0.11, 0.24, 0.57]],
  gates: [[-0.23, 0.35, 0, 0.1, 0.43, 0.2], [0.23, 0.35, 0, 0.1, 0.43, 0.2], [0, 0.56, 0, 0.56, 0.09, 0.2]],
  archive: [[0, 0.24, 0, 0.64, 0.2, 0.51], [0, 0.41, -0.03, 0.48, 0.14, 0.41], [0, 0.53, -0.06, 0.32, 0.1, 0.34]],
};

export function makeIsland(projects: readonly Project[]) {
  const world = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const trunk = new THREE.CylinderGeometry(0.07, 0.09, 0.4, 6);
  const leaf = new THREE.ConeGeometry(0.34, 0.85, 7);
  const transforms = new THREE.Object3D();
  const tileLayers = COLORS.map(() => [] as Block[]);
  const trunks: Block[] = [];
  const leaves: Block[] = [];

  function addInstances(geometry: THREE.BufferGeometry, color: number, blocks: Block[]) {
    const material = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.InstancedMesh(geometry, material, blocks.length);
    for (const [index, [x, y, z, width, height, depth]] of blocks.entries()) {
      transforms.position.set(x, y, z);
      transforms.scale.set(width, height, depth);
      transforms.updateMatrix();
      mesh.setMatrixAt(index, transforms.matrix);
    }
    mesh.castShadow = mesh.receiveShadow = true;
    world.add(mesh);
  }

  for (let i = 0; i <= 2 * halfGrid; i++) for (let j = 0; j <= 2 * halfGrid; j++) {
    const level = levelAt(i, j);
    const height = level + 0.6;
    const x = i - halfGrid;
    const z = j - halfGrid;
    tileLayers[Math.min(level, COLORS.length - 1)].push([x, height / 2, z, 1, height, 1]);
    const hasProject = projects.some(({ position }) => position[0] === x && position[1] === z);
    // Leave a sightline from the default camera to the collector on the next tier.
    const collectorSightline = x === -4 && z === 1;
    if (!hasProject && !collectorSightline && (level === 2 || level === 3) && ((i * 7 + j * 3) % 5 === 0)) {
      trunks.push([x, height + 0.2, z, 1, 1, 1]);
      leaves.push([x, height + 0.75, z, 1, 1, 1]);
    }
  }
  tileLayers.forEach((tiles, level) => addInstances(box, COLORS[level], tiles));
  addInstances(trunk, 0x8a5a34, trunks);
  addInstances(leaf, 0x3f9b57, leaves);

  const plaster = new THREE.MeshLambertMaterial({ color: 0xfdfbf5 });
  const lighthouse = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.4, 10), plaster);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 0.5, 10),
    new THREE.MeshLambertMaterial({ color: 0xef8d5a }),
  );
  roof.position.y = 0.95;
  tower.castShadow = roof.castShadow = true;
  lighthouse.add(tower, roof);
  lighthouse.position.y = levelAt(halfGrid, halfGrid) + 1.3;
  world.add(lighthouse);

  const markers = projects.map(({ slug, position: [x, z], landmark }) => {
    const group = new THREE.Group();
    const height = levelAt(x + halfGrid, z + halfGrid) + 0.6;
    const color = new THREE.MeshLambertMaterial({ color: accents[landmark] });

    function block(material: THREE.Material, [x, y, z, width, height, depth]: Block) {
      const mesh = new THREE.Mesh(box, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(width, height, depth);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }

    block(plaster, [0, 0.07, 0, 0.83, 0.14, 0.76]);
    structures[landmark].forEach(part => block(color, part));
    group.position.set(x, height, z);
    world.add(group);
    return { slug, group, height, color };
  });

  return { world, markers };
}

export function disposeIsland(world: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  world.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    materials.add(object.material);
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
