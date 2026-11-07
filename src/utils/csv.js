import Papa from "papaparse";

export const PHASES = [
  "ARMADO",
  "LISTO",
  "IMPULSO",
  "ASCENSO",
  "APOGEO",
  "DESCENSO",
  "ATERRIZADO",
];

export const FLAGS = {
  1: "Acelerómetro saturado (16 g)",
  2: "Impacto",
  4: "Falla de sensor",
  8: "Paracaídas abierto",
};

const NUMERIC_COLUMNS = [
  "t_ms",
  "seq",
  "estado",
  "alt_m",
  "ax",
  "ay",
  "az",
  "gx",
  "gy",
  "gz",
  "flags",
  "vbat",
];

export const formatNumber = (value, digits = 2) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("es", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value)
    : "—";

export const mean = (values) =>
  values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : NaN;

export function parseCSV(text) {
  const result = Papa.parse(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  });

  const headers = result.meta.fields ?? [];
  const missing = NUMERIC_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) {
    throw new Error(`faltan columnas requeridas: ${missing.join(", ")}.`);
  }

  const fieldMismatchRows = new Set(
    result.errors
      .filter(
        (error) =>
          error.code === "TooFewFields" || error.code === "TooManyFields",
      )
      .map((error) => error.row),
  );
  const fatalError = result.errors.find(
    (error) => error.code !== "TooFewFields" && error.code !== "TooManyFields",
  );
  if (fatalError) {
    throw new Error(
      `CSV inválido en la fila ${fatalError.row + 1}: ${fatalError.message}`,
    );
  }

  const rows = [];
  let skipped = 0;
  for (const [index, source] of result.data.entries()) {
    if (fieldMismatchRows.has(index)) {
      skipped += 1;
      continue;
    }

    const row = {};
    for (const column of NUMERIC_COLUMNS) {
      row[column] = Number(source[column]);
    }
    row.hora_pc = source.hora_pc ?? "";

    if (
      NUMERIC_COLUMNS.every((column) => Number.isFinite(row[column])) &&
      Number.isInteger(row.seq) &&
      Number.isInteger(row.estado) &&
      Number.isInteger(row.flags)
    ) {
      rows.push(row);
    } else {
      skipped += 1;
    }
  }

  if (rows.length < 2) {
    throw new Error("el archivo debe contener al menos dos filas válidas de telemetría.");
  }

  return { rows, skipped };
}

export function analyze(inputRows) {
  const sortedRows = [...inputRows].sort((a, b) => a.t_ms - b.t_ms);
  const startTime = sortedRows[0].t_ms;
  const rows = sortedRows.map((row) => ({
    ...row,
    t: (row.t_ms - startTime) / 1000,
    a: Math.hypot(row.ax, row.ay, row.az),
    g: Math.hypot(row.gx, row.gy, row.gz),
  }));

  const sequences = rows.map((row) => row.seq);
  const seqMin = Math.min(...sequences);
  const seqMax = Math.max(...sequences);
  const expected = seqMax - seqMin + 1;
  const received = new Set(sequences).size;
  const lost = Math.max(0, expected - received);
  const duplicates = rows.length - received;
  const intervals = rows.slice(1).map((row, index) => row.t_ms - rows[index].t_ms);

  const phases = [];
  for (const row of rows) {
    let phase = phases[phases.length - 1];
    if (!phase || phase.estado !== row.estado) {
      phase = { estado: row.estado, inicio: row.t, fin: row.t, n: 0 };
      phases.push(phase);
    }
    phase.fin = row.t;
    phase.n += 1;
  }

  const apogee = rows.reduce(
    (maximum, row) => (row.alt_m > maximum.alt_m ? row : maximum),
    rows[0],
  );
  const maxAcceleration = rows.reduce(
    (maximum, row) => (row.a > maximum.a ? row : maximum),
    rows[0],
  );
  const maxGyroscope = rows.reduce(
    (maximum, row) => (row.g > maximum.g ? row : maximum),
    rows[0],
  );

  const flags = new Map();
  for (const row of rows) {
    flags.set(row.flags, (flags.get(row.flags) ?? 0) + 1);
  }

  const atRest = rows.filter((row) => row.estado === 0);
  const calibration = ["ax", "ay", "az", "gx", "gy", "gz"].map((key) => {
    const values = atRest.map((row) => row[key]);
    return {
      key,
      average: mean(values),
      min: values.length ? Math.min(...values) : NaN,
      max: values.length ? Math.max(...values) : NaN,
    };
  });
  const battery = rows.map((row) => row.vbat);
  const ascents = rows.filter((row) => row.estado === 3);
  const impulses = rows.filter((row) => row.estado === 2);

  return {
    rows,
    seqMin,
    seqMax,
    expected,
    received,
    lost,
    duplicates,
    intervals,
    phases,
    apogee,
    maxAcceleration,
    maxGyroscope,
    battery,
    flags,
    calibration,
    duration: rows[rows.length - 1].t,
    date: rows[0].hora_pc,
    hasRest: atRest.length > 0,
    ascents,
    impulses,
  };
}
