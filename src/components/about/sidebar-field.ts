import { cubicBezier } from 'motion/react';

// Adapted from the TuneShape Mini Sidebar pointer field, MIT.
// The exported line 3 width defines the response one row from the pointer.
const maxWidth = 38;
const radius = 1 / Math.sqrt(-2 * Math.log((27.592794649095264 - 8) / (maxWidth - 8)));
export const sidebarEase = [.4, 0, .2, 1] as const;
const retractEase = cubicBezier(...sidebarEase);

type Line = { width: number; opacity: number; scaleY: number };
type Spring = { value: number; velocity: number };

function restingLine(selected: boolean): Line {
  return { width: selected ? 18 : 8, opacity: selected ? .96 : .2, scaleY: .76 };
}

function followingLine(rest: Line, distance: number): Line {
  const weight = Math.exp(-.5 * (distance / radius) ** 2);
  return {
    width: rest.width + (maxWidth - rest.width) * weight,
    opacity: Math.max(rest.opacity, .2 + .8 * weight),
    scaleY: .76 + .32 * weight,
  };
}

export function sectionOffset(index: number, count: number, expanded: boolean) {
  return (index - (count - 1) / 2) * (expanded ? 12 : 7);
}

function step(spring: Spring, target: number, seconds: number, tolerance: number) {
  const offset = spring.value - target;
  const decay = Math.exp(-48 * seconds);
  const carry = (spring.velocity + 48 * offset) * seconds;
  spring.value = target + (offset + carry) * decay;
  spring.velocity = (spring.velocity - 48 * carry) * decay;
  if (Math.abs(spring.value - target) > tolerance || Math.abs(spring.velocity) > .05) return false;
  spring.value = target;
  spring.velocity = 0;
  return true;
}

export function createSidebarField(count: number, paintLine: (index: number, value: Line) => void, paintLabel: (y: number) => void) {
  const properties = ['width', 'opacity', 'scaleY'] as const;
  const lines = Array.from({ length: count }, (_, index) => {
    const rest = restingLine(index === 0);
    return { width: { value: rest.width, velocity: 0 }, opacity: { value: rest.opacity, velocity: 0 }, scaleY: { value: rest.scaleY, velocity: 0 }, from: rest };
  });
  const label = { value: sectionOffset(0, count, true), velocity: 0 };
  let selected = 0;
  let pointer = 0;
  let open = false;
  let reduced = false;
  let frame = 0;
  let previousTime: number | undefined;
  let retractTime = 0;

  function draw(seconds: number) {
    let settled = true;
    const retraction = reduced ? 1 : retractEase(Math.min(1, retractTime / .4));
    for (const [index, line] of lines.entries()) {
      const rest = restingLine(index === selected);
      const goal = open ? followingLine(rest, index - pointer) : rest;
      for (const key of properties) {
        const spring = line[key];
        if (!open) {
          spring.value = line.from[key] + (goal[key] - line.from[key]) * retraction;
          spring.velocity = 0;
          settled &&= retraction === 1;
        } else if (reduced) {
          spring.value = goal[key];
          spring.velocity = 0;
        } else if (!step(spring, goal[key], seconds, key === 'width' ? .01 : .001)) {
          settled = false;
        }
      }
      paintLine(index, { width: line.width.value, opacity: line.opacity.value, scaleY: line.scaleY.value });
    }
    if (open) {
      const goal = sectionOffset(pointer, count, true);
      if (reduced) { label.value = goal; label.velocity = 0; }
      else if (!step(label, goal, seconds, .01)) settled = false;
      paintLabel(label.value);
    }
    return settled;
  }

  function tick(time: number) {
    frame = 0;
    const seconds = previousTime === undefined ? 0 : (time - previousTime) / 1000;
    previousTime = time;
    if (!open) retractTime += seconds;
    if (draw(seconds)) previousTime = undefined;
    else frame = requestAnimationFrame(tick);
  }

  function update() {
    if (reduced) draw(0);
    else if (!frame) frame = requestAnimationFrame(tick);
  }

  return {
    move(index: number) { pointer = index; open = true; update(); },
    leave() {
      if (!open) return;
      open = false;
      retractTime = 0;
      label.velocity = 0;
      for (const line of lines) {
        line.from = { width: line.width.value, opacity: line.opacity.value, scaleY: line.scaleY.value };
      }
      update();
    },
    configure(index: number, reduce: boolean) {
      selected = index;
      reduced = reduce;
      if (open) update();
      else if (!frame || reduced) { retractTime = .4; draw(0); }
    },
    stop() { cancelAnimationFrame(frame); frame = 0; previousTime = undefined; },
  };
}
