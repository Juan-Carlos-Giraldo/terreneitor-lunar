export const GRAVITY = 9.81;

export function averageVerticalVelocity(initialHeight, finalHeight, time) {
  if (
    !Number.isFinite(initialHeight) ||
    !Number.isFinite(finalHeight) ||
    !Number.isFinite(time) ||
    time <= 0
  ) {
    return NaN;
  }
  return (finalHeight - initialHeight) / time;
}

export function estimateInitialVelocity(
  initialHeight,
  finalHeight,
  time,
  gravity = GRAVITY,
) {
  if (
    !Number.isFinite(initialHeight) ||
    !Number.isFinite(finalHeight) ||
    !Number.isFinite(time) ||
    time <= 0 ||
    !Number.isFinite(gravity) ||
    gravity < 0
  ) {
    return NaN;
  }
  return (finalHeight - initialHeight + 0.5 * gravity * time ** 2) / time;
}
