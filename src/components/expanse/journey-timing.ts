import type { WorldParameters } from './parameters';

export function mapJourneyProgress(smoothed: number, timing: WorldParameters['journey']['timing']) {
  const opening = timing[0];
  const arrival = timing[timing.length - 1];
  const scroll = Math.max(opening.scroll, Math.min(arrival.scroll, smoothed));
  let segment = 0;
  while (segment < timing.length - 2 && scroll >= timing[segment + 1].scroll) segment++;
  const start = timing[segment];
  const end = timing[segment + 1];
  const span = end.scroll - start.scroll;
  const t = (scroll - start.scroll) / span;
  // Cubic Hermite. Slopes are with respect to scroll, so tangents scale with span.
  return start.path + (end.path - start.path) * t * t * (3 - 2 * t)
    + span * t * (1 - t) * ((1 - t) * start.slope - t * end.slope);
}
