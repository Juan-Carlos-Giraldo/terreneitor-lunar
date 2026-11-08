import Card from "../components/Card.jsx";
import LineChart from "../components/LineChart.jsx";
import { formatNumber, PHASES } from "../utils/csv.js";
import {
  buildBallisticAltitudeModel,
  integrateVerticalVelocity,
  keepLaunchAndFlight,
} from "../utils/adjustments.js";

export default function ArreglosView({ data }) {
  const { rows, removed, startTime } = keepLaunchAndFlight(data.rows);
  const altitudeModel = buildBallisticAltitudeModel(rows);
  const velocityModel = altitudeModel
    ? integrateVerticalVelocity(
        rows,
        altitudeModel.initialVelocity,
        data.calibration[2].average,
      )
    : null;
  const phaseCounts = new Map();
  for (const row of rows) {
    phaseCounts.set(row.estado, (phaseCounts.get(row.estado) ?? 0) + 1);
  }

  return (
    <div
      className="stack"
      id="panel-arreglos"
      role="tabpanel"
      aria-labelledby="tab-arreglos"
    >
      <Card title="Preparación de datos · lanzamiento y vuelo">
        <p className="adjustments__intro">
          Este arreglo conserva las muestras desde IMPULSO hasta ATERRIZADO y
          excluye las fases previas. Mantiene los valores originales de altitud y
          aceleración: no suaviza señales ni elimina picos, para no alterar el
          fenómeno antes del ajuste de curvas.
        </p>
        <div className="quality-grid adjustments__stats">
          <div className="quality-stat">
            <span className="note">MUESTRAS ORIGINALES</span>
            <strong>{data.rows.length.toLocaleString("es")}</strong>
            <span>filas válidas del CSV</span>
          </div>
          <div className="quality-stat">
            <span className="note">MUESTRAS DE VUELO</span>
            <strong>{rows.length.toLocaleString("es")}</strong>
            <span>estados 2 a 6 incluidos</span>
          </div>
          <div className="quality-stat">
            <span className="note">MUESTRAS EXCLUIDAS</span>
            <strong>{removed.toLocaleString("es")}</strong>
            <span>fases previas y otros estados</span>
          </div>
        </div>
        {rows.length ? (
          <>
            <p className="note adjustments__time">
              Tiempo relativo reiniciado al comienzo de IMPULSO. En el archivo
              original ese punto ocurre en T+{formatNumber(startTime)} s.
            </p>
            <div className="adjustments__phases">
              {Array.from(phaseCounts, ([state, count]) => (
                <span className="adjustments__phase" key={state}>
                  <span>{PHASES[state] ?? `ESTADO ${state}`}</span>
                  {count.toLocaleString("es")} muestras
                </span>
              ))}
            </div>
            <div className="stack adjustments__charts">
              <Card title="Altitud · modelo de ascenso y descenso">
                <LineChart
                  rows={altitudeModel?.rows ?? rows}
                  yLabel="ALTITUD (m)"
                  xLabel={
                    altitudeModel
                      ? "TIEMPO DESDE INICIO DE ASCENSO (s)"
                      : "TIEMPO DESDE INICIO DE IMPULSO (s)"
                  }
                  series={
                    altitudeModel
                      ? [
                          {
                            key: "alt_m",
                            label: "Altitud medida (m)",
                            color: "#a9d57f",
                          },
                          {
                            key: "model_alt",
                            label: "Modelo balístico (m)",
                            color: "#e5ad5c",
                            borderDash: [6, 4],
                          },
                        ]
                      : [
                          {
                            key: "alt_m",
                            label: "Altitud (m)",
                            color: "#a9d57f",
                          },
                        ]
                  }
                />
                {altitudeModel ? (
                  <div className="adjustments__model">
                    <span className="note">
                      MODELO: y(t) = y₀ + v₀ᵧt − ½gt²
                    </span>
                    <div className="adjustments__model-values">
                      <span>
                        y₀ = {formatNumber(altitudeModel.initialHeight)} m
                      </span>
                      <span>
                        v₀ᵧ = {formatNumber(altitudeModel.initialVelocity)} m/s
                      </span>
                      <span>g = 9,81 m/s²</span>
                      <span>
                        t = {formatNumber(altitudeModel.duration)} s hasta apogeo
                      </span>
                      <span>
                        vuelo trazado ={" "}
                        {formatNumber(altitudeModel.flightDuration)} s
                      </span>
                    </div>
                    <p className="adjustments__caveat">
                      La curva teórica continúa durante todo el descenso
                      registrado. v₀ᵧ se calcula con el inicio de ASCENSO y el
                      apogeo, así que coincide con esos extremos por construcción;
                      en el descenso puede separarse por el paracaídas y el
                      rozamiento del aire. No es una regresión estadística.
                    </p>
                  </div>
                ) : (
                  <p className="note">
                    Se requieren muestras de ASCENSO y un apogeo posterior para
                    construir el modelo.
                  </p>
                )}
              </Card>
              <Card title="Aceleración y velocidad estimada">
                <LineChart
                  rows={rows}
                  yLabel="ACELERACIÓN (g)"
                  xLabel="TIEMPO DESDE INICIO DE IMPULSO (s)"
                  series={[
                    {
                      key: "a",
                      label: "|a| total (g)",
                      color: "#e5ad5c",
                    },
                    { key: "az", label: "az (g)", color: "#78b9ad" },
                  ]}
                />
                <div className="adjustments__model">
                  <span className="note">
                    VELOCIDAD ESTIMADA · INTEGRACIÓN DE az
                  </span>
                  {velocityModel ? (
                    <>
                      <p className="adjustments__caveat">
                        Se inicia con v₀ᵧ ={" "}
                        {formatNumber(velocityModel.initialVelocity)} m/s del
                        modelo de altura. La aceleración vertical aproximada es
                        (az − az en ARMADO) × orientación × 9,81; se integra
                        numéricamente por trapecios.
                      </p>
                      <LineChart
                        rows={velocityModel.rows}
                        yLabel="VELOCIDAD VERTICAL (m/s)"
                        xLabel="TIEMPO DESDE INICIO DE ASCENSO (s)"
                        series={[
                          {
                            key: "velocity",
                            label: "Velocidad integrada (m/s)",
                            color: "#e5ad5c",
                          },
                        ]}
                      />
                      <div className="adjustments__model-values">
                        <span>
                          az de reposo usado:{" "}
                          {formatNumber(velocityModel.restingAz, 3)} g
                        </span>
                        <span>
                          velocidad final estimada:{" "}
                          {formatNumber(velocityModel.rows.at(-1)?.velocity)} m/s
                        </span>
                      </div>
                      <p className="adjustments__caveat">
                        Es una hipótesis: supone que el eje Z conserva su
                        orientación vertical durante el vuelo. Si el cohete rota,
                        la integración de az no representa la aceleración
                        vertical real.
                      </p>
                    </>
                  ) : (
                    <p className="adjustments__caveat">
                      No se puede estimar la velocidad: se necesita una velocidad
                      inicial válida y una referencia az de ARMADO claramente
                      alineada con la vertical.
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </>
        ) : (
          <p className="note">
            El CSV no contiene muestras en las fases IMPULSO, ASCENSO, APOGEO,
            DESCENSO o ATERRIZADO.
          </p>
        )}
        <p className="physics__caveat adjustments__note">
          Esta es una selección por fase, no un filtro de ruido de sensor. El
          giroscopio queda fuera de este módulo. La curva de altitud aplica el
          modelo balístico; la velocidad desde aceleración es una integración
          aproximada sujeta a la orientación del sensor.
        </p>
      </Card>
    </div>
  );
}
