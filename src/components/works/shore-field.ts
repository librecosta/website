/* Adapted from Wenz Louie Rejas (2026), MIT, 0319381. See public/works/wenz-license.txt. */
import * as THREE from 'three';

function meshesOf(model: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  model.traverse(object => { if (object instanceof THREE.Mesh && object.visible) meshes.push(object); });
  return meshes;
}

export interface DistanceField {
  distances: Float32Array
  resolution: number
  size: number
  centerX: number
  centerZ: number
}


type FieldFrame = Omit<DistanceField, 'distances'>

const TRIANGLE_FLOATS = 9

const { clamp } = THREE.MathUtils

const _worldToModel = new THREE.Matrix4()
const _meshToModel = new THREE.Matrix4()
const _point = new THREE.Vector3()

// ── Model triangles ───────────────────────────────────────────────────────────

const cornerCount = (geometry: THREE.BufferGeometry) =>
  geometry.index ? geometry.index.count : geometry.getAttribute('position').count

function readTriangles(model: THREE.Object3D): Float32Array {
  model.updateWorldMatrix(false, true)
  _worldToModel.identity()
  if (model.parent) _worldToModel.copy(model.parent.matrixWorld).invert()

  const meshes = meshesOf(model)
  const triangles = new Float32Array(
    meshes.reduce((sum, mesh) => sum + cornerCount(mesh.geometry), 0) * 3
  )
  let written = 0
  for (const mesh of meshes) {
    _meshToModel.multiplyMatrices(_worldToModel, mesh.matrixWorld)
    const position = mesh.geometry.getAttribute('position')
    const points = new Float32Array(position.count * 3)
    for (let vertex = 0; vertex < position.count; vertex++) {
      _point.fromBufferAttribute(position, vertex).applyMatrix4(_meshToModel)
      points[vertex * 3] = _point.x
      points[vertex * 3 + 1] = _point.y
      points[vertex * 3 + 2] = _point.z
    }

    const index = mesh.geometry.index
    const count = cornerCount(mesh.geometry)
    for (let corner = 0; corner < count; corner++) {
      const vertex = index ? index.getX(corner) : corner
      triangles[written++] = points[vertex * 3]
      triangles[written++] = points[vertex * 3 + 1]
      triangles[written++] = points[vertex * 3 + 2]
    }
  }
  return triangles
}


function sliceEdge(
  triangles: Float32Array,
  from: number,
  to: number,
  waterY: number,
  out: number[]
) {
  const fromY = triangles[from + 1]
  const toY = triangles[to + 1]
  if ((fromY - waterY) * (toY - waterY) >= 0) return false
  const along = (waterY - fromY) / (toY - fromY)
  out.push(
    triangles[from] + (triangles[to] - triangles[from]) * along,
    triangles[from + 2] + (triangles[to + 2] - triangles[from + 2]) * along
  )
  return true
}

function sliceAtWaterline(triangles: Float32Array, waterY: number): number[] {
  const segments: number[] = []
  for (let first = 0; first < triangles.length; first += TRIANGLE_FLOATS) {
    const crossings =
      Number(sliceEdge(triangles, first, first + 3, waterY, segments)) +
      Number(sliceEdge(triangles, first + 3, first + 6, waterY, segments)) +
      Number(sliceEdge(triangles, first + 6, first, waterY, segments))
    if (crossings === 1) segments.length -= 2
  }
  return segments
}


function frameAround(segments: number[], margin: number, resolution: number): FieldFrame {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (let i = 0; i < segments.length; i += 2) {
    minX = Math.min(minX, segments[i])
    maxX = Math.max(maxX, segments[i])
    minZ = Math.min(minZ, segments[i + 1])
    maxZ = Math.max(maxZ, segments[i + 1])
  }
  return {
    resolution,
    size: Math.max(maxX - minX, maxZ - minZ) + margin * 2,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  }
}

function toGrid(segments: number[], frame: FieldFrame): Float64Array {
  const cellsPerUnit = frame.resolution / frame.size
  const originX = frame.centerX - frame.size / 2
  const originZ = frame.centerZ - frame.size / 2
  const gridSegments = new Float64Array(segments.length)
  for (let i = 0; i < segments.length; i += 2) {
    gridSegments[i] = (segments[i] - originX) * cellsPerUnit
    gridSegments[i + 1] = (segments[i + 1] - originZ) * cellsPerUnit
  }
  return gridSegments
}

// ── Water mask ────────────────────────────────────────────────────────────────

