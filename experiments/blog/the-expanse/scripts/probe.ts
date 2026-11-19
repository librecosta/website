// Copied only into the disposable site snapshot.
const query = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
export const evidence = query?.has('e1') ? {
  shot: query.get('e1'), position: Number(query.get('position')),
  time: Number(query.get('time')), mode: query.get('mode') ?? 'normal',
  wind: query.get('wind') ?? 'static', sky: query.get('sky') ?? 'color',
} : null;

type Sample = { frameAt: number; calls: number; triangles: number; gpuMs: number | null };
type Trace = { limit: number; samples: Sample[]; disjoint: number; support: boolean; drawingBuffer: number[] };
type Controls = { trace?: Trace; sand?: () => unknown };
export const controls: Controls = {};
if (typeof window !== 'undefined' && evidence) Object.assign(window, { expanseEvidence: controls });

export function gpuProbe(context: WebGL2RenderingContext) {
  const ext = context.getExtension('EXT_disjoint_timer_query_webgl2');
  const pending: { query: WebGLQuery; sample: Sample }[] = [];
  return {
    begin() {
      const trace = controls.trace;
      if (!trace) return null;
      trace.support = Boolean(ext);
      trace.drawingBuffer = [context.drawingBufferWidth, context.drawingBufferHeight];
      if (ext) {
        const disjoint = context.getParameter(ext.GPU_DISJOINT_EXT);
        if (disjoint) {
          for (const item of pending.splice(0)) context.deleteQuery(item.query);
          for (const sample of trace.samples) sample.gpuMs = null;
          trace.disjoint++;
        }
        while (pending.length && context.getQueryParameter(pending[0].query, context.QUERY_RESULT_AVAILABLE)) {
          const item = pending.shift()!;
          item.sample.gpuMs = context.getQueryParameter(item.query, context.QUERY_RESULT) / 1e6;
          context.deleteQuery(item.query);
        }
      }
      if (trace.samples.length >= trace.limit) return null;
      const sample: Sample = { frameAt: performance.now(), calls: 0, triangles: 0, gpuMs: null };
      trace.samples.push(sample);
      const query = ext ? context.createQuery() : null;
      if (query && ext) context.beginQuery(ext.TIME_ELAPSED_EXT, query);
      return (calls: number, triangles: number) => {
        sample.calls = calls;
        sample.triangles = triangles;
        if (query && ext) {
          context.endQuery(ext.TIME_ELAPSED_EXT);
          pending.push({ query, sample });
        }
      };
    },
  };
}
