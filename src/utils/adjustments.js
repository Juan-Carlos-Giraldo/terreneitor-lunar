import { estimateInitialVelocity, GRAVITY } from "./physics.js";

const FLIGHT_PHASES = new Set([2, 3, 4, 5, 6]);

export function keepLaunchAndFlight(rows) {
  const flightRows = rows.filter((row) => FLIGHT_PHASES.has(row.estado));
  if (!flightRows.length) {
    return { rows: [], removed: rows.length, startTime: null };
  }

  const startTime = flightRows[0].t;
  return {
    rows: flightRows.map((row) => ({
      ...row,
      t: row.t - startTime,
    })),
    removed: rows.length - flightRows.length,
    startTime,
  };
}

export function buildBallisticAltitudeModel(rows, gravity = GRAVITY) {
  const ascentStart = rows.find((row) => row.estado === 3);
  const apogee = rows.reduce(
    (highest, row) => (row.alt_m > highest.alt_m ? row : highest),
    rows[0],
  );
  if (!ascentStart || !apogee || apogee.t <= ascentStart.t) return null;

  const duration = apogee.t - ascentStart.t;
  const initialVelocity = estimateInitialVelocity(
    ascentStart.alt_m,
    apogee.alt_m,
    duration,
    gravity,
  );
  if (!Number.isFinite(initialVelocity)) return null;

  const modelRows = rows
    .filter((row) => row.t >= ascentStart.t)
    .map((row) => {
      const time = row.t - ascentStart.t;
      return {
        ...row,
        t: time,
        model_alt:
          ascentStart.alt_m +
          initialVelocity * time -
          0.5 * gravity * time ** 2,
      };
    });

  return {
    rows: modelRows,
    initialHeight: ascentStart.alt_m,
    finalHeight: apogee.alt_m,
    duration,
    flightDuration: modelRows[modelRows.length - 1].t,
    initialVelocity,
    startTime: ascentStart.t,
  };
}

export function integrateVerticalVelocity(
  rows,
  initialVelocity,
  restingAz,
  gravity = GRAVITY,
) {
  const ascentStartIndex = rows.findIndex((row) => row.estado === 3);
  if (
    ascentStartIndex < 0 ||
    !Number.isFinite(initialVelocity) ||
    !Number.isFinite(restingAz) ||
    Math.abs(restingAz) < 0.25 ||
    !Number.isFinite(gravity) ||
    gravity <= 0
  ) {
    return null;
  }

  const flightRows = rows.slice(ascentStartIndex);
  const axisDirection = Math.sign(restingAz);
  const netVerticalAcceleration = (row) =>
    (row.az - restingAz) * axisDirection * gravity;
  const startTime = flightRows[0].t;
  let velocity = initialVelocity;
  let previousAcceleration = netVerticalAcceleration(flightRows[0]);
  const velocityRows = [
    { ...flightRows[0], t: 0, velocity },
  ];

  for (let index = 1; index < flightRows.length; index += 1) {
    const row = flightRows[index];
    const currentAcceleration = netVerticalAcceleration(row);
    const elapsed = row.t - flightRows[index - 1].t;
    velocity += ((previousAcceleration + currentAcceleration) / 2) * elapsed;
    velocityRows.push({
      ...row,
      t: row.t - startTime,
      velocity,
    });
    previousAcceleration = currentAcceleration;
  }

  return {
    rows: velocityRows,
    initialVelocity,
    restingAz,
    axisDirection,
  };
}
