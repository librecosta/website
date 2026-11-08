import { EXPANSE } from '../expanse/parameters';
import { buildMonumentCoreData } from '../expanse/world';
import { layers, layouts, splice, type View } from './layout';
import { unwrapMonument, type Point } from './unwrap';

export const hero = EXPANSE.hero;
export const core = buildMonumentCoreData(hero);
export const net = unwrapMonument(core, hero.scale);
export const stone = '#a69e91';

const svgPath = (points: Point[], closed = false) => points.map(([x, y], i) =>
  `${i ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join(' ') + (closed ? ' Z' : '');
const swatches = ['#958f85', '#b3a99a', '#bcb09f'];

export function artwork(view: View, { proof = false, guides = false, mask = false, textureSize = 0 } = {}) {
  const definitions = net.faces.map(face => `<clipPath id="${face.id}"><path clip-rule="evenodd" d="${
    face.outlines.map(loop => svgPath(loop, true)).join(' ')}"/></clipPath>`).join('');
  const group = (id: string, draw: (face: typeof net.faces[number]) => string) =>
    `<g id="${id}">${net.faces.map(face => `<g clip-path="url(#${face.id})">${draw(face)}</g>`).join('')}</g>`;
  const outline = net.faces.map(face => svgPath(face.corners, true)).join(' ');
  const isolated = proof && view !== 'composite';
  const base = isolated ? '#c6c9be' : stone;
  const basePlane = `<path d="${outline}" fill="${base}"/>`;
  const openings = net.faces.flatMap(face => face.outlines.slice(1)).map(loop => svgPath(loop, true)).join(' ');
  const content = layers.filter(layer => layer.id === view || view === 'composite').map(({ id }) => group(id, face => {
    const draw = (path: Point[], closed = false) => svgPath(path.map(face.point), closed);
    const layout = layouts[face.id];
    const line = (paths: Point[][], stroke: string, width: number) =>
      `<path d="${paths.map(path => draw(path)).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="bevel"/>`;
    const band: Point[] = [[0, splice.lower], [1, splice.lower], [1, splice.upper], [0, splice.upper]];
    if (id === 'panels') return `<path fill="#989287" d="${draw(band, true)}"/>`
      + layout.panels.map((path, i) => `<path fill="${swatches[i]}" d="${draw(path, true)}"/>`).join('');
    if (id === 'primary') return line(layout.primary, isolated ? '#555c53' : '#d3c9b5', 7.4);
    if (id === 'secondary') return line([...layout.secondary, [[0, splice.datum], [1, splice.datum]]],
      isolated ? '#5c645b' : '#726f63', 4.8);
    return line(layout.fine, mask ? '#fff' : isolated ? '#796441' : '#fff3d1', 3.5);
  })).join('');
  const guideLines = net.faces.map(face => {
    const [x, y] = face.point([.5, .5]);
    return `<path d="${svgPath(face.corners, true)}"/><path d="${face.outlines.slice(1).map(loop => svgPath(loop, true)).join(' ')}"/>`
      + `<path d="${svgPath([[x - 18, y], [x + 18, y]])}"/>`;
  }).join('');
  const guideLabels = net.faces.map(face => {
    const [x, y] = face.point([.5, 1]);
    return `<text x="${x}" y="${y - 12}">${face.id}</text>`;
  }).join('');
  const backdrop = (color: string) => `<rect x="${net.left}" y="${net.top}" width="${net.width}" height="${net.height}" fill="${color}"/>`;
  // A solid bleed keeps the atlas mipmaps from sampling transparent black at the fold edges.
  const background = mask ? backdrop('#000') : textureSize ? backdrop(stone)
    : proof ? `${basePlane}<path d="${openings}" fill="#50544c"/>` : view === 'composite' ? basePlane : '';
  const label = guides ? `<g fill="none" stroke="#4b5d63" stroke-width="3" stroke-dasharray="13 9">${guideLines}</g>`
    + `<g fill="#354640" font-family="sans-serif" font-size="25" text-anchor="middle">${guideLabels}</g>` : '';
  const size = textureSize ? textureSize / Math.max(net.width, net.height) : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(net.width * size)}" height="${Math.round(net.height * size)}" viewBox="${net.left} ${net.top} ${net.width} ${net.height}" preserveAspectRatio="none">`
    + `<title>Still Monolith · ${view}</title><defs>${definitions}</defs>${background}${content}${label}</svg>`;
}

export const svgUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
