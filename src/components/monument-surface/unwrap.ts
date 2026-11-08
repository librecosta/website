import { Vector3 } from 'three';
import type { buildMonumentCoreData } from '../expanse/world';

type Core = ReturnType<typeof buildMonumentCoreData>;
export type FaceId = Core['facades'][number]['id'];
export type Point = [number, number];

// Fold order viewed from the outside. The only cut is between left and front.
export function unwrapMonument(core: Core, scale: readonly number[]) {
  let previous: Point[] | undefined;
  const faces = core.facades.map(face => {
    const [a, b, c, d] = face.corners.map(point => new Vector3(...point));
    const across = b.clone().sub(a).normalize();
    const up = d.clone().sub(a);
    up.addScaledVector(across, -up.dot(across)).normalize();
    const height = d.clone().sub(a).dot(up);
    const project = (point: Vector3): Point => {
      const local = point.clone().sub(a);
      return [local.dot(across), height - local.dot(up)];
    };
    const corners = [a, b, c, d].map(project);
    // Align the next left edge with the previous right edge, with a rigid 2D rotation.
    const origin = previous?.[1] ?? corners[0];
    const crown = previous?.[2] ?? corners[3];
    const angle = Math.atan2(crown[1] - origin[1], crown[0] - origin[0])
      - Math.atan2(corners[3][1] - height, corners[3][0]);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const toNet = ([x, y]: Point): Point => [origin[0] + x * cos - (y - height) * sin,
      origin[1] + x * sin + (y - height) * cos];
    previous = corners.map(toNet);
    const point = ([u, v]: Point): Point => {
      const left = corners[3][0] * v;
      const right = corners[1][0] + (corners[2][0] - corners[1][0]) * v;
      return toNet([left + (right - left) * u, height * (1 - v)]);
    };
    const projectVertex = (id: number): Point => toNet(project(new Vector3(
      core.positions[id * 3] * scale[0], core.positions[id * 3 + 1] * scale[1], core.positions[id * 3 + 2] * scale[2],
    )));
    return { ...face, corners: previous, point, projectVertex,
      outlines: [face.outline, ...face.holes].map(loop => loop.map(projectVertex)) };
  });
  const corners = faces.flatMap(face => face.corners);
  const left = Math.floor(Math.min(...corners.map(p => p[0]))) - 52;
  const top = Math.floor(Math.min(...corners.map(p => p[1]))) - 52;
  const width = Math.ceil(Math.max(...corners.map(p => p[0]))) - left + 52;
  const height = Math.ceil(Math.max(...corners.map(p => p[1]))) - top + 52;
  return { faces, left, top, width, height };
}

export type MonumentUnwrap = ReturnType<typeof unwrapMonument>;
