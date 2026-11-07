import Card from "../components/Card.jsx";
import { FLAGS, formatNumber, mean, PHASES } from "../utils/csv.js";
import {
  averageVerticalVelocity,
  estimateInitialVelocity,
  GRAVITY,
} from "../utils/physics.js";

function MetricTable({ rows }) {
  return (
    <div className="scroll">
      <table>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalisisView({ data }) {
  const { rows, phases, ascents, impulses } = data;
  const ascentStart = phases.find((phase) => phase.estado === 3)?.inicio;
  const last = rows[rows.length - 1];
  const descentDuration = last.t - data.apogee.t;
  const descentSpeed =
    descentDuration > 0
      ? (data.apogee.alt_m - last.alt_m) / descentDuration
      : NaN;
  const ascentStartRow = rows.find((row) => row.estado === 3);
  const ascentDuration = ascentStartRow
    ? data.apogee.t - ascentStartRow.t
    : NaN;
  const ascentAverageVelocity = ascentStartRow
    ? averageVerticalVelocity(
        ascentStartRow.alt_m,
        data.apogee.alt_m,
        ascentDuration,
      )
    : NaN;
  const ascentInitialVelocity = ascentStartRow
    ? estimateInitialVelocity(
        ascentStartRow.alt_m,
        data.apogee.alt_m,
        ascentDuration,
      )
    : NaN;
  const batteryMin = Math.min(...data.battery);
  const batteryMax = Math.max(...data.battery);
  const flagRows = [...data.flags.entries()].sort((a, b) => b[1] - a[1]);
  const impulsePeak = impulses.reduce(
    (peak, row) => (row.a > peak.a ? row : peak),
    impulses[0],
  );
  const maxAbsAxis = (key) =>
    ascents.length
      ? Math.max(...ascents.map((row) => Math.abs(row[key])))
      : NaN;
  const restingAcceleration = Math.hypot(
    ...data.calibration.slice(0, 3).map((axis) => axis.average),
  );
  const limitations = [];

  if (last.estado !== 6) {
    limitations.push(
      `La captura termina en ${PHASES[last.estado] ?? `estado ${last.estado}`}, no en estado ATERRIZADO.`,
    );
  }
  if (batteryMax - batteryMin < 0.01) {
    limitations.push(
      `vbat es prácticamente constante (${formatNumber(batteryMin)} V); conviene revisar el ADC y el divisor de tensión.`,
    );
  }
  if (data.hasRest && Math.abs(restingAcceleration - 1) > 0.1) {
    limitations.push(
      "La aceleración en reposo difiere de 1 g; puede requerir calibración de offset.",
    );
  }
  if (data.lost > 0) {
    limitations.push(
      "Hay huecos en la secuencia de paquetes; contrasta la captura con el registro del dispositivo.",
    );
  }
  if (!limitations.length) {
    limitations.push("No se detectaron limitaciones evidentes en las métricas revisadas.");
  }

  const qualityRows = flagRows.map(([flag, count]) => {
    const description = Object.entries(FLAGS)
      .filter(([bit]) => flag & Number(bit))
      .map(([, label]) => label)
      .join(", ");
    return [String(flag), description || "Todo normal", count.toLocaleString("es")];
  });

  return (
    <div
      className="stack"
      id="panel-analisis"
      role="tabpanel"
      aria-labelledby="tab-analisis"
    >
      <Card title="Calidad de los datos">
        <div className="quality-grid">
          <div className="quality-stat">
            <span className="note">PAQUETES PERDIDOS</span>
            <strong>{data.lost.toLocaleString("es")}</strong>
            <span>de {data.expected.toLocaleString("es")} · seq {data.seqMin}—{data.seqMax}</span>
          </div>
          <div className="quality-stat">
            <span className="note">INTERVALO DE MUESTREO</span>
            <strong>
              {formatNumber(Math.min(...data.intervals), 1)}
              <small>—</small>
              {formatNumber(Math.max(...data.intervals), 1)} ms
            </strong>
            <span>media {formatNumber(mean(data.intervals), 1)} ms</span>
          </div>
          <div className="quality-stat">
            <span className="note">VOLTAJE DE BATERÍA</span>
            <strong>
              {formatNumber(batteryMin)}—{formatNumber(batteryMax)} V
            </strong>
            <span>{batteryMax - batteryMin < 0.01 ? "REVISAR SENSOR" : "RANGO VARIABLE"}</span>
          </div>
        </div>
        {data.duplicates > 0 && (
          <p className="warn">
            Atención: se detectaron {data.duplicates.toLocaleString("es")} muestras con secuencia duplicada.
          </p>
        )}
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Flags</th>
                <th>Significado</th>
                <th>Muestras</th>
              </tr>
            </thead>
            <tbody>
              {qualityRows.map(([flag, description, count]) => (
                <tr key={flag}>
                  <td>{flag}</td>
                  <td>{description}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 className="subheading">Limitaciones detectadas</h2>
        <ul className="limitations">
          {limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </Card>

      <div className="grid2">
        <Card title="Análisis de altura durante vuelo">
          <MetricTable
            rows={[
              ["Altura máxima", `${formatNumber(data.apogee.alt_m)} m`],
              ["Instante del apogeo", `${formatNumber(data.apogee.t)} s`],
              [
                "Inicio de ascenso",
                ascentStart == null ? "—" : `${formatNumber(ascentStart)} s`,
              ],
              [
                "Tiempo de ascenso",
                ascentStart == null
                  ? "—"
                  : `${formatNumber(data.apogee.t - ascentStart)} s`,
              ],
              ["Velocidad media de descenso", `${formatNumber(descentSpeed)} m/s`],
            ]}
          />
        </Card>
        <Card title="Aceleración durante despegue">
          {impulses.length ? (
            <MetricTable
              rows={[
                ["Inicio de impulso", `${formatNumber(impulses[0].t)} s`],
                [
                  "Duración de impulso",
                  `${formatNumber(impulses[impulses.length - 1].t - impulses[0].t)} s`,
                ],
                [
                  "Pico de |a| en impulso",
                  `${formatNumber(impulsePeak.a)} g · T+${formatNumber(impulsePeak.t)} s`,
                ],
                ["|a| media en impulso", `${formatNumber(mean(impulses.map((row) => row.a)))} g`],
                [
                  "Pico global de |a|",
                  `${formatNumber(data.maxAcceleration.a)} g · estado ${data.maxAcceleration.estado}`,
                ],
              ]}
            />
          ) : (
            <p className="note">Sin muestras en fase IMPULSO.</p>
          )}
        </Card>
      </div>

      <div className="grid2">
        <Card title="Lanzamiento vertical · velocidad inicial">
          <div className="physics">
            <div
              className="physics__formula"
              aria-label="Velocidad inicial despejada de la ecuación de lanzamiento vertical"
            >
              <span>v₀ =</span>
              <span className="physics__fraction">
                <span>h<sub>f</sub> − h<sub>0</sub> + ½ g t²</span>
                <span>t</span>
              </span>
            </div>
            <p className="physics__explanation">
              Despeje directo de h = h₀ + v₀t − ½gt². Se evalúa desde la primera
              muestra en ASCENSO hasta el apogeo, con g ={" "}
              {formatNumber(GRAVITY, 2)} m/s².
            </p>
          </div>
          {ascentStartRow && ascentDuration > 0 ? (
            <div className="physics__results physics__results--single">
              <div className="physics__result">
                <span className="note">ALTURA INICIAL · ASCENSO</span>
                <strong>{formatNumber(ascentStartRow.alt_m)} m</strong>
              </div>
              <div className="physics__result">
                <span className="note">ALTURA FINAL · APOGEO</span>
                <strong>{formatNumber(data.apogee.alt_m)} m</strong>
              </div>
              <div className="physics__result">
                <span className="note">TIEMPO TRANSCURRIDO</span>
                <strong>{formatNumber(ascentDuration)} s</strong>
              </div>
              <div className="physics__result physics__result--prediction">
                <span className="note">VELOCIDAD INICIAL ESTIMADA · v₀</span>
                <strong>{formatNumber(ascentInitialVelocity)} m/s</strong>
                <span>
                  ({formatNumber(data.apogee.alt_m)} −{" "}
                  {formatNumber(ascentStartRow.alt_m)} + ½ ×{" "}
                  {formatNumber(GRAVITY, 2)} × {formatNumber(ascentDuration)}²) /{" "}
                  {formatNumber(ascentDuration)}
                </span>
              </div>
            </div>
          ) : (
            <p className="note">
              No hay un intervalo válido entre el inicio de ASCENSO y el apogeo.
            </p>
          )}
          <p className="physics__caveat">
            Modelo ideal: aceleración constante de −g, sin resistencia del aire.
            La velocidad estimada corresponde al comienzo del tramo medido.
          </p>
        </Card>

        <Card title="Velocidad promedio · desplazamiento / tiempo">
          <div className="physics">
            <div
              className="physics__formula"
              aria-label="Fórmula de velocidad promedio"
            >
              <span>v̄ =</span>
              <span className="physics__fraction">
                <span>h<sub>f</sub> − h<sub>0</sub></span>
                <span>t</span>
              </span>
            </div>
            <p className="physics__explanation">
              Cálculo independiente: cambio de altura dividido por el tiempo
              transcurrido. No incluye gravedad ni estima la velocidad inicial.
            </p>
          </div>
          {ascentStartRow && ascentDuration > 0 ? (
            <div className="physics__results physics__results--single">
              <div className="physics__result">
                <span className="note">ALTURA INICIAL · ASCENSO</span>
                <strong>{formatNumber(ascentStartRow.alt_m)} m</strong>
              </div>
              <div className="physics__result">
                <span className="note">ALTURA FINAL · APOGEO</span>
                <strong>{formatNumber(data.apogee.alt_m)} m</strong>
              </div>
              <div className="physics__result">
                <span className="note">TIEMPO TRANSCURRIDO</span>
                <strong>{formatNumber(ascentDuration)} s</strong>
              </div>
              <div className="physics__result physics__result--average">
                <span className="note">VELOCIDAD PROMEDIO · v̄</span>
                <strong>{formatNumber(ascentAverageVelocity)} m/s</strong>
                <span>
                  ({formatNumber(data.apogee.alt_m)} −{" "}
                  {formatNumber(ascentStartRow.alt_m)}) /{" "}
                  {formatNumber(ascentDuration)}
                </span>
              </div>
            </div>
          ) : (
            <p className="note">
              No hay un intervalo válido para calcular la velocidad promedio.
            </p>
          )}
        </Card>
      </div>

      <div className="grid2">
        <Card title="Calibración en reposo">
          {data.hasRest ? (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Eje</th>
                    <th>Media (g)</th>
                    <th>Mínimo</th>
                    <th>Máximo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.calibration
                    .filter((item) => item.key.startsWith("a"))
                    .map((item) => (
                      <tr key={item.key}>
                        <td>{item.key}</td>
                        <td>{formatNumber(item.average, 3)}</td>
                        <td>{formatNumber(item.min, 3)}</td>
                        <td>{formatNumber(item.max, 3)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="note">No hay muestras en fase ARMADO.</p>
          )}
        </Card>
        <Card title="Giroscopio durante ascenso">
          {ascents.length ? (
            <MetricTable
              rows={[
                ["Máx. |gx| en ascenso", `${formatNumber(maxAbsAxis("gx"), 0)} °/s`],
                ["Máx. |gy| en ascenso", `${formatNumber(maxAbsAxis("gy"), 0)} °/s`],
                ["Máx. |gz| en ascenso", `${formatNumber(maxAbsAxis("gz"), 0)} °/s`],
                [
                  "Máx. |g| total en ascenso",
                  `${formatNumber(Math.max(...ascents.map((row) => row.g)), 0)} °/s`,
                ],
              ]}
            />
          ) : (
            <p className="note">Sin muestras en fase ASCENSO.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
