import { EXPANSE, monumentPanelUnits, monumentSplice } from '../expanse/parameters';
import type { FaceId, Point } from './unwrap';

export const layers = [
  { id: 'panels', name: 'Panel · 面板', note: '纵板与外围三段共用一套切边，以矿物底色留缝。' },
  { id: 'primary', name: 'Primary Lines · 主回路', note: '沿主槽收束，两组横向端子在四面等高。' },
  { id: 'fine', name: 'Fine Lines · 精细纹刻', note: '细纹沿整条纵轴分段绕行，在节点处收束。' },
  { id: 'emission', name: 'Emissive Mask · 发光遮罩', note: '冠部节点和主回路最亮，端子次之，刻度保持低亮。' },
] as const;

export type Layer = typeof layers[number]['id'];
export type View = Layer | 'composite';
export type Master = 'front' | 'side';

export const masterForFace = { front: 'front', right: 'side', back: 'front', left: 'side' } as const;
export const faceLabels: Record<FaceId, string> = { front: '正面 F', right: '右面 S', back: '背面 F', left: '左面 S' };
const joints = [[monumentSplice.lower, monumentSplice.upper], [.748, .761]] as const;

type Mark = { points: Point[]; fill?: string; width?: number; emission?: number; rim?: { color: string; width: number } };
const line = (points: Point[], width = 4, emission = 0): Mark => ({ points, width, emission });
const panel = (points: Point[], fill: string): Mark => ({ points, fill });
const outline = (points: Point[], width = 4, emission = 0): Mark => line([...points, points[0]], width, emission);

// Offset the outer edge in face units so diagonal cuts also retain a visible seam.
function offsetEdge(edge: Point[], gap: number, halfSpan: number, height: number): Point[] {
  const normals = edge.slice(1).map(([x, v], i): Point => {
    const dx = (x - edge[i][0]) * halfSpan;
    const dy = (v - edge[i][1]) * height;
    const length = Math.hypot(dx, dy);
    return [-dy / length, dx / length];
  });
  return edge.map(([x, v], i) => {
    const [ax, ay] = normals[Math.max(i - 1, 0)];
    const [bx, by] = normals[Math.min(i, normals.length - 1)];
    const offset = gap / (1 + ax * bx + ay * by);
    return [x + offset * (ax + bx) / halfSpan, v + offset * (ay + by) / height];
  });
}

function edgeSection(edge: Point[], top: number, bottom: number): Point[] {
  const points: Point[] = [];
  for (let i = 1; i < edge.length; i++) {
    const [x0, v0] = edge[i - 1];
    const [x1, v1] = edge[i];
    const start = Math.min(top, v0);
    const end = Math.max(bottom, v1);
    if (start <= end) continue;
    const at = (v: number): Point => [x0 + (x1 - x0) * (v - v0) / (v1 - v0), v];
    if (!points.length) points.push(at(start));
    points.push(at(end));
  }
  return points;
}

