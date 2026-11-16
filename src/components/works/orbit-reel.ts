// Orbit Reel geometry and retargeting are adapted from the TuneShape export.
// See /License/tuneshape-orbit-reel.txt.
export const orbitCount = 18;
export const orbitDuration = .7;
export const ringRadius = 82;
const cardHeight = 100;
const cardAspect = .8;
const gap = .18;
const cardWidth = cardHeight * cardAspect;
export const arcStep = cardWidth / (1 - gap);
const arcRadius = arcStep * orbitCount / (2 * Math.PI);
const ringScale = 2 * Math.PI * ringRadius / orbitCount / arcStep;
export const ringSpin = 8 / 360 * orbitCount;

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
const lerp = (start: number, end: number, progress: number) => start + (end - start) * progress;

export function wrapOrbit(value: number, period = orbitCount) {
  return ((value + period / 2) % period + period) % period - period / 2;
}

export function orbitIndex(position: number) {
  return (Math.round(position) % orbitCount + orbitCount) % orbitCount;
}

export function orbitEase(progress: number) {
  return 1 - (1 - clamp(progress)) ** 3;
}

export function orbitPose(index: number, position: number, mix: number) {
  const offset = wrapOrbit(index - position);
  const angle = offset * Math.PI * 2 / orbitCount;
  const rotate = angle * 180 / Math.PI;
  const distance = Math.abs(offset);
  return {
    x: Math.sin(angle) * lerp(ringRadius, arcRadius, mix),
    y: lerp(-Math.cos(angle) * ringRadius, -18.4 + arcRadius * (1 - Math.cos(angle)), mix),
    rotate,
    scale: lerp(ringScale, 1, mix),
    opacity: lerp(1, clamp((80 - Math.abs(rotate)) / 25), mix),
    depth: 100 - Math.round(distance * 10),
    distance,
  };
}

export type OrbitPose = ReturnType<typeof orbitPose>;

export function orbitFlip(elapsed: number, distance: number) {
  const interval = 10;
  if (elapsed < interval) return 0;
  const wave = (elapsed % interval - distance * .065) / 1.05;
  return wave > 0 && wave < 1 ? orbitEase(wave) * 360 : 0;
}

export function projectPose(pose: OrbitPose, progress: number, chosen: boolean): OrbitPose {
  if (!chosen) return { ...pose, opacity: pose.opacity * (1 - orbitEase(progress / .78)) };
  const focus = orbitEase(progress / .71);
  return {
    ...pose,
    x: lerp(pose.x, 0, focus),
    y: lerp(pose.y, 0, focus),
    rotate: lerp(pose.rotate, 0, focus),
    scale: lerp(pose.scale, 1.05, focus),
    opacity: lerp(pose.opacity, 1, focus) * (1 - orbitEase((progress - .67) / .33)),
    depth: 120,
  };
}

export function orbitTransform({ x, y, rotate }: OrbitPose, flip = 1) {
  return `translate(calc(-50% + ${x.toFixed(3)} * var(--reel-unit)), calc(-50% + ${y.toFixed(3)} * var(--reel-unit))) rotate(${rotate.toFixed(3)}deg) scaleX(${flip.toFixed(5)})`;
}
