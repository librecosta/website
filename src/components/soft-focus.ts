import { cubicBezier, useTransform, type MotionValue } from 'motion/react';

const focusEase = cubicBezier(.22, 1, .36, 1);

// Soft Blur In eases opacity and blur together and settles the offset earlier.
// See /License/tuneshape-about-closing.txt.
export function useSoftFocus(clock: MotionValue<number>, start: number, duration: number, blur: number, travel: number) {
  const opacity = useTransform(clock, [start, start + duration], [0, 1], { ease: focusEase });
  const filter = useTransform(opacity, value => `blur(${(1 - value) * blur}px)`);
  const y = useTransform(clock, [start, start + duration / 3], [travel, 0], { ease: focusEase });
  return { opacity, filter, y };
}