// X measures a fraction of the half-span from the slot axis. Every authored
// mark is mirrored in the exporter, and v is a shared fraction of body height.
export function masterLayout(master: Master) {
  const front = master === 'front';
  const inner = front ? .191 : .252;
  const service = front ? .372 : .387;
  const footWidth = front ? .193 : .286;
  const [lower, upper] = joints;
  const outer = front ? .636 : .658;
  const neck = front ? .561 : .579;
  const recess = neck - .041;
  const outerEdge: Point[] = [
    [.351,.873],[.351,.852],[outer,.818],
    [outer,upper[1]],[neck,upper[0]],[neck,.589],[recess,.564],
    [recess,.472],[neck,.447],[neck,lower[1]],[outer,lower[0]],
    [outer,.354],[.474,.319],[.474,.293],[inner+.088,.261],
    [inner+.088,.251],
  ];
  const profile: Point[] = [[inner,.873], ...outerEdge, [inner,.251]];
  const crownWidth = front ? .229 : .292;
  const crownShape = (points: Point[], scale = 1): Point[] => points.map(([x, y]) =>
    [x * crownWidth * scale, .927 + y * .025 * scale]);
  const crownEdge: Point[] = [[0,1],[.35,.51],[.47,.51],[.67,.12],[.76,.12],[1,-.9]];
  const gold = (points: Point[], emission: number): Mark => ({ points, fill: '#deb67a', emission });
  const crest = (points: Point[], emission: number) => gold(crownShape(points), emission);
  const footGlyph = (points: Point[], emission: number) =>
    gold(points.map(([x, v]) => [x * footWidth, .044 + v * .018]), emission);
  const { scale, topScale } = EXPANSE.hero;
  const halfSpan = front ? scale[0] * (1 + topScale[0]) / 4 : scale[2] * (1 + topScale[1]) / 4;
  const matingEdge = offsetEdge(outerEdge, 24, halfSpan, monumentPanelUnits);
  // Cut one companion strip at the two transverse joints. Leave the slot-side shoulder clear.
  const cuts: Point[] = [[.873,upper[1]+.008],[upper[0]-.008,lower[1]+.008],[lower[0]-.008,.251]];
  const inlays = cuts.map(([top, bottom]): Point[] => {
    const edge = edgeSection(matingEdge, top, bottom);
    const outside = edge.map(([x, v]): Point => [Math.min(x + 26 / halfSpan, front ? .793 : .773), v]);
    return [...edge, ...outside.reverse()];
  });
  const panelTone = '#766e60';
  const panels = [
    { ...panel(profile, panelTone), rim: { color: '#9b907f', width: 18 } },
    ...inlays.map(shape => panel(shape, panelTone)),
    panel(crownShape([...crownEdge,[0,-.9]], 1.17), '#766e60'),
    panel([[0,.019],[.864,.019],[.864,.04],[.584,.069],[0,.069]], '#746b5d'),
  ];
  const primary = [
    outline(profile, 5, .94),
    ...inlays.map(shape => outline(shape, 2.8, .65)),
    ...[lower[0], upper[1]].map(v => line([[outer,v],[1,v]], 4.5, .74)),
    ...[lower[1], upper[0]].map(v => line([[neck,v],[1,v]], 4, .46)),
    crest([...crownEdge,[.74,-.9],[.62,-.66],[.51,-.66],[.39,-.29],[.28,-.29],[0,.49]], .8),
    crest([[.085,.25],[.20,.27],[.27,.13],[.24,-.035],[.12,-.06],[.076,.06]], .56),
    crest([[.30,.035],[.43,.025],[.48,-.14],[.42,-.29],[.30,-.25],[.26,-.12]], .56),
    crest([[0,-.18],[.14,-.23],[.24,-.47],[.20,-.66],[.09,-.69],[0,-.60]], .63),
    // The plinth receives the axial core above two mirrored, stepped supports.
    footGlyph([[0,-.90],[.38,-.90],[.58,-.64],[.71,-.64],[1,.46],[.78,.46],
      [.65,.02],[.52,.02],[.34,-.44],[0,-.44]], .76),
    footGlyph([[0,.99],[.23,.36],[.16,.02],[0,-.18]], .87),
    line([[footWidth,.0523],[.675,.0523]], 3.2, .49),
  ];

  const split = (v: number) => [-1, 1].map(side => line([
    [service,v+.018],[service+side*.046,v+.008],
    [service+side*.046,v-.008],[service,v-.018],
  ], 3.4, .49));
  // Alternating signed radii open the winding in the middle and taper it back to the axis.
  const axisSections: Point[] = [[.814,.699],[.663,.519],[.483,.345]];
  const winding: Point[] = [[0,.022],[.11,-.042],[.24,.062],[.39,-.074],
    [.57,.062],[.74,-.043],[.88,.024],[1,0]];
  const spiral = axisSections.flatMap(([top, bottom]) => {
    const turns = winding.slice(0, -1).map(([start, radius], i) => {
      const length = winding[i + 1][0] - start;
      const arc = Array.from({ length: 9 }, (_, j): Point => {
        const t = j / 8;
        return [service + radius * Math.sin(Math.PI * t), top - (top - bottom) * (start + length * t)];
      });
      return line(arc, radius > 0 ? 3.2 : 2.7, radius > 0 ? .47 : .26);
    });
    return [line([[service,top],[service,bottom]], 3.2, .28), ...turns];
  });
  const fine = [
    ...split(.681),
    ...split(.501),
    ...spiral,
    ...[.814,.345].map(v => line([[service-.029,v],[service+.029,v]], 3.4, .39)),
    ...[[.916,.52],[.925,.56],[.934,.51]].map(([v, end]) => line([[crownWidth*1.17+.035,v],[end,v]], 3.4, .37)),
    ...[.60,.642].map(x => line([[x,.918],[x,.934]], 3.2, .24)),
    ...[.032,.042].map((v,i) => line([[footWidth+.055,v],[.759-i*.066,v]], 3.4, .35)),
    ...[.612,.66,.702].map(x => line([[x,.075],[x,.094]], 3.4, .22)),
  ];
  return { panels, primary, fine };
}
