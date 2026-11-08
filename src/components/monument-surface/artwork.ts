import { EXPANSE, monumentFaceHeight } from '../expanse/parameters';
import { buildMonumentCoreData } from '../expanse/world';
import { faceLabels, masterForFace, masterLayout, type Master, type View } from './layout';
import { unwrapMonument, type Point } from './unwrap';

export const hero = EXPANSE.hero;
export const core = buildMonumentCoreData(hero);
export const net = unwrapMonument(core, hero.scale);
export const stone = '#c5b8a4';

// Server and browser trig can disagree on the sign of a projected zero.
const svgCoordinate = (value: number) => (Math.abs(value) < .00005 ? 0 : value).toFixed(4);
const svgPath = (points: Point[], closed = false) => points.map(([x, y], i) =>
  `${i ? 'L' : 'M'}${svgCoordinate(x)} ${svgCoordinate(y)}`).join(' ') + (closed ? ' Z' : '');

export function artwork(view: View, { proof = false, guides = false, master, textureSize = 0 }:
  { proof?: boolean; guides?: boolean; master?: Master; textureSize?: number } = {}) {
  const selection = master ? net.faces.filter(face => face.id === (master === 'front' ? 'front' : 'right')) : net.faces;
  const faces = selection.map(face => {
    const [a, b] = face.corners;
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [ux, uy] = [(b[0] - a[0]) / span, (b[1] - a[1]) / span];
    const project = ([x, y]: Point): Point => master
      ? [(x - a[0]) * ux + (y - a[1]) * uy, (y - a[1]) * ux - (x - a[0]) * uy] : [x, y];
    return { ...face, corners: face.corners.map(project), outlines: face.outlines.map(loop => loop.map(project)),
      point: (p: Point) => project(face.point(p)) };
  });
  const vertices = faces.flatMap(face => face.corners);
  const left = master ? Math.floor(Math.min(...vertices.map(p => p[0]))) - 52 : net.left;
  const top = master ? Math.floor(Math.min(...vertices.map(p => p[1]))) - 52 : net.top;
  const width = master ? Math.ceil(Math.max(...vertices.map(p => p[0]))) - left + 52 : net.width;
  const height = master ? Math.ceil(Math.max(...vertices.map(p => p[1]))) - top + 52 : net.height;
  const definitions = faces.map(face => `<clipPath id="${face.id}"><path clip-rule="evenodd" d="${
    face.outlines.map(loop => svgPath(loop, true)).join(' ')}"/></clipPath>`).join('');
  const group = (id: string, draw: (face: typeof faces[number]) => string) =>
    `<g id="${id}">${faces.map(face => `<g clip-path="url(#${face.id})">${draw(face)}</g>`).join('')}</g>`;
  const parts = ['panels', 'primary', 'fine', 'emission'] as const;
  const content = parts.filter(id => id === view || (view === 'composite' && id !== 'emission')).map(id => group(id, face => {
    const layout = masterLayout(masterForFace[face.id]);
    const marks = id === 'emission' ? [...layout.primary, ...layout.fine].filter(mark => mark.emission) : layout[id];
    const drawings = marks.map(mark => {
      const mirrored = [-1, 1].map(side => svgPath(mark.points.map(([u, v]) =>
        face.point([.5 + side * u / 2, monumentFaceHeight(v)])), Boolean(mark.fill))).join(' ');
      const level = Math.round(255 * (mark.emission ?? 0));
      const ink = id === 'emission' ? `rgb(${level},${level},${level})` : id === 'primary' ? '#deb67a' : '#ddc199';
      if (mark.fill) {
        const rim = mark.rim ? ` stroke="${mark.rim.color}" stroke-width="${mark.rim.width}" stroke-linejoin="bevel" paint-order="stroke fill"` : '';
        return `<path fill="${id === 'emission' ? ink : mark.fill}"${rim} d="${mirrored}"/>`;
      }
      return `<path fill="none" stroke="${ink}" stroke-width="${mark.width}" stroke-linejoin="bevel" d="${mirrored}"/>`;
    }).join('');
    return (id === 'panels' ? `<path d="${svgPath(face.corners, true)}" fill="${stone}"/>` : '') + drawings;
  })).join('\n');
  const outline = faces.map(face => svgPath(face.corners, true)).join(' ');
  const openings = (loop: number) => faces.map(face => svgPath(face.outlines[loop], true)).join(' ');
  const backdrop = (color: string) => `<rect x="${left}" y="${top}" width="${width}" height="${height}" fill="${color}"/>`;
  const background = view === 'emission' ? backdrop('#000') : textureSize ? backdrop(stone) : proof
    ? `<path d="${outline}" fill="${stone}"/><path d="${openings(1)}" fill="#37362e"/><path d="${openings(2)}" fill="#5f5a4d"/>` : '';
  const label = guides ? faces.map(face => {
    const [x, y] = face.point([.5, 1]);
    return `<path d="${[face.corners,...face.outlines.slice(1)].map(loop => svgPath(loop, true)).join(' ')}"
      fill="none" stroke="#4b5d63" stroke-width="3" stroke-dasharray="13 9"/><text x="${x}" y="${y - 12}"
      fill="#354640" font-family="sans-serif" font-size="25" text-anchor="middle">${faceLabels[face.id]}</text>`;
  }).join('') : '';
  const size = textureSize ? textureSize / Math.max(width, height) : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width * size)}" height="${Math.round(height * size)}"
    viewBox="${left} ${top} ${width} ${height}" preserveAspectRatio="none"><title>Still Monolith · ${view}</title>
    <defs>${definitions}</defs>${background}${content}${label}</svg>`;
}

export const svgUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