function markOutline(gridSegments: Float64Array, resolution: number): Uint8Array {
  const outline = new Uint8Array(resolution * resolution)
  for (let i = 0; i < gridSegments.length; i += 4) {
    const spanX = gridSegments[i + 2] - gridSegments[i]
    const spanZ = gridSegments[i + 3] - gridSegments[i + 1]
    const steps = Math.ceil(Math.hypot(spanX, spanZ) * 2) + 1
    for (let step = 0; step <= steps; step++) {
      const column = Math.floor(gridSegments[i] + (spanX * step) / steps)
      const row = Math.floor(gridSegments[i + 1] + (spanZ * step) / steps)
      if (column >= 0 && row >= 0 && column < resolution && row < resolution) {
        outline[row * resolution + column] = 1
      }
    }
  }
  return outline
}


export function floodOpenWater(outline: Uint8Array, resolution: number): Uint8Array {
  const water = new Uint8Array(outline.length)
  const queue = new Int32Array(outline.length)
  let head = 0
  let tail = 0
  const fill = (cell: number) => {
    if (water[cell] || outline[cell]) return
    water[cell] = 1
    queue[tail++] = cell
  }

  const last = resolution - 1
  for (let i = 0; i < resolution; i++) {
    fill(i)
    fill(last * resolution + i)
    fill(i * resolution)
    fill(i * resolution + last)
  }
  while (head < tail) {
    const cell = queue[head++]
    const column = cell % resolution
    if (column > 0) fill(cell - 1)
    if (column < last) fill(cell + 1)
    if (cell >= resolution) fill(cell - resolution)
    if (cell < outline.length - resolution) fill(cell + resolution)
  }
  return water
}

// ── Distances ─────────────────────────────────────────────────────────────────

function squaredDistancesToOutline(
  gridSegments: Float64Array,
  resolution: number,
  farthest: number
): Float32Array {
  const squared = new Float32Array(resolution * resolution).fill(farthest * farthest)
  const last = resolution - 1

  for (let i = 0; i < gridSegments.length; i += 4) {
    const startX = gridSegments[i]
    const startZ = gridSegments[i + 1]
    const spanX = gridSegments[i + 2] - startX
    const spanZ = gridSegments[i + 3] - startZ
    const lengthSquared = spanX * spanX + spanZ * spanZ
    const leftX = Math.min(startX, startX + spanX)
    const rightX = Math.max(startX, startX + spanX)
    const topZ = Math.min(startZ, startZ + spanZ)
    const bottomZ = Math.max(startZ, startZ + spanZ)

    const firstRow = clamp(Math.floor(topZ - farthest), 0, last)
    const lastRow = clamp(Math.ceil(bottomZ + farthest), 0, last)

    for (let row = firstRow; row <= lastRow; row++) {
      const offsetZ = row + 0.5 - startZ
      const rowGap = Math.max(topZ - row - 0.5, row + 0.5 - bottomZ, 0)
      const sideReach = Math.min(
        farthest,
        Math.sqrt(Math.max(farthest * farthest - rowGap * rowGap, 0)) + 1
      )
      const firstColumn = clamp(Math.floor(leftX - sideReach), 0, last)
      const lastColumn = clamp(Math.ceil(rightX + sideReach), 0, last)

      for (let column = firstColumn; column <= lastColumn; column++) {
        const offsetX = column + 0.5 - startX
        const projection = offsetX * spanX + offsetZ * spanZ
        let gapX = offsetX
        let gapZ = offsetZ
        if (projection > 0) {
          const along = projection < lengthSquared ? projection / lengthSquared : 1
          gapX -= spanX * along
          gapZ -= spanZ * along
        }
        const cell = row * resolution + column
        squared[cell] = Math.min(squared[cell], gapX * gapX + gapZ * gapZ)
      }
    }
  }
  return squared
}

function signedDistances(
  gridSegments: Float64Array,
  outline: Uint8Array,
  frame: FieldFrame,
  reach: number
): Float32Array {
  const cellSize = frame.size / frame.resolution
  const water = floodOpenWater(outline, frame.resolution)
  const squared = squaredDistancesToOutline(gridSegments, frame.resolution, reach / cellSize)

  const distances = new Float32Array(squared.length)
  for (let i = 0; i < squared.length; i++) {
    const distance = Math.sqrt(squared[i]) * cellSize
    distances[i] = water[i] ? distance : -distance
  }
  return distances
}


function fieldAround(waterline: number[], margin: number, resolution: number): DistanceField {
  const frame = frameAround(waterline, margin, resolution)
  const gridWaterline = toGrid(waterline, frame)
  const outline = markOutline(gridWaterline, resolution)
  return { ...frame, distances: signedDistances(gridWaterline, outline, frame, margin) }
}

export function buildWaterlineField(model: THREE.Object3D, waterY: number, margin: number, resolution: number) {
  const waterline = sliceAtWaterline(readTriangles(model), waterY);
  return waterline.length ? fieldAround(waterline, margin, resolution) : null;
}
